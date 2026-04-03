import { callOpenRouter } from './OpenRouterClient.js';

// ─── Recommender Agent ────────────────────────────────────────────────────────
// Handles: AI single-bot recommendation + Fleet proposal
// Consolidates: aiService.getBotRecommendations() + aiService.getFleetProposal()
//   + duplicate code in legacy server.js (lines 1564-1983)

const AI_TYPES = {
  confident: { desc: 'BEST for 15m Trend following / High Winrate (EMA_RSI)', strategy: 'EMA_RSI', interval: '15m' },
  scout:     { desc: 'BEST for 5m Scalping (AI_SCOUTER)', strategy: 'AI_SCOUTER', interval: '5m' },
  grid:      { desc: 'BEST for 1h Grid Trading boundary mapping (GRID)', strategy: 'AI_GRID', interval: '1h' },
};

/**
 * Get single-bot recommendation for a symbol.
 */
export async function recommendBot(closePrices, aiType, apiKey, model, symbol) {
  const type = AI_TYPES[aiType] || AI_TYPES.confident;
  const prompt = `You are a QUANT RISK MANAGER. Analyze ${symbol} price history:
${JSON.stringify(closePrices.slice(-60))}

TASK: Suggest ONE strategy using the ${type.desc} approach.

CRITICAL RISK MANAGEMENT:
1. LEVERAGE: Suggest a safe leverage (1-20x) based on current volatility.
2. SCALING IN (ซอยไม้): Suggest 2-3 entry steps. 
   - First step is always MARKET.
   - Other steps are LIMIT orders at a specific percentage offset from current price.
   - Assign a weight (percentage of capital) to each step.

RESPONSE FORMAT (strict JSON only):
{
  "symbol": "${symbol}",
  "strategy": "${type.strategy}",
  "interval": "${type.interval}",
  "tp": 1.5,
  "sl": 1.0,
  "leverage": 10,
  "entry_steps": [
    { "type": "MARKET", "weightPct": 50, "offsetPct": 0 },
    { "type": "LIMIT", "weightPct": 50, "offsetPct": -0.5 }
  ],
  "expected_duration_min": 240,
  "ai_check_interval": 30,
  "reason": "อธิบายสั้นๆ ว่าทำไมต้องเข้าแบบนี้ และทำไมใช้ Leverage เท่านี้",
  "grid_upper": null,
  "grid_lower": null
}
Ensure entry_steps weightPct total = 100. OffsetPct for Longs is negative, Shorts is positive.`;

  const raw = await callOpenRouter(prompt, apiKey, model);
  return {
    symbol:               raw.symbol || symbol,
    strategy:             raw.strategy || type.strategy,
    interval:             raw.interval || type.interval,
    tp:                   parseFloat(raw.tp) || 1.5,
    sl:                   parseFloat(raw.sl) || 1.0,
    leverage:             parseInt(raw.leverage) || 5,
    entry_steps:          raw.entry_steps || [
      { type: 'MARKET', weightPct: 50, offsetPct: 0 },
      { type: 'LIMIT', weightPct: 50, offsetPct: -0.5 }
    ],
    expected_duration_min: parseInt(raw.expected_duration_min) || 240,
    ai_check_interval:    parseInt(raw.ai_check_interval) || 30,
    reason:               raw.reason || 'วิเคราะห์ความเสี่ยงตามความผันผวนปัจจุบัน',
    grid_upper:           raw.grid_upper ? parseFloat(raw.grid_upper) : null,
    grid_lower:           raw.grid_lower ? parseFloat(raw.grid_lower) : null,
  };
}

/**
 * Get AI-proposed fleet of bots.
 */
export async function proposeFleet(tickers, count, capital, durationMins, instructions, apiKey, model) {
  const prompt = `You are an EXPERT CRYPTO QUANT. Plan a FLEET of exactly ${count} bot(s).
Capital: $${capital} USDT | Duration: ${durationMins} mins
Goal: "${instructions}"

Top Selection List (24h stats):
${JSON.stringify(tickers.slice(0, 30))}

STRATEGIES: EMA_RSI (15m trend), AI_SCOUTER (5m scalp), AI_GRID (range — MUST include grid_upper, grid_lower numbers).

RESPONSE FORMAT (strict valid JSON):
{
  "confident": {
    "name": "🛡️ Confident Fleet",
    "description": "อธิบายเป็นภาษาไทย",
    "coins": [{ "symbol": "BTCUSDT", "strategy": "EMA_RSI", "interval": "15m", "tp": 2.0, "sl": 1.0, "leverage": 10 }]
  },
  "scout": {
    "name": "🏹 Scouting Fleet",
    "description": "อธิบายเป็นภาษาไทย",
    "coins": [{ "symbol": "DOGEUSDT", "strategy": "AI_SCOUTER", "interval": "5m", "tp": 1.5, "sl": 0.5, "leverage": 20 }]
  }
}
Rules: "coins" arrays MUST have exactly ${count} objects. NO MARKDOWN.`;

  return callOpenRouter(prompt, apiKey, model);
}
