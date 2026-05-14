# Audit Apply Note — AIAntiFraud

## Audit recommendations (from batch_00.md)

Substantive: 17 routes, 11 AI endpoints. Production-grade fraud detection.

### Missing AI counterparts
- AI velocity rules (rapid-fire transaction detection)
- AI money mule detection (cash-out patterns)

### Missing non-AI features
- Payment network integration (Visa, Mastercard FDS)
- Biometric verification
- Synthetic identity detection

### Custom feature suggestions
- Real-time graph anomaly detection
- Behavioral biometrics
- ML rule automation
- Card network feeds
- Cross-merchant fraud rings

## Implemented in this pass

None. Substantive project. Remaining items need either external integrations (card network feeds, biometric vendors) or new graph/streaming infrastructure.

## Backlog (not implemented)

| Item | Category | Reason |
|---|---|---|
| Velocity rules | NEEDS-PRODUCT-DECISION | Threshold policy |
| Money-mule detection | TOO-RISKY | Needs transaction-graph schema |
| Visa/Mastercard FDS feed | NEEDS-CREDS | Card-network creds |
| Biometric verification | NEEDS-CREDS | Vendor APIs |
| Synthetic identity detection | NEEDS-CREDS | Identity bureau |
| Graph anomaly streaming | TOO-RISKY | New pipeline |
| Behavioral biometrics | NEEDS-CREDS | Vendor SDK |

## Apply pass 3 (frontend)

Backend already had 11 AI endpoints; FE previously surfaced only `/ai/results`, `/ai/suggest-rules`, and `/ai/score-transaction` (via AIResults, RuleSuggestions, AlertDetail, FraudRules pages). The 7 most powerful endpoints (analyze-transaction, credit-assessment, behavioral-analysis, risk-report, merchant-screening, network-analysis, customer-360) had no direct FE entry point.

Added an "AI Tools" page that exposes those 7 endpoints with simple ID-based forms and reuses the existing `AIResultsDisplay` component for output. Includes a 503 / "AI not configured" branch.

- File added: `client/src/pages/AITools.js`
- Files modified: `client/src/App.js` (route + nav entry)
- Auth: uses existing `api` axios instance which already attaches Bearer token from `localStorage`
- Syntax check: babel-parser PASS on App.js + AITools.js

## Apply pass 4 (mechanical backlog)

Picked up the two remaining MECHANICAL items from the original audit (the rest are NEEDS-CREDS / TOO-RISKY).

- **Velocity Rules** — `POST /api/ai/velocity-rules` (BE: `server/routes/ai.js`). Bucketed `date_trunc('hour', created_at)` aggregate over `transactions`, then LLM classifies card-testing / BIN-attack / ATO-burst patterns. Returns suggested velocity rules with thresholds.
- **Money Mule Detection** — `POST /api/ai/money-mule-detection` (BE: `server/routes/ai.js`). Cash-out signal aggregate (round-amount payouts, distinct merchants/countries, recent account age). LLM classifies cash-out / layering / structuring / funnel-account.

Both endpoints:
- Reuse existing `callOpenRouter`, `persistAIResult` helpers from `aiHelper.js`.
- Inline `OPENROUTER_API_KEY` guard returning HTTP 503 when not set.
- Persist into `ai_results` with `endpoint = 'velocity-rules' | 'money-mule-detection'`.

FE: `client/src/pages/AITools.js` extended with two new tool tabs (icons `FiZap`, `FiAlertTriangle`) and per-tool form schemas; existing JWT-bearer axios instance + 503 / OpenRouter detection branch already handle the new endpoints.

- Smoke test: PASS — login OK, both endpoints return HTTP 503 when `OPENROUTER_API_KEY=""`.
- Syntax check: `node --check server/routes/ai.js` PASS, `@babel/parser` PASS on `AITools.js`.

## Apply pass 5 (all backlog)

Picked up 3 remaining audit-backlog items implementable from existing tables.

- **ML Rule Automation** — `POST /api/ai/ml-rule-automation` (MECHANICAL). Reads `fraud_rules` LEFT JOIN `fraud_alerts` LEFT JOIN `transactions`; LLM proposes threshold / severity / action tuning. Suggestions only — never auto-applied (PRODUCT-DECISION documented inline).
- **Graph Anomaly Detection** — `POST /api/ai/graph-anomaly` (TOO-RISKY → safe in-memory stub). Builds in-memory user-device-IP graph from a 5000-row sample of `transactions`, computes degree / shared-user / fraud-ratio metrics; LLM classifies anomalous nodes. No new tables, no streaming pipeline.
- **Cross-Merchant Fraud Rings** — `POST /api/ai/cross-merchant-rings` (MECHANICAL). User merchant-spread aggregate + 24-hour-window merchant co-occurrence join; LLM clusters into rings.

All three endpoints:
- Inline `OPENROUTER_API_KEY` 503 guard returning `{ error, message, missing: 'OPENROUTER_API_KEY' }`.
- Reuse existing `callOpenRouter`, `persistAIResult` from `aiHelper.js`.
- Persist into `ai_results`.

FE: `client/src/pages/AITools.js` extended with 3 new tabs (icons `FiSettings`, `FiShare2`, `FiLayers`) and per-tool form schemas; existing 503 detection branch handles all three.

- Smoke test: PASS — login OK at alt port 3019, all 3 endpoints return HTTP 503 with `missing: OPENROUTER_API_KEY` when key unset.
- Syntax check: `node --check server/routes/ai.js` PASS, `@babel/parser` PASS on `AITools.js`.
