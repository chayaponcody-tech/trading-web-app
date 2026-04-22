import { callOpenRouter } from './OpenRouterClient.js';

// ─── Optimizer Agent ──────────────────────────────────────────────────────────
// Mistake analysis and strategy tuning based on trade history.
// Consolidates: /api/forward-test/review-mistakes + /api/binance/ai-analyze
//   from legacy server.js.

/**
 * Analyze recent losing trades and suggest improvements.
 * @param {object} bot
 * @param {string} apiKey
 * @param {string} model
 * @returns {Promise<string>} Markdown analysis (Thai language)
 */
export async function analyzeMistakes(bot, apiKey, model) {
  const losingTrades = (bot.trades || []).filter((t) => parseFloat(t.pnl) < 0).slice(-10);
  if (!losingTrades.length) return 'ยังไม่มีข้อมูลการขาดทุนเพียงพอสำหรับการวิเคราะห์ในขณะนี้';

  const { strategy, interval, tpPercent, slPercent, leverage, symbol } = bot.config;
  const prompt = `You are an AI TRADING PSYCHOLOGIST & ANALYST. Review LOSING trades for bot [${bot.id}] (${symbol}).

Bot Config: Strategy=${strategy}, TF=${interval}, TP=${tpPercent}%, SL=${slPercent}%, Leverage=${leverage}x
Losing Trades (Recent 10):
${JSON.stringify(losingTrades, null, 2)}

TASK:
1. Mistake Review: WHY did these trades lose? (premature SL? signal flipped? wrong trend?)
2. Pattern Recognition: Is there a recurring mistake?
3. Strategic Adjustment: Suggest EXACT changes (e.g. "Lower SL to 0.4%").
4. Psychology Note: Are these losses "Healthy" (expected) or "Unhealthy" (strategy failure)?

Write a professional Markdown report. ENTIRE response must be in THAI.`;

  return callOpenRouter(prompt, apiKey, model, { feature: 'analyzeMistakes', jsonMode: false, maxTokens: 2000 });
}

/**
 * Full AI analysis of a fleet's performance.
 * @param {Array} botsArray
 * @param {Array} tradeHistory
 * @param {string} apiKey
 * @param {string} model
 * @returns {Promise<string>} Markdown report (Thai)
 */
export async function analyzeFleet(botsArray, tradeHistory, apiKey, model) {
  const currentConfigs = botsArray.map((b) => ({
    botId: b.id, symbol: b.config.symbol, strategy: b.config.strategy,
    tp: b.config.tpPercent, sl: b.config.slPercent, leverage: b.config.leverage,
  }));

  const prompt = `You are a MASTER CRYPTO QUANT TRADER. Analyze my Binance Testnet operations:

[Current Bot Configurations]
${JSON.stringify(currentConfigs, null, 2)}

[Recent Performance (Last 30 Trades)]
${JSON.stringify(tradeHistory.slice(-30), null, 2)}

TASK:
1. Strategic Audit: Are TP/SL realistic for current volatility?
2. Pattern Identification: Which coins/strategies are consistently failing/succeeding?
3. Profit Maximization Plan: Provide EXACT numbers to change.
4. Risk Advisory: Highlight "Danger Zones" that might cause major drawdowns.

Professional Markdown format with clear sections.
IMPORTANT: Entire response MUST be in THAI.`;

  return callOpenRouter(prompt, apiKey, model, { feature: 'analyzeFleet', jsonMode: false, maxTokens: 2000 });
}

/**
 * Programmatic Parameter Optimization
 * Suggests new TP/SL/Leverage/Strategy values based on recent performance.
 * @returns {Promise<object>} suggestedChanges - { botId, tp?, sl?, leverage?, strategy? }
 */
export async function getOptimizedParams(bot, apiKey, model) {
  const trades = (bot.trades || []).slice(-30);
  const prompt = `You are a QUANT OPTIMIZATION LLM. 
Analyze bot performance for [${bot.config.symbol}] with Strategy [${bot.config.strategy}].

Current Config: 
- TP=${bot.config.tpPercent}%
- SL=${bot.config.slPercent}%
- Leverage=${bot.config.leverage}x
- AI Check Interval=${bot.config.aiCheckInterval || 30} minutes

Recent 30 Trades: ${JSON.stringify(trades, null, 2)}

TASK:
1. Identify if current TP/SL, strategy, or AI Check Interval are underperforming.
2. If volatility is HIGH, suggest REDUCING AI Check Interval (e.g. to 5 or 10 mins).
3. If volatility is LOW, suggest INCREASING it (e.g. to 60 or 120 mins) to save resource.
4. Suggest optimized values for: TP(%), SL(%), Leverage(x), Strategy(string), and AI Check Interval (minutes).
5. Provide a brief Thai rationale.

RESPONSE MUST BE JSON ONLY:
{
  "shouldUpdate": boolean,
  "tp": number,
  "sl": number,
  "leverage": number,
  "strategy": "string",
  "interval_mins": number,
  "reason": "Thai explanation"
}`;


  const res = await callOpenRouter(prompt, apiKey, model, { feature: 'parameterOptimization', jsonMode: true });
  if (typeof res === 'object' && res !== null) {
      return res;
  }
  try {
    return JSON.parse(res);
  } catch (e) {
    console.error('[OptimizerAgent] JSON Parse Error:', e.message, 'Raw:', res);
  }
}

