import { db } from '../DatabaseManager.js';

/**
 * Log AI token usage for a specific feature.
 * @param {string} feature - Name of the feature (e.g., 'recommender', 'reviewer')
 * @param {string} model - Model name used
 * @param {object} usage - { prompt_tokens, completion_tokens, total_tokens }
 */
export function logTokenUsage(feature, model, usage) {
  if (!db) return;
  try {
    const { prompt_tokens = 0, completion_tokens = 0, total_tokens = 0 } = usage || {};
    db.prepare(`
      INSERT INTO ai_token_logs (feature, model, prompt_tokens, completion_tokens, total_tokens)
      VALUES (?, ?, ?, ?, ?)
    `).run(feature, model, prompt_tokens, completion_tokens, total_tokens);
  } catch (e) {
    console.error('[TokenRepository] Error logging usage:', e.message);
  }
}

/**
 * Get aggregated or detailed token logs.
 * @param {number} limit - Number of logs to return
 */
export function getTokenLogs(limit = 100) {
  if (!db) return [];
  try {
    return db.prepare(`
      SELECT * FROM ai_token_logs 
      ORDER BY timestamp DESC 
      LIMIT ?
    `).all(limit);
  } catch (e) {
    console.error('[TokenRepository] Error fetching logs:', e.message);
    return [];
  }
}

/**
 * Get summary of usage per feature.
 */
export function getTokenSummary() {
  if (!db) return [];
  try {
    return db.prepare(`
      SELECT 
        feature, 
        COUNT(*) as total_calls,
        SUM(total_tokens) as total_tokens,
        SUM(prompt_tokens) as total_prompt_tokens,
        SUM(completion_tokens) as total_completion_tokens
      FROM ai_token_logs
      GROUP BY feature
      ORDER BY total_tokens DESC
    `).all();
  } catch (e) {
    console.error('[TokenRepository] Error fetching summary:', e.message);
    return [];
  }
}
