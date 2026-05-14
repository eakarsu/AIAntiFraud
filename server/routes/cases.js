const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

const validateCase = [
  body('title').notEmpty().withMessage('title is required').isLength({ max: 500 }).withMessage('title too long'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid priority'),
  body('status').optional().isIn(['open', 'investigating', 'submitted', 'resolved', 'closed']).withMessage('Invalid status'),
];

// GET /api/cases
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, priority, assigned_to, page = 1, limit = 20 } = req.query;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (status) { conditions.push(`c.status = $${paramIndex++}::case_status`); params.push(status); }
    if (priority) { conditions.push(`c.priority = $${paramIndex++}::rule_severity`); params.push(priority); }
    if (assigned_to) { conditions.push(`c.assigned_to = $${paramIndex++}`); params.push(parseInt(assigned_to)); }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const countResult = await query(`SELECT COUNT(*) FROM cases c ${whereClause}`, params);
    const dataResult = await query(
      `SELECT c.*,
              a.name AS assigned_to_name, a.email AS assigned_to_email,
              cb.name AS created_by_name
       FROM cases c
       LEFT JOIN users a ON c.assigned_to = a.id
       LEFT JOIN users cb ON c.created_by = cb.id
       ${whereClause}
       ORDER BY c.created_at DESC
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
    console.error('Get cases error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// GET /api/cases/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const caseResult = await query(
      `SELECT c.*,
              a.name AS assigned_to_name, a.email AS assigned_to_email,
              cb.name AS created_by_name
       FROM cases c
       LEFT JOIN users a ON c.assigned_to = a.id
       LEFT JOIN users cb ON c.created_by = cb.id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (caseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Case not found' });
    }

    const notesResult = await query(
      `SELECT cn.*, u.name AS user_name
       FROM case_notes cn
       LEFT JOIN users u ON cn.user_id = u.id
       WHERE cn.case_id = $1
       ORDER BY cn.created_at ASC`,
      [req.params.id]
    );

    return res.json({ case: caseResult.rows[0], notes: notesResult.rows });
  } catch (err) {
    console.error('Get case error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// POST /api/cases
router.post('/', authenticateToken, validateCase, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation Error', errors: errors.array() });
  }
  try {
    const { title, description, priority = 'medium', assigned_to, alert_id, transaction_id } = req.body;

    const result = await query(
      `INSERT INTO cases (title, description, priority, assigned_to, created_by, alert_id, transaction_id)
       VALUES ($1, $2, $3::rule_severity, $4, $5, $6, $7)
       RETURNING *`,
      [title, description || null, priority, assigned_to || null, req.user.id, alert_id || null, transaction_id || null]
    );

    // Add initial note
    await query(
      `INSERT INTO case_notes (case_id, user_id, note, note_type) VALUES ($1, $2, $3, 'status_change')`,
      [result.rows[0].id, req.user.id, 'Case opened']
    );

    return res.status(201).json({ case: result.rows[0] });
  } catch (err) {
    console.error('Create case error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// PUT /api/cases/:id
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { title, description, status, priority, assigned_to } = req.body;

    const existing = await query('SELECT id FROM cases WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Case not found' });
    }

    const resolvedAt = status === 'resolved' || status === 'closed' ? 'NOW()' : null;

    const result = await query(
      `UPDATE cases SET
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         status = COALESCE($3::case_status, status),
         priority = COALESCE($4::rule_severity, priority),
         assigned_to = COALESCE($5, assigned_to),
         resolved_at = CASE WHEN $3 IN ('resolved', 'closed') THEN NOW() ELSE resolved_at END
       WHERE id = $6
       RETURNING *`,
      [title || null, description || null, status || null, priority || null, assigned_to || null, req.params.id]
    );

    return res.json({ case: result.rows[0] });
  } catch (err) {
    console.error('Update case error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// PATCH /api/cases/:id/status
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['open', 'investigating', 'submitted', 'resolved', 'closed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `status must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const result = await query(
      `UPDATE cases SET
         status = $1::case_status,
         resolved_at = CASE WHEN $1 IN ('resolved', 'closed') THEN NOW() ELSE resolved_at END
       WHERE id = $2
       RETURNING *`,
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Case not found' });
    }

    // Add status change note
    await query(
      `INSERT INTO case_notes (case_id, user_id, note, note_type) VALUES ($1, $2, $3, 'status_change')`,
      [req.params.id, req.user.id, `Status changed to: ${status}`]
    );

    return res.json({ case: result.rows[0], message: `Case status updated to '${status}'` });
  } catch (err) {
    console.error('Update case status error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// POST /api/cases/:id/notes — add a note
router.post('/:id/notes', authenticateToken, async (req, res) => {
  try {
    const { note, note_type = 'comment' } = req.body;
    if (!note) {
      return res.status(400).json({ error: 'Bad Request', message: 'note is required' });
    }
    const validTypes = ['comment', 'evidence', 'decision', 'status_change'];
    if (!validTypes.includes(note_type)) {
      return res.status(400).json({ error: 'Bad Request', message: `note_type must be one of: ${validTypes.join(', ')}` });
    }

    const caseCheck = await query('SELECT id FROM cases WHERE id = $1', [req.params.id]);
    if (caseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Case not found' });
    }

    const result = await query(
      `INSERT INTO case_notes (case_id, user_id, note, note_type) VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.id, req.user.id, note, note_type]
    );

    return res.status(201).json({ note: result.rows[0] });
  } catch (err) {
    console.error('Add case note error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// DELETE /api/cases/:id
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await query('DELETE FROM cases WHERE id = $1 RETURNING id, title', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Case not found' });
    }
    return res.json({ message: 'Case deleted', deleted: result.rows[0] });
  } catch (err) {
    console.error('Delete case error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

module.exports = router;
