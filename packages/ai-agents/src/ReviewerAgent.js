import { callOpenRouter } from './OpenRouterClient.js';

// ─── Reviewer Agent ───────────────────────────────────────────────────────────
// Optimized for Token Efficiency

/**
 * @param {object} bot - Full bot state
 * @param {number[]} closePrices - Recent close prices
 * @param {string} apiKey
 * @param {string} model
 * @returns {Promise<{shouldUpdate: boolean, strategy: string, tp: number, sl: number, leverage: number, gridUpper: number, gridLower: number, reason: string}>}
 */
export async function reviewBot(bot, closePrices, apiKey, model) {
  if (!apiKey) return { shouldUpdate: false, reason: 'No API key' };

  const { symbol, strategy, tpPercent, slPercent, leverage, gridUpper, gridLower } = bot.config;
  const currPrice = closePrices.at(-1);
  
  // Compact trade history: SIDE|PNL|REASON
  const recentTrades = (bot.trades || []).slice(-10)
    .map(t => `${t.type}|${t.pnl?.toFixed(1)}|${t.reason?.slice(0, 15)}`)
    .join('\n');

  const isGrid = ['GRID', 'AI_GRID', 'AI_GRID_SCALP', 'AI_GRID_SWING'].includes(strategy);
  const gridInfo = isGrid ? `Grid: [${gridUpper}-${gridLower}]` : '';

  const prompt = `Review Bot: ${symbol} (${strategy})
Status: Price=${currPrice}, TP=${tpPercent}%, SL=${slPercent}%, Lev=${leverage}x ${gridInfo}
Trades (Side|PnL|Reason):
${recentTrades}

TASK: Suggest optimization if R/R is poor. 
JSON RESPONSE:
{
  "should_update": false,
  "strategy": "${strategy}",
  "tp": ${tpPercent}, "sl": ${slPercent}, "leverage": ${leverage},
  ${isGrid ? `"grid_upper": ${gridUpper}, "grid_lower": ${gridLower},` : ''}
  "reason": "Thai (concise)"
}`;

  try {
    const raw = await callOpenRouter(prompt, apiKey, model, { feature: 'reviewBot' });
    return {
      shouldUpdate: Boolean(raw.should_update),
      strategy:     raw.strategy || strategy,
      tp:           raw.tp ? parseFloat(raw.tp) : tpPercent,
      sl:           raw.sl ? parseFloat(raw.sl) : slPercent,
      leverage:     raw.leverage ? parseInt(raw.leverage) : leverage,
      gridUpper:    raw.grid_upper ? parseFloat(raw.grid_upper) : gridUpper,
      gridLower:    raw.grid_lower ? parseFloat(raw.grid_lower) : gridLower,
      reason:       raw.reason || 'No changes proposed',
    };
  } catch (e) {
    console.error('[ReviewerAgent] Error:', e.message);
    return { shouldUpdate: false, reason: `Review failed: ${e.message}` };
  }
}

