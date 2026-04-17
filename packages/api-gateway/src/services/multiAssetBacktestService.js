import { runBacktest } from '../../../bot-engine/src/Backtester.js';

/**
 * Generate non-overlapping random time windows within a lookback range.
 *
 * @param {number} lookbackYears - How many years back to sample from (max 5)
 * @param {number} windowDays - Size of each window in days
 * @param {number} numWindows - Number of windows to generate (max 10)
 * @returns {{ startDate: string, endDate: string }[]} Array of non-overlapping windows
 */
export function generateNonOverlappingWindows(lookbackYears, windowDays, numWindows) {
  const now = new Date();
  const lookbackStart = new Date(now);
  lookbackStart.setFullYear(lookbackStart.getFullYear() - lookbackYears);

  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const rangeMs = now.getTime() - lookbackStart.getTime();

  // Not enough range to fit even one window
  if (rangeMs < windowMs) {
    return [];
  }

  const windows = [];
  const maxAttempts = numWindows * 50;
  let attempts = 0;

  while (windows.length < numWindows && attempts < maxAttempts) {
    attempts++;

    // Random startDate within [lookbackStart, now - windowDays]
    const maxStart = now.getTime() - windowMs;
    if (maxStart < lookbackStart.getTime()) break;

    const randomOffset = Math.random() * (maxStart - lookbackStart.getTime());
    const startMs = lookbackStart.getTime() + randomOffset;
    const endMs = startMs + windowMs;

    const candidate = {
      startDate: new Date(startMs).toISOString(),
      endDate: new Date(endMs).toISOString(),
    };

    // Check non-overlapping with existing windows
    const overlaps = windows.some(w => {
      const wStart = new Date(w.startDate).getTime();
      const wEnd = new Date(w.endDate).getTime();
      return startMs < wEnd && endMs > wStart;
    });

    if (!overlaps) {
      windows.push(candidate);
    }
  }

  return windows;
}

/**
 * Run a backtest for a single strategy across multiple symbols in parallel.
 *
 * @param {object} exchange - BinanceAdapter instance
 * @param {object} strategyDef - StrategyDefinition object (id, name, defaultParams, etc.)
 * @param {object} config - { symbols: string[], interval, startDate, endDate, params? }
 * @returns {Promise<{ results: AssetResult[], summary: object, executionTimeMs: number }>}
 */
export async function runMultiAssetBacktest(exchange, strategyDef, config) {
  const startTime = Date.now();
  const { interval, startDate, endDate, params } = config;
  // Deduplicate symbols to ensure exactly one result per symbol
  const symbols = [...new Set(config.symbols)];

  // Merge defaultParams with override params
  const mergedParams = {
    ...(strategyDef.defaultParams || {}),
    ...(params || {}),
  };

  // Resolve the actual strategy key for SignalEngine:
  // custom DB strategies store their base engine key in `baseStrategy`
  const strategyKey = strategyDef.baseStrategy || strategyDef.name;

  // Force python engine for custom strategies (engineType === 'python') or
  // when no baseStrategy is set (custom strategy with python code)
  const forceEngine = strategyDef.engineType === 'python' ? 'python' : undefined;

  // Run all symbols in parallel
  const settled = await Promise.allSettled(
    symbols.map(symbol =>
      runBacktest(exchange, {
        symbol,
        strategy: strategyKey,
        interval,
        startDate,
        endDate,
        forceEngine,
        ...mergedParams,
      })
    )
  );

  // Build AssetResult array
  const rawResults = settled.map((outcome, idx) => {
    const symbol = symbols[idx];

    if (outcome.status === 'rejected') {
      return {
        symbol,
        error: outcome.reason?.message ?? String(outcome.reason),
        rank: null,
      };
    }

    const result = outcome.value;
    if (result.error) {
      return {
        symbol,
        error: result.error,
        rank: null,
      };
    }

    return {
      symbol,
      totalPnl: result.totalPnl ?? 0,
      winRate: result.winRate ?? 0,
      sharpeRatio: result.sharpeRatio ?? 0,
      maxDrawdown: result.maxDrawdown ?? 0,
      totalTrades: result.totalTrades ?? 0,
      equityCurve: result.equityCurve ?? [],
      trades: (result.trades ?? []).map(t => ({
        type: t.type,
        entryPrice: t.entryPrice,
        exitPrice: t.exitPrice,
        entryTime: t.entryTime,
        exitTime: t.exitTime,
        pnl: t.pnl,
        pnlPct: t.pnlPct,
        entryReason: t.entryReason,
        exitReason: t.exitReason,
      })),
      rank: null, // assigned below
    };
  });

  // Separate successful and failed results
  const successful = rawResults.filter(r => !r.error);
  const failed = rawResults.filter(r => r.error);

  // Sort successful by totalPnl descending and assign rank
  successful.sort((a, b) => (b.totalPnl ?? 0) - (a.totalPnl ?? 0));
  successful.forEach((r, idx) => {
    r.rank = idx + 1;
  });

  const results = [...successful, ...failed];

  // Calculate summary metrics
  const avgWinRate =
    successful.length > 0
      ? successful.reduce((sum, r) => sum + r.winRate, 0) / successful.length
      : 0;

  const avgSharpeRatio =
    successful.length > 0
      ? successful.reduce((sum, r) => sum + r.sharpeRatio, 0) / successful.length
      : 0;

  const avgTotalPnl =
    successful.length > 0
      ? successful.reduce((sum, r) => sum + r.totalPnl, 0) / successful.length
      : 0;

  const bestSymbol = successful.length > 0 ? successful[0].symbol : null;
  const worstSymbol = successful.length > 0 ? successful[successful.length - 1].symbol : null;

  const summary = {
    bestSymbol,
    worstSymbol,
    avgWinRate,
    avgSharpeRatio,
    avgTotalPnl,
    totalSymbolsTested: symbols.length,
    successfulSymbols: successful.length,
    failedSymbols: failed.length,
  };

  return {
    results,
    summary,
    executionTimeMs: Date.now() - startTime,
  };
}

