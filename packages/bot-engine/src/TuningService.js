import { optimizeStrategy, optimizeStrategyVbt } from './PythonStrategyClient.js';
import { saveBotTuningLog } from '../../data-layer/src/repositories/botRepository.js';

// Default search spaces per strategy type
const SEARCH_SPACES = {
    RSI:          { rsiOversold: [20, 45], rsiOverbought: [55, 80] },
    Grid:         { gridUpper: [0, 5], gridLower: [-5, 0], gridLayers: [3, 20] },
    EMACross:     { fastPeriod: [5, 30], slowPeriod: [20, 100] },
    EMAScalp:     { emaPeriod: [5, 50] },
    BollingerBands: { bbPeriod: [10, 50], bbStdDev: [1, 3] },
    StochRSI:     { stochRsiOversold: [10, 40], stochRsiOverbought: [60, 90] },
    VWAPScalp:    { vwapDeviation: [0.001, 0.01] },
    default:      { rsiOversold: [20, 45], rsiOverbought: [55, 80] },
};

function getSearchSpace(bot) {
    const strategy = bot.config.strategy || '';
    for (const [key, space] of Object.entries(SEARCH_SPACES)) {
        if (key !== 'default' && strategy.includes(key)) return space;
    }
    return SEARCH_SPACES.default;
}

export class TuningService {
    constructor(exchange, _aiConfig) {
        this.exchange = exchange;
        // aiConfig retained for API compatibility but no longer used for LLM calls
    }

    /**
     * Optimize bot indicator parameters using Bayesian search via POST /strategy/optimize.
     * On endpoint unavailability, logs a warning and retains current params unchanged.
     */
    async tuneBot(bot, closes, highs = [], lows = [], volumes = []) {
        const symbol = bot.config.symbol;
        const strategyRaw = bot.config.strategy || 'RSI';
        // Strip "PYTHON:" prefix if present
        const strategyKey = strategyRaw.replace(/^PYTHON:/i, '');

        // Defensive check: Ensure all arrays have the same length
        if (!Array.isArray(highs)) highs = [];
        if (!Array.isArray(lows)) lows = [];
        if (!Array.isArray(volumes)) volumes = [];

        const cLen = closes.length;
        if (highs.length !== cLen || lows.length !== cLen || volumes.length !== cLen) {
            console.warn(`[TuningService] ⚠️ Array length mismatch for ${symbol}: C=${cLen}, H=${highs.length}, L=${lows.length}, V=${volumes.length}. Attempting to fix...`);
            // If they are empty, fill them with 'closes' to prevent VBT mismatch 
            // This allows strategies like RSI (which only need close) to still be optimized in VBT mode.
            if (highs.length === 0) highs = [...closes];
            if (lows.length === 0) lows = [...closes];
            if (volumes.length === 0) volumes = closes.map(() => 0);
        }

        console.log(`[TuningService] Optimizing parameters for ${symbol} (${strategyKey})...`);

        const search_space = getSearchSpace(bot);

        let result;
        try {
            // Try VectorBT optimizer first (faster grid sweep)
            result = await optimizeStrategyVbt(strategyKey, {
                closes,
                highs,
                lows,
                volumes,
                search_space,
            });
            console.log(`[TuningService] VBT engine: ${result.engine}, return: ${result.best_return?.toFixed(2)}%, MDD: ${result.best_max_drawdown?.toFixed(4)}`);
        } catch {
            // Fallback to Bayesian (Optuna) if VBT endpoint unavailable
            console.warn(`[TuningService] VBT unavailable, falling back to Optuna for ${symbol}`);
            try {
                result = await optimizeStrategy(strategyKey, {
                    closes,
                    highs,
                    lows,
                    volumes,
                    search_space,
                });
            } catch (err) {
                // Requirement 5.7: log warning and retain current params unchanged
                console.warn(`[TuningService] Optimization endpoint unavailable for ${symbol}: ${err.message}`);
                return;
            }
        }

        const { best_params } = result;
        if (!best_params || Object.keys(best_params).length === 0) {
            console.warn(`[TuningService] No best_params returned for ${symbol}, retaining current config.`);
            return;
        }

        const oldParams = bot.config.dynamicParams || { ...bot.config };

        // Apply returned best_params to bot.config
        bot.config.dynamicParams = { ...best_params };
        Object.assign(bot.config, best_params);

        // Log to SQLite for RAG
        saveBotTuningLog({
            botId: bot.id,
            symbol,
            oldParams,
            newParams: best_params,
            reasoning: `${result.engine ?? 'optuna'} optimization (Sharpe: ${result.best_sharpe?.toFixed(4) ?? 'N/A'}, trials: ${result.n_trials})`,
            marketCondition: 'optimized',
            engine: result.engine ?? 'optuna',
        });

        console.log(`✅ [TuningService] ${symbol} updated | engine=${result.engine ?? 'optuna'} | sharpe=${result.best_sharpe?.toFixed(4)} | params:`, best_params);
    }
}
