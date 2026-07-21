'use strict';

const transitions = Object.freeze({ ingested: ['scored'], scored: ['assigned', 'dismissed'], assigned: ['disposed'], dismissed: [], disposed: [] });

function normalizeTransaction(input) {
  const amount = Number(input.amount);
  if (!input.externalId || !input.currency || !Number.isFinite(amount) || amount <= 0) throw new Error('externalId, currency and positive amount are required');
  const occurredAt = new Date(input.occurredAt);
  if (Number.isNaN(occurredAt.getTime())) throw new Error('occurredAt must be an ISO timestamp');
  return {
    externalId: String(input.externalId), amount: Math.round(amount * 100) / 100,
    currency: String(input.currency).toUpperCase(), occurredAt: occurredAt.toISOString(),
    customerReference: String(input.customerReference || ''), merchantReference: String(input.merchantReference || ''),
    country: String(input.country || '').toUpperCase(), channel: String(input.channel || 'unknown'),
  };
}

function scoreTypologies(tx, signals = {}) {
  const reasons = [];
  let score = 0;
  if (tx.amount >= 10000) { score += 25; reasons.push('high_value'); }
  if (signals.sanctionsMatch === true) { score += 70; reasons.push('sanctions_match'); }
  if (Number(signals.velocity24h) >= 10) { score += 25; reasons.push('high_velocity'); }
  if (signals.countryMismatch === true) { score += 15; reasons.push('country_mismatch'); }
  return { score: Math.min(score, 100), reasons, modelVersion: 'rules-2026-07-18' };
}

function assertTransition(from, to, context) {
  if (!transitions[from]?.includes(to)) throw new Error(`Invalid transition: ${from} -> ${to}`);
  if (['assigned', 'dismissed', 'disposed'].includes(to) && !['reviewer', 'admin'].includes(context.role)) throw new Error('Reviewer role required');
  if (to === 'disposed' && String(context.creatorId) === String(context.actorId)) throw new Error('Segregation of duties violation');
  if (['dismissed', 'disposed'].includes(to) && (!context.rationale || context.rationale.trim().length < 12)) throw new Error('Disposition rationale is required');
}

function evaluateAlerts(rows) {
  if (!Array.isArray(rows) || rows.length < 20) throw new Error('At least 20 labelled alerts are required');
  let tp = 0, fp = 0, fn = 0, stabilityMatches = 0;
  for (const row of rows) {
    if (typeof row.confirmedFraud !== 'boolean') throw new Error('confirmedFraud labels are required');
    const alerted = Number(row.score) >= Number(row.threshold ?? 50);
    if (alerted && row.confirmedFraud) tp += 1;
    if (alerted && !row.confirmedFraud) fp += 1;
    if (!alerted && row.confirmedFraud) fn += 1;
    const reasons = [...(row.reasons || [])].sort();
    const repeated = [...(row.repeatReasons || row.reasons || [])].sort();
    if (JSON.stringify(reasons) === JSON.stringify(repeated)) stabilityMatches += 1;
  }
  return { sampleSize: rows.length, precision: tp + fp ? tp / (tp + fp) : 0, recall: tp + fn ? tp / (tp + fn) : 0, falsePositiveRate: fp / rows.length, meanScore: rows.reduce((sum, row) => sum + Number(row.score), 0) / rows.length, explanationStability: stabilityMatches / rows.length, evaluationVersion: 'fraud-alerts-1' };
}

module.exports = { transitions, normalizeTransaction, scoreTypologies, assertTransition, evaluateAlerts };
