const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || 'default';

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email and password are required',
      });
    }

    const result = await query(
      'SELECT id, email, password_hash, name, role, tenant_id FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenant_id: user.tenant_id,
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    await query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details_json, ip_address)
       VALUES ($1, 'LOGIN', 'user', $2, $3, $4::inet)`,
      [
        user.id,
        user.id,
        JSON.stringify({ method: 'password', success: true }),
        req.ip || '0.0.0.0',
      ]
    );

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenant_id: user.tenant_id,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred during login',
    });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  if (process.env.ALLOW_PUBLIC_REGISTRATION !== 'true') {
    return res.status(403).json({ error: 'Forbidden', message: 'Public registration is disabled; request an organization invitation' });
  }
  try {
    const { email, password, name } = req.body;
    const role = 'analyst';

    if (!email || !password || !name) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email, password, and name are required',
      });
    }

    if (password.length < 12) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Password must be at least 12 characters long',
      });
    }

    const validRoles = ['admin', 'analyst', 'reviewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Role must be one of: ${validRoles.join(', ')}`,
      });
    }

    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'An account with this email already exists',
      });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const result = await query(
      `INSERT INTO users (email, password_hash, name, role, tenant_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, role, tenant_id, created_at`,
      [email.toLowerCase().trim(), passwordHash, name.trim(), role, DEFAULT_TENANT_ID]
    );

    const newUser = result.rows[0];

    const token = jwt.sign(
      {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        tenant_id: newUser.tenant_id,
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        tenant_id: newUser.tenant_id,
        created_at: newUser.created_at,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred during registration',
    });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, email, name, role, tenant_id, created_at FROM users WHERE id = $1 AND tenant_id = $2',
      [req.user.id, req.user.tenant_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    return res.status(200).json({ user: result.rows[0] });
  } catch (err) {
    console.error('Get me error:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while fetching user data',
    });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Current password and new password are required',
      });
    }

    if (newPassword.length < 12) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'New password must be at least 12 characters long',
      });
    }

    const result = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }

    const isCurrentValid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!isCurrentValid) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Current password is incorrect',
      });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);

    return res.status(200).json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An error occurred while changing the password',
    });
  }
});

module.exports = router;
