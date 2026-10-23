'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const fp = require('../featurepack');

const rows = [
  { id: '1', merchant_name: 'Acme Store', amount: 100, currency: 'USD', status: 'blocked', risk_score: 90, fraud_confirmed: true, location_city: 'Berlin', created_at: '2026-01-01' },
  { id: '2', merchant_name: 'Acme Store', amount: 20, currency: 'USD', status: 'approved', risk_score: 10, fraud_confirmed: false, location_city: 'Paris', created_at: '2026-01-02' },
];

test('tasks validate, create, list-filter and update', () => {
  const store = fp.createTaskStore();
  assert.throws(() => store.create('t:u', { title: '' }), /required/);
  const saved = store.create('t:u', { title: ' Review draft ', status: 'open', linkedId: '1' });
  const updated = store.update('t:u', saved.id, { status: 'done' });
  assert.equal(updated.status, 'done');
  assert.equal(store.list('t:u', { status: 'done' }).length, 1);
  assert.equal(store.list('t:other', {}).length, 0);
  assert.equal(store.update('t:u', 'missing', { title: 'x' }), null);
});

test('search/filter and CSV/JSON export preserve values', () => {
  assert.equal(fp.filterRecords(rows, { search: 'acme' }).length, 2);
  assert.equal(fp.filterRecords(rows, { status: 'blocked' }).length, 1);
  assert.match(fp.recordsToCsv(rows), /Acme Store/);
  const json = fp.recordsToJson(rows);
  assert.equal(json.count, 2);
});

test('AI insights are domain-grounded and fallback-labelled without a key', async () => {
  const fallback = fp.buildInsights(rows);
  assert.equal(fallback.highRiskConcentration.highRiskCount, 1);
  assert.equal(fallback.blockedFlaggedRate.blockedOrFlaggedCount, 1);
  assert.equal(fallback.confirmedFraud.confirmedFraudCount, 1);
  const result = await fp.runAiInsights({ fallback, system: 's', user: 'u', env: {}, fetchFn: async () => { throw new Error('must not be called'); } });
  assert.equal(result.aiGenerated, false);
  assert.match(result.note, /Deterministic fallback/);
  assert.deepEqual(fp.aiSections({ zero: 0, flag: false, empty: '' }).map((s) => s.lines[0]), ['0', 'false', '(empty)']);
});

test('authenticated router: tasks, records search/export, AI insights', async () => {
  const app = express(); app.use(express.json());
  app.use((req, res, next) => req.headers.authorization === 'Bearer good' ? (req.user = { id: 'u', tenant_id: 't' }, next()) : res.status(401).json({ error: 'unauthorized' }));
  app.use('/api/featurepack', fp.createFeaturePackRouter({ listRecords: async () => rows, env: {} }));
  const server = app.listen(0); const base = `http://127.0.0.1:${server.address().port}/api/featurepack`;
  try {
    assert.equal((await fetch(`${base}/tasks`)).status, 401);
    const h = { authorization: 'Bearer good', 'content-type': 'application/json' };
    const created = await (await fetch(`${base}/tasks`, { method: 'POST', headers: h, body: JSON.stringify({ title: 'Follow up' }) })).json();
    assert.equal(created.status, 'open');
    const updated = await (await fetch(`${base}/tasks/${created.id}`, { method: 'PATCH', headers: h, body: JSON.stringify({ status: 'done' }) })).json();
    assert.equal(updated.status, 'done');
    assert.equal((await (await fetch(`${base}/records?search=acme`, { headers: h })).json()).data.length, 2);
    assert.match(await (await fetch(`${base}/records/export?format=csv`, { headers: h })).text(), /Acme Store/);
    assert.equal((await (await fetch(`${base}/records/export?format=json`, { headers: h })).json()).count, 2);
    const ai = await (await fetch(`${base}/ai/insights`, { method: 'POST', headers: h, body: JSON.stringify({}) })).json();
    assert.equal(ai.aiGenerated, false); assert.ok(ai.sections.length >= 3);
  } finally { server.close(); }
});
