const express = require('express');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { callOpenRouter, persistAIResult, DEFAULT_MODEL } = require('../aiHelper');

const router = express.Router();

// GET /api/analytics/patterns
router.get('/patterns', authenticateToken, async (req, res) => {
  try {
    // Heatmap: group resolved alerts by alert_type + time_of_day + day_of_week
    const heatmapResult = await query(`
      SELECT
        alert_type,
        EXTRACT(DOW FROM created_at)::int AS day_of_week,
        EXTRACT(HOUR FROM created_at)::int AS hour_of_day,
        COUNT(*) AS frequency
      FROM fraud_alerts
      WHERE status IN ('resolved', 'dismissed')
      GROUP BY alert_type, day_of_week, hour_of_day
      ORDER BY alert_type, day_of_week, hour_of_day
    `);

    // Top alert types
    const alertTypeSummary = await query(`
      SELECT
        alert_type,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'resolved') AS resolved,
        COUNT(*) FILTER (WHERE status = 'dismissed') AS dismissed,
        COUNT(*) FILTER (WHERE severity = 'critical' OR severity = 'high') AS high_severity
      FROM fraud_alerts
      GROUP BY alert_type
      ORDER BY total DESC
      LIMIT 10
    `);

    // Daily trend for last 30 days
    const dailyTrend = await query(`
      SELECT
        DATE(created_at) AS date,
        COUNT(*) AS total_alerts,
        COUNT(*) FILTER (WHERE severity IN ('high', 'critical')) AS high_severity_alerts
      FROM fraud_alerts
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    // Transaction stats for context
    const txStats = await query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE fraud_confirmed = TRUE) AS confirmed_fraud,
        ROUND(AVG(risk_score)::numeric, 2) AS avg_risk
      FROM transactions
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);

    const systemPrompt = `You are a fraud analyst AI. Provide a structured analysis of fraud alert patterns.
Respond ONLY with valid JSON:
{
  "summary": "3-sentence overview of fraud patterns",
  "top_threat_types": ["most common fraud types"],
  "peak_times": {"day": "string", "hour": "string", "description": "string"},
  "trend_assessment": "improving|stable|worsening",
  "key_insights": ["actionable insight strings"],
  "immediate_actions": ["action strings"],
  "risk_forecast": "string describing expected near-term risk"
}`;

    const userPrompt = `Analyze these fraud alert patterns:

Top Alert Types:
${JSON.stringify(alertTypeSummary.rows.slice(0, 8), null, 2)}

Heatmap sample (first 20 rows):
${JSON.stringify(heatmapResult.rows.slice(0, 20), null, 2)}

Last 30 days transaction stats:
${JSON.stringify(txStats.rows[0], null, 2)}

Daily trend (last 30 days, summary):
Total days with alerts: ${dailyTrend.rows.length}
Peak alert day count: ${Math.max(...dailyTrend.rows.map(r => parseInt(r.total_alerts) || 0), 0)}`;

    let aiAnalysis = null;
    try {
      const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
      aiAnalysis = await callOpenRouter(systemPrompt, userPrompt, model);
      await persistAIResult({
        endpoint: 'analytics-patterns',
        entityType: 'platform',
        entityId: null,
        inputData: { alert_type_count: alertTypeSummary.rows.length },
        result: aiAnalysis,
        modelUsed: model,
        userId: null,
      });
    } catch (aiErr) {
      console.error('AI pattern analysis error:', aiErr.message);
      aiAnalysis = { summary: 'AI analysis unavailable', raw_error: aiErr.message };
    }

    // Structure heatmap as { alert_type -> { day -> { hour -> count } } }
    const heatmapData = {};
    heatmapResult.rows.forEach(row => {
      if (!heatmapData[row.alert_type]) heatmapData[row.alert_type] = {};
      if (!heatmapData[row.alert_type][row.day_of_week]) heatmapData[row.alert_type][row.day_of_week] = {};
      heatmapData[row.alert_type][row.day_of_week][row.hour_of_day] = parseInt(row.frequency);
    });

    return res.json({
      heatmap: heatmapData,
      heatmap_raw: heatmapResult.rows,
      alert_type_summary: alertTypeSummary.rows,
      daily_trend: dailyTrend.rows,
      ai_analysis: aiAnalysis,
      // backward-compat field
      ai_pattern_summary: typeof aiAnalysis?.summary === 'string' ? aiAnalysis.summary : null,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Analytics patterns error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

module.exports = router;
