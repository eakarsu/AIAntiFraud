const express = require('express');
const { query } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/fraud-rules
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { is_active, severity, rule_type, page = 1, limit = 50 } = req.query;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (is_active !== undefined) {
      conditions.push(`is_active = $${paramIndex++}`);
      params.push(is_active === 'true');
    }
    if (severity) {
      conditions.push(`severity = $${paramIndex++}::rule_severity`);
      params.push(severity);
    }
    if (rule_type) {
      conditions.push(`rule_type = $${paramIndex++}`);
      params.push(rule_type);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const countResult = await query(
      `SELECT COUNT(*) FROM fraud_rules ${whereClause}`,
      params
    );

    const dataResult = await query(
      `SELECT * FROM fraud_rules ${whereClause}
       ORDER BY
         CASE severity
           WHEN 'critical' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           WHEN 'low' THEN 4
         END,
         created_at DESC
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
    console.error('Get fraud rules error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// GET /api/fraud-rules/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT * FROM fraud_rules WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Fraud rule not found' });
    }

    const alertCountResult = await query(
      'SELECT COUNT(*) FROM fraud_alerts WHERE rule_id = $1',
      [req.params.id]
    );

    return res.json({
      rule: result.rows[0],
      alert_count: parseInt(alertCountResult.rows[0].count),
    });
  } catch (err) {
    console.error('Get fraud rule error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// POST /api/fraud-rules
router.post('/', authenticateToken, requireRole('admin', 'analyst'), async (req, res) => {
  try {
    const {
      name,
      description,
      rule_type,
      condition_json,
      action = 'flag',
      severity = 'medium',
      is_active = true,
    } = req.body;

    if (!name || !rule_type || !condition_json) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'name, rule_type, and condition_json are required',
      });
    }

    const validActions = ['block', 'flag', 'alert'];
    const validSeverities = ['low', 'medium', 'high', 'critical'];

    if (!validActions.includes(action)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `action must be one of: ${validActions.join(', ')}`,
      });
    }

    if (!validSeverities.includes(severity)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `severity must be one of: ${validSeverities.join(', ')}`,
      });
    }

    const conditionJsonValue = typeof condition_json === 'string'
      ? condition_json
      : JSON.stringify(condition_json);

    const result = await query(
      `INSERT INTO fraud_rules (name, description, rule_type, condition_json, action, severity, is_active)
       VALUES ($1, $2, $3, $4, $5::rule_action, $6::rule_severity, $7)
       RETURNING *`,
      [name, description || null, rule_type, conditionJsonValue, action, severity, is_active]
    );

    return res.status(201).json({ rule: result.rows[0] });
  } catch (err) {
    console.error('Create fraud rule error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// PUT /api/fraud-rules/:id
router.put('/:id', authenticateToken, requireRole('admin', 'analyst'), async (req, res) => {
  try {
    const { name, description, rule_type, condition_json, action, severity, is_active } = req.body;

    const existing = await query('SELECT id FROM fraud_rules WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Fraud rule not found' });
    }

    const conditionJsonValue = condition_json
      ? (typeof condition_json === 'string' ? condition_json : JSON.stringify(condition_json))
      : null;

    const result = await query(
      `UPDATE fraud_rules SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         rule_type = COALESCE($3, rule_type),
         condition_json = COALESCE($4, condition_json),
         action = COALESCE($5::rule_action, action),
         severity = COALESCE($6::rule_severity, severity),
         is_active = COALESCE($7, is_active)
       WHERE id = $8
       RETURNING *`,
      [
        name || null,
        description || null,
        rule_type || null,
        conditionJsonValue,
        action || null,
        severity || null,
        is_active !== undefined ? is_active : null,
        req.params.id,
      ]
    );

    return res.json({ rule: result.rows[0] });
  } catch (err) {
    console.error('Update fraud rule error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// PATCH /api/fraud-rules/:id/toggle
router.patch('/:id/toggle', authenticateToken, requireRole('admin', 'analyst'), async (req, res) => {
  try {
    const result = await query(
      `UPDATE fraud_rules SET is_active = NOT is_active WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Fraud rule not found' });
    }

    return res.json({
      rule: result.rows[0],
      message: `Rule ${result.rows[0].is_active ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (err) {
    console.error('Toggle fraud rule error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// DELETE /api/fraud-rules/:id
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM fraud_rules WHERE id = $1 RETURNING id, name',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Fraud rule not found' });
    }

    return res.json({
      message: 'Fraud rule deleted successfully',
      deleted: result.rows[0],
    });
  } catch (err) {
    console.error('Delete fraud rule error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

module.exports = router;
