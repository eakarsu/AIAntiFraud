'use strict';
// Feature pack wave 26A: authenticated tasks, transaction search/filter,
// CSV/JSON export, and domain AI insights over saved transactions.
// Provider is called only when OPENROUTER_API_KEY/OPENAI_API_KEY is set;
// otherwise a clearly labelled deterministic fallback is returned.
const express = require('express');
const crypto = require('node:crypto');

const TASK_STATUSES = ['open', 'in_progress', 'done'];
function validateTask(input = {}) {
  const title = String(input.title ?? '').trim();
  if (!title) throw new Error('Task title is required.');
  if (title.length > 200) throw new Error('Task title must be at most 200 characters.');
  const status = TASK_STATUSES.includes(input.status) ? input.status : 'open';
  return { title, status, linkedId: String(input.linkedId ?? '').trim().slice(0, 100), due: String(input.due ?? '').trim().slice(0, 40), notes: String(input.notes ?? '').trim().slice(0, 500) };
}
function createTaskStore() {
  const byOwner = new Map();
  const list = (owner) => [...(byOwner.get(owner) ?? new Map()).values()];
  return {
    list: (owner, filters = {}) => {
      const q = String(filters.search ?? '').trim().toLowerCase();
      const status = String(filters.status ?? '').trim();
      return list(owner).filter((t) => (!status || status === 'all' || t.status === status) && (!q || `${t.title} ${t.notes} ${t.linkedId}`.toLowerCase().includes(q)));
    },
    create(owner, input) {
      if (!byOwner.has(owner)) byOwner.set(owner, new Map());
      const task = { id: crypto.randomUUID(), ...validateTask(input), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      byOwner.get(owner).set(task.id, task); return task;
    },
    update(owner, id, input) {
      const existing = byOwner.get(owner)?.get(id); if (!existing) return null;
      const task = { ...existing, ...validateTask({ ...existing, ...input }), updatedAt: new Date().toISOString() };
      byOwner.get(owner).set(id, task); return task;
    },
  };
}
const SEARCH_FIELDS = ['merchant_name', 'merchant_category', 'location_city', 'status', 'currency'];
function filterRecords(rows, { search = '', status = '', statusField = 'status', fields = SEARCH_FIELDS } = {}) {
  const q = String(search ?? '').trim().toLowerCase(); const st = String(status ?? '').trim();
  return (Array.isArray(rows) ? rows : []).filter((r) => (!st || st === 'all' || String(r[statusField] ?? '') === st) && (!q || fields.some((f) => String(r[f] ?? '').toLowerCase().includes(q))));
}
function csvCell(v) { let t = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); if (/^\s*[=+\-@\t\r\n]/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; }
const COLUMNS = ['id', 'merchant_name', 'amount', 'currency', 'status', 'risk_score', 'fraud_confirmed', 'location_city', 'created_at'];
function recordsToCsv(rows) { return [COLUMNS, ...(rows ?? []).map((r) => COLUMNS.map((c) => r[c]))].map((row) => row.map(csvCell).join(',')).join('\r\n'); }
function recordsToJson(rows) { return { exported_at: new Date().toISOString(), count: (rows ?? []).length, data: rows ?? [] }; }
function formatAiValue(v) { if (v === false) return 'false'; if (v === 0) return '0'; if (v === '') return '(empty)'; if (v == null) return 'Not recorded'; if (Array.isArray(v)) return v.length ? v.map(formatAiValue).join('; ') : '(none)'; if (typeof v === 'object') return JSON.stringify(v); return String(v); }
function aiSections(data, prefix = '') {
  if (!data || typeof data !== 'object') return [{ label: prefix || 'Result', lines: [formatAiValue(data)] }];
  return Object.entries(data).flatMap(([k, v]) => {
    const label = prefix ? `${prefix} · ${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) return aiSections(v, label);
    if (Array.isArray(v) && v.length && v.every((x) => x && typeof x === 'object')) return [{ label, lines: v.map((x) => Object.entries(x).map(([kk, vv]) => `${kk}: ${formatAiValue(vv)}`).join(' · ')) }];
    return [{ label, lines: [formatAiValue(v)] }];
  });
}
const providerKey = (env = {}) => (env.OPENROUTER_API_KEY ? 'openrouter' : env.OPENAI_API_KEY ? 'openai' : null);
async function runAiInsights({ fallback, system, user, env = {}, fetchFn }) {
  const provider = providerKey(env);
  if (!provider) return { aiGenerated: false, provider: null, note: 'Deterministic fallback — no OPENROUTER_API_KEY or OPENAI_API_KEY is configured. Values below are computed locally from saved records.', data: fallback };
  try {
    const key = provider === 'openrouter' ? env.OPENROUTER_API_KEY : env.OPENAI_API_KEY;
    const url = provider === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
    const model = provider === 'openrouter' ? (env.OPENROUTER_MODEL || 'openai/gpt-4o-mini') : (env.OPENAI_MODEL || 'gpt-4o-mini');
    const res = await (fetchFn ?? fetch)(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, temperature: 0.2, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }) });
    if (!res?.ok) throw new Error(`Provider returned ${res?.status ?? 'an error'}.`);
    const body = await res.json();
    const parsed = JSON.parse(String(body?.choices?.[0]?.message?.content ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Provider returned incomplete JSON.');
    return { aiGenerated: true, provider, model: body?.model ?? model, note: 'Generated by the configured provider from saved records. Check every statement before use.', data: parsed };
  } catch (e) { return { aiGenerated: false, provider: null, note: `Provider call failed (${e.message}). Deterministic fallback from saved records is shown instead.`, data: fallback }; }
}
function highRiskConcentration(rows = []) {
  const high = rows.filter((r) => Number(r.risk_score) >= 80);
  return { highRiskCount: high.length, highRiskShare: rows.length ? Math.round((high.length / rows.length) * 10000) / 100 : 0, hasHighRisk: high.length > 0 };
}
function blockedFlaggedRate(rows = []) {
  const hit = rows.filter((r) => r.status === 'blocked' || r.status === 'flagged');
  return { blockedOrFlaggedCount: hit.length, blockedOrFlaggedShare: rows.length ? Math.round((hit.length / rows.length) * 10000) / 100 : 0 };
}
function confirmedFraud(rows = []) {
  const hit = rows.filter((r) => r.fraud_confirmed === true || r.fraud_confirmed === 'true');
  return { confirmedFraudCount: hit.length, confirmedFraudShare: rows.length ? Math.round((hit.length / rows.length) * 10000) / 100 : 0, hasConfirmedFraud: hit.length > 0 };
}
function buildInsights(rows = []) { return { highRiskConcentration: highRiskConcentration(rows), blockedFlaggedRate: blockedFlaggedRate(rows), confirmedFraud: confirmedFraud(rows) }; }
const AI_SYSTEM = 'You summarize saved card-transaction fraud records only. Never invent transactions, merchants or amounts. Return JSON only with keys highRiskConcentration, blockedFlaggedRate, confirmedFraud.';
function ownerOf(req) { return `${req.user?.tenant_id ?? 'tenant'}:${req.user?.id ?? req.user?.sub ?? 'user'}`; }
function createFeaturePackRouter({ listRecords, env = process.env, store = createTaskStore() } = {}) {
  const router = express.Router();
  router.get('/tasks', (req, res) => res.json({ tasks: store.list(ownerOf(req), req.query) }));
  router.post('/tasks', (req, res) => { try { return res.status(201).json(store.create(ownerOf(req), req.body ?? {})); } catch (e) { return res.status(422).json({ error: e.message }); } });
  const update = (req, res) => { try { const t = store.update(ownerOf(req), req.params.id, req.body ?? {}); return t ? res.json(t) : res.status(404).json({ error: 'task_not_found' }); } catch (e) { return res.status(422).json({ error: e.message }); } };
  router.put('/tasks/:id', update); router.patch('/tasks/:id', update);
  router.get('/records', async (req, res, next) => { try { return res.json({ data: filterRecords(await listRecords(req), req.query) }); } catch (e) { return next(e); } });
  router.get('/records/export', async (req, res, next) => {
    try {
      const rows = filterRecords(await listRecords(req), req.query);
      if (String(req.query.format ?? 'csv').toLowerCase() === 'json') return res.json(recordsToJson(rows));
      res.setHeader('Content-Type', 'text/csv'); res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"'); return res.send(recordsToCsv(rows));
    } catch (e) { return next(e); }
  });
  router.post('/ai/insights', async (req, res, next) => {
    try {
      const rows = Array.isArray(req.body?.records) ? req.body.records : await listRecords(req);
      const fallback = buildInsights(rows);
      const result = await runAiInsights({ fallback, system: AI_SYSTEM, user: JSON.stringify({ records: rows.slice(0, 100) }), env });
      return res.json({ ...result, sections: aiSections(result.data) });
    } catch (e) { return next(e); }
  });
  return router;
}
module.exports = { TASK_STATUSES, validateTask, createTaskStore, filterRecords, recordsToCsv, recordsToJson, formatAiValue, aiSections, providerKey, runAiInsights, highRiskConcentration, blockedFlaggedRate, confirmedFraud, buildInsights, createFeaturePackRouter };
