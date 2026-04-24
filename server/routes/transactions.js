const express = require('express');
const axios = require('axios');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/transactions/stats
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const statsResult = await query(`
      SELECT
        COUNT(*)                                                        AS total,
        COUNT(*) FILTER (WHERE status = 'approved')                    AS approved,
        COUNT(*) FILTER (WHERE status = 'blocked')                     AS blocked,
        COUNT(*) FILTER (WHERE status = 'flagged')                     AS flagged,
        COUNT(*) FILTER (WHERE status = 'pending')                     AS pending,
        COUNT(*) FILTER (WHERE fraud_confirmed = TRUE)                 AS confirmed_fraud,
        ROUND(AVG(risk_score)::numeric, 2)                             AS avg_risk_score,
        ROUND(SUM(amount)::numeric, 2)                                 AS total_amount,
        ROUND(
          (COUNT(*) FILTER (WHERE fraud_confirmed = TRUE)::decimal
           / NULLIF(COUNT(*), 0)) * 100, 2
        )                                                              AS fraud_rate
      FROM transactions
    `);

    const byDayResult = await query(`
      SELECT
        DATE_TRUNC('day', created_at) AS day,
        COUNT(*)                       AS total,
        COUNT(*) FILTER (WHERE status = 'blocked' OR fraud_confirmed = TRUE) AS fraud_count
      FROM transactions
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY day
      ORDER BY day ASC
    `);

    const riskDistResult = await query(`
      SELECT
        CASE
          WHEN risk_score < 20  THEN 'very_low'
          WHEN risk_score < 40  THEN 'low'
          WHEN risk_score < 60  THEN 'medium'
          WHEN risk_score < 80  THEN 'high'
          ELSE                       'critical'
        END AS risk_band,
        COUNT(*) AS count
      FROM transactions
      WHERE risk_score IS NOT NULL
      GROUP BY risk_band
    `);

    return res.json({
      summary: statsResult.rows[0],
      daily_trend: byDayResult.rows,
      risk_distribution: riskDistResult.rows,
    });
  } catch (err) {
    console.error('Transaction stats error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// GET /api/transactions
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      min_risk,
      max_risk,
      fraud_confirmed,
      currency,
      search,
      sort_by = 'created_at',
      sort_order = 'DESC',
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`t.status = $${paramIndex++}`);
      params.push(status);
    }
    if (min_risk !== undefined) {
      conditions.push(`t.risk_score >= $${paramIndex++}`);
      params.push(parseFloat(min_risk));
    }
    if (max_risk !== undefined) {
      conditions.push(`t.risk_score <= $${paramIndex++}`);
      params.push(parseFloat(max_risk));
    }
    if (fraud_confirmed !== undefined) {
      conditions.push(`t.fraud_confirmed = $${paramIndex++}`);
      params.push(fraud_confirmed === 'true');
    }
    if (currency) {
      conditions.push(`t.currency = $${paramIndex++}`);
      params.push(currency.toUpperCase());
    }
    if (search) {
      conditions.push(`(t.merchant_name ILIKE $${paramIndex} OR t.location_city ILIKE $${paramIndex} OR t.card_number_last4 = $${paramIndex + 1})`);
      params.push(`%${search}%`);
      params.push(search);
      paramIndex += 2;
    }

    const allowedSortColumns = ['created_at', 'amount', 'risk_score', 'status', 'merchant_name'];
    const safeSortBy = allowedSortColumns.includes(sort_by) ? sort_by : 'created_at';
    const safeSortOrder = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) FROM transactions t ${whereClause}`,
      params
    );

    const dataResult = await query(
      `SELECT t.*, u.name AS user_name, u.email AS user_email
       FROM transactions t
       LEFT JOIN users u ON t.user_id = u.id
       ${whereClause}
       ORDER BY t.${safeSortBy} ${safeSortOrder}
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
    console.error('Get transactions error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// GET /api/transactions/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT t.*, u.name AS user_name, u.email AS user_email
       FROM transactions t
       LEFT JOIN users u ON t.user_id = u.id
       WHERE t.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Transaction not found' });
    }

    const alertsResult = await query(
      `SELECT fa.*, fr.name AS rule_name
       FROM fraud_alerts fa
       LEFT JOIN fraud_rules fr ON fa.rule_id = fr.id
       WHERE fa.transaction_id = $1`,
      [req.params.id]
    );

    return res.json({
      transaction: result.rows[0],
      alerts: alertsResult.rows,
    });
  } catch (err) {
    console.error('Get transaction error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// POST /api/transactions
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      user_id,
      amount,
      currency = 'USD',
      merchant_name,
      merchant_category,
      card_number_last4,
      ip_address,
      location_country,
      location_city,
      device_id,
      is_online = false,
      status = 'pending',
      risk_score,
      fraud_confirmed = false,
    } = req.body;

    if (!amount || !merchant_name) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'amount and merchant_name are required',
      });
    }

    const result = await query(
      `INSERT INTO transactions
         (user_id, amount, currency, merchant_name, merchant_category, card_number_last4,
          ip_address, location_country, location_city, device_id, is_online, status, risk_score, fraud_confirmed)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        user_id || null,
        amount,
        currency,
        merchant_name,
        merchant_category || null,
        card_number_last4 || null,
        ip_address || null,
        location_country || null,
        location_city || null,
        device_id || null,
        is_online,
        status,
        risk_score || null,
        fraud_confirmed,
      ]
    );

    return res.status(201).json({ transaction: result.rows[0] });
  } catch (err) {
    console.error('Create transaction error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// PUT /api/transactions/:id
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const {
      amount,
      currency,
      merchant_name,
      merchant_category,
      card_number_last4,
      ip_address,
      location_country,
      location_city,
      device_id,
      is_online,
      status,
      risk_score,
      fraud_confirmed,
    } = req.body;

    const existing = await query('SELECT id FROM transactions WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Transaction not found' });
    }

    const result = await query(
      `UPDATE transactions SET
         amount = COALESCE($1, amount),
         currency = COALESCE($2, currency),
         merchant_name = COALESCE($3, merchant_name),
         merchant_category = COALESCE($4, merchant_category),
         card_number_last4 = COALESCE($5, card_number_last4),
         ip_address = COALESCE($6::inet, ip_address),
         location_country = COALESCE($7, location_country),
         location_city = COALESCE($8, location_city),
         device_id = COALESCE($9, device_id),
         is_online = COALESCE($10, is_online),
         status = COALESCE($11::transaction_status, status),
         risk_score = COALESCE($12, risk_score),
         fraud_confirmed = COALESCE($13, fraud_confirmed)
       WHERE id = $14
       RETURNING *`,
      [
        amount || null,
        currency || null,
        merchant_name || null,
        merchant_category || null,
        card_number_last4 || null,
        ip_address || null,
        location_country || null,
        location_city || null,
        device_id || null,
        is_online !== undefined ? is_online : null,
        status || null,
        risk_score !== undefined ? risk_score : null,
        fraud_confirmed !== undefined ? fraud_confirmed : null,
        req.params.id,
      ]
    );

    return res.json({ transaction: result.rows[0] });
  } catch (err) {
    console.error('Update transaction error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// PATCH /api/transactions/:id/status
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status, fraud_confirmed } = req.body;
    const validStatuses = ['approved', 'blocked', 'flagged', 'pending'];

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Status must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const result = await query(
      `UPDATE transactions
       SET status = COALESCE($1::transaction_status, status),
           fraud_confirmed = COALESCE($2, fraud_confirmed)
       WHERE id = $3
       RETURNING *`,
      [status || null, fraud_confirmed !== undefined ? fraud_confirmed : null, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Transaction not found' });
    }

    return res.json({ transaction: result.rows[0] });
  } catch (err) {
    console.error('Patch transaction status error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// DELETE /api/transactions/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM transactions WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Transaction not found' });
    }

    return res.json({ message: 'Transaction deleted successfully', id: result.rows[0].id });
  } catch (err) {
    console.error('Delete transaction error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// POST /api/transactions/:id/analyze
router.post('/:id/analyze', authenticateToken, async (req, res) => {
  try {
    const txResult = await query(
      `SELECT t.*, u.name AS user_name
       FROM transactions t
       LEFT JOIN users u ON t.user_id = u.id
       WHERE t.id = $1`,
      [req.params.id]
    );

    if (txResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Transaction not found' });
    }

    const tx = txResult.rows[0];

    const systemPrompt = `You are an expert anti-fraud analyst AI. Analyze the given transaction data and provide:
1. A fraud risk score (0-100)
2. Risk classification (low/medium/high/critical)
3. Key fraud indicators found
4. Recommended action (approve/flag/block)
5. Detailed reasoning
Respond in JSON format with fields: risk_score, risk_level, fraud_indicators (array), recommended_action, reasoning.`;

    const userPrompt = `Analyze this transaction for fraud risk:
Transaction ID: ${tx.id}
Amount: ${tx.currency} ${tx.amount}
Merchant: ${tx.merchant_name} (${tx.merchant_category || 'unknown category'})
Card Last 4: ${tx.card_number_last4 || 'N/A'}
IP Address: ${tx.ip_address || 'N/A'}
Location: ${tx.location_city || 'N/A'}, ${tx.location_country || 'N/A'}
Device ID: ${tx.device_id || 'N/A'}
Online Transaction: ${tx.is_online}
Current Status: ${tx.status}
Current Risk Score: ${tx.risk_score || 'unscored'}
Timestamp: ${tx.created_at}`;

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

    if (analysis.risk_score) {
      await query(
        'UPDATE transactions SET risk_score = $1 WHERE id = $2',
        [analysis.risk_score, tx.id]
      );
    }

    return res.json({
      transaction_id: tx.id,
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
    console.error('Analyze transaction error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

module.exports = router;
