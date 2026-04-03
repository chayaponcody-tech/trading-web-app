import { callOpenRouter } from './OpenRouterClient.js';

/**
 * Hunter Agent: Analyzes a list of tickers to find the best 5 candidates for a specific strategy goal.
 */
export async function huntBestSymbols(tickers, goal, apiKey, model) {
  const tickerSummary = tickers.slice(0, 40).map(t => ({
    s: t.symbol,
    c: t.priceChangePercent,
    v: Math.round(t.quoteVolume / 1000000) + 'M',
    p: t.lastPrice
  }));

  const prompt = `You are a High-Frequency Trading Analyst.
GOAL: ${goal}

I have 40 top coins from Binance (24h data):
${JSON.stringify(tickerSummary)}

TASK:
Identify the TOP 5 most suitable coins that fit the goal perfectly based on their 24h price change and volume behavior.
- For Grid: Look for coins with low change (-2% to +2%) but high volume (sideways).
- For Scalp: Look for high volatility (> 5%) and extreme volume.
- For Trend: Look for steady positive momentum (> 3%) with strong volume support.

RESPONSE FORMAT (strict JSON only):
[
  { "symbol": "SYMBOL", "reason": "Short catchy reason in Thai", "score": 1-100, "tag": "short-tag" },
  ...
]
No markdown, no explanation. Just the JSON array.`;

  try {
    const raw = await callOpenRouter(prompt, apiKey, model);
    return Array.isArray(raw) ? raw : [];
  } catch (e) {
    console.error('Hunter Agent Error:', e.message);
    return [];
  }
}
