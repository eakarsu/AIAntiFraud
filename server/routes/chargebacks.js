const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { callOpenRouter, persistAIResult, DEFAULT_MODEL } = require('../aiHelper');

const router = express.Router();

const validateChargeback = [
  body('customer_name').notEmpty().withMessage('customer_name is required'),
  body('amount').isFloat({ gt: 0 }).withMessage('amount must be a positive number'),
  body('reason_code').optional().isString(),
];

// GET /api/chargebacks
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`cb.status = $${paramIndex++}::chargeback_status`);
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const countResult = await query(`SELECT COUNT(*) FROM chargebacks cb ${whereClause}`, params);
    const dataResult = await query(
      `SELECT cb.*, u.name AS assigned_to_name
       FROM chargebacks cb
       LEFT JOIN users u ON cb.assigned_to = u.id
       ${whereClause}
       ORDER BY cb.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parseInt(limit), offset]
    );

    return res.json({
      data: dataResult.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        total_pages: Math.ceil(parseInt(countResult.rows[0].count) / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Get chargebacks error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// GET /api/chargebacks/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT cb.*, u.name AS assigned_to_name
       FROM chargebacks cb
       LEFT JOIN users u ON cb.assigned_to = u.id
       WHERE cb.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Chargeback not found' });
    }
    return res.json({ chargeback: result.rows[0] });
  } catch (err) {
    console.error('Get chargeback error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// POST /api/chargebacks
router.post('/', authenticateToken, validateChargeback, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation Error', errors: errors.array() });
  }
  try {
    const {
      transaction_id, alert_id, customer_name, amount, reason_code,
      reason_text, evidence_due, assigned_to,
    } = req.body;

    const result = await query(
      `INSERT INTO chargebacks
         (transaction_id, alert_id, customer_name, amount, reason_code, reason_text, evidence_due, assigned_to)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        transaction_id || null,
        alert_id || null,
        customer_name,
        amount,
        reason_code || null,
        reason_text || null,
        evidence_due || null,
        assigned_to || null,
      ]
    );

    return res.status(201).json({ chargeback: result.rows[0] });
  } catch (err) {
    console.error('Create chargeback error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// PATCH /api/chargebacks/:id/status
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['filed', 'evidence_period', 'pending_decision', 'won', 'lost', 'withdrawn'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `status must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const result = await query(
      `UPDATE chargebacks SET
         status = $1::chargeback_status,
         decision_at = CASE WHEN $1 IN ('won', 'lost') THEN NOW() ELSE decision_at END
       WHERE id = $2
       RETURNING *`,
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Chargeback not found' });
    }

    return res.json({ chargeback: result.rows[0], message: `Chargeback status updated to '${status}'` });
  } catch (err) {
    console.error('Update chargeback status error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// POST /api/chargebacks/:id/ai-predict — AI outcome prediction
router.post('/:id/ai-predict', authenticateToken, async (req, res) => {
  try {
    const cbResult = await query(
      `SELECT cb.*, t.amount AS tx_amount, t.merchant_name, t.status AS tx_status,
              t.risk_score, t.fraud_confirmed
       FROM chargebacks cb
       LEFT JOIN transactions t ON cb.transaction_id = t.id
       WHERE cb.id = $1`,
      [req.params.id]
    );

    if (cbResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Chargeback not found' });
    }

    const cb = cbResult.rows[0];

    const systemPrompt = `You are an expert chargeback analyst AI. Predict the outcome of this chargeback dispute and provide recommendations.
Respond ONLY with valid JSON:
{
  "predicted_outcome": "win|lose|settle",
  "win_probability": 0.0-1.0,
  "key_factors": [{"factor": "string", "impact": "positive|negative|neutral", "weight": "high|medium|low"}],
  "recommended_action": "fight|settle|withdraw",
  "evidence_needed": ["string array"],
  "risk_assessment": "low|medium|high|critical",
  "estimated_resolution_days": 0,
  "reasoning": "detailed explanation string",
  "confidence": 0-100
}`;

    const userPrompt = `Analyze this chargeback dispute:
Customer: ${cb.customer_name}
Amount: $${cb.amount}
Reason Code: ${cb.reason_code || 'N/A'}
Reason: ${cb.reason_text || 'N/A'}
Status: ${cb.status}
Filed: ${cb.filed_at}
Evidence Due: ${cb.evidence_due || 'N/A'}
Linked Transaction Risk Score: ${cb.risk_score || 'N/A'}
Fraud Confirmed on Transaction: ${cb.fraud_confirmed}
Transaction Status: ${cb.tx_status || 'N/A'}`;

    const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
    const analysis = await callOpenRouter(systemPrompt, userPrompt, model);

    // Save AI recommendation to chargeback
    await query(
      `UPDATE chargebacks SET
         ai_recommendation = $1,
         ai_outcome_prediction = $2
       WHERE id = $3`,
      [
        analysis.recommended_action || 'See analysis',
        JSON.stringify(analysis),
        cb.id,
      ]
    );

    await persistAIResult({
      endpoint: 'chargeback-predict',
      entityType: 'chargeback',
      entityId: cb.id,
      inputData: { chargeback_id: cb.id },
      result: analysis,
      modelUsed: model,
      userId: req.user?.id,
    });

    return res.json({
      chargeback_id: cb.id,
      prediction: analysis,
      model_used: model,
      analyzed_at: new Date().toISOString(),
    });
  } catch (err) {
    if (err.response) {
      return res.status(502).json({ error: 'AI Service Error', message: 'Failed to get response from AI service', details: err.response.data });
    }
    console.error('Chargeback AI predict error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// DELETE /api/chargebacks/:id
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await query('DELETE FROM chargebacks WHERE id = $1 RETURNING id, customer_name', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Chargeback not found' });
    }
    return res.json({ message: 'Chargeback deleted', deleted: result.rows[0] });
  } catch (err) {
    console.error('Delete chargeback error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

module.exports = router;
