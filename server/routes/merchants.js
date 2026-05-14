const express = require('express');
const { query } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { callOpenRouter, persistAIResult, DEFAULT_MODEL } = require('../aiHelper');

const router = express.Router();

// GET /api/merchants
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      is_flagged,
      merchant_category,
      country,
      min_risk,
      max_risk,
      search,
      page = 1,
      limit = 20,
      sort_by = 'created_at',
      sort_order = 'DESC',
    } = req.query;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (is_flagged !== undefined) {
      conditions.push(`is_flagged = $${paramIndex++}`);
      params.push(is_flagged === 'true');
    }
    if (merchant_category) {
      conditions.push(`merchant_category = $${paramIndex++}`);
      params.push(merchant_category);
    }
    if (country) {
      conditions.push(`country = $${paramIndex++}`);
      params.push(country.toUpperCase());
    }
    if (min_risk !== undefined) {
      conditions.push(`risk_score >= $${paramIndex++}`);
      params.push(parseFloat(min_risk));
    }
    if (max_risk !== undefined) {
      conditions.push(`risk_score <= $${paramIndex++}`);
      params.push(parseFloat(max_risk));
    }
    if (search) {
      conditions.push(`(merchant_name ILIKE $${paramIndex} OR merchant_category ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const allowedSortColumns = ['created_at', 'risk_score', 'merchant_name', 'chargeback_rate', 'fraud_incident_count'];
    const safeSortBy = allowedSortColumns.includes(sort_by) ? sort_by : 'created_at';
    const safeSortOrder = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const countResult = await query(
      `SELECT COUNT(*) FROM merchant_risk_profiles ${whereClause}`,
      params
    );

    const dataResult = await query(
      `SELECT * FROM merchant_risk_profiles ${whereClause}
       ORDER BY ${safeSortBy} ${safeSortOrder}
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
    console.error('Get merchants error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// GET /api/merchants/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT * FROM merchant_risk_profiles WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Merchant risk profile not found' });
    }

    return res.json({ merchant: result.rows[0] });
  } catch (err) {
    console.error('Get merchant error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// POST /api/merchants
router.post('/', authenticateToken, requireRole('admin', 'analyst'), async (req, res) => {
  try {
    const {
      merchant_name,
      merchant_category,
      risk_score,
      chargeback_rate,
      fraud_incident_count = 0,
      avg_transaction_amount,
      country,
      is_flagged = false,
    } = req.body;

    if (!merchant_name) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'merchant_name is required',
      });
    }

    const result = await query(
      `INSERT INTO merchant_risk_profiles
         (merchant_name, merchant_category, risk_score, chargeback_rate,
          fraud_incident_count, avg_transaction_amount, country, is_flagged)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        merchant_name,
        merchant_category || null,
        risk_score || null,
        chargeback_rate || null,
        fraud_incident_count,
        avg_transaction_amount || null,
        country || null,
        is_flagged,
      ]
    );

    return res.status(201).json({ merchant: result.rows[0] });
  } catch (err) {
    console.error('Create merchant error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// PUT /api/merchants/:id
router.put('/:id', authenticateToken, requireRole('admin', 'analyst'), async (req, res) => {
  try {
    const {
      merchant_name, merchant_category, risk_score, chargeback_rate,
      fraud_incident_count, avg_transaction_amount, country, is_flagged,
    } = req.body;

    const existing = await query('SELECT id FROM merchant_risk_profiles WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Merchant risk profile not found' });
    }

    const result = await query(
      `UPDATE merchant_risk_profiles SET
         merchant_name = COALESCE($1, merchant_name),
         merchant_category = COALESCE($2, merchant_category),
         risk_score = COALESCE($3, risk_score),
         chargeback_rate = COALESCE($4, chargeback_rate),
         fraud_incident_count = COALESCE($5, fraud_incident_count),
         avg_transaction_amount = COALESCE($6, avg_transaction_amount),
         country = COALESCE($7, country),
         is_flagged = COALESCE($8, is_flagged)
       WHERE id = $9
       RETURNING *`,
      [
        merchant_name || null,
        merchant_category || null,
        risk_score !== undefined ? risk_score : null,
        chargeback_rate !== undefined ? chargeback_rate : null,
        fraud_incident_count !== undefined ? fraud_incident_count : null,
        avg_transaction_amount || null,
        country || null,
        is_flagged !== undefined ? is_flagged : null,
        req.params.id,
      ]
    );

    return res.json({ merchant: result.rows[0] });
  } catch (err) {
    console.error('Update merchant error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// PATCH /api/merchants/:id/flag
router.patch('/:id/flag', authenticateToken, requireRole('admin', 'analyst'), async (req, res) => {
  try {
    const result = await query(
      `UPDATE merchant_risk_profiles SET is_flagged = NOT is_flagged WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Merchant risk profile not found' });
    }

    return res.json({
      merchant: result.rows[0],
      message: `Merchant ${result.rows[0].is_flagged ? 'flagged' : 'unflagged'} successfully`,
    });
  } catch (err) {
    console.error('Toggle merchant flag error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// DELETE /api/merchants/:id
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM merchant_risk_profiles WHERE id = $1 RETURNING id, merchant_name',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Merchant risk profile not found' });
    }

    return res.json({ message: 'Merchant risk profile deleted successfully', deleted: result.rows[0] });
  } catch (err) {
    console.error('Delete merchant error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// POST /api/merchant-profiles/:id/analyze
router.post('/:id/analyze', authenticateToken, async (req, res) => {
  try {
    const mrResult = await query('SELECT * FROM merchant_risk_profiles WHERE id = $1', [req.params.id]);

    if (mrResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Merchant risk profile not found' });
    }

    const mr = mrResult.rows[0];
    const chargebackRatePct = mr.chargeback_rate != null
      ? (parseFloat(mr.chargeback_rate) * 100).toFixed(2) + '%'
      : 'N/A';

    const systemPrompt = `You are an expert merchant risk analyst AI. Analyze the merchant risk profile and provide a compliance assessment.
Respond ONLY with valid JSON:
{
  "screening_result": "clear|watchlist_match|suspicious|high_risk|blocked",
  "compliance_score": 0-100,
  "risk_factors": [{"factor": "string", "severity": "high|medium|low", "description": "string"}],
  "fraud_indicators": ["string array"],
  "recommended_action": "continue_monitoring|enhanced_monitoring|restrict|terminate",
  "due_diligence_checklist": [{"item": "string", "status": "pass|fail|unknown", "notes": "string"}],
  "country_risk_assessment": {"country": "string", "risk_level": "low|medium|high", "sanctions_status": "clear|flagged"},
  "risk_score_adjustment": 0-100,
  "summary": "concise assessment string",
  "confidence": 0-100
}`;

    const userPrompt = `Analyze this merchant risk profile:
Merchant Name: ${mr.merchant_name}
Category: ${mr.merchant_category || 'Unknown'}
Current Risk Score: ${mr.risk_score}
Chargeback Rate: ${chargebackRatePct}
Fraud Incidents: ${mr.fraud_incident_count}
Average Transaction Amount: $${mr.avg_transaction_amount || 0}
Country: ${mr.country || 'Unknown'}
Currently Flagged: ${mr.is_flagged}
Profile Created: ${mr.created_at}`;

    const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
    const analysis = await callOpenRouter(systemPrompt, userPrompt, model);

    if (analysis.risk_score_adjustment != null) {
      const newScore = Math.min(100, Math.max(0, parseFloat(analysis.risk_score_adjustment)));
      await query('UPDATE merchant_risk_profiles SET risk_score = $1 WHERE id = $2', [newScore, mr.id]);
    }

    const aiResultId = await persistAIResult({
      endpoint: 'merchant-analyze',
      entityType: 'merchant',
      entityId: mr.id,
      inputData: { merchant: mr },
      result: analysis,
      modelUsed: model,
      userId: req.user?.id,
    });

    return res.json({
      merchant_id: mr.id,
      merchant_name: mr.merchant_name,
      merchant: mr,
      analysis,
      ai_result_id: aiResultId,
      model_used: model,
      analyzed_at: new Date().toISOString(),
    });
  } catch (err) {
    if (err.response) {
      console.error('OpenRouter API error:', err.response.data);
      return res.status(502).json({
        error: 'AI Service Error',
        message: 'Failed to get response from AI service',
        details: err.response.data,
      });
    }
    console.error('Analyze merchant error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

module.exports = router;
