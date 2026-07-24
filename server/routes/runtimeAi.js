'use strict';

const express = require('express');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/fraud-readiness', authenticateToken, async (req, res) => {
  try {
    const baseUrl = process.env.OPENROUTER_BASE_URL;
    const model = process.env.OPENROUTER_MODEL;
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (baseUrl !== 'https://openrouter.ai/api/v1' || !model || !apiKey) return res.status(503).json({ error: 'Canonical OpenRouter configuration is required' });
    const context = String(req.body?.context || 'Assess a suspicious card transaction for analyst review readiness.').slice(0, 4000);
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [
        { role: 'system', content: 'You are a fraud investigation analyst assistant. Return concise risk observations, evidence gaps, and safe next actions without making a final adjudication.' },
        { role: 'user', content: context },
      ], temperature: 0.2, max_tokens: 600 }),
    });
    const provider = await response.json();
    if (!response.ok || provider.error) throw new Error(provider.error?.message || `OpenRouter HTTP ${response.status}`);
    const content = provider.choices?.[0]?.message?.content;
    if (!provider.id || typeof content !== 'string' || !content.trim()) throw new Error('OpenRouter returned an incomplete provider response');
    const receipt = { id: provider.id, model: provider.model || model, usage: provider.usage || null };
    const stored = await query(
      `INSERT INTO runtime_ai_results (user_id, tenant_id, feature, input, content, model, provider_receipt)
       VALUES ($1, $2, 'fraud-readiness', $3, $4, $5, $6) RETURNING id, created_at`,
      [req.user.id, req.user.tenant_id, { context }, content, receipt.model, receipt]
    );
    res.json({ success: true, content, model: receipt.model, providerReceipt: receipt, resultId: stored.rows[0].id, persistedAt: stored.rows[0].created_at });
  } catch (error) {
    console.error('[runtime-ai] fraud-readiness failed:', error.message);
    res.status(502).json({ error: 'OpenRouter fraud readiness failed' });
  }
});

module.exports = router;
