const express = require('express');
const axios = require('axios');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/behavioral
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      pattern_type,
      min_anomaly,
      max_anomaly,
      search,
      page = 1,
      limit = 20,
      sort_by = 'last_updated',
      sort_order = 'DESC',
    } = req.query;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (pattern_type) {
      conditions.push(`pattern_type = $${paramIndex++}`);
      params.push(pattern_type);
    }
    if (min_anomaly !== undefined) {
      conditions.push(`anomaly_score >= $${paramIndex++}`);
      params.push(parseFloat(min_anomaly));
    }
    if (max_anomaly !== undefined) {
      conditions.push(`anomaly_score <= $${paramIndex++}`);
      params.push(parseFloat(max_anomaly));
    }
    if (search) {
      conditions.push(`customer_id ILIKE $${paramIndex++}`);
      params.push(`%${search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const allowedSortColumns = ['last_updated', 'anomaly_score', 'customer_id', 'avg_transaction_amount', 'pattern_type'];
    const safeSortBy = allowedSortColumns.includes(sort_by) ? sort_by : 'last_updated';
    const safeSortOrder = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const countResult = await query(
      `SELECT COUNT(*) FROM behavioral_patterns ${whereClause}`,
      params
    );

    const dataResult = await query(
      `SELECT * FROM behavioral_patterns ${whereClause}
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
    console.error('Get behavioral patterns error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// GET /api/behavioral/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT * FROM behavioral_patterns WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Behavioral pattern not found' });
    }

    return res.json({ pattern: result.rows[0] });
  } catch (err) {
    console.error('Get behavioral pattern error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// POST /api/behavioral
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      customer_id,
      pattern_type,
      avg_transaction_amount,
      max_transaction_amount,
      typical_locations,
      typical_times,
      device_fingerprints,
      anomaly_score,
    } = req.body;

    if (!customer_id || !pattern_type) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'customer_id and pattern_type are required',
      });
    }

    const locationsJson = typical_locations
      ? (typeof typical_locations === 'string' ? typical_locations : JSON.stringify(typical_locations))
      : '[]';
    const timesJson = typical_times
      ? (typeof typical_times === 'string' ? typical_times : JSON.stringify(typical_times))
      : '{}';
    const devicesJson = device_fingerprints
      ? (typeof device_fingerprints === 'string' ? device_fingerprints : JSON.stringify(device_fingerprints))
      : '[]';

    const result = await query(
      `INSERT INTO behavioral_patterns
         (customer_id, pattern_type, avg_transaction_amount, max_transaction_amount,
          typical_locations, typical_times, device_fingerprints, anomaly_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        customer_id,
        pattern_type,
        avg_transaction_amount || null,
        max_transaction_amount || null,
        locationsJson,
        timesJson,
        devicesJson,
        anomaly_score || null,
      ]
    );

    return res.status(201).json({ pattern: result.rows[0] });
  } catch (err) {
    console.error('Create behavioral pattern error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// PUT /api/behavioral/:id
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const {
      customer_id, pattern_type, avg_transaction_amount, max_transaction_amount,
      typical_locations, typical_times, device_fingerprints, anomaly_score,
    } = req.body;

    const existing = await query('SELECT id FROM behavioral_patterns WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Behavioral pattern not found' });
    }

    const locationsJson = typical_locations
      ? (typeof typical_locations === 'string' ? typical_locations : JSON.stringify(typical_locations))
      : null;
    const timesJson = typical_times
      ? (typeof typical_times === 'string' ? typical_times : JSON.stringify(typical_times))
      : null;
    const devicesJson = device_fingerprints
      ? (typeof device_fingerprints === 'string' ? device_fingerprints : JSON.stringify(device_fingerprints))
      : null;

    const result = await query(
      `UPDATE behavioral_patterns SET
         customer_id = COALESCE($1, customer_id),
         pattern_type = COALESCE($2, pattern_type),
         avg_transaction_amount = COALESCE($3, avg_transaction_amount),
         max_transaction_amount = COALESCE($4, max_transaction_amount),
         typical_locations = COALESCE($5, typical_locations),
         typical_times = COALESCE($6, typical_times),
         device_fingerprints = COALESCE($7, device_fingerprints),
         anomaly_score = COALESCE($8, anomaly_score)
       WHERE id = $9
       RETURNING *`,
      [
        customer_id || null,
        pattern_type || null,
        avg_transaction_amount || null,
        max_transaction_amount || null,
        locationsJson,
        timesJson,
        devicesJson,
        anomaly_score !== undefined ? anomaly_score : null,
        req.params.id,
      ]
    );

    return res.json({ pattern: result.rows[0] });
  } catch (err) {
    console.error('Update behavioral pattern error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// DELETE /api/behavioral/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM behavioral_patterns WHERE id = $1 RETURNING id, customer_id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Behavioral pattern not found' });
    }

    return res.json({ message: 'Behavioral pattern deleted successfully', deleted: result.rows[0] });
  } catch (err) {
    console.error('Delete behavioral pattern error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// POST /api/behavioral/:id/analyze
router.post('/:id/analyze', authenticateToken, async (req, res) => {
  try {
    const bpResult = await query('SELECT * FROM behavioral_patterns WHERE id = $1', [req.params.id]);

    if (bpResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Behavioral pattern not found' });
    }

    const bp = bpResult.rows[0];

    const systemPrompt = `You are an expert behavioral fraud analyst AI. Analyze the given customer behavioral pattern and provide:
1. Anomaly assessment (normal, suspicious, high_risk, critical)
2. Behavioral anomalies detected
3. Risk indicators with explanations
4. Recommended actions (monitor, investigate, restrict, block)
5. Pattern comparison analysis
Respond in JSON format with fields: anomaly_level, anomalies_detected (array), risk_indicators (array of objects with indicator and explanation), recommended_action, pattern_analysis, confidence_score (0-100).`;

    const userPrompt = `Analyze this customer behavioral pattern:
Customer ID: ${bp.customer_id}
Pattern Type: ${bp.pattern_type}
Average Transaction Amount: $${bp.avg_transaction_amount}
Maximum Transaction Amount: $${bp.max_transaction_amount}
Typical Locations: ${JSON.stringify(bp.typical_locations)}
Typical Times: ${JSON.stringify(bp.typical_times)}
Device Fingerprints: ${JSON.stringify(bp.device_fingerprints)}
Current Anomaly Score: ${bp.anomaly_score}
Last Updated: ${bp.last_updated}`;

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

    if (analysis.confidence_score) {
      await query(
        'UPDATE behavioral_patterns SET anomaly_score = $1 WHERE id = $2',
        [analysis.confidence_score, bp.id]
      );
    }

    return res.json({
      pattern_id: bp.id,
      customer_id: bp.customer_id,
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
    console.error('Analyze behavioral pattern error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

module.exports = router;
