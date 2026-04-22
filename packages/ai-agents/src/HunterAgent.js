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

  // TOKEN OPTIMIZATION: Compact string format
  // SYMBOL|CHG%|VOL|OI|OI_DELTA|ADX|BBW|REGIME|SCORE
  const tickerLines = tickers.slice(0, 40).map(t => {
    const r = regimeMap[t.symbol];
    const parts = [
      t.symbol,
      t.priceChangePercent,
      Math.round(t.quoteVolume / 1000000) + 'M',
      t.oi ? Math.round(t.oi / 1000000) + 'M' : 'N/A',
      t.oi24hDelta ? (t.oi24hDelta > 0 ? '+' : '') + t.oi24hDelta.toFixed(1) + '%' : 'N/A',
      r ? r.adx : '?',
      r ? r.bbWidth : '?',
      r ? r.regime : '?',
      r ? r.score : '?'
    ];
    return parts.join('|');
  }).join('\n');

  const prompt = `Hunter Analyst Mode. Goal: ${goal}
Tickers (SYM|CHG%|VOL|OI|OI24|ADX|BBW|REGIME|SCORE):
${tickerLines}

TASK: Pick TOP 5 symbols. Match Strategy Goal to Regime.
- Trend: High ADX, Trending.
- Grid: Low ADX, BBW stable, Sideway.
- Microstructure: Price+OI movement.

RESPONSE (JSON only):
{
  "recommendations": [
    { "symbol": "SYMBOL", "reason": "Analytical Thai (concise)", "score": 95, "tag": "quant-pick" }
  ]
}`;

  try {
    const raw = await callOpenRouter(prompt, apiKey, model, { feature: 'huntBestSymbols' });
    return raw.recommendations || (Array.isArray(raw) ? raw : []);
  } catch (e) {
    console.error('Hunter Agent Error:', e.message);
    return [];
  }
}

