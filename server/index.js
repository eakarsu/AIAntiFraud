require('dotenv').config();
const express = require('express');
const cors = require('cors');

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

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  next();
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Anti-Fraud & Credit Analysis Engine',
    version: '1.0.0',
  });
});

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
app.use('/api/ai', aiRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} does not exist`,
    timestamp: new Date().toISOString(),
  });
});

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
  console.log(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
