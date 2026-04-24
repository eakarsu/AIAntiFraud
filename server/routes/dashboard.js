const express = require('express');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard/stats
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const transactionStatsResult = await query(`
      SELECT
        COUNT(*)                                            AS total_transactions,
        COUNT(*) FILTER (WHERE status = 'flagged')         AS flagged_count,
        COUNT(*) FILTER (WHERE status = 'blocked')         AS blocked_count,
        COUNT(*) FILTER (WHERE status = 'approved')        AS approved_count,
        COUNT(*) FILTER (WHERE status = 'pending')         AS pending_count,
        COUNT(*) FILTER (WHERE fraud_confirmed = TRUE)     AS confirmed_fraud_count,
        ROUND(AVG(risk_score)::numeric, 2)                 AS avg_risk_score,
        ROUND(SUM(amount)::numeric, 2)                     AS total_volume,
        ROUND(
          (COUNT(*) FILTER (WHERE fraud_confirmed = TRUE)::decimal
           / NULLIF(COUNT(*), 0)) * 100, 2
        )                                                  AS fraud_rate
      FROM transactions
    `);

    const alertStatsResult = await query(`
      SELECT
        COUNT(*)                                           AS total_alerts,
        COUNT(*) FILTER (WHERE status = 'open')           AS open_alerts,
        COUNT(*) FILTER (WHERE status = 'investigating')  AS investigating_alerts,
        COUNT(*) FILTER (WHERE status = 'resolved')       AS resolved_alerts,
        COUNT(*) FILTER (WHERE status = 'dismissed')      AS dismissed_alerts
      FROM fraud_alerts
    `);

    const recentAlertsResult = await query(`
      SELECT
        fa.id, fa.alert_type, fa.severity, fa.description, fa.status, fa.created_at,
        t.amount, t.currency, t.merchant_name,
        fr.name AS rule_name
      FROM fraud_alerts fa
      LEFT JOIN transactions t ON fa.transaction_id = t.id
      LEFT JOIN fraud_rules fr ON fa.rule_id = fr.id
      ORDER BY fa.created_at DESC
      LIMIT 10
    `);

    const riskDistributionResult = await query(`
      SELECT
        CASE
          WHEN risk_score < 20  THEN 'very_low'
          WHEN risk_score < 40  THEN 'low'
          WHEN risk_score < 60  THEN 'medium'
          WHEN risk_score < 80  THEN 'high'
          ELSE                       'critical'
        END AS risk_band,
        COUNT(*) AS count,
        ROUND(AVG(amount)::numeric, 2) AS avg_amount
      FROM transactions
      WHERE risk_score IS NOT NULL
      GROUP BY risk_band
      ORDER BY
        CASE
          WHEN risk_score < 20  THEN 1
          WHEN risk_score < 40  THEN 2
          WHEN risk_score < 60  THEN 3
          WHEN risk_score < 80  THEN 4
          ELSE                       5
        END
    `);

    const alertSeverityDistResult = await query(`
      SELECT severity, COUNT(*) AS count
      FROM fraud_alerts
      GROUP BY severity
    `);

    const topFlaggedMerchantsResult = await query(`
      SELECT merchant_name, risk_score, chargeback_rate, fraud_incident_count, country
      FROM merchant_risk_profiles
      WHERE is_flagged = TRUE
      ORDER BY risk_score DESC
      LIMIT 5
    `);

    const activeRulesCountResult = await query(`
      SELECT COUNT(*) AS active_rules FROM fraud_rules WHERE is_active = TRUE
    `);

    const watchlistCountResult = await query(`
      SELECT COUNT(*) AS active_watchlist FROM watchlist WHERE is_active = TRUE
    `);

    const activeModelsCountResult = await query(`
      SELECT COUNT(*) AS active_models FROM risk_models WHERE status = 'active'
    `);

    return res.json({
      transactions: transactionStatsResult.rows[0],
      alerts: alertStatsResult.rows[0],
      recent_alerts: recentAlertsResult.rows,
      risk_distribution: riskDistributionResult.rows,
      alert_severity_distribution: alertSeverityDistResult.rows,
      top_flagged_merchants: topFlaggedMerchantsResult.rows,
      active_rules: parseInt(activeRulesCountResult.rows[0].active_rules),
      active_watchlist: parseInt(watchlistCountResult.rows[0].active_watchlist),
      active_models: parseInt(activeModelsCountResult.rows[0].active_models),
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

module.exports = router;
