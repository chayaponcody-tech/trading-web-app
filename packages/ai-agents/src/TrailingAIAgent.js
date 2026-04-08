import { callOpenRouter } from './OpenRouterClient.js';

// ─── Trailing AI Agent ────────────────────────────────────────────────────────
// Decides whether to extend TP or tighten trailing stop based on trend strength.
// Called during _aiReview when a position is open and in profit.

/**
 * Ask AI whether to extend TP or adjust trailing stop given current trend.
 *
 * @param {object} bot - Bot state
 * @param {object} pos - Open position { type, entryPrice, highestPrice, lowestPrice }
 * @param {number} currPrice
 * @param {number[]} closes - Recent close prices
 * @param {string} apiKey
 * @param {string} model
 * @returns {Promise<{
 *   action: 'EXTEND_TP'|'TIGHTEN_TRAIL'|'HOLD',
 *   newTpPercent: number|null,
 *   newTrailingPct: number|null,
 *   reason: string
 * }>}
 */
export async function assessTrailingAdjustment(bot, pos, currPrice, closes, apiKey, model) {
  if (!apiKey) return { action: 'HOLD', newTpPercent: null, newTrailingPct: null, reason: 'No API key' };

  const { symbol, strategy, tpPercent, slPercent, trailingStopPct = 0 } = bot.config;
  const isLong = pos.type === 'LONG';
  const pnlPct = isLong
    ? ((currPrice - pos.entryPrice) / pos.entryPrice) * 100
    : ((pos.entryPrice - currPrice) / pos.entryPrice) * 100;

  // Only call AI when position is in meaningful profit (> 0.5%)
  if (pnlPct < 0.5) return { action: 'HOLD', newTpPercent: null, newTrailingPct: null, reason: 'Not enough profit to assess' };

  const recentCloses = closes.slice(-20);
  const priceChange5 = ((recentCloses.at(-1) - recentCloses.at(-5)) / recentCloses.at(-5) * 100).toFixed(2);
  const priceChange10 = ((recentCloses.at(-1) - recentCloses.at(-10)) / recentCloses.at(-10) * 100).toFixed(2);

  const prompt = `You are a DYNAMIC POSITION MANAGER for a crypto futures bot.

POSITION:
- Symbol: ${symbol} | Side: ${pos.type} | Strategy: ${strategy}
- Entry: ${pos.entryPrice} | Current: ${currPrice}
- Current PnL: +${pnlPct.toFixed(2)}%
- Current TP: ${tpPercent}% | Current SL: ${slPercent}% | Trailing: ${trailingStopPct}%

TREND STRENGTH:
- Price change (last 5 candles): ${priceChange5}%
- Price change (last 10 candles): ${priceChange10}%
- Recent closes (last 10): ${JSON.stringify(recentCloses.slice(-10).map(p => parseFloat(p.toFixed(4))))}

TASK: Decide ONE action:
1. EXTEND_TP — if trend is strong and momentum continues, suggest a higher TP%
2. TIGHTEN_TRAIL — if trend is weakening, tighten trailing stop to lock in profit
3. HOLD — if current settings are optimal

RULES:
- Only EXTEND_TP if price change (5 candles) is > 1% in our direction AND momentum is consistent
- TIGHTEN_TRAIL if price is stalling or showing reversal signs
- newTpPercent must be > current TP (${tpPercent}%) and <= 10%
- newTrailingPct must be between 0.3% and 3%
- Keep "reason" under 100 chars in Thai

RESPONSE FORMAT (strict JSON only):
{
  "action": "HOLD",
  "newTpPercent": null,
  "newTrailingPct": null,
  "reason": "สรุปเหตุผลสั้นๆ ภาษาไทย"
}`;

  try {
    const raw = await callOpenRouter(prompt, apiKey, model);
    return {
      action:         raw.action || 'HOLD',
      newTpPercent:   raw.newTpPercent ? parseFloat(raw.newTpPercent) : null,
      newTrailingPct: raw.newTrailingPct ? parseFloat(raw.newTrailingPct) : null,
      reason:         raw.reason || '',
    };
  } catch (e) {
    console.error('[TrailingAIAgent] Error:', e.message);
    return { action: 'HOLD', newTpPercent: null, newTrailingPct: null, reason: `AI error: ${e.message}` };
  }
}
