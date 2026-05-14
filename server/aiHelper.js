/**
 * Shared AI helper for OpenRouter API calls.
 * All AI routes should use this module.
 */
const axios = require('axios');
const { query } = require('./db');

const DEFAULT_MODEL = 'anthropic/claude-3-5-sonnet-20241022';

/**
 * Robust JSON parser — handles code fences, leading prose, etc.
 */
function parseAIJson(text) {
  if (!text) return null;

  // Direct parse
  try { return JSON.parse(text); } catch (e) {}

  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  const stripped = text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim();
  try { return JSON.parse(stripped); } catch (e) {}

  // Extract outermost JSON object
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch (e) {}
  }

  // Extract outermost JSON array
  const aStart = text.indexOf('[');
  const aEnd = text.lastIndexOf(']');
  if (aStart !== -1 && aEnd !== -1 && aEnd > aStart) {
    try { return JSON.parse(text.slice(aStart, aEnd + 1)); } catch (e) {}
  }

  return null;
}

/**
 * Call OpenRouter and return parsed JSON or { raw_response: text }
 */
async function callOpenRouter(systemPrompt, userPrompt, model) {
  const selectedModel = model || process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: selectedModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://antifraud-ai.app',
        'X-Title': 'Anti-Fraud AI Engine',
      },
      timeout: 30000,
    }
  );

  const text = response.data.choices[0].message.content;
  const parsed = parseAIJson(text);
  return parsed || { raw_response: text };
}

/**
 * Persist an AI result to the ai_results table.
 * Ensures table exists before inserting.
 */
async function persistAIResult({ endpoint, entityType, entityId, inputData, result, modelUsed, userId }) {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS ai_results (
        id            SERIAL PRIMARY KEY,
        endpoint      VARCHAR(100) NOT NULL,
        entity_type   VARCHAR(100),
        entity_id     INTEGER,
        input_data    JSONB,
        result        JSONB NOT NULL,
        model_used    VARCHAR(255),
        user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const insertResult = await query(
      `INSERT INTO ai_results (endpoint, entity_type, entity_id, input_data, result, model_used, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        endpoint,
        entityType || null,
        entityId || null,
        JSON.stringify(inputData || {}),
        JSON.stringify(result),
        modelUsed || process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
        userId || null,
      ]
    );

    return insertResult.rows[0].id;
  } catch (err) {
    console.error('Failed to persist AI result:', err.message);
    return null;
  }
}

module.exports = { callOpenRouter, parseAIJson, persistAIResult, DEFAULT_MODEL };