/**
 * Technical Indicator Tuning
 * Suggests new RSI/EMA thresholds based on recent price action & volatility.
 * @returns {Promise<object>} suggestedParams - { rsiOversold, rsiOverbought, marketCondition, reasoning }
 */
export async function getTunedIndicatorParams(bot, closes, apiKey, model) {
  const symbol = bot.config.symbol;
  const strategy = bot.config.strategy;
  
  // Last 50 closes for context
  const recentPrices = closes.slice(-50);
  
  const isGrid = strategy.includes('GRID');
  
  let taskMsg = `
TASK:
1. Analyze market condition: trending_up, trending_down, sideways, or volatile.
2. Suggest optimal "rsiOversold" (30-65) and "rsiOverbought" (35-70).
3. Provide a brief Thai rationale.`;

  let responseFormat = `{
  "rsiOversold": number,
  "rsiOverbought": number,
  "marketCondition": "string",
  "reasoning": "Thai description"
}`;

  if (isGrid) {
    const focus = strategy === 'AI_GRID_SCALP' ? 'SCALPING (Fast turnover, tight boundaries)' : 'SWING (Mid-term, wide boundaries)';
    taskMsg = `
TASK: This is a Grid Trading strategy. Focus: ${focus}.
1. Analyze the price range (Min/Max) of the recent 50 candles.
2. Suggest optimal "gridUpper" and "gridLower" boundaries.
3. Suggest "gridLayers" (3 to 10).
4. Identify marketCondition (e.g. range_bound, breakout).
5. Provide a brief Thai rationale.`;
    
    responseFormat = `{
  "gridUpper": number,
  "gridLower": number,
  "gridLayers": number,
  "marketCondition": "string",
  "reasoning": "Thai description"
}`;
  }

  const prompt = `You are a QUANT INDICATOR TUNER.
Analyze [${symbol}] Price Action for [${strategy}] Strategy.
Recent Prices: ${JSON.stringify(recentPrices)}

${taskMsg}

RESPONSE MUST BE JSON ONLY:
${responseFormat}`;

  try {
    const res = await callOpenRouter(prompt, apiKey, model, { feature: 'indicatorTuning', jsonMode: true });
    if (typeof res === 'object' && res !== null) return res;
    return JSON.parse(res);
  } catch (e) {
    console.error('[OptimizerAgent] Tuning AI Error:', e.message);
    return null;
  }
}

/**
 * Higher-level "Chief Investment Officer" Agent.
 * Reviews all fleets and total equity distribution.
 * @param {Array} fleets
 * @param {Array} allBots
 * @param {string} apiKey
 * @param {string} model
 */
export async function analyzeGlobalPortfolio(fleets, allBots, apiKey, model) {
  const fleetSummaries = fleets.map(f => {
    const fBots = allBots.filter(b => b.managedBy === f.id);
    const totalPnl = fBots.reduce((s, b) => s + (b.netPnl || 0), 0);
    return {
      name: f.name,
      activeBots: fBots.length,
      mode: f.config?.riskMode || 'manual',
      budget: f.config?.totalBudget || 0,
      totalPnl: totalPnl.toFixed(2),
      isAutonomous: f.isRunning ? 'YES' : 'NO'
    };
  });

  const prompt = `You are the CHIEF INVESTMENT OFFICER (CIO) of an AI Quant Fund.
Review my current Global Portfolio across all trading fleets.

[Fleet Summaries]
${JSON.stringify(fleetSummaries, null, 2)}

[Market Context]
Current exposure is across ${allBots.length} active bots on Binance.

TASK:
1. Executive Summary: Overall portfolio health and performance.
2. Risk Analysis: Are we over-exposed? Is any fleet underperforming?
3. Strategic Guidance: Should we change risk modes (e.g. shift from Grid to Trend)?
4. Scaling Recommendation: Should we increase or decrease capital in specific fleets?

Format: Professional Markdown. Use emoji for impact.
IMPORTANT: Entire response MUST be in THAI (ภาษาไทย).`;

  return callOpenRouter(prompt, apiKey, model, { feature: 'globalPortfolioAnalysis', jsonMode: false, maxTokens: 1500 });
}

