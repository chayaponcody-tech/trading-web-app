import { callOpenRouter } from './OpenRouterClient.js';

/**
 * Hunter Agent: Analyzes a list of tickers to find the best 5 candidates for a specific strategy goal.
 */
export async function huntBestSymbols(tickers, goal, apiKey, model) {
  const tickerSummary = tickers.slice(0, 40).map(t => ({
    s: t.symbol,
    c: t.priceChangePercent,
    v: Math.round(t.quoteVolume / 1000000) + 'M',
    p: t.lastPrice,
    oi: t.oi ? Math.round(t.oi / 1000000) + 'M' : 'N/A', // Open Interest in Millions
    oi24h: t.oi24hDelta ? (t.oi24hDelta > 0 ? '+' : '') + t.oi24hDelta.toFixed(1) + '%' : 'N/A' // OI 24h Change
  }));

  const prompt = `You are a High-Frequency Trading Analyst specializing in QUANTITATIVE MICROSTRUCTURE.
GOAL: ${goal}

I have 40 top coins from Binance (24h Price/Vol + Open Interest data):
${JSON.stringify(tickerSummary)}

TASK:
Identify the TOP 5 most suitable coins that fit the goal perfectly.

QUANTITATIVE GUIDELINES:
1. **OI DELTA**: Price Up + OI Up = High conviction BULLISH (New capital entering). Price Up + OI Down = Short Covering (Weak rally).
2. **LIQUIDITY**: Prioritize symbols with high Quote Volume AND growing Open Interest.
3. **MICROSTRUCTURE**: Look for anomalies where OI is rising much faster than price (potential breakout).

For each selection, provide a brief but ANALYTICAL reason in Thai, explicitly mentioning the price-OI relationship.

RESPONSE FORMAT (strict JSON only):
{
  "recommendations": [
    { "symbol": "SYMBOL", "reason": "เหตุผลเชิงลึก (ภาษาไทย) เช่น 'ราคาขึ้นพร้อม OI +15% ยืนยันแรงซื้อจริง'", "score": 1-100, "tag": "quant-pick" },
    ...
  ]
}
No markdown, no explanation. Just the JSON object.`;

  try {
    const raw = await callOpenRouter(prompt, apiKey, model);
    if (raw && Array.isArray(raw.recommendations)) return raw.recommendations;
    if (Array.isArray(raw)) return raw; // Fallback
    return [];
  } catch (e) {
    console.error('Hunter Agent Error:', e.message);
    return [];
  }
}
