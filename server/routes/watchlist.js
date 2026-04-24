const express = require('express');
const { query } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/watchlist
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      is_active,
      entity_type,
      risk_level,
      search,
      page = 1,
      limit = 20,
      sort_by = 'created_at',
      sort_order = 'DESC',
    } = req.query;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (is_active !== undefined) {
      conditions.push(`w.is_active = $${paramIndex++}`);
      params.push(is_active === 'true');
    }
    if (entity_type) {
      conditions.push(`w.entity_type = $${paramIndex++}::entity_type_enum`);
      params.push(entity_type);
    }
    if (risk_level) {
      conditions.push(`w.risk_level = $${paramIndex++}::risk_level_enum`);
      params.push(risk_level);
    }
    if (search) {
      conditions.push(`(w.entity_name ILIKE $${paramIndex} OR w.identifier ILIKE $${paramIndex} OR w.reason ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const allowedSortColumns = ['created_at', 'entity_name', 'risk_level', 'entity_type'];
    const safeSortBy = allowedSortColumns.includes(sort_by) ? sort_by : 'created_at';
    const safeSortOrder = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const countResult = await query(
      `SELECT COUNT(*) FROM watchlist w ${whereClause}`,
      params
    );

    const dataResult = await query(
      `SELECT w.*, u.name AS added_by_name
       FROM watchlist w
       LEFT JOIN users u ON w.added_by = u.id
       ${whereClause}
       ORDER BY w.${safeSortBy} ${safeSortOrder}
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
    console.error('Get watchlist error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// GET /api/watchlist/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT w.*, u.name AS added_by_name
       FROM watchlist w
       LEFT JOIN users u ON w.added_by = u.id
       WHERE w.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Watchlist entry not found' });
    }

    return res.json({ entry: result.rows[0] });
  } catch (err) {
    console.error('Get watchlist entry error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// POST /api/watchlist
router.post('/', authenticateToken, requireRole('admin', 'analyst'), async (req, res) => {
  try {
    const {
      entity_name,
      entity_type = 'individual',
      identifier,
      reason,
      risk_level = 'high',
      source,
      is_active = true,
    } = req.body;

    if (!entity_name) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'entity_name is required',
      });
    }

    const validEntityTypes = ['individual', 'organization'];
    if (!validEntityTypes.includes(entity_type)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `entity_type must be one of: ${validEntityTypes.join(', ')}`,
      });
    }

    const result = await query(
      `INSERT INTO watchlist
         (entity_name, entity_type, identifier, reason, risk_level, source, is_active, added_by)
       VALUES ($1, $2::entity_type_enum, $3, $4, $5::risk_level_enum, $6, $7, $8)
       RETURNING *`,
      [
        entity_name,
        entity_type,
        identifier || null,
        reason || null,
        risk_level,
        source || null,
        is_active,
        req.user.id,
      ]
    );

    return res.status(201).json({ entry: result.rows[0] });
  } catch (err) {
    console.error('Create watchlist entry error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// PUT /api/watchlist/:id
router.put('/:id', authenticateToken, requireRole('admin', 'analyst'), async (req, res) => {
  try {
    const { entity_name, entity_type, identifier, reason, risk_level, source, is_active } = req.body;

    const existing = await query('SELECT id FROM watchlist WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Watchlist entry not found' });
    }

    const result = await query(
      `UPDATE watchlist SET
         entity_name = COALESCE($1, entity_name),
         entity_type = COALESCE($2::entity_type_enum, entity_type),
         identifier = COALESCE($3, identifier),
         reason = COALESCE($4, reason),
         risk_level = COALESCE($5::risk_level_enum, risk_level),
         source = COALESCE($6, source),
         is_active = COALESCE($7, is_active)
       WHERE id = $8
       RETURNING *`,
      [
        entity_name || null,
        entity_type || null,
        identifier || null,
        reason || null,
        risk_level || null,
        source || null,
        is_active !== undefined ? is_active : null,
        req.params.id,
      ]
    );

    return res.json({ entry: result.rows[0] });
  } catch (err) {
    console.error('Update watchlist entry error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// PATCH /api/watchlist/:id/toggle
router.patch('/:id/toggle', authenticateToken, requireRole('admin', 'analyst'), async (req, res) => {
  try {
    const result = await query(
      `UPDATE watchlist SET is_active = NOT is_active WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Watchlist entry not found' });
    }

    return res.json({
      entry: result.rows[0],
      message: `Watchlist entry ${result.rows[0].is_active ? 'activated' : 'deactivated'}`,
    });
  } catch (err) {
    console.error('Toggle watchlist entry error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// DELETE /api/watchlist/:id
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM watchlist WHERE id = $1 RETURNING id, entity_name',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Watchlist entry not found' });
    }

    return res.json({ message: 'Watchlist entry deleted successfully', deleted: result.rows[0] });
  } catch (err) {
    console.error('Delete watchlist entry error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

module.exports = router;
