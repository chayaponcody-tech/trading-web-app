import { callOpenRouter } from './OpenRouterClient.js';

// ─── Recommender Agent ────────────────────────────────────────────────────────
// Optimized for Token Efficiency

const AI_TYPES = {
  confident:  { desc: '15m Trend/High Winrate (EMA_RSI)', strategy: 'EMA_RSI', interval: '15m' },
  scout:      { desc: '5m Scalp (AI_SCOUTER)', strategy: 'AI_SCOUTER', interval: '5m' },
  aggressive: { desc: '5m Scalp (AI_SCOUTER)', strategy: 'AI_SCOUTER', interval: '5m' },
  grid:       { desc: '1h Grid Boundary (GRID)', strategy: 'AI_GRID', interval: '1h' },
  safe:       { desc: '1h Grid Boundary (GRID)', strategy: 'AI_GRID', interval: '1h' },
};

/**
 * Get single-bot recommendation for a symbol.
 */
export async function recommendBot(closePrices, aiType, apiKey, model, symbol, microstructureData = null) {
  const type = AI_TYPES[aiType] || AI_TYPES.confident;
  
  // TOKEN OPTIMIZATION: Use compressed price string
  const pricesStr = closePrices.slice(-60).map(p => p.toFixed(2)).join(',');

  const prompt = `Quant Analyst Mode: ${symbol}
PRICES (last 60): ${pricesStr}
MS: ${microstructureData ? JSON.stringify(microstructureData) : 'N/A'}

TASK: Suggest strategy using ${type.desc}. 
RULES:
1. Funding > 0.01%: Risk-off Longs.
2. OI Trend: confirm entry.
3. Leverage: 1-20x based on vol.
4. Scaling: 2-3 steps (1st is MARKET).

RESPONSE (JSON):
{
  "symbol": "${symbol}",
  "strategy": "${type.strategy}",
  "interval": "${type.interval}",
  "tp": 1.5, "sl": 1.0, "leverage": 10,
  "entry_reason": "Thai analytical reasoning (concise)",
  "entry_steps": [{ "type": "MARKET", "weightPct": 50, "offsetPct": 0 }, { "type": "LIMIT", "weightPct": 50, "offsetPct": -0.5 }],
  "reason": "Thai short summary",
  "grid_upper": null, "grid_lower": null
}`;

  const raw = await callOpenRouter(prompt, apiKey, model, { feature: 'recommendBot' });
  return {
    symbol:               raw.symbol || symbol,
    strategy:             type.strategy,
    interval:             type.interval,
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
  // TOKEN OPTIMIZATION: Compact Tickers (Symbol, PriceChange, Volume)
  const compactTickers = tickers.slice(0, 30)
    .map(t => `${t.symbol}:${parseFloat(t.priceChangePercent).toFixed(1)}%|Vol:${Math.round(t.quoteVolume/1000)}k`)
    .join('\n');

  const prompt = `Fleet Planner Mode. Bots: ${count}, Cap: $${capital}, Goal: "${instructions}"
Top Market List (24h):
${compactTickers}

STRATEGY: EMA_RSI (15m), AI_SCOUTER (5m), AI_GRID (1h range).

RESPONSE (JSON):
{
  "confident": { "name": "🛡️ Confident Fleet", "description": "Thai", "coins": [{ "symbol": "BTCUSDT", "strategy": "EMA_RSI", "interval": "15m", "tp": 2.0, "sl": 1.0, "leverage": 10, "reason": "Thai" }] },
  "scout": { "name": "🏹 Scouting Fleet", "description": "Thai", "coins": [{ "symbol": "DOGEUSDT", "strategy": "AI_SCOUTER", "interval": "5m", "tp": 1.5, "sl": 0.5, "leverage": 20, "reason": "Thai" }] }
}
Rules: "coins" array size = ${count}. Short Thai reasons.`;

  return callOpenRouter(prompt, apiKey, model, { feature: 'proposeFleet' });
}


/**
 * Master Strategy Wizard: AI proposes 3 distinct options (Safe, Balanced, Aggressive).
 */
export async function proposeFundStrategy(totalAmount, tickers, apiKey, model) {
  const compactTickers = (tickers || []).slice(0, 30)
    .map(t => {
      const pct = t.percentage !== undefined ? t.percentage : (t.priceChangePercent || 0);
      const vol = t.quoteVolume || t.baseVolume || 0;
      return `${t.symbol}:${parseFloat(pct).toFixed(1)}%|Vol:${Math.round(vol/1000)}k`;
    })
    .join('\n');

  const prompt = `AI CIO Mode. Total Capital: $${totalAmount}
Recent Market Data (Top 30 by Volume):
${compactTickers}

TASK: Propose 3 distinct fund allocation strategies based on risk levels.

RESPONSE (JSON ONLY):
{
  "safe": {
    "summary": "Thai summary for safe mode",
    "fleets": [{ "name": "e.g. Fortress", "budget": number, "strategyType": "trend|grid", "riskMode": "safe", "isAutonomous": true, "reason": "Thai" }],
    "reserve": number
  },
  "balanced": {
    "summary": "Thai summary for balanced mode",
    "fleets": [...],
    "reserve": number
  },
  "aggressive": {
    "summary": "Thai summary for aggressive mode",
    "fleets": [{ "name": "e.g. Rapid Scout", "budget": number, "strategyType": "scalp", "riskMode": "aggressive", "isAutonomous": true, "reason": "Thai" }],
    "reserve": number
  }
}
Rules:
1. "reserve" is cash for drawdowns (10-40%). Sum(budget) + reserve = ${totalAmount}.
2. Max 3 fleets per tier.
3. Use Professional Thai language.
4. Strategy Types: 'trend' (EMA/SATS), 'scalp' (EMA_SCALP), 'grid' (AI_GRID).`;

  return callOpenRouter(prompt, apiKey, model, { feature: 'proposeFundStrategy', jsonMode: true });
}
