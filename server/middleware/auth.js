const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Access token is required',
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'TokenExpired',
          message: 'Access token has expired. Please log in again.',
        });
      }
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid access token',
      });
    }
    if (!decoded.tenant_id || typeof decoded.tenant_id !== 'string') {
      return res.status(403).json({ error: 'Forbidden', message: 'Token is missing organization scope' });
    }
    req.user = decoded;
    next();
  });
};

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Required role(s): ${allowedRoles.join(', ')}`,
      });
    }
    next();
  };
};

module.exports = { authenticateToken, requireRole };
