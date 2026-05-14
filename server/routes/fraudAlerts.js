const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

const VALID_ALERT_TYPES = [
  'velocity_check', 'amount_threshold', 'location_anomaly', 'behavioral_anomaly',
  'card_testing', 'account_takeover', 'identity_theft', 'merchant_fraud',
  'chargeback_abuse', 'synthetic_identity', 'ai_risk_score', 'manual',
];

const validateFraudAlert = [
  body('alert_type')
    .notEmpty().withMessage('alert_type is required')
    .isIn(VALID_ALERT_TYPES).withMessage(`alert_type must be one of: ${VALID_ALERT_TYPES.join(', ')}`),
  body('severity')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical']).withMessage('severity must be low, medium, high, or critical'),
  body('amount')
    .optional()
    .isFloat({ gt: 0 }).withMessage('amount must be a positive number'),
];

// GET /api/fraud-alerts
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      status,
      severity,
      alert_type,
      assigned_to,
      page = 1,
      limit = 20,
      sort_by = 'created_at',
      sort_order = 'DESC',
    } = req.query;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`fa.status = $${paramIndex++}::alert_status`);
      params.push(status);
    }
    if (severity) {
      conditions.push(`fa.severity = $${paramIndex++}::alert_severity`);
      params.push(severity);
    }
    if (alert_type) {
      conditions.push(`fa.alert_type = $${paramIndex++}`);
      params.push(alert_type);
    }
    if (assigned_to) {
      conditions.push(`fa.assigned_to = $${paramIndex++}`);
      params.push(parseInt(assigned_to));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const allowedSortColumns = ['created_at', 'severity', 'status', 'alert_type'];
    const safeSortBy = allowedSortColumns.includes(sort_by) ? sort_by : 'created_at';
    const safeSortOrder = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const countResult = await query(
      `SELECT COUNT(*) FROM fraud_alerts fa ${whereClause}`,
      params
    );

    const dataResult = await query(
      `SELECT
         fa.*,
         t.amount, t.currency, t.merchant_name, t.status AS transaction_status,
         fr.name AS rule_name, fr.rule_type,
         u.name AS assigned_to_name
       FROM fraud_alerts fa
       LEFT JOIN transactions t  ON fa.transaction_id = t.id
       LEFT JOIN fraud_rules  fr ON fa.rule_id = fr.id
       LEFT JOIN users        u  ON fa.assigned_to = u.id
       ${whereClause}
       ORDER BY fa.${safeSortBy} ${safeSortOrder}
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
    console.error('Get fraud alerts error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// GET /api/fraud-alerts/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT
         fa.*,
         t.amount, t.currency, t.merchant_name, t.card_number_last4, t.location_country,
         t.location_city, t.ip_address, t.status AS transaction_status, t.risk_score,
         fr.name AS rule_name, fr.description AS rule_description, fr.rule_type, fr.condition_json,
         u.name AS assigned_to_name, u.email AS assigned_to_email
       FROM fraud_alerts fa
       LEFT JOIN transactions t  ON fa.transaction_id = t.id
       LEFT JOIN fraud_rules  fr ON fa.rule_id = fr.id
       LEFT JOIN users        u  ON fa.assigned_to = u.id
       WHERE fa.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Fraud alert not found' });
    }

    return res.json({ alert: result.rows[0] });
  } catch (err) {
    console.error('Get fraud alert error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// POST /api/fraud-alerts
router.post('/', authenticateToken, validateFraudAlert, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation Error', errors: errors.array() });
  }

  try {
    const {
      transaction_id,
      rule_id,
      alert_type,
      severity = 'medium',
      description,
      status = 'open',
      assigned_to,
    } = req.body;

    if (transaction_id) {
      const txCheck = await query('SELECT id FROM transactions WHERE id = $1', [transaction_id]);
      if (txCheck.rows.length === 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Referenced transaction does not exist',
        });
      }
    }

    const result = await query(
      `INSERT INTO fraud_alerts
         (transaction_id, rule_id, alert_type, severity, description, status, assigned_to)
       VALUES ($1, $2, $3, $4::alert_severity, $5, $6::alert_status, $7)
       RETURNING *`,
      [
        transaction_id || null,
        rule_id || null,
        alert_type,
        severity,
        description || null,
        status,
        assigned_to || null,
      ]
    );

    return res.status(201).json({ alert: result.rows[0] });
  } catch (err) {
    console.error('Create fraud alert error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// PUT /api/fraud-alerts/:id
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { alert_type, severity, description, status, assigned_to } = req.body;

    const existing = await query('SELECT id FROM fraud_alerts WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Fraud alert not found' });
    }

    const resolvedAt = status === 'resolved' ? new Date().toISOString() : null;

    const result = await query(
      `UPDATE fraud_alerts SET
         alert_type  = COALESCE($1, alert_type),
         severity    = COALESCE($2::alert_severity, severity),
         description = COALESCE($3, description),
         status      = COALESCE($4::alert_status, status),
         assigned_to = COALESCE($5, assigned_to),
         resolved_at = CASE WHEN $4 = 'resolved' THEN NOW() ELSE resolved_at END
       WHERE id = $6
       RETURNING *`,
      [
        alert_type || null,
        severity || null,
        description || null,
        status || null,
        assigned_to || null,
        req.params.id,
      ]
    );

    return res.json({ alert: result.rows[0] });
  } catch (err) {
    console.error('Update fraud alert error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// PATCH /api/fraud-alerts/:id/status
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status, assigned_to } = req.body;
    const validStatuses = ['open', 'investigating', 'resolved', 'dismissed'];

    if (!status) {
      return res.status(400).json({ error: 'Bad Request', message: 'status is required' });
    }

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `status must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const result = await query(
      `UPDATE fraud_alerts SET
         status      = $1::alert_status,
         assigned_to = COALESCE($2, assigned_to),
         resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE resolved_at END
       WHERE id = $3
       RETURNING *`,
      [status, assigned_to || null, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Fraud alert not found' });
    }

    return res.json({
      alert: result.rows[0],
      message: `Alert status updated to '${status}'`,
    });
  } catch (err) {
    console.error('Patch alert status error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// PATCH /api/fraud-alerts/:id/assign
router.patch('/:id/assign', authenticateToken, async (req, res) => {
  try {
    const { assigned_to } = req.body;

    if (!assigned_to) {
      return res.status(400).json({ error: 'Bad Request', message: 'assigned_to user id is required' });
    }

    const userCheck = await query('SELECT id, name FROM users WHERE id = $1', [assigned_to]);
    if (userCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'Assigned user does not exist' });
    }

    const result = await query(
      `UPDATE fraud_alerts SET assigned_to = $1, status = 'investigating'
       WHERE id = $2
       RETURNING *`,
      [assigned_to, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Fraud alert not found' });
    }

    return res.json({
      alert: result.rows[0],
      message: `Alert assigned to ${userCheck.rows[0].name}`,
    });
  } catch (err) {
    console.error('Assign alert error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// DELETE /api/fraud-alerts/:id
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM fraud_alerts WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Fraud alert not found' });
    }

    return res.json({ message: 'Fraud alert deleted successfully', id: result.rows[0].id });
  } catch (err) {
    console.error('Delete fraud alert error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

module.exports = router;
