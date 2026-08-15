'use strict';

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { callOpenRouter, DEFAULT_MODEL } = require('../aiHelper');

const router = express.Router();

const FEATURES = Object.freeze({
  'cf-advanced-behavioral-biometrics-mouse-typing': 'Advanced behavioral biometrics and device fingerprinting',
  'cf-card-network-alert-feed-integration': 'Card-network alert feed integration',
  'cf-cross-merchant-coordinated-fraud-detection': 'Cross-merchant coordinated fraud detection',
  'cf-ml-rule-automation-generating-new': 'ML fraud-rule automation',
  'cf-real-time-graph-anomaly-detection': 'Real-time fraud-ring graph anomaly detection',
  'gap-ai-explainability-risk-score-outputs': 'Risk-score explainability analysis',
  'gap-ai-money-mule-cash-out': 'Money-mule cash-out pattern analysis',
  'gap-ai-synthetic-identity-detection': 'Synthetic identity risk analysis',
  'gap-ai-velocity-rule-learning-rapid': 'Rapid transaction velocity-rule analysis',
  'gap-biometric-device-fingerprint-verification': 'Biometric and device-fingerprint verification plan',
  'gap-notifications-subsystem': 'Fraud notification and escalation plan',
  'gap-outbound-webhooks-siem-soc-integration': 'SIEM and SOC integration plan',
  'gap-payment-network-integration-visa-mastercard': 'Payment-network fraud feed integration plan',
});

const SYSTEM_PROMPT = `You are a senior fraud operations analyst. Return only valid JSON with this structure:
{
  "summary": "concise executive finding",
  "risk_level": "low|medium|high|critical",
  "confidence": 0,
  "key_findings": [{"finding":"string","evidence":"string","severity":"low|medium|high|critical"}],
  "prioritized_actions": [{"priority":1,"action":"string","owner":"string","deadline":"string"}],
  "assumptions": ["string"],
  "missing_information": ["string"],
  "follow_up_questions": ["string"]
}. Do not claim that an external integration, alert, block, or payment-network action was executed. Clearly distinguish analysis from verified evidence and keep a human analyst responsible for final decisions.`;

function normalizeInput(body) {
  const value = typeof body?.input === 'string' ? body.input.trim() : '';
  if (value.length < 10) return null;
  return value.slice(0, 12000);
}

for (const [slug, title] of Object.entries(FEATURES)) {
  router.post(`/${slug}/run`, authenticateToken, async (req, res) => {
    const input = normalizeInput(req.body);
    if (!input) {
      return res.status(400).json({
        error: 'ValidationError',
        message: 'Input must contain at least 10 characters.',
      });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(503).json({
        error: 'AIServiceNotConfigured',
        message: 'OPENROUTER_API_KEY is required for AI analysis.',
      });
    }

    try {
      const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
      const result = await callOpenRouter(
        `${SYSTEM_PROMPT}\n\nFeature: ${title}`,
        input,
        model
      );
      return res.json({
        feature: slug,
        title,
        result,
        model,
        disclaimer: 'Decision support only. A qualified fraud analyst must verify evidence and approve consequential actions.',
      });
    } catch (error) {
      console.error(`[generated-ai:${slug}]`, error.response?.data || error.message);
      return res.status(502).json({
        error: 'AIServiceError',
        message: 'The AI provider could not complete this analysis. Please retry or escalate for manual review.',
      });
    }
  });
}

module.exports = { router, FEATURES };
