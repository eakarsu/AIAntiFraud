import React, { useState } from 'react';

export default function RefundAbuseRisk() {
  const [form, setForm] = useState({ refunds90d: 7, chargebacks90d: 2, accountAgeDays: 18, deviceAccounts: 4, highValueReturns: 2 });
  const [result, setResult] = useState(null);
  const submit = async () => {
    const response = await fetch('/api/refund-abuse-risk/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      body: JSON.stringify(form),
    });
    setResult(await response.json());
  };
  return (
    <div className="page">
      <h1>Refund Abuse Risk</h1>
      <div className="card">
        {Object.entries(form).map(([key, value]) => (
          <label key={key}>{key.replace(/([A-Z])/g, ' $1')}<input type="number" value={value} onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })} /></label>
        ))}
        <button onClick={submit}>Score refund risk</button>
      </div>
      {result && <div className="card"><h2>{result.level.toUpperCase()} · {result.score}/100</h2><ul>{result.actions.map((action) => <li key={action}>{action}</li>)}</ul></div>}
    </div>
  );
}
