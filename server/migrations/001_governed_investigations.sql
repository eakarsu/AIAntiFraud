BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE users SET tenant_id='default' WHERE tenant_id IS NULL;
ALTER TABLE users ALTER COLUMN tenant_id SET DEFAULT 'default';
ALTER TABLE users ALTER COLUMN tenant_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS fraud_users_id_tenant_uidx ON users(id, tenant_id);
CREATE TABLE IF NOT EXISTS governed_investigations (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'ingested' CHECK (state IN ('ingested','scored','assigned','dismissed','disposed')),
  normalized_transaction JSONB NOT NULL,
  score INTEGER CHECK (score BETWEEN 0 AND 100),
  score_reasons JSONB NOT NULL DEFAULT '[]',
  model_version TEXT,
  disposition TEXT,
  created_by INTEGER NOT NULL,
  assigned_to INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, external_id),
  UNIQUE(id, tenant_id),
  FOREIGN KEY (created_by, tenant_id) REFERENCES users(id, tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (assigned_to, tenant_id) REFERENCES users(id, tenant_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS governed_investigations_queue_idx ON governed_investigations(tenant_id,state,score DESC);
CREATE TABLE IF NOT EXISTS governed_investigation_events (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  investigation_id BIGINT NOT NULL,
  actor_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  from_state TEXT,
  to_state TEXT,
  rationale TEXT,
  evidence JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (investigation_id, tenant_id) REFERENCES governed_investigations(id, tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (actor_id, tenant_id) REFERENCES users(id, tenant_id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS fraud_provider_outbox (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('bank_feed','sanctions_pep','case_management','regulatory_reporting')),
  operation TEXT NOT NULL,
  payload_reference TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','delivering','delivered','failed','dead_letter')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id,provider,idempotency_key)
);
CREATE TABLE IF NOT EXISTS fraud_evaluation_runs (
  id BIGSERIAL PRIMARY KEY, tenant_id TEXT NOT NULL, created_by INTEGER NOT NULL,
  cohort_reference TEXT NOT NULL, model_version TEXT NOT NULL, metrics JSONB NOT NULL,
  labelled_count INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (created_by, tenant_id) REFERENCES users(id, tenant_id) ON DELETE RESTRICT
);
CREATE OR REPLACE FUNCTION reject_fraud_event_mutation() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'governed_investigation_events is append-only'; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS fraud_events_append_only ON governed_investigation_events;
CREATE TRIGGER fraud_events_append_only BEFORE UPDATE OR DELETE ON governed_investigation_events FOR EACH ROW EXECUTE FUNCTION reject_fraud_event_mutation();
COMMIT;
