const express = require('express');
const axios = require('axios');
const { query } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

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

// POST /api/merchants/:id/analyze
router.post('/:id/analyze', authenticateToken, async (req, res) => {
  try {
    const mrResult = await query('SELECT * FROM merchant_risk_profiles WHERE id = $1', [req.params.id]);

    if (mrResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Merchant risk profile not found' });
    }

    const mr = mrResult.rows[0];

    const systemPrompt = `You are an expert merchant risk analyst AI. Analyze the given merchant risk profile and provide:
1. Overall risk assessment (low_risk, moderate_risk, high_risk, critical_risk)
2. Key risk factors identified
3. Chargeback analysis and trends
4. Fraud pattern indicators
5. Recommended actions (continue_monitoring, enhanced_monitoring, restrict, terminate)
6. Industry comparison
Respond in JSON format with fields: risk_assessment, risk_factors (array), chargeback_analysis, fraud_indicators (array), recommended_action, industry_comparison, risk_score_adjustment (number), detailed_reasoning.`;

    const userPrompt = `Analyze this merchant risk profile:
Merchant Name: ${mr.merchant_name}
Category: ${mr.merchant_category || 'Unknown'}
Current Risk Score: ${mr.risk_score}
Chargeback Rate: ${(mr.chargeback_rate * 100).toFixed(2)}%
Fraud Incidents: ${mr.fraud_incident_count}
Average Transaction Amount: $${mr.avg_transaction_amount}
Country: ${mr.country}
Currently Flagged: ${mr.is_flagged}
Profile Created: ${mr.created_at}`;

    const aiResponse = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: process.env.OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    let analysisText = aiResponse.data.choices[0].message.content;
    const jsonMatch = analysisText.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (jsonMatch) analysisText = jsonMatch[1].trim();
    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch {
      analysis = { raw_response: analysisText };
    }

    if (analysis.risk_score_adjustment !== undefined) {
      const newScore = Math.min(100, Math.max(0, analysis.risk_score_adjustment));
      await query(
        'UPDATE merchant_risk_profiles SET risk_score = $1 WHERE id = $2',
        [newScore, mr.id]
      );
    }

    return res.json({
      merchant_id: mr.id,
      merchant_name: mr.merchant_name,
      analysis,
      model_used: process.env.OPENROUTER_MODEL,
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
