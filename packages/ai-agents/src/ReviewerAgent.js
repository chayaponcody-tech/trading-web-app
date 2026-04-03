import { callOpenRouter } from './OpenRouterClient.js';

// ─── Reviewer Agent ───────────────────────────────────────────────────────────
// Periodic strategic review of a running bot.
// Consolidates: performAiBotReview() from server.js (line 339) and botService.js.

/**
 * @param {object} bot - Full bot state
 * @param {number[]} closePrices - Recent close prices
 * @param {string} apiKey
 * @param {string} model
 * @returns {Promise<{shouldUpdate: boolean, changes: object, reason: string}>}
 */
export async function reviewBot(bot, closePrices, apiKey, model) {
  if (!apiKey) return { shouldUpdate: false, reason: 'No API key' };

  const { symbol, strategy, tpPercent, slPercent, leverage, interval } = bot.config;
  const currPrice = closePrices.at(-1);
  const recentTrades = (bot.trades || []).slice(-10).map(t => ({
    side: t.type,
    pnl: t.pnl?.toFixed(2),
    exit: t.reason?.slice(0, 20)
  }));

  const prompt = `You are a SENIOR QUANT STRATEGIST. Review Bot [${bot.id}] (${symbol}).
Current: Strategy=${strategy}, TP=${tpPercent}%, SL=${slPercent}%, Leverage=${leverage}x
Current Price: ${currPrice}
Recent Performance: ${JSON.stringify(recentTrades)}

TASK:
1. Review volatility and market phase.
2. Suggest optimization only if R/R is poor.
3. If current setup is good, set "should_update": false.

RESPONSE FORMAT (JSON only, no preamble, keep "reason" under 150 chars):
{
  "should_update": false,
  "strategy": "${strategy}",
  "tp": ${tpPercent},
  "sl": ${slPercent},
  "leverage": ${leverage},
  "reason": "Brief summary in Thai"
}
Only set "should_update" to true for meaningful improvements.`;

  try {
    const raw = await callOpenRouter(prompt, apiKey, model);
    return {
      shouldUpdate: Boolean(raw.should_update),
      strategy:     raw.strategy,
      tp:           raw.tp ? parseFloat(raw.tp) : null,
      sl:           raw.sl ? parseFloat(raw.sl) : null,
      leverage:     raw.leverage ? parseInt(raw.leverage) : null,
      gridUpper:    raw.grid_upper ? parseFloat(raw.grid_upper) : null,
      gridLower:    raw.grid_lower ? parseFloat(raw.grid_lower) : null,
      reason:       raw.reason || '',
    };
  } catch (e) {
    console.error('[ReviewerAgent] Error:', e.message);
    return { shouldUpdate: false, reason: `Review failed: ${e.message}` };
  }
}
