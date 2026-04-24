const express = require('express');
const { query } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/audit-log
router.get('/', authenticateToken, requireRole('admin', 'analyst'), async (req, res) => {
  try {
    const {
      user_id,
      action,
      entity_type,
      page = 1,
      limit = 50,
      start_date,
      end_date,
      sort_order = 'DESC',
    } = req.query;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (user_id) {
      conditions.push(`al.user_id = $${paramIndex++}`);
      params.push(parseInt(user_id));
    }
    if (action) {
      conditions.push(`al.action = $${paramIndex++}`);
      params.push(action);
    }
    if (entity_type) {
      conditions.push(`al.entity_type = $${paramIndex++}`);
      params.push(entity_type);
    }
    if (start_date) {
      conditions.push(`al.created_at >= $${paramIndex++}`);
      params.push(start_date);
    }
    if (end_date) {
      conditions.push(`al.created_at <= $${paramIndex++}`);
      params.push(end_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const safeSortOrder = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const countResult = await query(
      `SELECT COUNT(*) FROM audit_log al ${whereClause}`,
      params
    );

    const dataResult = await query(
      `SELECT al.*, u.name AS user_name, u.email AS user_email
       FROM audit_log al
       LEFT JOIN users u ON al.user_id = u.id
       ${whereClause}
       ORDER BY al.created_at ${safeSortOrder}
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
    console.error('Get audit log error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// GET /api/audit-log/:id
router.get('/:id', authenticateToken, requireRole('admin', 'analyst'), async (req, res) => {
  try {
    const result = await query(
      `SELECT al.*, u.name AS user_name, u.email AS user_email
       FROM audit_log al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Audit log entry not found' });
    }

    return res.json({ entry: result.rows[0] });
  } catch (err) {
    console.error('Get audit log entry error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

module.exports = router;
