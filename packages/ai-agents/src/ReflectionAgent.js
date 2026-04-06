import { callOpenRouter } from './OpenRouterClient.js';

// ─── Reflection Agent ─────────────────────────────────────────────────────────
// Pre-trade validation: approves or rejects a signal before execution.
// Consolidates: performAiReflection() from server.js (line 472) and botService.js.

/**
 * @param {object} bot - Bot state object
 * @param {'LONG'|'SHORT'} signal
 * @param {number} currPrice
 * @param {string} apiKey
 * @param {string} model
 * @param {Array} pastMistakes - Array of recent trade mistakes for this symbol
 * @returns {Promise<{approved: boolean, reason: string}>}
 */
export async function reflect(bot, signal, currPrice, apiKey, model, pastMistakes = []) {
  if (!apiKey) return { approved: true, reason: 'No API key — auto-approved' };

  const { symbol, strategy, interval } = bot.config;
  const prompt = `You are a strict Quant Reflection Agent.
A technical indicator fired a [${signal}] signal for ${symbol} on ${interval} timeframe using ${strategy}.
Current price: ${currPrice}.

Based on market context (volatility, trend, chop), should we execute this ${signal} trade?
Approve only for high-probability setups. Reject for false breakouts or choppy markets.

PAST MISTAKES (DO NOT REPEAT THESE ERRORS):
${pastMistakes.length > 0 
  ? pastMistakes.map(m => `- [${m.strategy}] At ${m.entryPrice}: ${m.aiLesson}`).join('\n')
  : 'None recorded yet. Be careful.'}

RESPONSE FORMAT (JSON only):
{
  "approved": true,
  "reason": "สรุปเหตุผลสั้นๆ เป็นภาษาไทย (ระบุด้วยว่าเช็คจากบทเรียนเก่าแล้วหรือไม่)"
}`;

  try {
    const raw = await callOpenRouter(prompt, apiKey, model);
    return { approved: Boolean(raw.approved), reason: raw.reason || 'No reason' };
  } catch (e) {
    console.error('[ReflectionAgent] Error:', e.message);
    return { approved: true, reason: `Error — auto-approved: ${e.message}` };
  }
}
