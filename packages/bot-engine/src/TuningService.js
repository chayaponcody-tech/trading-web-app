import { getTunedIndicatorParams } from '../../ai-agents/src/OptimizerAgent.js';
import { saveBotTuningLog } from '../../data-layer/src/repositories/botRepository.js';

export class TuningService {
    constructor(exchange, aiConfig) {
        this.exchange = exchange;
        this.aiConfig = aiConfig; // { openRouterKey, openRouterModel }
    }

    /**
     * Analyze and tune bot indicators based on market volatility.
     */
    async tuneBot(bot, closes) {
        if (!this.aiConfig.openRouterKey) return;
        
        const symbol = bot.config.symbol;
        console.log(`[TuningService] Optimizing indicators for ${symbol}...`);

        try {
            const suggestion = await getTunedIndicatorParams(
                bot, 
                closes, 
                this.aiConfig.openRouterKey, 
                this.aiConfig.openRouterModel
            );

            if (suggestion && (suggestion.rsiOversold || suggestion.gridUpper)) {
                // Determine old params for logging
                const oldParams = bot.config.dynamicParams || { ...bot.config };

                // Build new params object dynamically
                const newParams = { marketCondition: suggestion.marketCondition };
                if (suggestion.rsiOversold) {
                    newParams.rsiOversold = suggestion.rsiOversold;
                    newParams.rsiOverbought = suggestion.rsiOverbought;
                }
                if (suggestion.gridUpper) {
                    newParams.gridUpper = suggestion.gridUpper;
                    newParams.gridLower = suggestion.gridLower;
                    newParams.gridLayers = suggestion.gridLayers;
                }

                // Apply to bot config (live update)
                bot.config.dynamicParams = newParams;
                
                // If it's a Grid bot, we might want to update the main config too 
                // so the technical logic picked it up immediately
                if (newParams.gridUpper) {
                    bot.config.gridUpper = newParams.gridUpper;
                    bot.config.gridLower = newParams.gridLower;
                    bot.config.gridLayers = newParams.gridLayers;
                }

                bot.aiReason = `[AI Tuned] ${suggestion.reasoning}`;

                // Log to SQLite for RAG
                saveBotTuningLog({
                    botId: bot.id,
                    symbol: symbol,
                    oldParams,
                    newParams,
                    reasoning: suggestion.reasoning,
                    marketCondition: suggestion.marketCondition
                });

                const detailStr = suggestion.rsiOversold 
                    ? `RSI < ${suggestion.rsiOversold}` 
                    : `Grid Range: $${suggestion.gridLower}-$${suggestion.gridUpper}`;
                
                console.log(`✅ [TuningService] ${symbol} updated: ${detailStr} (${suggestion.marketCondition})`);
            }
        } catch (err) {
            console.error(`[TuningService] Error tuning ${symbol}:`, err.message);
        }
    }
}
