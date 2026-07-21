-- Anti-Fraud & Credit Analysis Engine - Database Schema v2
-- Run with: psql $DATABASE_URL -f server/schema.sql

BEGIN;

-- Drop existing tables in reverse dependency order
DROP TABLE IF EXISTS case_notes CASCADE;
DROP TABLE IF EXISTS chargebacks CASCADE;
DROP TABLE IF EXISTS cases CASCADE;
DROP TABLE IF EXISTS ai_results CASCADE;
DROP TABLE IF EXISTS transaction_risk_scores CASCADE;
DROP TABLE IF EXISTS rule_suggestions CASCADE;
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS behavioral_patterns CASCADE;
DROP TABLE IF EXISTS merchant_risk_profiles CASCADE;
DROP TABLE IF EXISTS fraud_alerts CASCADE;
DROP TABLE IF EXISTS credit_scores CASCADE;
DROP TABLE IF EXISTS risk_models CASCADE;
DROP TABLE IF EXISTS watchlist CASCADE;
DROP TABLE IF EXISTS fraud_rules CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop custom types
DROP TYPE IF EXISTS transaction_status CASCADE;
DROP TYPE IF EXISTS alert_status CASCADE;
DROP TYPE IF EXISTS alert_severity CASCADE;
DROP TYPE IF EXISTS rule_action CASCADE;
DROP TYPE IF EXISTS rule_severity CASCADE;
DROP TYPE IF EXISTS risk_level_enum CASCADE;
DROP TYPE IF EXISTS model_status CASCADE;
DROP TYPE IF EXISTS entity_type_enum CASCADE;
DROP TYPE IF EXISTS case_status CASCADE;
DROP TYPE IF EXISTS chargeback_status CASCADE;

-- Create custom ENUM types
CREATE TYPE transaction_status AS ENUM ('approved', 'blocked', 'flagged', 'pending');
CREATE TYPE alert_status AS ENUM ('open', 'investigating', 'resolved', 'dismissed');
CREATE TYPE alert_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE rule_action AS ENUM ('block', 'flag', 'alert');
CREATE TYPE rule_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE risk_level_enum AS ENUM ('very_low', 'low', 'medium', 'high', 'very_high');
CREATE TYPE model_status AS ENUM ('training', 'active', 'inactive', 'archived');
CREATE TYPE entity_type_enum AS ENUM ('individual', 'organization');
CREATE TYPE case_status AS ENUM ('open', 'investigating', 'submitted', 'resolved', 'closed');
CREATE TYPE chargeback_status AS ENUM ('filed', 'evidence_period', 'pending_decision', 'won', 'lost', 'withdrawn');

-- users table
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(255) NOT NULL,
  role          VARCHAR(50) NOT NULL DEFAULT 'analyst' CHECK (role IN ('admin', 'analyst', 'reviewer')),
  tenant_id     TEXT NOT NULL DEFAULT 'default',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- transactions table
