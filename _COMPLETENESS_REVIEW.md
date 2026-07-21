# Completeness Review: AIAntiFraud

- **Review date:** 2026-07-18
- **Assessment basis:** Static source and configuration inspection only. Dependencies were not installed, and no build, database migration, external integration, or runtime workflow was executed.

## Classification

**Prototype-demo**

## Verdict

The repository presents a broad financial crime monitoring surface (76 source files and 31 route modules), but the static evidence is characteristic of a generated prototype. Pages and endpoints demonstrate concepts; they do not establish a verified execution path for ingest normalized transactions, score typologies, create cases, and record analyst dispositions.

## Why it is not complete

- 21 files are explicitly named as gap/gap-feature implementations; route/page count therefore overstates completed product capability.
- 24 files reference model-provider or chat-completion behavior; these generic LLM paths are not a substitute for deterministic domain execution, grounding, or evaluation.
- 20 files contain mock, sample, placeholder, or random-data signals, leaving important outcomes disconnected from authoritative systems.
- No recognizable application test files were found in the inspected tree.
- No CI workflow was found to continuously verify builds, tests, migrations, or security checks.
- No environment example/template was found, so required configuration and secret boundaries are undocumented.

## Needed features

- 1. Implement a workflow to ingest normalized transactions, score typologies, create cases, and record analyst dispositions.
- 2. Connect banking feeds, sanctions/PEP data, case management, and regulatory reporting; replace seed/demo records with durable, synchronized data and explicit failure handling.
- 3. Backtest alert quality, drift, false positives, and explanation stability.
- 4. Enforce segregation of duties, immutable audit logs, privacy, and human disposition.
- 5. Add contract, integration, authorization, migration, and end-to-end tests in CI, plus a documented non-destructive deployment/run path.

## Risks or launch blockers

- Credential/secret fallback or demo-password patterns occur in 3 files and must be removed or made development-only.
- TLS certificate verification is disabled in inspected code; this is a release blocker.
- The root launcher can terminate unrelated processes occupying configured ports.
- The root launcher seeds, creates, migrates, or otherwise mutates database state during startup.
- The root launcher installs dependencies at run time, reducing reproducibility and expanding supply-chain risk.
- Ungrounded or malformed model output can become a domain action unless schemas, evidence, evaluations, and approval gates are added.

## Evidence inspected

- `client/package.json` — declared scripts, runtime dependencies, and application boundaries.
- `package.json` — declared scripts, runtime dependencies, and application boundaries.
- `server/index.js` — service composition, middleware, and registered routes.
- `server/routes/ai.js` — implemented API surface and domain/AI request handling.
- `server/routes/analytics.js` — implemented API surface and domain/AI request handling.
- `server/routes/auditLog.js` — implemented API surface and domain/AI request handling.

## Recommended next action

Treat this as a prototype: select one narrow financial crime monitoring outcome, remove or quarantine generated gap routes, and implement that outcome end to end with real data, deterministic rules, and tests before adding features.

## Implementation progress

**Local status (2026-07-18): implemented; regulated integrations and validation remain blocked.**

1. `server/routes/governedInvestigations.js`, `server/domain/investigationPolicy.js`, and migration `001_governed_investigations.sql` now provide normalized idempotent ingestion, versioned deterministic typology scoring, queues, assignment, dismissal/disposition, and evidence-bearing events.
2. A durable provider outbox models bank-feed, sanctions/PEP, case-management, and regulatory-reporting operations with explicit failure/dead-letter state. It does not fabricate successful connections; credentials, contracts, licensed data, and sandbox certification remain external blockers.
3. Reviewer-owned labelled-cohort evaluations persist precision, recall, false-positive rate, mean score, model version, and explanation stability for backtesting/drift comparison. Production labelled cohorts and monitoring thresholds are still required.
4. Analyst registration can no longer self-assign elevated roles; reviewer/admin dispositions, maker-checker separation, tenant scoping, optimistic versions, append-only audit triggers, and human rationale are enforced. TLS verification is strict, JWT/DATABASE_URL fallbacks were removed, and experimental AI/gap routes are disabled by default.
5. Environment documentation, locked bootstrap, forward-only migration, guarded seed, nondestructive start, policy tests, and PostgreSQL migration/frontend build CI were added. The destructive legacy schema is restricted to disposable CI/bootstrap use and excluded from the production forward migration command.

Validation completed without starting services or external feeds: shell and JavaScript syntax checks passed; `npm test` passed 3/3. CI is configured for isolated schema/migration and frontend build. Bank/sanctions/regulatory contracts, licensed data, production backtests, security testing, and regulator-approved reporting remain launch blockers.
