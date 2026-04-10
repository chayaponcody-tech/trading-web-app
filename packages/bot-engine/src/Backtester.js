import crypto from 'crypto';
import { fetchKlines } from './KlineFetcher.js';
import { computeSignal, generateEntryReason } from './SignalEngine.js';
import { getPythonSignal } from './PythonStrategyClient.js';
import {
  calculateSharpe,
  calculateMaxDrawdown,
  calculateProfitFactor,
  generateEquityCurve,
  computeSignalConfidence,
} from '../../shared/AnalyticsUtils.js';
import { saveBacktestResult } from '../../data-layer/src/repositories/backtestRepository.js';

const MIN_CANDLES = 50;
const TAKER_FEE_RATE = 0.0004; // 0.04%

/**
 * Run a single backtest simulation.
 * @param {object} exchange - BinanceAdapter instance
 * @param {object} config - BacktestConfig
 * @returns {Promise<BacktestResult>}
 */
export async function runBacktest(exchange, config) {
  const {
    symbol,
    strategy,
    interval,
    tpPercent = 2.0,
    slPercent = 1.0,
    leverage = 10,
    capital = 1000,
    startDate = null,
    endDate = null,
  } = config;

  // Fetch klines
  const klines = await fetchKlines(exchange, symbol, interval, {
    startDate,
    endDate,
    maxKlines: 1500,
  });

  if (!klines || klines.length < MIN_CANDLES) {
    return { error: 'Insufficient data for backtesting (need > 50 klines)' };
  }

  const closes = klines.map(k => parseFloat(k[4]));
  const isPython = strategy.startsWith('PYTHON:');
  const strategyKey = isPython ? strategy.slice(7) : null;

  const positionSize = capital * leverage;
  const totalFeePerTrade = 2 * positionSize * TAKER_FEE_RATE;

  let currentCapital = capital;
  let inPosition = false;
  let positionSide = null;
  let entryPrice = 0;
  let entryTime = null;
  let entryReason = '';
  let entryConfidence = null;
  let lastConfidence = null;
  const trades = [];
  const equityCurvePerCandle = []; // one point per candle

  for (let i = MIN_CANDLES; i < klines.length; i++) {
    const closesSlice = closes.slice(0, i); // no look-ahead

    let signal;
    if (isPython) {
      try {
        const result = await getPythonSignal(strategyKey, {
          closes: closesSlice,
          highs: klines.slice(0, i).map(k => parseFloat(k[2])),
          lows: klines.slice(0, i).map(k => parseFloat(k[3])),
          volumes: klines.slice(0, i).map(k => parseFloat(k[5])),
          params: config,
          symbol,
        });
        signal = result.signal;
        lastConfidence = result.confidence;
      } catch {
        return { error: 'Strategy AI service unavailable' };
      }
    } else {
      signal = computeSignal(closesSlice, strategy, config);
      lastConfidence = computeSignalConfidence(signal, closesSlice);
    }

    const currPrice = closes[i];

    if (!inPosition) {
      if (signal === 'LONG' || signal === 'SHORT') {
        inPosition = true;
        positionSide = signal;
        entryPrice = currPrice;
        entryTime = new Date(klines[i][0]).toISOString();
        entryConfidence = lastConfidence;
        entryReason = isPython
          ? `Python:${strategyKey} → ${signal}`
          : generateEntryReason(signal, strategy, closesSlice, config);
      }
    } else {
      const pnlPct =
        positionSide === 'LONG'
          ? ((currPrice - entryPrice) / entryPrice) * 100
          : ((entryPrice - currPrice) / entryPrice) * 100;

      const signalFlipped = signal !== 'NONE' && signal !== positionSide;

      if (pnlPct >= tpPercent || pnlPct <= -slPercent || signalFlipped) {
        const pnl = (pnlPct / 100) * positionSize - totalFeePerTrade;
        currentCapital += pnl;

        trades.push({
          symbol,
          type: positionSide,
          entryPrice,
          exitPrice: currPrice,
          entryTime,
          exitTime: new Date(klines[i][0]).toISOString(),
          pnl,
          pnlPct,
          entryReason,
          entryConfidence,
          exitReason: signalFlipped ? 'Signal Flipped' : pnlPct >= tpPercent ? 'TP' : 'SL',
        });

        inPosition = false;
        positionSide = null;
        entryPrice = 0;
        entryTime = null;
        entryReason = '';
        entryConfidence = null;
      }
    }

    // Record equity at this candle (realized + unrealized)
    let unrealizedPnl = 0;
    if (inPosition) {
      const currPrice = closes[i];
      const pnlPct = positionSide === 'LONG'
        ? ((currPrice - entryPrice) / entryPrice) * 100
        : ((entryPrice - currPrice) / entryPrice) * 100;
      unrealizedPnl = (pnlPct / 100) * positionSize;
    }
    equityCurvePerCandle.push({
      time: new Date(klines[i][0]).toISOString(),
      value: currentCapital + unrealizedPnl,
    });
  }

  // Metrics
  const totalTrades = trades.length;

  if (totalTrades === 0) {
    const result = {
      backtestId: crypto.randomUUID(),
      symbol,
      strategy,
      interval,
      config,
      initialCapital: capital,
      finalCapital: capital,
      totalPnl: 0,
      netPnlPct: 0,
      totalTrades: 0,
      winRate: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      profitFactor: 0,
      avgWin: 0,
      avgLoss: 0,
      maxConsecutiveLosses: 0,
      equityCurve: [],
      trades: [],
      createdAt: new Date().toISOString(),
    };

    try {
      saveBacktestResult(result);
    } catch (e) {
      console.warn('[Backtester] DB write failed:', e.message);
    }

    return result;
  }

  const pnlList = trades.map(t => t.pnl);
  const equityCurve = equityCurvePerCandle;
  const equityValues = equityCurve.map(p => p.value);

  const winningTrades = trades.filter(t => t.pnl > 0);
  const losingTrades = trades.filter(t => t.pnl <= 0);
  const avgWin =
    winningTrades.length > 0
      ? winningTrades.reduce((s, t) => s + t.pnl, 0) / winningTrades.length
      : 0;
  const avgLoss =
    losingTrades.length > 0
      ? losingTrades.reduce((s, t) => s + t.pnl, 0) / losingTrades.length
      : 0;

  let maxConsecutiveLosses = 0;
  let streak = 0;
  for (const t of trades) {
    if (t.pnl <= 0) {
      streak++;
      if (streak > maxConsecutiveLosses) maxConsecutiveLosses = streak;
    } else {
      streak = 0;
    }
  }

  const result = {
    backtestId: crypto.randomUUID(),
    symbol,
    strategy,
    interval,
    config,
    initialCapital: capital,
    finalCapital: currentCapital,
    totalPnl: currentCapital - capital,
    netPnlPct: ((currentCapital - capital) / capital) * 100,
    totalTrades,
    winRate: (winningTrades.length / totalTrades) * 100,
    sharpeRatio: calculateSharpe(pnlList),
    maxDrawdown: calculateMaxDrawdown(equityValues),
    profitFactor: calculateProfitFactor(pnlList),
    avgWin,
    avgLoss,
    maxConsecutiveLosses,
    equityCurve,
    trades,
    createdAt: new Date().toISOString(),
  };

  try {
    saveBacktestResult(result);
  } catch (e) {
    console.warn('[Backtester] DB write failed:', e.message);
  }

  return result;
}

