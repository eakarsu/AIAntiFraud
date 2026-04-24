const express = require('express');
const { query } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/risk-models
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, model_type, page = 1, limit = 20, sort_by = 'created_at', sort_order = 'DESC' } = req.query;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`status = $${paramIndex++}::model_status`);
      params.push(status);
    }
    if (model_type) {
      conditions.push(`model_type = $${paramIndex++}`);
      params.push(model_type);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const allowedSortColumns = ['created_at', 'accuracy', 'f1_score', 'name', 'status', 'last_trained_at'];
    const safeSortBy = allowedSortColumns.includes(sort_by) ? sort_by : 'created_at';
    const safeSortOrder = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const countResult = await query(
      `SELECT COUNT(*) FROM risk_models ${whereClause}`,
      params
    );

    const dataResult = await query(
      `SELECT * FROM risk_models ${whereClause}
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
    console.error('Get risk models error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// GET /api/risk-models/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT * FROM risk_models WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Risk model not found' });
    }

    return res.json({ model: result.rows[0] });
  } catch (err) {
    console.error('Get risk model error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// POST /api/risk-models
router.post('/', authenticateToken, requireRole('admin', 'analyst'), async (req, res) => {
  try {
    const {
      name,
      description,
      model_type,
      accuracy,
      precision_score,
      recall_score,
      f1_score,
      status = 'inactive',
      last_trained_at,
    } = req.body;

    if (!name || !model_type) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'name and model_type are required',
      });
    }

    const validStatuses = ['training', 'active', 'inactive', 'archived'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `status must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const result = await query(
      `INSERT INTO risk_models
         (name, description, model_type, accuracy, precision_score, recall_score, f1_score, status, last_trained_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::model_status, $9)
       RETURNING *`,
      [
        name,
        description || null,
        model_type,
        accuracy || null,
        precision_score || null,
        recall_score || null,
        f1_score || null,
        status,
        last_trained_at || null,
      ]
    );

    return res.status(201).json({ model: result.rows[0] });
  } catch (err) {
    console.error('Create risk model error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// PUT /api/risk-models/:id
router.put('/:id', authenticateToken, requireRole('admin', 'analyst'), async (req, res) => {
  try {
    const {
      name, description, model_type, accuracy, precision_score,
      recall_score, f1_score, status, last_trained_at,
    } = req.body;

    const existing = await query('SELECT id FROM risk_models WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Risk model not found' });
    }

    const result = await query(
      `UPDATE risk_models SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         model_type = COALESCE($3, model_type),
         accuracy = COALESCE($4, accuracy),
         precision_score = COALESCE($5, precision_score),
         recall_score = COALESCE($6, recall_score),
         f1_score = COALESCE($7, f1_score),
         status = COALESCE($8::model_status, status),
         last_trained_at = COALESCE($9, last_trained_at)
       WHERE id = $10
       RETURNING *`,
      [
        name || null, description || null, model_type || null,
        accuracy || null, precision_score || null, recall_score || null,
        f1_score || null, status || null, last_trained_at || null,
        req.params.id,
      ]
    );

    return res.json({ model: result.rows[0] });
  } catch (err) {
    console.error('Update risk model error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// PATCH /api/risk-models/:id/status
router.patch('/:id/status', authenticateToken, requireRole('admin', 'analyst'), async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['training', 'active', 'inactive', 'archived'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `status must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const result = await query(
      `UPDATE risk_models SET status = $1::model_status WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Risk model not found' });
    }

    return res.json({ model: result.rows[0], message: `Model status updated to '${status}'` });
  } catch (err) {
    console.error('Patch risk model status error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// DELETE /api/risk-models/:id
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM risk_models WHERE id = $1 RETURNING id, name',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Risk model not found' });
    }

    return res.json({ message: 'Risk model deleted successfully', deleted: result.rows[0] });
  } catch (err) {
    console.error('Delete risk model error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

module.exports = router;
