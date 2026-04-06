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
Identify the TOP 5 most suitable coins that fit the goal perfectly.
For each selection, provide a brief but ANALYTICAL reason in Thai, mentioning why its volume or price behavior is attractive for the strategy.

RESPONSE FORMAT (strict JSON only):
{
  "recommendations": [
    { "symbol": "SYMBOL", "reason": "เหตุผลเชิงเทคนิคสั้นๆ (ภาษาไทย) เช่น 'ปริมาณการซื้อขายคงที่ที่แนวรับ 1h'", "score": 1-100, "tag": "short-tag" },
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
