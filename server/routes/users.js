const express = require('express');
const { query } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/users
router.get('/', authenticateToken, requireRole('admin', 'analyst'), async (req, res) => {
  try {
    const { page = 1, limit = 20, role, is_active, search } = req.query;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (role) {
      conditions.push(`role = $${paramIndex++}`);
      params.push(role);
    }
    if (is_active !== undefined) {
      conditions.push(`is_active = $${paramIndex++}`);
      params.push(is_active === 'true');
    }
    if (search) {
      conditions.push(`(name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const countResult = await query(`SELECT COUNT(*) FROM users ${whereClause}`, params);
    const dataResult = await query(
      `SELECT id, email, name, role, is_active, created_at FROM users ${whereClause}
       ORDER BY created_at DESC
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
    console.error('Get users error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// GET /api/users/:id
router.get('/:id', authenticateToken, requireRole('admin', 'analyst'), async (req, res) => {
  try {
    const result = await query(
      'SELECT id, email, name, role, is_active, created_at FROM users WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }
    return res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Get user error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// PATCH /api/users/:id/role
router.patch('/:id/role', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['admin', 'analyst', 'reviewer'];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `role must be one of: ${validRoles.join(', ')}`,
      });
    }
    const result = await query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, name, role, is_active',
      [role, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }
    return res.json({ user: result.rows[0], message: `Role updated to '${role}'` });
  } catch (err) {
    console.error('Update user role error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// PATCH /api/users/:id/toggle
router.patch('/:id/toggle', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await query(
      'UPDATE users SET is_active = NOT is_active WHERE id = $1 RETURNING id, email, name, role, is_active',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }
    return res.json({
      user: result.rows[0],
      message: `User ${result.rows[0].is_active ? 'activated' : 'deactivated'}`,
    });
  } catch (err) {
    console.error('Toggle user error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

module.exports = router;
