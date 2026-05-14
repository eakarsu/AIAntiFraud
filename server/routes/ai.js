const express = require('express');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { callOpenRouter, persistAIResult, DEFAULT_MODEL } = require('../aiHelper');

const router = express.Router();

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
Respond ONLY with valid JSON containing these fields:
{
  "risk_score": 0-100,
  "risk_level": "low|medium|high|critical",
  "fraud_probability": 0.0-1.0,
  "fraud_indicators": ["string array"],
  "legitimate_indicators": ["string array"],
  "recommended_action": "approve|flag|block|manual_review",
  "reasoning": "detailed explanation string",
  "similar_fraud_patterns": ["known patterns this matches"],
  "confidence": 0-100
}`;

    const userPrompt = `Analyze this transaction for fraud:
Amount: ${tx.currency || 'USD'} ${tx.amount}
Merchant: ${tx.merchant_name} (${tx.merchant_category || 'unknown'})
Card Last 4: ${tx.card_number_last4 || 'N/A'}
IP: ${tx.ip_address || 'N/A'}
Location: ${tx.location_city || 'N/A'}, ${tx.location_country || 'N/A'}
Device: ${tx.device_id || 'N/A'}
Online: ${tx.is_online}
Time: ${tx.created_at || new Date().toISOString()}`;

    const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
    const analysis = await callOpenRouter(systemPrompt, userPrompt, model);

    // Update transaction risk_score if we got a score
    if (transaction_id && analysis.risk_score != null) {
      await query(
        'UPDATE transactions SET risk_score = $1 WHERE id = $2',
        [analysis.risk_score, transaction_id]
      );
    }

    // Persist AI result
    const aiResultId = await persistAIResult({
      endpoint: 'analyze-transaction',
      entityType: 'transaction',
      entityId: transaction_id || null,
      inputData: { transaction: tx },
      result: analysis,
      modelUsed: model,
      userId: req.user?.id,
    });

    return res.json({
      transaction: tx,
      analysis,
      ai_result_id: aiResultId,
      model_used: model,
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
Respond ONLY with valid JSON:
{
  "recommendation": "APPROVE|CONDITIONAL|DECLINE",
  "risk_grade": "A|B|C|D|F",
  "default_probability": 0.0-1.0,
  "risk_factors": [{"factor": "string", "impact": "high|medium|low", "description": "string"}],
  "strengths": ["string array"],
  "weaknesses": ["string array"],
  "suggested_terms": {"max_amount": 0, "interest_rate_range": "string", "term_months": 0, "conditions": ["string"]},
  "improvement_plan": ["actionable suggestion strings"],
  "comparable_profile_default_rate": "percentage string",
  "confidence": 0-100
}`;

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

    const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
    const analysis = await callOpenRouter(systemPrompt, userPrompt, model);

    if (credit_score_id) {
      await query(
        `UPDATE credit_scores SET
           ai_recommendation = $1,
           ai_risk_analysis = $2
         WHERE id = $3`,
        [
          analysis.recommendation || 'See analysis',
          JSON.stringify(analysis),
          credit_score_id,
        ]
      );
    }

    const aiResultId = await persistAIResult({
      endpoint: 'credit-assessment',
      entityType: 'credit_score',
      entityId: credit_score_id || null,
      inputData: { credit_data: cs },
      result: analysis,
      modelUsed: model,
      userId: req.user?.id,
    });

    return res.json({
      credit_data: cs,
      analysis,
      ai_result_id: aiResultId,
      model_used: model,
      analyzed_at: new Date().toISOString(),
    });
  } catch (err) {
    if (err.response) {
      return res.status(502).json({ error: 'AI Service Error', message: 'Failed to get response from AI service', details: err.response.data });
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
      return res.status(400).json({ error: 'Bad Request', message: 'Provide pattern_id or pattern_data' });
    }

    const systemPrompt = `You are an expert behavioral fraud analyst AI. Analyze the customer behavioral pattern data to detect anomalies and assess risk.
Respond ONLY with valid JSON:
{
  "anomaly_level": "normal|mild|moderate|severe|critical",
  "anomaly_score": 0-100,
  "detected_anomalies": [{"type": "string", "description": "string", "severity": "low|medium|high|critical"}],
  "behavioral_risk_factors": ["string array"],
  "normal_behavior_indicators": ["string array"],
  "pattern_classification": "legitimate|suspicious|fraudulent",
  "recommended_action": "no_action|monitor|investigate|restrict_account|freeze_account",
  "temporal_analysis": {"peak_hours": "string", "unusual_times": "string", "pattern": "string"},
  "geographic_analysis": {"typical_regions": "string", "anomalies": "string"},
  "device_analysis": {"device_count": 0, "anomalies": "string"},
  "confidence": 0-100
}`;

    const userPrompt = `Analyze this customer behavioral pattern:
Customer ID: ${bp.customer_id}
Pattern Type: ${bp.pattern_type}
Avg Transaction: $${bp.avg_transaction_amount}
Max Transaction: $${bp.max_transaction_amount}
Typical Locations: ${JSON.stringify(bp.typical_locations)}
Typical Times: ${JSON.stringify(bp.typical_times)}
Devices: ${JSON.stringify(bp.device_fingerprints)}
Current Anomaly Score: ${bp.anomaly_score}`;

    const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
    const analysis = await callOpenRouter(systemPrompt, userPrompt, model);

    // Update anomaly_score from AI analysis (use the AI's anomaly_score, not confidence)
    if (pattern_id && analysis.anomaly_score != null) {
      await query(
        'UPDATE behavioral_patterns SET anomaly_score = $1 WHERE id = $2',
        [Math.min(100, Math.max(0, parseFloat(analysis.anomaly_score))), pattern_id]
      );
    }

    const aiResultId = await persistAIResult({
      endpoint: 'behavioral-analysis',
      entityType: 'behavioral_pattern',
      entityId: pattern_id || null,
      inputData: { pattern: bp },
      result: analysis,
      modelUsed: model,
      userId: req.user?.id,
    });

    return res.json({
      pattern: bp,
      analysis,
      ai_result_id: aiResultId,
      model_used: model,
      analyzed_at: new Date().toISOString(),
    });
  } catch (err) {
    if (err.response) {
      return res.status(502).json({ error: 'AI Service Error', message: 'Failed to get response from AI service', details: err.response.data });
    }
    console.error('AI behavioral analysis error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// POST /api/ai/risk-report
router.post('/risk-report', authenticateToken, async (req, res) => {
  try {
    const [transactionStats, alertStats, topRiskyMerchants, highRiskPatterns, activeModels] = await Promise.all([
      query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'blocked') AS blocked,
          COUNT(*) FILTER (WHERE status = 'flagged') AS flagged,
          COUNT(*) FILTER (WHERE fraud_confirmed = TRUE) AS confirmed_fraud,
          ROUND(AVG(risk_score)::numeric, 2) AS avg_risk,
          ROUND(SUM(amount)::numeric, 2) AS total_volume,
          ROUND((COUNT(*) FILTER (WHERE fraud_confirmed = TRUE)::decimal / NULLIF(COUNT(*), 0)) * 100, 2) AS fraud_rate
        FROM transactions
      `),
      query(`
        SELECT
          COUNT(*) AS total_alerts,
          COUNT(*) FILTER (WHERE status = 'open') AS open_alerts,
          COUNT(*) FILTER (WHERE severity = 'critical') AS critical_alerts
        FROM fraud_alerts
      `),
      query(`
        SELECT merchant_name, risk_score, fraud_incident_count, country
        FROM merchant_risk_profiles
        ORDER BY risk_score DESC
        LIMIT 5
      `),
      query(`
        SELECT customer_id, pattern_type, anomaly_score
        FROM behavioral_patterns
        WHERE anomaly_score > 70
        ORDER BY anomaly_score DESC
        LIMIT 5
      `),
      query(`
        SELECT name, model_type, accuracy, f1_score
        FROM risk_models
        WHERE status = 'active'
        ORDER BY accuracy DESC
      `),
    ]);

    const systemPrompt = `You are an expert risk management AI. Generate a comprehensive risk report based on the provided platform data.
Respond ONLY with valid JSON:
{
  "executive_summary": "2-3 paragraph overview string",
  "overall_risk_rating": "low|moderate|elevated|high|critical",
  "key_findings": ["string array"],
  "threat_landscape": {"emerging_threats": ["strings"], "ongoing_risks": ["strings"]},
  "recommendations": [{"priority": "high|medium|low", "action": "string", "rationale": "string"}],
  "metrics_analysis": {"fraud_rate_assessment": "string", "volume_assessment": "string", "alert_assessment": "string"},
  "model_performance_review": "assessment string",
  "forecast": "short-term risk forecast string",
  "action_items": [{"priority": 1, "item": "string", "timeline": "string"}]
}`;

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

    const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
    const analysis = await callOpenRouter(systemPrompt, userPrompt, model);

    const aiResultId = await persistAIResult({
      endpoint: 'risk-report',
      entityType: 'platform',
      entityId: null,
      inputData: {
        transactions: transactionStats.rows[0],
        alerts: alertStats.rows[0],
      },
      result: analysis,
      modelUsed: model,
      userId: req.user?.id,
    });

    return res.json({
      report: analysis,
      data_snapshot: {
        transactions: transactionStats.rows[0],
        alerts: alertStats.rows[0],
        top_risky_merchants: topRiskyMerchants.rows,
        high_risk_patterns: highRiskPatterns.rows,
        active_models: activeModels.rows,
      },
      ai_result_id: aiResultId,
      model_used: model,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    if (err.response) {
      return res.status(502).json({ error: 'AI Service Error', message: 'Failed to get response from AI service', details: err.response.data });
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
      return res.status(400).json({ error: 'Bad Request', message: 'Provide merchant_id or merchant_data' });
    }

    const watchlistResult = await query(
      `SELECT entity_name, reason, risk_level
       FROM watchlist
       WHERE is_active = TRUE AND entity_type = 'organization'
       AND entity_name ILIKE $1`,
      [`%${merchant.merchant_name}%`]
    );

    const systemPrompt = `You are an expert merchant screening and due diligence AI. Screen the merchant against risk factors and provide a compliance assessment.
Respond ONLY with valid JSON:
{
  "screening_result": "clear|watchlist_match|suspicious|high_risk|blocked",
  "compliance_score": 0-100,
  "risk_factors": [{"factor": "string", "severity": "high|medium|low", "description": "string"}],
  "watchlist_findings": ["strings"],
  "regulatory_concerns": ["strings"],
  "business_legitimacy_score": 0-100,
  "recommended_action": "onboard|enhanced_due_diligence|monitor|reject",
  "due_diligence_checklist": [{"item": "string", "status": "pass|fail|unknown", "notes": "string"}],
  "country_risk_assessment": {"country": "string", "risk_level": "low|medium|high", "sanctions_status": "clear|flagged"},
  "summary": "concise screening summary string"
}`;

    const userPrompt = `Screen this merchant for risk and compliance:
Merchant: ${merchant.merchant_name}
Category: ${merchant.merchant_category || 'Unknown'}
Country: ${merchant.country || 'Unknown'}
Risk Score: ${merchant.risk_score}
Chargeback Rate: ${merchant.chargeback_rate ? (merchant.chargeback_rate * 100).toFixed(2) + '%' : 'N/A'}
Fraud Incidents: ${merchant.fraud_incident_count}
Avg Transaction: $${merchant.avg_transaction_amount || 0}
Currently Flagged: ${merchant.is_flagged}

Watchlist Matches Found: ${watchlistResult.rows.length}
${watchlistResult.rows.length > 0 ? JSON.stringify(watchlistResult.rows, null, 2) : 'None'}`;

    const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
    const analysis = await callOpenRouter(systemPrompt, userPrompt, model);

    const aiResultId = await persistAIResult({
      endpoint: 'merchant-screening',
      entityType: 'merchant',
      entityId: merchant_id || null,
      inputData: { merchant, watchlist_matches: watchlistResult.rows },
      result: analysis,
      modelUsed: model,
      userId: req.user?.id,
    });

    return res.json({
      merchant,
      watchlist_matches: watchlistResult.rows,
      screening: analysis,
      ai_result_id: aiResultId,
      model_used: model,
      screened_at: new Date().toISOString(),
    });
  } catch (err) {
    if (err.response) {
      return res.status(502).json({ error: 'AI Service Error', message: 'Failed to get response from AI service', details: err.response.data });
    }
    console.error('AI merchant screening error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// POST /api/ai/suggest-rules
router.post('/suggest-rules', authenticateToken, async (req, res) => {
  try {
    const alertsResult = await query(`
      SELECT
        fa.id, fa.alert_type, fa.severity, fa.status, fa.description,
        fa.rule_id, fr.name AS rule_name, fr.rule_type, fr.condition_json,
        t.amount, t.merchant_category, t.location_country, t.is_online
      FROM fraud_alerts fa
      LEFT JOIN fraud_rules fr ON fa.rule_id = fr.id
      LEFT JOIN transactions t ON fa.transaction_id = t.id
      WHERE fa.status IN ('resolved', 'dismissed')
      ORDER BY fa.created_at DESC
      LIMIT 100
    `);

    const ruleEffectiveness = {};
    alertsResult.rows.forEach(alert => {
      const key = alert.rule_id || 'no_rule';
      if (!ruleEffectiveness[key]) {
        ruleEffectiveness[key] = {
          rule_name: alert.rule_name || 'Manual',
          rule_type: alert.rule_type,
          condition_json: alert.condition_json,
          resolved_count: 0,
          dismissed_count: 0,
          alert_types: {},
          severities: {},
        };
      }
      if (alert.status === 'resolved') ruleEffectiveness[key].resolved_count++;
      else ruleEffectiveness[key].dismissed_count++;
      ruleEffectiveness[key].alert_types[alert.alert_type] = (ruleEffectiveness[key].alert_types[alert.alert_type] || 0) + 1;
      ruleEffectiveness[key].severities[alert.severity] = (ruleEffectiveness[key].severities[alert.severity] || 0) + 1;
    });

    const systemPrompt = `You are a fraud detection expert. Analyze alert patterns and suggest new detection rules.
Respond ONLY with valid JSON:
{
  "suggested_rules": [
    {
      "name": "Rule Name",
      "description": "What this rule detects",
      "rule_type": "velocity|amount|location|behavioral|merchant|card",
      "condition_json": {"field": "value", "threshold": 0},
      "action": "flag|block|alert",
      "severity": "low|medium|high|critical",
      "priority": 1,
      "expected_precision": 0.85,
      "rationale": "why this rule is needed"
    }
  ]
}
Suggest 3-5 concrete, actionable rules based on the patterns.`;

    const userPrompt = `Analyze these fraud alert patterns and suggest new detection rules:

Alert Count: ${alertsResult.rows.length}
Rule Effectiveness Summary:
${JSON.stringify(ruleEffectiveness, null, 2)}

Sample recent alerts:
${JSON.stringify(alertsResult.rows.slice(0, 20), null, 2)}`;

    const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
    const aiResult = await callOpenRouter(systemPrompt, userPrompt, model);

    const suggestedRules = aiResult.suggested_rules || [];

    const savedSuggestions = [];
    for (const rule of suggestedRules) {
      const insertResult = await query(
        `INSERT INTO rule_suggestions (suggested_by_ai, rule_data) VALUES ($1, $2) RETURNING *`,
        [model, JSON.stringify(rule)]
      );
      savedSuggestions.push(insertResult.rows[0]);
    }

    await persistAIResult({
      endpoint: 'suggest-rules',
      entityType: 'platform',
      entityId: null,
      inputData: { analyzed_alerts: alertsResult.rows.length },
      result: aiResult,
      modelUsed: model,
      userId: req.user?.id,
    });

    return res.json({
      suggested_rules: suggestedRules,
      saved_count: savedSuggestions.length,
      analyzed_alerts: alertsResult.rows.length,
      model_used: model,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    if (err.response) {
      return res.status(502).json({ error: 'AI Service Error', message: 'Failed to get response from AI service', details: err.response.data });
    }
    console.error('AI suggest rules error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// POST /api/ai/score-transaction
router.post('/score-transaction', authenticateToken, async (req, res) => {
  try {
    const { transaction_id, amount, merchant_category, location, user_id } = req.body;

    if (!amount || !user_id) {
      return res.status(400).json({ error: 'Bad Request', message: 'amount and user_id are required' });
    }

    const historyResult = await query(`
      SELECT amount, merchant_category, location_country, location_city,
             is_online, status, risk_score, created_at
      FROM transactions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 30
    `, [user_id]);

    const history = historyResult.rows;
    const avgAmount = history.length > 0
      ? history.reduce((s, t) => s + parseFloat(t.amount), 0) / history.length
      : 0;
    const maxAmount = history.length > 0
      ? Math.max(...history.map(t => parseFloat(t.amount)))
      : 0;

    const systemPrompt = `You are a fraud risk scoring AI. Analyze a transaction and return a risk score.
Respond ONLY with valid JSON:
{
  "risk_score": 0-100,
  "risk_factors": ["factor strings"],
  "location_anomaly": true/false,
  "amount_spike": true/false,
  "velocity_issue": true/false,
  "unusual_merchant": true/false,
  "reasoning": "brief explanation string"
}`;

    const userPrompt = `Score this transaction for fraud risk (0-100):

Transaction:
- Amount: $${amount}
- Merchant Category: ${merchant_category || 'unknown'}
- Location: ${location || 'unknown'}
- User ID: ${user_id}

User's historical baseline (last 30 transactions):
- Average amount: $${avgAmount.toFixed(2)}
- Max amount: $${maxAmount.toFixed(2)}
- Transaction count: ${history.length}
- Recent locations: ${[...new Set(history.map(t => t.location_country).filter(Boolean))].slice(0, 5).join(', ') || 'none'}
- Common merchants: ${[...new Set(history.map(t => t.merchant_category).filter(Boolean))].slice(0, 5).join(', ') || 'none'}

Flags to assess: location anomaly, amount spike (>3x average), velocity (many recent txns), unusual merchant category.`;

    const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
    const aiResult = await callOpenRouter(systemPrompt, userPrompt, model);

    const riskScore = Math.min(100, Math.max(0, parseInt(aiResult.risk_score) || 0));
    const riskFactors = aiResult.risk_factors || [];
    let autoAlertCreated = false;

    if (riskScore > 70) {
      const severity = riskScore >= 90 ? 'critical' : riskScore >= 80 ? 'high' : 'medium';
      await query(
        `INSERT INTO fraud_alerts (transaction_id, alert_type, severity, description, status)
         VALUES ($1, $2, $3::alert_severity, $4, 'open')`,
        [
          transaction_id || null,
          'ai_risk_score',
          severity,
          `AI risk score ${riskScore}/100. Factors: ${riskFactors.join(', ')}`,
        ]
      );
      autoAlertCreated = true;
    }

    await query(
      `INSERT INTO transaction_risk_scores (transaction_id, user_id, risk_score, risk_factors, auto_alert_created, model_used)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [transaction_id || null, user_id, riskScore, JSON.stringify(riskFactors), autoAlertCreated, model]
    );

    await persistAIResult({
      endpoint: 'score-transaction',
      entityType: 'transaction',
      entityId: transaction_id || null,
      inputData: { amount, merchant_category, location, user_id },
      result: aiResult,
      modelUsed: model,
      userId: req.user?.id,
    });

    return res.json({
      risk_score: riskScore,
      risk_factors: riskFactors,
      auto_alert_created: autoAlertCreated,
      details: {
        location_anomaly: aiResult.location_anomaly || false,
        amount_spike: aiResult.amount_spike || false,
        velocity_issue: aiResult.velocity_issue || false,
        unusual_merchant: aiResult.unusual_merchant || false,
        reasoning: aiResult.reasoning || '',
      },
      baseline: { avg_amount: avgAmount, max_amount: maxAmount, history_count: history.length },
      model_used: model,
      scored_at: new Date().toISOString(),
    });
  } catch (err) {
    if (err.response) {
      return res.status(502).json({ error: 'AI Service Error', message: 'Failed to get response from AI service', details: err.response.data });
    }
    console.error('AI score transaction error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// POST /api/ai/network-analysis — Fraud ring detection
router.post('/network-analysis', authenticateToken, async (req, res) => {
  try {
    const { min_shared_attrs = 2, days_back = 30 } = req.body;

    // Find clusters of transactions sharing device_id, ip_address within time window
    const sharedDevices = await query(`
      SELECT device_id, COUNT(DISTINCT user_id) AS user_count,
             COUNT(*) AS tx_count, ARRAY_AGG(DISTINCT user_id) AS user_ids,
             SUM(amount) AS total_amount,
             COUNT(*) FILTER (WHERE fraud_confirmed = TRUE) AS confirmed_fraud_count
      FROM transactions
      WHERE device_id IS NOT NULL
        AND created_at >= NOW() - INTERVAL '${parseInt(days_back)} days'
      GROUP BY device_id
      HAVING COUNT(DISTINCT user_id) >= $1
      ORDER BY user_count DESC
      LIMIT 20
    `, [Math.max(2, parseInt(min_shared_attrs))]);

    const sharedIPs = await query(`
      SELECT ip_address::text, COUNT(DISTINCT user_id) AS user_count,
             COUNT(*) AS tx_count, SUM(amount) AS total_amount,
             COUNT(*) FILTER (WHERE fraud_confirmed = TRUE) AS confirmed_fraud_count
      FROM transactions
      WHERE ip_address IS NOT NULL
        AND created_at >= NOW() - INTERVAL '${parseInt(days_back)} days'
      GROUP BY ip_address
      HAVING COUNT(DISTINCT user_id) >= $1
      ORDER BY user_count DESC
      LIMIT 20
    `, [Math.max(2, parseInt(min_shared_attrs))]);

    const systemPrompt = `You are an expert fraud network analyst AI. Analyze the shared-attribute clusters to detect coordinated fraud rings.
Respond ONLY with valid JSON:
{
  "fraud_ring_detected": true/false,
  "risk_level": "low|medium|high|critical",
  "suspected_rings": [
    {
      "ring_id": "string",
      "type": "shared_device|shared_ip|both",
      "size": 0,
      "total_amount": 0,
      "confirmed_fraud_ratio": 0.0,
      "risk_score": 0-100,
      "indicators": ["string array"]
    }
  ],
  "total_suspicious_users": 0,
  "total_suspicious_amount": 0,
  "recommended_actions": ["string array"],
  "investigation_priority": "immediate|high|medium|low",
  "summary": "string"
}`;

    const userPrompt = `Analyze these shared-attribute clusters for coordinated fraud rings:

Shared Device ID Clusters (last ${days_back} days):
${JSON.stringify(sharedDevices.rows, null, 2)}

Shared IP Address Clusters (last ${days_back} days):
${JSON.stringify(sharedIPs.rows, null, 2)}

Identify if these indicate coordinated fraud rings (mule networks, synthetic identity fraud, etc.).`;

    const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
    const analysis = await callOpenRouter(systemPrompt, userPrompt, model);

    await persistAIResult({
      endpoint: 'network-analysis',
      entityType: 'platform',
      entityId: null,
      inputData: { days_back, min_shared_attrs },
      result: analysis,
      modelUsed: model,
      userId: req.user?.id,
    });

    return res.json({
      analysis,
      data: {
        shared_devices: sharedDevices.rows,
        shared_ips: sharedIPs.rows,
      },
      model_used: model,
      analyzed_at: new Date().toISOString(),
    });
  } catch (err) {
    if (err.response) {
      return res.status(502).json({ error: 'AI Service Error', message: 'Failed to get response from AI service', details: err.response.data });
    }
    console.error('AI network analysis error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// POST /api/ai/customer-360
router.post('/customer-360', authenticateToken, async (req, res) => {
  try {
    const { customer_id, user_id } = req.body;

    if (!customer_id && !user_id) {
      return res.status(400).json({ error: 'Bad Request', message: 'Provide customer_id or user_id' });
    }

    const [transactions, behavioral, creditScores, alerts, watchlistCheck] = await Promise.all([
      query(`
        SELECT id, amount, currency, merchant_name, status, risk_score, fraud_confirmed, created_at
        FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20
      `, [user_id || 0]),
      query(`
        SELECT * FROM behavioral_patterns WHERE customer_id = $1 ORDER BY last_updated DESC LIMIT 5
      `, [customer_id || String(user_id)]),
      query(`
        SELECT id, customer_name, credit_score, risk_level, loan_amount_requested, ai_recommendation, created_at
        FROM credit_scores WHERE customer_email = $1 OR customer_name ILIKE $2 ORDER BY created_at DESC LIMIT 5
      `, [customer_id || '', `%${customer_id || ''}%`]),
      query(`
        SELECT fa.id, fa.alert_type, fa.severity, fa.status, fa.created_at
        FROM fraud_alerts fa
        JOIN transactions t ON fa.transaction_id = t.id
        WHERE t.user_id = $1 ORDER BY fa.created_at DESC LIMIT 10
      `, [user_id || 0]),
      query(`
        SELECT entity_name, risk_level, reason, is_active
        FROM watchlist WHERE identifier = $1 OR entity_name ILIKE $2
      `, [customer_id || '', `%${customer_id || ''}%`]),
    ]);

    const systemPrompt = `You are an expert customer risk analyst AI. Provide a 360-degree risk profile for this customer.
Respond ONLY with valid JSON:
{
  "overall_risk_score": 0-100,
  "overall_risk_level": "low|medium|high|critical",
  "customer_classification": "legitimate|suspicious|high_risk|fraud_confirmed",
  "key_risk_indicators": ["string array"],
  "positive_signals": ["string array"],
  "fraud_history_summary": "string",
  "credit_worthiness": "excellent|good|fair|poor|very_poor",
  "recommended_actions": [{"action": "string", "urgency": "immediate|high|medium|low"}],
  "watchlist_status": "clear|flagged|blocked",
  "summary": "comprehensive 2-3 sentence customer summary"
}`;

    const userPrompt = `Provide a 360-degree risk profile for this customer:

Recent Transactions (${transactions.rows.length}):
${JSON.stringify(transactions.rows, null, 2)}

Behavioral Patterns:
${JSON.stringify(behavioral.rows, null, 2)}

Credit Scores:
${JSON.stringify(creditScores.rows, null, 2)}

Fraud Alerts:
${JSON.stringify(alerts.rows, null, 2)}

Watchlist Status:
${JSON.stringify(watchlistCheck.rows, null, 2)}`;

    const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
    const analysis = await callOpenRouter(systemPrompt, userPrompt, model);

    await persistAIResult({
      endpoint: 'customer-360',
      entityType: 'customer',
      entityId: user_id || null,
      inputData: { customer_id, user_id },
      result: analysis,
      modelUsed: model,
      userId: req.user?.id,
    });

    return res.json({
      customer_id: customer_id || user_id,
      profile: {
        transactions: transactions.rows,
        behavioral_patterns: behavioral.rows,
        credit_scores: creditScores.rows,
        alerts: alerts.rows,
        watchlist: watchlistCheck.rows,
      },
      analysis,
      model_used: model,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    if (err.response) {
      return res.status(502).json({ error: 'AI Service Error', message: 'Failed to get response from AI service', details: err.response.data });
    }
    console.error('AI customer 360 error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// POST /api/ai/velocity-rules — Detect rapid-fire transaction velocity anomalies
router.post('/velocity-rules', authenticateToken, async (req, res) => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(503).json({ error: 'AI Not Configured', message: 'OPENROUTER_API_KEY is not set' });
    }
    const { user_id, hours_window = 1, min_tx_count = 3, days_back = 7 } = req.body;

    const conditions = [`created_at >= NOW() - INTERVAL '${parseInt(days_back) || 7} days'`];
    const params = [];
    let paramIndex = 1;
    if (user_id) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(user_id);
    }

    const velocityClusters = await query(`
      WITH bucketed AS (
        SELECT user_id,
               date_trunc('hour', created_at) AS bucket_hour,
               COUNT(*) AS tx_count,
               SUM(amount) AS total_amount,
               ARRAY_AGG(id) AS tx_ids,
               ARRAY_AGG(DISTINCT merchant_name) AS merchants,
               ARRAY_AGG(DISTINCT location_country) AS countries,
               COUNT(*) FILTER (WHERE fraud_confirmed = TRUE) AS confirmed_fraud_count,
               MAX(risk_score) AS max_risk_score
        FROM transactions
        WHERE ${conditions.join(' AND ')}
        GROUP BY user_id, date_trunc('hour', created_at)
      )
      SELECT *
      FROM bucketed
      WHERE tx_count >= $${paramIndex}
      ORDER BY tx_count DESC, total_amount DESC
      LIMIT 30
    `, [...params, Math.max(2, parseInt(min_tx_count) || 3)]);

    const systemPrompt = `You are an expert fraud-velocity analyst AI. Analyze rapid-fire transaction clusters to identify velocity-rule fraud (card testing, BIN attacks, account takeover bursts).
Respond ONLY with valid JSON:
{
  "velocity_anomaly_detected": true/false,
  "overall_risk_level": "low|medium|high|critical",
  "anomalies": [
    {
      "user_id": 0,
      "bucket_hour": "string",
      "tx_count": 0,
      "total_amount": 0,
      "pattern_type": "card_testing|bin_attack|account_takeover|legitimate_burst|other",
      "indicators": ["string array"],
      "risk_score": 0-100,
      "recommended_action": "block|flag|monitor|approve"
    }
  ],
  "suggested_velocity_rules": [
    { "rule_name": "string", "threshold": "string", "reasoning": "string" }
  ],
  "summary": "string"
}`;

    const userPrompt = `Analyze these high-velocity transaction clusters for rapid-fire fraud over the last ${days_back} days (window: ${hours_window}h, threshold: ${min_tx_count} tx/hour):

${JSON.stringify(velocityClusters.rows, null, 2)}`;

    const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
    const analysis = await callOpenRouter(systemPrompt, userPrompt, model);

    await persistAIResult({
      endpoint: 'velocity-rules',
      entityType: user_id ? 'user' : 'platform',
      entityId: user_id || null,
      inputData: { user_id, hours_window, min_tx_count, days_back },
      result: analysis,
      modelUsed: model,
      userId: req.user?.id,
    });

    return res.json({
      analysis,
      data: { velocity_clusters: velocityClusters.rows },
      model_used: model,
      analyzed_at: new Date().toISOString(),
    });
  } catch (err) {
    if (err.response) {
      return res.status(502).json({ error: 'AI Service Error', message: 'Failed to get response from AI service', details: err.response.data });
    }
    console.error('AI velocity rules error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// POST /api/ai/money-mule-detection — Identify cash-out / mule patterns
router.post('/money-mule-detection', authenticateToken, async (req, res) => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(503).json({ error: 'AI Not Configured', message: 'OPENROUTER_API_KEY is not set' });
    }
    const { days_back = 30, min_total_amount = 1000 } = req.body;

    // Cash-out signals: high outgoing-to-incoming ratio, recent account, repeated round-number payouts
    const muleCandidates = await query(`
      SELECT t.user_id,
             u.name AS user_name,
             u.email AS user_email,
             u.created_at AS account_created_at,
             COUNT(*) AS tx_count,
             SUM(t.amount) AS total_amount,
             AVG(t.amount) AS avg_amount,
             COUNT(*) FILTER (WHERE t.amount = ROUND(t.amount/100,0)*100 AND t.amount >= 100) AS round_amount_count,
             COUNT(DISTINCT t.merchant_name) AS distinct_merchants,
             COUNT(DISTINCT t.location_country) AS distinct_countries,
             COUNT(*) FILTER (WHERE t.fraud_confirmed = TRUE) AS confirmed_fraud_count,
             MAX(t.risk_score) AS max_risk_score
      FROM transactions t
      JOIN users u ON u.id = t.user_id
      WHERE t.created_at >= NOW() - INTERVAL '${parseInt(days_back) || 30} days'
      GROUP BY t.user_id, u.name, u.email, u.created_at
      HAVING SUM(t.amount) >= $1
      ORDER BY total_amount DESC
      LIMIT 25
    `, [parseFloat(min_total_amount) || 1000]);

    const systemPrompt = `You are an expert anti-money-laundering AI. Detect money-mule and cash-out patterns from transaction aggregates (rapid layering, structuring, round-amount payouts, newly opened accounts moving funds).
Respond ONLY with valid JSON:
{
  "mules_detected": true/false,
  "overall_risk_level": "low|medium|high|critical",
  "suspected_mules": [
    {
      "user_id": 0,
      "user_name": "string",
      "mule_type": "cash_out|layering|structuring|funnel_account|other",
      "indicators": ["string array"],
      "risk_score": 0-100,
      "estimated_laundered_amount": 0,
      "recommended_action": "freeze|escalate|monitor|file_sar"
    }
  ],
  "regulatory_recommendations": ["string array"],
  "summary": "string"
}`;

    const userPrompt = `Identify likely money mules from the last ${days_back} days of transaction aggregates (min total amount $${min_total_amount}):

${JSON.stringify(muleCandidates.rows, null, 2)}`;

    const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
    const analysis = await callOpenRouter(systemPrompt, userPrompt, model);

    await persistAIResult({
      endpoint: 'money-mule-detection',
      entityType: 'platform',
      entityId: null,
      inputData: { days_back, min_total_amount },
      result: analysis,
      modelUsed: model,
      userId: req.user?.id,
    });

    return res.json({
      analysis,
      data: { mule_candidates: muleCandidates.rows },
      model_used: model,
      analyzed_at: new Date().toISOString(),
    });
  } catch (err) {
    if (err.response) {
      return res.status(502).json({ error: 'AI Service Error', message: 'Failed to get response from AI service', details: err.response.data });
    }
    console.error('AI money mule detection error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// POST /api/ai/ml-rule-automation — Auto-tune fraud-rule thresholds from observed performance
// MECHANICAL: reads `fraud_rules` + `fraud_alerts` + `transactions`; LLM proposes threshold/action
// adjustments based on hit_count + confirmed_fraud rate. NO new tables. Suggestions are returned,
// not applied — humans must accept via existing rule_suggestions workflow.
// PRODUCT-DECISION: only suggests, never auto-applies — keeps human in the loop.
router.post('/ml-rule-automation', authenticateToken, async (req, res) => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(503).json({ error: 'AI Not Configured', message: 'OPENROUTER_API_KEY is not set', missing: 'OPENROUTER_API_KEY' });
    }
    const { days_back = 30, min_hits = 1 } = req.body;

    const rulePerf = await query(`
      SELECT r.id, r.name, r.rule_type, r.condition_json, r.action, r.severity, r.is_active, r.hit_count,
             COUNT(a.id) AS alerts_in_window,
             COUNT(a.id) FILTER (WHERE a.transaction_id IS NOT NULL) AS alerts_with_tx,
             COUNT(t.id) FILTER (WHERE t.fraud_confirmed = TRUE) AS confirmed_fraud_count,
             COUNT(t.id) FILTER (WHERE t.fraud_confirmed = FALSE AND t.id IS NOT NULL) AS false_positive_count
      FROM fraud_rules r
      LEFT JOIN fraud_alerts a ON a.rule_id = r.id AND a.created_at >= NOW() - INTERVAL '${parseInt(days_back) || 30} days'
      LEFT JOIN transactions t ON t.id = a.transaction_id
      GROUP BY r.id
      HAVING COALESCE(r.hit_count, 0) >= $1 OR COUNT(a.id) > 0
      ORDER BY r.hit_count DESC NULLS LAST
      LIMIT 25
    `, [Math.max(0, parseInt(min_hits) || 0)]);

    const systemPrompt = `You are an expert fraud-rule tuning AI. Given existing fraud rules and their recent
performance (alerts fired, confirmed fraud, false positives), propose calibrated threshold/action/severity
adjustments. NEVER fabricate metrics — only reason from supplied data.
Respond ONLY with valid JSON:
{
  "overall_assessment": "string",
  "rule_suggestions": [
    {
      "rule_id": 0,
      "rule_name": "string",
      "current_action": "approve|flag|block|manual_review",
      "current_severity": "low|medium|high|critical",
      "suggested_action": "approve|flag|block|manual_review|disable",
      "suggested_severity": "low|medium|high|critical",
      "suggested_condition_changes": "string",
      "expected_impact": { "fp_reduction_pct": 0, "fraud_capture_pct": 0 },
      "rationale": "string",
      "confidence": 0-100
    }
  ],
  "global_recommendations": ["string array"]
}`;

    const userPrompt = `Auto-tune these fraud rules based on last ${days_back} days of performance:\n\n${JSON.stringify(rulePerf.rows, null, 2)}`;

    const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
    const analysis = await callOpenRouter(systemPrompt, userPrompt, model);

    await persistAIResult({
      endpoint: 'ml-rule-automation',
      entityType: 'platform',
      entityId: null,
      inputData: { days_back, min_hits },
      result: analysis,
      modelUsed: model,
      userId: req.user?.id,
    });

    return res.json({
      analysis,
      data: { rule_performance: rulePerf.rows },
      model_used: model,
      analyzed_at: new Date().toISOString(),
    });
  } catch (err) {
    if (err.response) {
      return res.status(502).json({ error: 'AI Service Error', message: 'Failed to get response from AI service', details: err.response.data });
    }
    console.error('AI ml-rule-automation error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// POST /api/ai/graph-anomaly — Real-time graph anomaly detection
// TOO-RISKY for full streaming pipeline; this is an additive in-memory graph stub built from
// the transactions table (user -> device -> ip nodes). LLM evaluates degree/clustering/PageRank-like
// signals to surface anomalous nodes. PRODUCT-DECISION: limited to a 5000-row sample for safety.
router.post('/graph-anomaly', authenticateToken, async (req, res) => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(503).json({ error: 'AI Not Configured', message: 'OPENROUTER_API_KEY is not set', missing: 'OPENROUTER_API_KEY' });
    }
    const { days_back = 14, max_nodes = 50 } = req.body;

    const edges = await query(`
      SELECT user_id, device_id, ip_address::text AS ip, merchant_name, amount, fraud_confirmed, created_at
      FROM transactions
      WHERE created_at >= NOW() - INTERVAL '${parseInt(days_back) || 14} days'
        AND (device_id IS NOT NULL OR ip_address IS NOT NULL)
      ORDER BY created_at DESC
      LIMIT 5000
    `);

    // In-memory graph aggregation — additive, no schema changes.
    const userToDevices = new Map();
    const userToIps = new Map();
    const deviceToUsers = new Map();
    const ipToUsers = new Map();
    const userMetrics = new Map();
    for (const r of edges.rows) {
      const u = String(r.user_id);
      if (!userMetrics.has(u)) userMetrics.set(u, { tx: 0, fraud: 0, total: 0 });
      const m = userMetrics.get(u);
      m.tx += 1; m.total += Number(r.amount || 0);
      if (r.fraud_confirmed) m.fraud += 1;
      if (r.device_id) {
        if (!userToDevices.has(u)) userToDevices.set(u, new Set());
        userToDevices.get(u).add(r.device_id);
        if (!deviceToUsers.has(r.device_id)) deviceToUsers.set(r.device_id, new Set());
        deviceToUsers.get(r.device_id).add(u);
      }
      if (r.ip) {
        if (!userToIps.has(u)) userToIps.set(u, new Set());
        userToIps.get(u).add(r.ip);
        if (!ipToUsers.has(r.ip)) ipToUsers.set(r.ip, new Set());
        ipToUsers.get(r.ip).add(u);
      }
    }
    const anomalies = [];
    for (const [u, m] of userMetrics) {
      const devCount = userToDevices.get(u)?.size || 0;
      const ipCount = userToIps.get(u)?.size || 0;
      let sharedDeviceUsers = 0;
      for (const d of (userToDevices.get(u) || [])) {
        sharedDeviceUsers += (deviceToUsers.get(d)?.size || 1) - 1;
      }
      let sharedIpUsers = 0;
      for (const ip of (userToIps.get(u) || [])) {
        sharedIpUsers += (ipToUsers.get(ip)?.size || 1) - 1;
      }
      const degree = devCount + ipCount;
      const fraud_ratio = m.tx > 0 ? m.fraud / m.tx : 0;
      const anomaly_score = Math.min(100, Math.round((degree * 5) + (sharedDeviceUsers * 8) + (sharedIpUsers * 4) + (fraud_ratio * 50)));
      anomalies.push({ user_id: u, tx_count: m.tx, total_amount: m.total, devices: devCount, ips: ipCount, shared_device_users: sharedDeviceUsers, shared_ip_users: sharedIpUsers, fraud_ratio: Number(fraud_ratio.toFixed(3)), anomaly_score });
    }
    anomalies.sort((a, b) => b.anomaly_score - a.anomaly_score);
    const top = anomalies.slice(0, Math.max(5, parseInt(max_nodes) || 50));

    const systemPrompt = `You are a graph fraud-anomaly AI. Given pre-computed user-node graph metrics
(degree, shared-device users, shared-ip users, fraud ratio), classify anomalous nodes and propose
investigation actions. Respond ONLY with valid JSON:
{
  "graph_anomaly_detected": true/false,
  "overall_risk_level": "low|medium|high|critical",
  "anomalous_nodes": [
    { "user_id": "string", "node_type": "user", "anomaly_score": 0-100, "anomaly_class": "hub|bridge|burst|isolated_high_risk|other", "indicators": ["string array"], "recommended_action": "investigate|freeze|monitor" }
  ],
  "summary": "string"
}`;
    const userPrompt = `Top ${top.length} graph nodes from a ${days_back}-day window (in-memory, sampled):\n\n${JSON.stringify(top, null, 2)}`;

    const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
    const analysis = await callOpenRouter(systemPrompt, userPrompt, model);

    await persistAIResult({
      endpoint: 'graph-anomaly',
      entityType: 'platform',
      entityId: null,
      inputData: { days_back, max_nodes },
      result: analysis,
      modelUsed: model,
      userId: req.user?.id,
    });

    return res.json({
      analysis,
      data: { node_metrics_sample: top, edge_count: edges.rows.length, total_users: userMetrics.size },
      model_used: model,
      analyzed_at: new Date().toISOString(),
    });
  } catch (err) {
    if (err.response) {
      return res.status(502).json({ error: 'AI Service Error', message: 'Failed to get response from AI service', details: err.response.data });
    }
    console.error('AI graph-anomaly error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// POST /api/ai/cross-merchant-rings — Detect fraud rings spanning multiple merchants
// MECHANICAL: aggregates transactions by user-merchant pairs, finds users hitting many merchants
// in narrow windows with shared device/IP. LLM clusters into rings.
router.post('/cross-merchant-rings', authenticateToken, async (req, res) => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(503).json({ error: 'AI Not Configured', message: 'OPENROUTER_API_KEY is not set', missing: 'OPENROUTER_API_KEY' });
    }
    const { days_back = 30, min_merchants = 3 } = req.body;

    const userMerchantSpread = await query(`
      SELECT user_id,
             COUNT(DISTINCT merchant_name) AS distinct_merchants,
             COUNT(DISTINCT merchant_category) AS distinct_categories,
             COUNT(*) AS tx_count,
             SUM(amount) AS total_amount,
             COUNT(*) FILTER (WHERE fraud_confirmed = TRUE) AS confirmed_fraud_count,
             ARRAY_AGG(DISTINCT device_id) FILTER (WHERE device_id IS NOT NULL) AS devices,
             ARRAY_AGG(DISTINCT ip_address::text) FILTER (WHERE ip_address IS NOT NULL) AS ips,
             MIN(created_at) AS first_tx,
             MAX(created_at) AS last_tx
      FROM transactions
      WHERE created_at >= NOW() - INTERVAL '${parseInt(days_back) || 30} days'
      GROUP BY user_id
      HAVING COUNT(DISTINCT merchant_name) >= $1
      ORDER BY distinct_merchants DESC, total_amount DESC
      LIMIT 25
    `, [Math.max(2, parseInt(min_merchants) || 3)]);

    const merchantCoOccurrence = await query(`
      SELECT t1.merchant_name AS merchant_a, t2.merchant_name AS merchant_b,
             COUNT(DISTINCT t1.user_id) AS shared_users
      FROM transactions t1
      JOIN transactions t2 ON t2.user_id = t1.user_id
        AND t2.merchant_name <> t1.merchant_name
        AND t2.created_at BETWEEN t1.created_at AND t1.created_at + INTERVAL '24 hours'
      WHERE t1.created_at >= NOW() - INTERVAL '${parseInt(days_back) || 30} days'
      GROUP BY t1.merchant_name, t2.merchant_name
      HAVING COUNT(DISTINCT t1.user_id) >= 3
      ORDER BY shared_users DESC
      LIMIT 30
    `);

    const systemPrompt = `You are an expert cross-merchant fraud-ring detector AI. Identify ring structures
where users coordinate across multiple merchants (testing stolen cards, refund fraud, money-out chains).
Respond ONLY with valid JSON:
{
  "rings_detected": true/false,
  "overall_risk_level": "low|medium|high|critical",
  "rings": [
    { "ring_id": "string", "merchants": ["string array"], "user_count": 0, "total_amount": 0, "type": "card_testing|refund_fraud|money_out|laundering|other", "indicators": ["string array"], "risk_score": 0-100, "recommended_action": "investigate|freeze|notify_merchants" }
  ],
  "merchants_at_risk": ["string array"],
  "summary": "string"
}`;
    const userPrompt = `Cross-merchant ring candidates over ${days_back} days:

User merchant-spread (users hitting >=${min_merchants} merchants):
${JSON.stringify(userMerchantSpread.rows, null, 2)}

Merchant co-occurrence (same user, <=24h apart):
${JSON.stringify(merchantCoOccurrence.rows, null, 2)}`;

    const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
    const analysis = await callOpenRouter(systemPrompt, userPrompt, model);

    await persistAIResult({
      endpoint: 'cross-merchant-rings',
      entityType: 'platform',
      entityId: null,
      inputData: { days_back, min_merchants },
      result: analysis,
      modelUsed: model,
      userId: req.user?.id,
    });

    return res.json({
      analysis,
      data: {
        user_merchant_spread: userMerchantSpread.rows,
        merchant_co_occurrence: merchantCoOccurrence.rows,
      },
      model_used: model,
      analyzed_at: new Date().toISOString(),
    });
  } catch (err) {
    if (err.response) {
      return res.status(502).json({ error: 'AI Service Error', message: 'Failed to get response from AI service', details: err.response.data });
    }
    console.error('AI cross-merchant-rings error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// GET /api/ai/results — list persisted AI results
router.get('/results', authenticateToken, async (req, res) => {
  try {
    const { endpoint, entity_type, page = 1, limit = 20 } = req.query;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (endpoint) { conditions.push(`endpoint = $${paramIndex++}`); params.push(endpoint); }
    if (entity_type) { conditions.push(`entity_type = $${paramIndex++}`); params.push(entity_type); }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const countResult = await query(`SELECT COUNT(*) FROM ai_results ${whereClause}`, params);
    const dataResult = await query(
      `SELECT id, endpoint, entity_type, entity_id, model_used, user_id, created_at
       FROM ai_results ${whereClause}
       ORDER BY created_at DESC
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
    console.error('Get AI results error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// GET /api/ai/results/:id — get a specific persisted result
router.get('/results/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT * FROM ai_results WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'AI result not found' });
    }
    return res.json({ ai_result: result.rows[0] });
  } catch (err) {
    console.error('Get AI result error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

module.exports = router;