/**
 * Run multiple backtest configs for comparison.
 * @param {object} exchange - BinanceAdapter instance
 * @param {object[]} configs - Array of BacktestConfig
 * @returns {Promise<BacktestCompareResult[]>}
 */
export async function runBacktestCompare(exchange, configs) {
  const settled = await Promise.allSettled(
    configs.map(cfg => runBacktest(exchange, cfg))
  );

  const results = settled.map((outcome, idx) => {
    const cfg = configs[idx];
    const configLabel = `${cfg.strategy}-${cfg.interval}-${cfg.tpPercent ?? 2.0}/${cfg.slPercent ?? 1.0}`;

    if (outcome.status === 'rejected') {
      return { error: outcome.reason?.message ?? String(outcome.reason), configLabel };
    }

    const result = outcome.value;
    if (result.error) {
      return { error: result.error, configLabel };
    }

    return { ...result, configLabel };
  });

  // Sort by totalPnl descending (errors go to the bottom)
  results.sort((a, b) => {
    if (a.error && b.error) return 0;
    if (a.error) return 1;
    if (b.error) return -1;
    return (b.totalPnl ?? 0) - (a.totalPnl ?? 0);
  });

  // Assign rank
  results.forEach((r, idx) => {
    r.rank = idx + 1;
  });

  return results;
}
