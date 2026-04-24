const express = require('express');
const axios = require('axios');
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/credit-scores
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      risk_level,
      min_score,
      max_score,
      search,
      sort_by = 'created_at',
      sort_order = 'DESC',
    } = req.query;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (risk_level) {
      conditions.push(`risk_level = $${paramIndex++}::risk_level_enum`);
      params.push(risk_level);
    }
    if (min_score !== undefined) {
      conditions.push(`credit_score >= $${paramIndex++}`);
      params.push(parseInt(min_score));
    }
    if (max_score !== undefined) {
      conditions.push(`credit_score <= $${paramIndex++}`);
      params.push(parseInt(max_score));
    }
    if (search) {
      conditions.push(`(customer_name ILIKE $${paramIndex} OR customer_email ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const allowedSortColumns = ['created_at', 'credit_score', 'risk_level', 'customer_name', 'income', 'debt_to_income'];
    const safeSortBy = allowedSortColumns.includes(sort_by) ? sort_by : 'created_at';
    const safeSortOrder = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const countResult = await query(
      `SELECT COUNT(*) FROM credit_scores ${whereClause}`,
      params
    );

    const dataResult = await query(
      `SELECT * FROM credit_scores ${whereClause}
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
    console.error('Get credit scores error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// GET /api/credit-scores/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT * FROM credit_scores WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Credit score record not found' });
    }

    return res.json({ credit_score: result.rows[0] });
  } catch (err) {
    console.error('Get credit score error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// POST /api/credit-scores
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      customer_name,
      customer_email,
      ssn_last4,
      credit_score,
      risk_level = 'medium',
      income,
      debt_to_income,
      payment_history_score,
      credit_utilization,
      account_age_months,
      num_accounts,
      num_late_payments,
      loan_amount_requested,
      loan_purpose,
      ai_recommendation,
      ai_risk_analysis,
    } = req.body;

    if (!customer_name) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'customer_name is required',
      });
    }

    const result = await query(
      `INSERT INTO credit_scores
         (customer_name, customer_email, ssn_last4, credit_score, risk_level, income,
          debt_to_income, payment_history_score, credit_utilization, account_age_months,
          num_accounts, num_late_payments, loan_amount_requested, loan_purpose,
          ai_recommendation, ai_risk_analysis)
       VALUES ($1,$2,$3,$4,$5::risk_level_enum,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        customer_name,
        customer_email || null,
        ssn_last4 || null,
        credit_score || null,
        risk_level,
        income || null,
        debt_to_income || null,
        payment_history_score || null,
        credit_utilization || null,
        account_age_months || null,
        num_accounts || null,
        num_late_payments || null,
        loan_amount_requested || null,
        loan_purpose || null,
        ai_recommendation || null,
        ai_risk_analysis || null,
      ]
    );

    return res.status(201).json({ credit_score: result.rows[0] });
  } catch (err) {
    console.error('Create credit score error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// PUT /api/credit-scores/:id
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const {
      customer_name, customer_email, ssn_last4, credit_score, risk_level,
      income, debt_to_income, payment_history_score, credit_utilization,
      account_age_months, num_accounts, num_late_payments,
      loan_amount_requested, loan_purpose, ai_recommendation, ai_risk_analysis,
    } = req.body;

    const existing = await query('SELECT id FROM credit_scores WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Credit score record not found' });
    }

    const result = await query(
      `UPDATE credit_scores SET
         customer_name = COALESCE($1, customer_name),
         customer_email = COALESCE($2, customer_email),
         ssn_last4 = COALESCE($3, ssn_last4),
         credit_score = COALESCE($4, credit_score),
         risk_level = COALESCE($5::risk_level_enum, risk_level),
         income = COALESCE($6, income),
         debt_to_income = COALESCE($7, debt_to_income),
         payment_history_score = COALESCE($8, payment_history_score),
         credit_utilization = COALESCE($9, credit_utilization),
         account_age_months = COALESCE($10, account_age_months),
         num_accounts = COALESCE($11, num_accounts),
         num_late_payments = COALESCE($12, num_late_payments),
         loan_amount_requested = COALESCE($13, loan_amount_requested),
         loan_purpose = COALESCE($14, loan_purpose),
         ai_recommendation = COALESCE($15, ai_recommendation),
         ai_risk_analysis = COALESCE($16, ai_risk_analysis)
       WHERE id = $17
       RETURNING *`,
      [
        customer_name || null, customer_email || null, ssn_last4 || null,
        credit_score || null, risk_level || null, income || null,
        debt_to_income || null, payment_history_score || null,
        credit_utilization || null, account_age_months || null,
        num_accounts || null, num_late_payments || null,
        loan_amount_requested || null, loan_purpose || null,
        ai_recommendation || null, ai_risk_analysis || null,
        req.params.id,
      ]
    );

    return res.json({ credit_score: result.rows[0] });
  } catch (err) {
    console.error('Update credit score error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// DELETE /api/credit-scores/:id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM credit_scores WHERE id = $1 RETURNING id, customer_name',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Credit score record not found' });
    }

    return res.json({ message: 'Credit score record deleted successfully', deleted: result.rows[0] });
  } catch (err) {
    console.error('Delete credit score error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// POST /api/credit-scores/:id/analyze
router.post('/:id/analyze', authenticateToken, async (req, res) => {
  try {
    const csResult = await query('SELECT * FROM credit_scores WHERE id = $1', [req.params.id]);

    if (csResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Credit score record not found' });
    }

    const cs = csResult.rows[0];

    const systemPrompt = `You are an expert credit analyst AI. Analyze the given credit profile and provide:
1. A loan recommendation (APPROVE, CONDITIONAL, or DECLINE)
2. Risk assessment with detailed reasoning
3. Key risk factors identified
4. Suggested loan terms if approved (interest rate range, max amount)
5. Improvement suggestions for the applicant
Respond in JSON format with fields: recommendation, risk_assessment, risk_factors (array), suggested_terms (object with rate_range, max_amount, term_months), improvement_suggestions (array).`;

    const userPrompt = `Analyze this credit application:
Customer: ${cs.customer_name}
Credit Score: ${cs.credit_score}
Risk Level: ${cs.risk_level}
Annual Income: $${cs.income}
Debt-to-Income Ratio: ${cs.debt_to_income}%
Payment History Score: ${cs.payment_history_score}
Credit Utilization: ${cs.credit_utilization}%
Account Age: ${cs.account_age_months} months
Number of Accounts: ${cs.num_accounts}
Late Payments: ${cs.num_late_payments}
Loan Amount Requested: $${cs.loan_amount_requested}
Loan Purpose: ${cs.loan_purpose}`;

    const aiResponse = await axios.post(
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

    let analysisText = aiResponse.data.choices[0].message.content;
    const jsonMatch = analysisText.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (jsonMatch) analysisText = jsonMatch[1].trim();
    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch {
      analysis = { raw_response: analysisText };
    }

    await query(
      `UPDATE credit_scores SET
         ai_recommendation = $1,
         ai_risk_analysis = $2
       WHERE id = $3`,
      [
        analysis.recommendation || analysisText,
        JSON.stringify(analysis),
        cs.id,
      ]
    );

    return res.json({
      credit_score_id: cs.id,
      customer_name: cs.customer_name,
      analysis,
      model_used: process.env.OPENROUTER_MODEL,
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
    console.error('Analyze credit score error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

module.exports = router;
