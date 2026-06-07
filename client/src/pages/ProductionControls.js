import React from 'react';

const controls = [
  ['Device Fingerprint Coverage', 'Link device, IP, card, email, account, and merchant signals for fraud rings.'],
  ['Velocity & Abuse Orchestration', 'Coordinate refund, chargeback, promo, login, and transaction velocity policies.'],
  ['Issuer / 3DS Connector Readiness', 'Track credentials, retries, webhook events, challenge outcomes, and fallback rules.'],
  ['Model Drift & Override QA', 'Monitor false positives, analyst overrides, score drift, and model-risk signoff.'],
  ['Audit Export Center', 'Export alerts, cases, decisions, rule versions, model scores, and user access history.'],
  ['Release Test Harness', 'Run seeded fraud scenarios, API smoke checks, regression tests, and go-live approvals.'],
];

export default function ProductionControls() {
  return (
    <div className="page">
      <h1>Production Controls</h1>
      <p>Operational missing features for a production anti-fraud command center.</p>
      <div className="card">
        {controls.map(([title, detail]) => (
          <div key={title} style={{ padding: '14px 0', borderBottom: '1px solid rgba(148,163,184,0.25)' }}>
            <h2 style={{ fontSize: 16, margin: '0 0 6px' }}>{title}</h2>
            <p style={{ margin: 0 }}>{detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
