const express = require('express');
const axios = require('axios');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const callOpenRouter = async (systemPrompt, userPrompt) => {
  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: process.env.OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  let text = response.data.choices[0].message.content;
  // Strip markdown code fences if present
  const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (jsonMatch) text = jsonMatch[1].trim();
  try {
    return JSON.parse(text);
  } catch {
    return { raw_response: text };
  }
};

// POST /api/ai/analyze-transaction
router.post('/analyze-transaction', authenticateToken, async (req, res) => {
  try {
    const { transaction_id, transaction_data } = req.body;

    let tx = transaction_data;
    if (transaction_id && !tx) {
      const result = await query(
        `SELECT t.*, u.name AS user_name
         FROM transactions t
         LEFT JOIN users u ON t.user_id = u.id
         WHERE t.id = $1`,
        [transaction_id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Not Found', message: 'Transaction not found' });
      }
      tx = result.rows[0];
    }

    if (!tx) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Provide transaction_id or transaction_data',
      });
    }

    const systemPrompt = `You are an expert anti-fraud analyst AI. Analyze the given transaction data and provide a comprehensive fraud risk assessment.
Respond in JSON format with these fields:
- risk_score (0-100)
- risk_level (low, medium, high, critical)
- fraud_probability (0-1)
- fraud_indicators (array of strings)
- legitimate_indicators (array of strings)
- recommended_action (approve, flag, block, manual_review)
- reasoning (detailed explanation)
- similar_fraud_patterns (array of known fraud patterns this matches)
- confidence (0-100)`;

    const userPrompt = `Analyze this transaction for fraud:
Amount: ${tx.currency || 'USD'} ${tx.amount}
Merchant: ${tx.merchant_name} (${tx.merchant_category || 'unknown'})
Card Last 4: ${tx.card_number_last4 || 'N/A'}
IP: ${tx.ip_address || 'N/A'}
Location: ${tx.location_city || 'N/A'}, ${tx.location_country || 'N/A'}
Device: ${tx.device_id || 'N/A'}
Online: ${tx.is_online}
Time: ${tx.created_at || new Date().toISOString()}`;

    const analysis = await callOpenRouter(systemPrompt, userPrompt);

    return res.json({
      transaction: tx,
      analysis,
      model_used: process.env.OPENROUTER_MODEL,
      analyzed_at: new Date().toISOString(),
    });
  } catch (err) {
    if (err.response) {
      console.error('OpenRouter API error:', err.response.data);
      return res.status(502).json({
        error: 'AI Service Error',
        message: 'Failed to get response from AI service',
        details: err.response.data,
      });
    }
    console.error('AI analyze transaction error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// POST /api/ai/credit-assessment
router.post('/credit-assessment', authenticateToken, async (req, res) => {
  try {
    const { credit_score_id, credit_data } = req.body;

    let cs = credit_data;
    if (credit_score_id && !cs) {
      const result = await query('SELECT * FROM credit_scores WHERE id = $1', [credit_score_id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Not Found', message: 'Credit score record not found' });
      }
      cs = result.rows[0];
    }

    if (!cs) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Provide credit_score_id or credit_data',
      });
    }

    const systemPrompt = `You are an expert credit risk analyst AI. Assess the credit application and provide a detailed recommendation.
Respond in JSON format with these fields:
- recommendation (APPROVE, CONDITIONAL, DECLINE)
- risk_grade (A, B, C, D, F)
- default_probability (0-1)
- risk_factors (array of objects with factor and impact)
- strengths (array of strings)
- weaknesses (array of strings)
- suggested_terms (object: max_amount, interest_rate_range, term_months, conditions)
- improvement_plan (array of actionable suggestions)
- comparable_profile_default_rate (percentage)
- confidence (0-100)`;

    const userPrompt = `Assess this credit application:
Customer: ${cs.customer_name}
Credit Score: ${cs.credit_score}
Risk Level: ${cs.risk_level}
Annual Income: $${cs.income}
Debt-to-Income: ${cs.debt_to_income}%
Payment History Score: ${cs.payment_history_score}
Credit Utilization: ${cs.credit_utilization}%
Account Age: ${cs.account_age_months} months
Accounts: ${cs.num_accounts}
Late Payments: ${cs.num_late_payments}
Loan Requested: $${cs.loan_amount_requested}
Purpose: ${cs.loan_purpose}`;

    const analysis = await callOpenRouter(systemPrompt, userPrompt);

    if (credit_score_id) {
      await query(
        `UPDATE credit_scores SET
           ai_recommendation = $1,
           ai_risk_analysis = $2
         WHERE id = $3`,
        [
          analysis.recommendation || JSON.stringify(analysis),
          JSON.stringify(analysis),
          credit_score_id,
        ]
      );
    }

    return res.json({
      credit_data: cs,
      analysis,
      model_used: process.env.OPENROUTER_MODEL,
      analyzed_at: new Date().toISOString(),
    });
  } catch (err) {
    if (err.response) {
      console.error('OpenRouter API error:', err.response.data);
      return res.status(502).json({
        error: 'AI Service Error',
        message: 'Failed to get response from AI service',
        details: err.response.data,
      });
    }
    console.error('AI credit assessment error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// POST /api/ai/behavioral-analysis
router.post('/behavioral-analysis', authenticateToken, async (req, res) => {
  try {
    const { pattern_id, pattern_data } = req.body;

    let bp = pattern_data;
    if (pattern_id && !bp) {
      const result = await query('SELECT * FROM behavioral_patterns WHERE id = $1', [pattern_id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Not Found', message: 'Behavioral pattern not found' });
      }
      bp = result.rows[0];
    }

    if (!bp) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Provide pattern_id or pattern_data',
      });
    }

    const systemPrompt = `You are an expert behavioral fraud analyst AI. Analyze the customer behavioral pattern data to detect anomalies and assess risk.
Respond in JSON format with these fields:
- anomaly_level (normal, mild, moderate, severe, critical)
- anomaly_score (0-100)
- detected_anomalies (array of objects with type, description, severity)
- behavioral_risk_factors (array of strings)
- normal_behavior_indicators (array of strings)
- pattern_classification (legitimate, suspicious, fraudulent)
- recommended_action (no_action, monitor, investigate, restrict_account, freeze_account)
- temporal_analysis (object describing time-based patterns)
- geographic_analysis (object describing location-based patterns)
- device_analysis (object describing device-based patterns)
- confidence (0-100)`;

    const userPrompt = `Analyze this customer behavioral pattern:
Customer ID: ${bp.customer_id}
Pattern Type: ${bp.pattern_type}
Avg Transaction: $${bp.avg_transaction_amount}
Max Transaction: $${bp.max_transaction_amount}
Typical Locations: ${JSON.stringify(bp.typical_locations)}
Typical Times: ${JSON.stringify(bp.typical_times)}
Devices: ${JSON.stringify(bp.device_fingerprints)}
Current Anomaly Score: ${bp.anomaly_score}`;

    const analysis = await callOpenRouter(systemPrompt, userPrompt);

    return res.json({
      pattern: bp,
      analysis,
      model_used: process.env.OPENROUTER_MODEL,
      analyzed_at: new Date().toISOString(),
    });
  } catch (err) {
    if (err.response) {
      console.error('OpenRouter API error:', err.response.data);
      return res.status(502).json({
        error: 'AI Service Error',
        message: 'Failed to get response from AI service',
        details: err.response.data,
      });
    }
    console.error('AI behavioral analysis error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// POST /api/ai/risk-report
router.post('/risk-report', authenticateToken, async (req, res) => {
  try {
    const transactionStats = await query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'blocked') AS blocked,
        COUNT(*) FILTER (WHERE status = 'flagged') AS flagged,
        COUNT(*) FILTER (WHERE fraud_confirmed = TRUE) AS confirmed_fraud,
        ROUND(AVG(risk_score)::numeric, 2) AS avg_risk,
        ROUND(SUM(amount)::numeric, 2) AS total_volume,
        ROUND((COUNT(*) FILTER (WHERE fraud_confirmed = TRUE)::decimal / NULLIF(COUNT(*), 0)) * 100, 2) AS fraud_rate
      FROM transactions
    `);

    const alertStats = await query(`
      SELECT
        COUNT(*) AS total_alerts,
        COUNT(*) FILTER (WHERE status = 'open') AS open_alerts,
        COUNT(*) FILTER (WHERE severity = 'critical') AS critical_alerts
      FROM fraud_alerts
    `);

    const topRiskyMerchants = await query(`
      SELECT merchant_name, risk_score, fraud_incident_count, country
      FROM merchant_risk_profiles
      ORDER BY risk_score DESC
      LIMIT 5
    `);

    const highRiskPatterns = await query(`
      SELECT customer_id, pattern_type, anomaly_score
      FROM behavioral_patterns
      WHERE anomaly_score > 70
      ORDER BY anomaly_score DESC
      LIMIT 5
    `);

    const activeModels = await query(`
      SELECT name, model_type, accuracy, f1_score
      FROM risk_models
      WHERE status = 'active'
      ORDER BY accuracy DESC
    `);

    const systemPrompt = `You are an expert risk management AI. Generate a comprehensive risk report based on the provided platform data.
Respond in JSON format with these fields:
- executive_summary (2-3 paragraph overview)
- overall_risk_rating (low, moderate, elevated, high, critical)
- key_findings (array of strings)
- threat_landscape (object with emerging_threats array, ongoing_risks array)
- recommendations (array of objects with priority, action, rationale)
- metrics_analysis (object analyzing the provided metrics)
- model_performance_review (assessment of active risk models)
- forecast (short-term risk forecast)
- action_items (prioritized array of immediate actions needed)`;

    const userPrompt = `Generate a comprehensive risk report from this platform data:

Transaction Overview:
${JSON.stringify(transactionStats.rows[0], null, 2)}

Alert Overview:
${JSON.stringify(alertStats.rows[0], null, 2)}

Top Risky Merchants:
${JSON.stringify(topRiskyMerchants.rows, null, 2)}

High-Risk Behavioral Patterns:
${JSON.stringify(highRiskPatterns.rows, null, 2)}

Active Risk Models:
${JSON.stringify(activeModels.rows, null, 2)}`;

    const analysis = await callOpenRouter(systemPrompt, userPrompt);

    return res.json({
      report: analysis,
      data_snapshot: {
        transactions: transactionStats.rows[0],
        alerts: alertStats.rows[0],
        top_risky_merchants: topRiskyMerchants.rows,
        high_risk_patterns: highRiskPatterns.rows,
        active_models: activeModels.rows,
      },
      model_used: process.env.OPENROUTER_MODEL,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    if (err.response) {
      console.error('OpenRouter API error:', err.response.data);
      return res.status(502).json({
        error: 'AI Service Error',
        message: 'Failed to get response from AI service',
        details: err.response.data,
      });
    }
    console.error('AI risk report error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// POST /api/ai/merchant-screening
router.post('/merchant-screening', authenticateToken, async (req, res) => {
  try {
    const { merchant_id, merchant_data } = req.body;

    let merchant = merchant_data;
    if (merchant_id && !merchant) {
      const result = await query('SELECT * FROM merchant_risk_profiles WHERE id = $1', [merchant_id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Not Found', message: 'Merchant not found' });
      }
      merchant = result.rows[0];
    }

    if (!merchant) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Provide merchant_id or merchant_data',
      });
    }

    const watchlistResult = await query(
      `SELECT entity_name, reason, risk_level
       FROM watchlist
       WHERE is_active = TRUE AND entity_type = 'organization'
       AND entity_name ILIKE $1`,
      [`%${merchant.merchant_name}%`]
    );

    const systemPrompt = `You are an expert merchant screening and due diligence AI. Screen the merchant against risk factors and provide a compliance assessment.
Respond in JSON format with these fields:
- screening_result (clear, watchlist_match, suspicious, high_risk, blocked)
- compliance_score (0-100)
- risk_factors (array of objects with factor, severity, description)
- watchlist_findings (array of any matching watchlist entries)
- regulatory_concerns (array of strings)
- business_legitimacy_score (0-100)
- recommended_action (onboard, enhanced_due_diligence, monitor, reject)
- due_diligence_checklist (array of objects with item, status, notes)
- country_risk_assessment (object with country, risk_level, sanctions_status)
- summary (concise screening summary)`;

    const userPrompt = `Screen this merchant for risk and compliance:
Merchant: ${merchant.merchant_name}
Category: ${merchant.merchant_category || 'Unknown'}
Country: ${merchant.country || 'Unknown'}
Risk Score: ${merchant.risk_score}
Chargeback Rate: ${merchant.chargeback_rate ? (merchant.chargeback_rate * 100).toFixed(2) + '%' : 'N/A'}
Fraud Incidents: ${merchant.fraud_incident_count}
Avg Transaction: $${merchant.avg_transaction_amount}
Currently Flagged: ${merchant.is_flagged}

Watchlist Matches Found: ${watchlistResult.rows.length}
${watchlistResult.rows.length > 0 ? JSON.stringify(watchlistResult.rows, null, 2) : 'None'}`;

    const analysis = await callOpenRouter(systemPrompt, userPrompt);

    return res.json({
      merchant,
      watchlist_matches: watchlistResult.rows,
      screening: analysis,
      model_used: process.env.OPENROUTER_MODEL,
      screened_at: new Date().toISOString(),
    });
  } catch (err) {
    if (err.response) {
      console.error('OpenRouter API error:', err.response.data);
      return res.status(502).json({
        error: 'AI Service Error',
        message: 'Failed to get response from AI service',
        details: err.response.data,
      });
    }
    console.error('AI merchant screening error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

module.exports = router;
