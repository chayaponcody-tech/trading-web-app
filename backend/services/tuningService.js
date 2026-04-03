import { callOpenRouter } from './aiService.js';
import * as dbService from '../db/dbService.js';

export class TuningService {
    constructor(binanceService, binanceConfig) {
        this.binanceService = binanceService;
        this.binanceConfig = binanceConfig;
    }

    /**
     * AI-driven parameter optimization for a specific bot.
     * Analyzes recent klines and suggests better RSI/EMA/BB thresholds.
     */
    async tuneBotParameters(bot) {
        if (!this.binanceConfig.apiKey) return;
        
        const symbol = bot.config.symbol;
        const interval = bot.config.interval || '15m';

        try {
            console.log(`[AI Tuner] Analyzing ${symbol} to optimize parameters...`);
            
            // 1. Gather Market Context (Last 100 klines)
            const klines = await this.binanceService.getKlines(symbol, interval, 100);
            if (!klines || klines.length < 50) return;

            const marketData = {
                symbol,
                interval,
                currentPrice: klines[klines.length - 1],
                volatility: this.calculateVolatility(klines),
                last50Prices: klines.slice(-50),
                currentStrategy: bot.config.strategy
            };

            // 2. Prompt AI for Optimization
            const prompt = `You are a QUANT OPTIMIZER.
            Symbol: ${symbol} (${interval})
            Recent Prices: ${JSON.stringify(marketData.last50Prices)}
            Strategy: ${marketData.currentStrategy}
            Current Logic: Entering LONG if RSI is extremely oversold (<40) and EMA Cross Up happens.
            
            PROBLEM: Major coins like BTC/ETH are moving steady, and RSI < 40 is too rare during an uptrend. If the market is trending UP, we should relax the RSI entry to 45-55. If it's volatile/sideways, keep it strict.

            TASK:
            1. Analyze the volatility and trend.
            2. Suggest new "dynamicParams" for this bot.
            3. Return EXACTLY this JSON format:
            {
              "rsiLower": 50,
              "rsiUpper": 50,
              "reasoning": "Thai explanation of why you chose these values",
              "marketCondition": "trending_up | trending_down | sideways | high_volatility"
            }
            
            Rules: rsiLower (for LONG) should be between 30-60. rsiUpper (for SHORT) should be between 40-70.`;

            const aiSuggestion = await callOpenRouter(prompt, this.binanceConfig.apiKey, 'google/gemini-2.0-flash-exp:free');
            
            if (aiSuggestion && aiSuggestion.rsiLower) {
                const oldParams = bot.config.dynamicParams || { rsiLower: 40, rsiUpper: 60 };
                const newParams = {
                    rsiLower: aiSuggestion.rsiLower,
                    rsiUpper: aiSuggestion.rsiUpper,
                    rsiPeriod: 14 // default for now
                };

                // 3. Update Bot Config
                bot.config.dynamicParams = newParams;
                dbService.saveBot(bot);

                // 4. Log for RAG
                dbService.saveBotTuningLog({
                    botId: bot.id,
                    symbol: symbol,
                    oldParams: oldParams,
                    newParams: newParams,
                    reasoning: aiSuggestion.reasoning,
                    marketCondition: aiSuggestion.marketCondition
                });

                console.log(`✅ [AI Tuner] ${symbol} optimized: RSI < ${newParams.rsiLower} (Reason: ${aiSuggestion.reasoning})`);
            }

        } catch (e) {
            console.error(`[AI Tuner] Error tuning ${bot.config.symbol}:`, e.message);
        }
    }

    calculateVolatility(prices) {
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            returns.push(Math.abs((prices[i] - prices[i - 1]) / prices[i - 1]));
        }
        return returns.reduce((a, b) => a + b, 0) / returns.length;
    }
}
