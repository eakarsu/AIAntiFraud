require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const fraudRuleRoutes = require('./routes/fraudRules');
const fraudAlertRoutes = require('./routes/fraudAlerts');
const creditScoreRoutes = require('./routes/creditScores');
const riskModelRoutes = require('./routes/riskModels');
const watchlistRoutes = require('./routes/watchlist');
const auditLogRoutes = require('./routes/auditLog');
const behavioralRoutes = require('./routes/behavioral');
const merchantRoutes = require('./routes/merchants');
const dashboardRoutes = require('./routes/dashboard');
const aiRoutes = require('./routes/ai');
const analyticsRoutes = require('./routes/analytics');
const usersRoutes = require('./routes/users');
const ruleSuggestionsRoutes = require('./routes/ruleSuggestions');
const casesRoutes = require('./routes/cases');
const chargebacksRoutes = require('./routes/chargebacks');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must contain at least 32 characters');
}
if (process.env.NODE_ENV === 'production' && !process.env.CLIENT_URL) throw new Error('CLIENT_URL is required in production');
if (process.env.NODE_ENV === 'production' && !process.env.DEFAULT_TENANT_ID) throw new Error('DEFAULT_TENANT_ID is required in production');

const app = express();
const PORT = process.env.PORT || 3001;

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // Allow API to be consumed by any client
}));

// Rate limiting
const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  keyGenerator: (req) => {
    const authHeader = req.headers.authorization;
    if (authHeader) return authHeader;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return ip.replace(/^::ffff:/, '');
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, ipKeyGenerator: false },
  message: { error: 'Too Many Requests', message: 'AI rate limit exceeded. Maximum 20 AI requests per hour.' },
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  keyGenerator: (req) => {
    const authHeader = req.headers.authorization;
    if (authHeader) return authHeader;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return ip.replace(/^::ffff:/, '');
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, ipKeyGenerator: false },
  message: { error: 'Too Many Requests', message: 'Rate limit exceeded. Maximum 100 requests per 15 minutes.' },
});

// CORS
const allowedOrigins = process.env.CLIENT_URL
  ? [process.env.CLIENT_URL]
  : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  next();
});

// Health check (no rate limit, no auth)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Anti-Fraud & Credit Analysis Engine',
    version: '2.0.0',
  });
});

// Apply general rate limiter to all API routes
app.use('/api/', generalLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/fraud-rules', fraudRuleRoutes);
app.use('/api/fraud-alerts', fraudAlertRoutes);
app.use('/api/credit-scores', creditScoreRoutes);
app.use('/api/risk-models', riskModelRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/audit-log', auditLogRoutes);
app.use('/api/behavioral-patterns', behavioralRoutes);
app.use('/api/merchant-profiles', merchantRoutes);
app.use('/api/dashboard', dashboardRoutes);
if (process.env.ENABLE_EXPERIMENTAL_AI === 'true') app.use('/api/ai', aiRateLimiter, aiRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/rule-suggestions', ruleSuggestionsRoutes);
app.use('/api/cases', casesRoutes);
app.use('/api/chargebacks', chargebacksRoutes);
app.use('/api/refund-abuse-risk', require('./routes/refundAbuseRisk'));
app.use('/api/governed-investigations', require('./routes/governedInvestigations'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} does not exist`,
    timestamp: new Date().toISOString(),
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.name || 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`Anti-Fraud Engine API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;