CREATE TABLE transactions (
  id                    SERIAL PRIMARY KEY,
  user_id               INTEGER REFERENCES users(id) ON DELETE SET NULL,
  amount                DECIMAL(15, 2) NOT NULL,
  currency              VARCHAR(10) NOT NULL DEFAULT 'USD',
  merchant_name         VARCHAR(255) NOT NULL,
  merchant_category     VARCHAR(100),
  card_number_last4     CHAR(4),
  ip_address            INET,
  location_country      VARCHAR(100),
  location_city         VARCHAR(100),
  device_id             VARCHAR(255),
  is_online             BOOLEAN NOT NULL DEFAULT FALSE,
  status                transaction_status NOT NULL DEFAULT 'pending',
  risk_score            DECIMAL(5, 2) CHECK (risk_score >= 0 AND risk_score <= 100),
  fraud_confirmed       BOOLEAN NOT NULL DEFAULT FALSE,
  rule_triggered_id     INTEGER,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX idx_transactions_risk_score ON transactions(risk_score DESC);
CREATE INDEX idx_transactions_fraud_confirmed ON transactions(fraud_confirmed);
CREATE INDEX idx_transactions_merchant_name ON transactions(merchant_name);
CREATE INDEX idx_transactions_device_id ON transactions(device_id);

-- fraud_rules table
CREATE TABLE fraud_rules (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  rule_type       VARCHAR(100) NOT NULL,
  condition_json  JSONB NOT NULL DEFAULT '{}',
  action          rule_action NOT NULL DEFAULT 'flag',
  severity        rule_severity NOT NULL DEFAULT 'medium',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  hit_count       INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fraud_rules_is_active ON fraud_rules(is_active);
CREATE INDEX idx_fraud_rules_severity ON fraud_rules(severity);

-- fraud_alerts table
CREATE TABLE fraud_alerts (
  id              SERIAL PRIMARY KEY,
  transaction_id  INTEGER REFERENCES transactions(id) ON DELETE CASCADE,
  rule_id         INTEGER REFERENCES fraud_rules(id) ON DELETE SET NULL,
  alert_type      VARCHAR(100) NOT NULL,
  severity        alert_severity NOT NULL DEFAULT 'medium',
  description     TEXT,
  status          alert_status NOT NULL DEFAULT 'open',
  assigned_to     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fraud_alerts_transaction_id ON fraud_alerts(transaction_id);
CREATE INDEX idx_fraud_alerts_status ON fraud_alerts(status);
CREATE INDEX idx_fraud_alerts_severity ON fraud_alerts(severity);
CREATE INDEX idx_fraud_alerts_created_at ON fraud_alerts(created_at DESC);

-- credit_scores table
CREATE TABLE credit_scores (
  id                        SERIAL PRIMARY KEY,
  customer_name             VARCHAR(255) NOT NULL,
  customer_email            VARCHAR(255),
  ssn_last4                 CHAR(4),
  credit_score              INTEGER CHECK (credit_score >= 300 AND credit_score <= 850),
  risk_level                risk_level_enum NOT NULL DEFAULT 'medium',
  income                    DECIMAL(15, 2),
  debt_to_income            DECIMAL(5, 2),
  payment_history_score     DECIMAL(5, 2),
  credit_utilization        DECIMAL(5, 2),
  account_age_months        INTEGER,
  num_accounts              INTEGER,
  num_late_payments         INTEGER,
  loan_amount_requested     DECIMAL(15, 2),
  loan_purpose              VARCHAR(255),
  ai_recommendation         TEXT,
  ai_risk_analysis          JSONB,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credit_scores_customer_email ON credit_scores(customer_email);
CREATE INDEX idx_credit_scores_risk_level ON credit_scores(risk_level);
CREATE INDEX idx_credit_scores_credit_score ON credit_scores(credit_score);

-- risk_models table
CREATE TABLE risk_models (
  id                SERIAL PRIMARY KEY,
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  model_type        VARCHAR(100) NOT NULL,
  accuracy          DECIMAL(5, 4),
  precision_score   DECIMAL(5, 4),
  recall_score      DECIMAL(5, 4),
  f1_score          DECIMAL(5, 4),
  status            model_status NOT NULL DEFAULT 'inactive',
  last_trained_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_risk_models_status ON risk_models(status);

-- watchlist table
CREATE TABLE watchlist (
  id            SERIAL PRIMARY KEY,
  entity_name   VARCHAR(255) NOT NULL,
  entity_type   entity_type_enum NOT NULL DEFAULT 'individual',
  identifier    VARCHAR(255),
  reason        TEXT,
  risk_level    risk_level_enum NOT NULL DEFAULT 'high',
  source        VARCHAR(255),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  added_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_watchlist_entity_name ON watchlist(entity_name);
CREATE INDEX idx_watchlist_is_active ON watchlist(is_active);
CREATE INDEX idx_watchlist_risk_level ON watchlist(risk_level);

-- audit_log table
CREATE TABLE audit_log (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action        VARCHAR(100) NOT NULL,
  entity_type   VARCHAR(100),
  entity_id     INTEGER,
  details_json  JSONB DEFAULT '{}',
  ip_address    INET,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_entity_type ON audit_log(entity_type);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);

-- behavioral_patterns table
CREATE TABLE behavioral_patterns (
  id                        SERIAL PRIMARY KEY,
  customer_id               VARCHAR(255) NOT NULL,
  pattern_type              VARCHAR(100) NOT NULL,
  avg_transaction_amount    DECIMAL(15, 2),
  max_transaction_amount    DECIMAL(15, 2),
  typical_locations         JSONB DEFAULT '[]',
  typical_times             JSONB DEFAULT '{}',
  device_fingerprints       JSONB DEFAULT '[]',
  anomaly_score             DECIMAL(5, 2) CHECK (anomaly_score >= 0 AND anomaly_score <= 100),
  last_updated              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_behavioral_patterns_customer_id ON behavioral_patterns(customer_id);
CREATE INDEX idx_behavioral_patterns_anomaly_score ON behavioral_patterns(anomaly_score DESC);

-- merchant_risk_profiles table
CREATE TABLE merchant_risk_profiles (
  id                        SERIAL PRIMARY KEY,
  merchant_name             VARCHAR(255) NOT NULL,
  merchant_category         VARCHAR(100),
  risk_score                DECIMAL(5, 2) CHECK (risk_score >= 0 AND risk_score <= 100),
  chargeback_rate           DECIMAL(5, 4),
  fraud_incident_count      INTEGER NOT NULL DEFAULT 0,
  avg_transaction_amount    DECIMAL(15, 2),
  country                   VARCHAR(100),
  is_flagged                BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_merchant_risk_merchant_name ON merchant_risk_profiles(merchant_name);
CREATE INDEX idx_merchant_risk_is_flagged ON merchant_risk_profiles(is_flagged);
CREATE INDEX idx_merchant_risk_risk_score ON merchant_risk_profiles(risk_score DESC);

-- ai_results table — persists every AI call
CREATE TABLE ai_results (
  id            SERIAL PRIMARY KEY,
  endpoint      VARCHAR(100) NOT NULL,
  entity_type   VARCHAR(100),
  entity_id     INTEGER,
  input_data    JSONB,
  result        JSONB NOT NULL,
  model_used    VARCHAR(255),
  user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_results_endpoint ON ai_results(endpoint);
CREATE INDEX idx_ai_results_entity ON ai_results(entity_type, entity_id);
CREATE INDEX idx_ai_results_created_at ON ai_results(created_at DESC);

-- transaction_risk_scores table
CREATE TABLE transaction_risk_scores (
  id                  SERIAL PRIMARY KEY,
  transaction_id      INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  user_id             INTEGER REFERENCES users(id) ON DELETE SET NULL,
  risk_score          INTEGER NOT NULL,
  risk_factors        JSONB NOT NULL DEFAULT '[]',
  auto_alert_created  BOOLEAN NOT NULL DEFAULT FALSE,
  model_used          VARCHAR(255),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trs_transaction_id ON transaction_risk_scores(transaction_id);
CREATE INDEX idx_trs_created_at ON transaction_risk_scores(created_at DESC);

-- rule_suggestions table — AI-suggested fraud rules
CREATE TABLE rule_suggestions (
  id              SERIAL PRIMARY KEY,
  suggested_by_ai VARCHAR(255) NOT NULL DEFAULT 'anthropic/claude-3-5-sonnet-20241022',
  rule_data       JSONB NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  reviewed_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rule_suggestions_status ON rule_suggestions(status);

-- cases table — fraud investigation case management
CREATE TABLE cases (
  id              SERIAL PRIMARY KEY,
  title           VARCHAR(500) NOT NULL,
  description     TEXT,
  status          case_status NOT NULL DEFAULT 'open',
  priority        rule_severity NOT NULL DEFAULT 'medium',
  assigned_to     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  alert_id        INTEGER REFERENCES fraud_alerts(id) ON DELETE SET NULL,
  transaction_id  INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_assigned_to ON cases(assigned_to);
CREATE INDEX idx_cases_created_at ON cases(created_at DESC);

-- case_notes table
CREATE TABLE case_notes (
  id          SERIAL PRIMARY KEY,
  case_id     INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  note        TEXT NOT NULL,
  note_type   VARCHAR(50) NOT NULL DEFAULT 'comment' CHECK (note_type IN ('comment', 'evidence', 'decision', 'status_change')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_case_notes_case_id ON case_notes(case_id);

-- chargebacks table
CREATE TABLE chargebacks (
  id              SERIAL PRIMARY KEY,
  transaction_id  INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  alert_id        INTEGER REFERENCES fraud_alerts(id) ON DELETE SET NULL,
  customer_name   VARCHAR(255) NOT NULL,
  amount          DECIMAL(15, 2) NOT NULL,
  reason_code     VARCHAR(100),
  reason_text     TEXT,
  status          chargeback_status NOT NULL DEFAULT 'filed',
  filed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  evidence_due    TIMESTAMPTZ,
  decision_at     TIMESTAMPTZ,
  ai_recommendation TEXT,
  ai_outcome_prediction JSONB,
  assigned_to     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chargebacks_status ON chargebacks(status);
CREATE INDEX idx_chargebacks_transaction_id ON chargebacks(transaction_id);
CREATE INDEX idx_chargebacks_created_at ON chargebacks(created_at DESC);

-- Trigger: auto-update credit_scores.updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_credit_scores_updated_at
  BEFORE UPDATE ON credit_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_cases_updated_at
  BEFORE UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_chargebacks_updated_at
  BEFORE UPDATE ON chargebacks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger: auto-update behavioral_patterns.last_updated
CREATE OR REPLACE FUNCTION update_last_updated_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_behavioral_patterns_last_updated
  BEFORE UPDATE ON behavioral_patterns
  FOR EACH ROW EXECUTE FUNCTION update_last_updated_column();

COMMIT;