/**
 * Run a backtest across randomly sampled non-overlapping time windows.
 *
 * @param {object} exchange - BinanceAdapter instance
 * @param {object} strategyDef - StrategyDefinition object
 * @param {object} config - { symbols: string[], interval, windowDays, lookbackYears, numWindows, params? }
 * @returns {Promise<{ windows: object[], summary: object, executionTimeMs: number }>}
 */
export async function runRandomWindowBacktest(exchange, strategyDef, config) {
  const startTime = Date.now();
  const { interval, windowDays, lookbackYears, numWindows, params } = config;
  // Deduplicate symbols
  const symbols = [...new Set(config.symbols)];

  // Generate non-overlapping windows
  const timeWindows = generateNonOverlappingWindows(lookbackYears, windowDays, numWindows);

  // Merge defaultParams with override params
  const mergedParams = {
    ...(strategyDef.defaultParams || {}),
    ...(params || {}),
  };

  // Resolve the actual strategy key for SignalEngine
  const strategyKey = strategyDef.baseStrategy || strategyDef.name;

  // Force python engine for custom strategies with engineType === 'python'
  const forceEngine = strategyDef.engineType === 'python' ? 'python' : undefined;

  // Build all (symbol, window) combinations
  const tasks = [];
  for (const window of timeWindows) {
    for (const symbol of symbols) {
      tasks.push({ symbol, window });
    }
  }

  // Run all combinations in parallel
  const settled = await Promise.allSettled(
    tasks.map(({ symbol, window }) =>
      runBacktest(exchange, {
        symbol,
        strategy: strategyKey,
        interval,
        startDate: window.startDate,
        endDate: window.endDate,
        forceEngine,
        ...mergedParams,
      })
    )
  );

  // Group results by window
  const windowResultsMap = new Map();
  for (const tw of timeWindows) {
    windowResultsMap.set(tw.startDate, {
      windowStart: tw.startDate,
      windowEnd: tw.endDate,
      symbolResults: [],
    });
  }

  tasks.forEach(({ symbol, window }, idx) => {
    const outcome = settled[idx];
    const windowEntry = windowResultsMap.get(window.startDate);

    if (outcome.status === 'rejected') {
      windowEntry.symbolResults.push({
        symbol,
        error: outcome.reason?.message ?? String(outcome.reason),
      });
    } else {
      const result = outcome.value;
      if (result.error) {
        windowEntry.symbolResults.push({ symbol, error: result.error });
      } else {
        windowEntry.symbolResults.push({
          symbol,
          totalPnl: result.totalPnl ?? 0,
          winRate: result.winRate ?? 0,
          sharpeRatio: result.sharpeRatio ?? 0,
          maxDrawdown: result.maxDrawdown ?? 0,
          totalTrades: result.totalTrades ?? 0,
        });
      }
    }
  });

  // Aggregate per-window metrics (average across symbols)
  const windows = Array.from(windowResultsMap.values()).map(entry => {
    const successful = entry.symbolResults.filter(r => !r.error);
    const avgPnl =
      successful.length > 0
        ? successful.reduce((s, r) => s + r.totalPnl, 0) / successful.length
        : 0;
    const avgWinRate =
      successful.length > 0
        ? successful.reduce((s, r) => s + r.winRate, 0) / successful.length
        : 0;
    const avgSharpe =
      successful.length > 0
        ? successful.reduce((s, r) => s + r.sharpeRatio, 0) / successful.length
        : 0;
    const avgDrawdown =
      successful.length > 0
        ? successful.reduce((s, r) => s + r.maxDrawdown, 0) / successful.length
        : 0;

    return {
      windowStart: entry.windowStart,
      windowEnd: entry.windowEnd,
      totalPnl: avgPnl,
      winRate: avgWinRate,
      sharpeRatio: avgSharpe,
      maxDrawdown: avgDrawdown,
    };
  });

  // Consistency score: fraction of windows with totalPnl > 0
  const profitableWindows = windows.filter(w => w.totalPnl > 0).length;
  const consistencyScore = windows.length > 0 ? profitableWindows / windows.length : 0;

  const avgWinRate =
    windows.length > 0
      ? windows.reduce((s, w) => s + w.winRate, 0) / windows.length
      : 0;

  const avgSharpeRatio =
    windows.length > 0
      ? windows.reduce((s, w) => s + w.sharpeRatio, 0) / windows.length
      : 0;

  const avgTotalPnl =
    windows.length > 0
      ? windows.reduce((s, w) => s + w.totalPnl, 0) / windows.length
      : 0;

  const bestWindow =
    windows.length > 0
      ? windows.reduce((best, w) => (w.totalPnl > best.totalPnl ? w : best), windows[0])
      : null;

  const worstWindow =
    windows.length > 0
      ? windows.reduce((worst, w) => (w.totalPnl < worst.totalPnl ? w : worst), windows[0])
      : null;

  const summary = {
    consistencyScore,
    avgWinRate,
    avgSharpeRatio,
    avgTotalPnl,
    bestWindow,
    worstWindow,
  };

  return {
    windows,
    summary,
    executionTimeMs: Date.now() - startTime,
  };
}
