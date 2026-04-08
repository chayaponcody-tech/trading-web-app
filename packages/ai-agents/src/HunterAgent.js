import { callOpenRouter } from './OpenRouterClient.js';

// Strategy type mapping — used to determine what market regime to look for
const STRATEGY_REGIME = {
  grid:    { type: 'grid',  label: 'Sideway/Range',  interval: '1h' },
  safe:    { type: 'grid',  label: 'Sideway/Range',  interval: '1h' },
  scout:   { type: 'scalp', label: 'High Volatility', interval: '5m' },
  aggressive: { type: 'scalp', label: 'High Volatility', interval: '5m' },
  confident:  { type: 'trend', label: 'Trending',    interval: '15m' },
};

/**
 * Hunter Agent: Analyzes a list of tickers to find the best 5 candidates for a specific strategy goal.
 * Now includes market regime suitability data (ADX, BBWidth) per coin.
 *
 * @param {object[]} tickers - Raw ticker list from exchange
 * @param {string} goal - Strategy goal description
 * @param {string} apiKey
 * @param {string} model
 * @param {object[]} [regimeData] - Optional pre-computed regime data per symbol: { symbol, adx, bbWidth, regime, score, suitable }
 */
export async function huntBestSymbols(tickers, goal, apiKey, model, regimeData = []) {
  const regimeMap = Object.fromEntries(regimeData.map(r => [r.symbol, r]));

  const tickerSummary = tickers.slice(0, 40).map(t => {
    const regime = regimeMap[t.symbol];
    return {
      s: t.symbol,
      c: t.priceChangePercent,
      v: Math.round(t.quoteVolume / 1000000) + 'M',
      p: t.lastPrice,
      oi: t.oi ? Math.round(t.oi / 1000000) + 'M' : 'N/A',
      oi24h: t.oi24hDelta ? (t.oi24hDelta > 0 ? '+' : '') + t.oi24hDelta.toFixed(1) + '%' : 'N/A',
      // Market regime indicators
      adx:     regime ? regime.adx     : null,
      bbw:     regime ? regime.bbWidth : null,
      regime:  regime ? regime.regime  : null,
      regScore: regime ? regime.score  : null,
    };
  });

  const prompt = `You are a High-Frequency Trading Analyst specializing in QUANTITATIVE MICROSTRUCTURE.
GOAL: ${goal}

I have 40 top coins from Binance with 24h stats + Open Interest + Market Regime data:
- adx: Average Directional Index (ADX < 25 = ranging/sideway, ADX > 25 = trending)
- bbw: Bollinger Band Width % (low = consolidating, high = expanding/volatile)
- regime: detected market regime (sideway_strong, sideway, weak_trend, trending, volatile, etc.)
- regScore: suitability score 0-100 for the requested strategy type

${JSON.stringify(tickerSummary)}

TASK:
Identify the TOP 5 most suitable coins that fit the goal perfectly.

QUANTITATIVE GUIDELINES:
1. **REGIME MATCH**: Prioritize coins whose "regime" and "regScore" match the strategy goal. For grid/range strategies, prefer sideway_strong/sideway with high regScore. For trend strategies, prefer trending with high ADX.
2. **OI DELTA**: Price Up + OI Up = High conviction BULLISH. Price Up + OI Down = Short Covering (Weak rally).
3. **LIQUIDITY**: Prioritize symbols with high Quote Volume AND growing Open Interest.
4. **MICROSTRUCTURE**: Look for anomalies where OI is rising much faster than price (potential breakout).

For each selection, provide a brief but ANALYTICAL reason in Thai, explicitly mentioning the regime match + price-OI relationship.

RESPONSE FORMAT (strict JSON only):
{
  "recommendations": [
    { "symbol": "SYMBOL", "reason": "เหตุผลเชิงลึก (ภาษาไทย) เช่น 'ADX=18 ยืนยัน sideway + OI +15% ยืนยันแรงซื้อจริง'", "score": 1-100, "tag": "quant-pick" },
    ...
  ]
}
No markdown, no explanation. Just the JSON object.`;

  try {
    const raw = await callOpenRouter(prompt, apiKey, model);
    if (raw && Array.isArray(raw.recommendations)) return raw.recommendations;
    if (Array.isArray(raw)) return raw;
    return [];
  } catch (e) {
    console.error('Hunter Agent Error:', e.message);
    return [];
  }
}
