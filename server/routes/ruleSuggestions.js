const express = require('express');
const { query } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/rule-suggestions
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`rs.status = $${paramIndex++}`);
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const countResult = await query(
      `SELECT COUNT(*) FROM rule_suggestions rs ${whereClause}`,
      params
    );

    const dataResult = await query(
      `SELECT rs.*, u.name AS reviewed_by_name
       FROM rule_suggestions rs
       LEFT JOIN users u ON rs.reviewed_by = u.id
       ${whereClause}
       ORDER BY rs.created_at DESC
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
    console.error('Get rule suggestions error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// GET /api/rule-suggestions/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT rs.*, u.name AS reviewed_by_name
       FROM rule_suggestions rs
       LEFT JOIN users u ON rs.reviewed_by = u.id
       WHERE rs.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Rule suggestion not found' });
    }
    return res.json({ suggestion: result.rows[0] });
  } catch (err) {
    console.error('Get rule suggestion error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// POST /api/rule-suggestions/:id/accept — promote to fraud_rules
router.post('/:id/accept', authenticateToken, requireRole('admin', 'analyst'), async (req, res) => {
  try {
    const sugResult = await query('SELECT * FROM rule_suggestions WHERE id = $1', [req.params.id]);
    if (sugResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Rule suggestion not found' });
    }
    const sug = sugResult.rows[0];
    if (sug.status !== 'pending') {
      return res.status(400).json({ error: 'Bad Request', message: 'Only pending suggestions can be accepted' });
    }

    const ruleData = typeof sug.rule_data === 'object' ? sug.rule_data : JSON.parse(sug.rule_data);

    // Promote to fraud_rules
    const conditionJson = ruleData.condition_json
      ? (typeof ruleData.condition_json === 'string' ? ruleData.condition_json : JSON.stringify(ruleData.condition_json))
      : '{}';

    const ruleResult = await query(
      `INSERT INTO fraud_rules (name, description, rule_type, condition_json, action, severity, is_active)
       VALUES ($1, $2, $3, $4, $5::rule_action, $6::rule_severity, TRUE)
       RETURNING *`,
      [
        ruleData.name || 'AI Suggested Rule',
        ruleData.description || null,
        ruleData.rule_type || 'behavioral',
        conditionJson,
        ruleData.action || 'flag',
        ruleData.severity || 'medium',
      ]
    );

    // Mark suggestion as accepted
    await query(
      `UPDATE rule_suggestions SET status = 'accepted', reviewed_by = $1, reviewed_at = NOW() WHERE id = $2`,
      [req.user.id, req.params.id]
    );

    return res.json({
      message: 'Rule suggestion accepted and promoted to fraud rules',
      rule: ruleResult.rows[0],
      suggestion_id: parseInt(req.params.id),
    });
  } catch (err) {
    console.error('Accept rule suggestion error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// POST /api/rule-suggestions/:id/reject
router.post('/:id/reject', authenticateToken, requireRole('admin', 'analyst'), async (req, res) => {
  try {
    const result = await query(
      `UPDATE rule_suggestions SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW()
       WHERE id = $2 AND status = 'pending'
       RETURNING *`,
      [req.user.id, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Pending rule suggestion not found' });
    }
    return res.json({ message: 'Rule suggestion rejected', suggestion: result.rows[0] });
  } catch (err) {
    console.error('Reject rule suggestion error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// DELETE /api/rule-suggestions/:id
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM rule_suggestions WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Rule suggestion not found' });
    }
    return res.json({ message: 'Rule suggestion deleted', id: result.rows[0].id });
  } catch (err) {
    console.error('Delete rule suggestion error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

module.exports = router;
