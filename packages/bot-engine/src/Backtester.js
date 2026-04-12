import crypto from 'crypto';
import { fetchKlines } from './KlineFetcher.js';
import { computeSignal, generateEntryReason } from './SignalEngine.js';
import { getBatchSignals } from './PythonStrategyClient.js';
import {
  calculateSharpe,
  calculateMaxDrawdown,
  calculateProfitFactor,
  computeSignalConfidence,
} from '../../shared/AnalyticsUtils.js';
import { saveBacktestResult } from '../../data-layer/src/repositories/backtestRepository.js';
// Inlined indicator helpers (avoids cross-boundary import from backend/)
function emaCalc(values, period) {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  let ema = [values.slice(0, period).reduce((a, b) => a + b, 0) / period];
  for (let i = period; i < values.length; i++) {
    ema.push(values[i] * k + ema[ema.length - 1] * (1 - k));
  }
  return ema;
}

function rsiCalc(values, period = 14) {
  if (values.length <= period) return [];
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gains += d; else losses -= d;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  const rsi = [avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)];
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }
  return rsi;
}

function bbCalc(values, period = 20, stdDev = 2) {
  if (values.length < period) return [];
  const bands = [];
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    bands.push({ upper: mean + stdDev * sd, lower: mean - stdDev * sd, middle: mean });
  }
  return bands;
}

const MIN_CANDLES = 50;
const TAKER_FEE_RATE = 0.0004; // 0.04%

/**
 * Registry of all JS-native strategies.
 * Each entry is tagged with `engine: "js"` so the routing logic in runBacktest()
 * can auto-detect whether to use the local JS path or the Python batch endpoint.
 *
 * Requirement 9.6 — THE UnifiedStrategyRegistry SHALL tag each strategy entry
 * with its execution engine ('js' or 'python') so the Backtester can route correctly.
 */
export const STRATEGY_REGISTRY = {
  EMA:           { engine: 'js' },
  EMA_CROSS:     { engine: 'js' },
  RSI:           { engine: 'js' },
  BB:            { engine: 'js' },
  GRID:          { engine: 'js' },
  AI_GRID:       { engine: 'js' },
  AI_GRID_SCALP: { engine: 'js' },
  AI_GRID_SWING: { engine: 'js' },
  AI_SCOUTER:    { engine: 'js' },
  EMA_RSI:       { engine: 'js' },
  BB_RSI:        { engine: 'js' },
  EMA_BB_RSI:    { engine: 'js' },
  EMA_SCALP:     { engine: 'js' },
  STOCH_RSI:     { engine: 'js' },
  VWAP_SCALP:    { engine: 'js' },
  // Python-backed strategies (routed through getBatchSignals)
  BOLLINGER_BREAKOUT:  { engine: 'python' },
  RSI_DIVERGENCE:      { engine: 'python' },
  OI_FUNDING_ALPHA:    { engine: 'python' },
};

/**
 * Apply 0.05% slippage to fill price.
 * LONG open: price × 1.0005 (worse entry for buyer)
 * SHORT open: price × 0.9995 (worse entry for seller)
 * LONG close: price × 0.9995 (worse exit for buyer)
 * SHORT close: price × 1.0005 (worse exit for seller)
 * @param {number} price - Raw market price
 * @param {'LONG'|'SHORT'} side - Position side
 * @param {'open'|'close'} action - Whether opening or closing the position
 * @returns {number} Effective fill price after slippage
 */
export function applySlippage(price, side, action) {
  const factor = 0.0005;
  if (side === 'LONG'  && action === 'open')  return price * (1 + factor);
  if (side === 'SHORT' && action === 'open')  return price * (1 - factor);
  if (side === 'LONG'  && action === 'close') return price * (1 - factor);
  if (side === 'SHORT' && action === 'close') return price * (1 + factor);
  return price;
}

/**
 * Compute Average True Range (ATR) over a rolling window.
 * @param {number[]} highs - Array of high prices
 * @param {number[]} lows - Array of low prices
 * @param {number[]} closes - Array of close prices
 * @param {number} [period=14] - Rolling window size
 * @returns {number} ATR value, or 0 if insufficient data
 */
export function computeATR(highs, lows, closes, period = 14) {
  if (closes.length < period + 1) return 0;
  const trueRanges = [];
  for (let i = 1; i < closes.length; i++) {
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    trueRanges.push(Math.max(hl, hc, lc));
  }
  const recent = trueRanges.slice(-period);
  return recent.reduce((a, b) => a + b, 0) / recent.length;
}

/**
 * Compute dynamic TP and SL prices using ATR multipliers.
 * Falls back to null when ATR is zero or unavailable, so the caller can use legacy pct-based TP/SL.
 *
 * LONG  TP: entryPrice + (ATR × tpMultiplier)
 * LONG  SL: entryPrice - (ATR × slMultiplier)
 * SHORT TP: entryPrice - (ATR × tpMultiplier)
 * SHORT SL: entryPrice + (ATR × slMultiplier)
 *
 * @param {number} entryPrice - Effective entry price (after slippage)
 * @param {'LONG'|'SHORT'} side - Position side
 * @param {number} atr - Current ATR value
 * @param {object} [options={}]
 * @param {number} [options.tpMultiplier=2.0] - ATR multiplier for take-profit distance
 * @param {number} [options.slMultiplier=1.0] - ATR multiplier for stop-loss distance
 * @returns {{ tp: number, sl: number } | null} TP/SL prices, or null when ATR is unavailable
 */
export function computeTPSL(entryPrice, side, atr, { tpMultiplier = 2.0, slMultiplier = 1.0 } = {}) {
  if (!atr || atr === 0) return null; // fallback to legacy pct-based TP/SL
  if (side === 'LONG') return {
    tp: entryPrice + atr * tpMultiplier,
    sl: entryPrice - atr * slMultiplier,
  };
  return {
    tp: entryPrice - atr * tpMultiplier,
    sl: entryPrice + atr * slMultiplier,
  };
}

/**
 * Compute position size using Fixed Risk % per Trade.
 * Formula: (Capital × RiskPct) / SlPercent
 * e.g. capital=$10,000, riskPct=2%, slPercent=1% → positionSize=$20,000
 * Falls back to Capital × Leverage when slPercent is zero.
 * @param {number} capital - Available capital
 * @param {number[]} highs - Array of high prices (unused, kept for API compatibility)
 * @param {number[]} lows - Array of low prices (unused, kept for API compatibility)
 * @param {number[]} closes - Array of close prices (unused, kept for API compatibility)
 * @param {object} [options={}]
 * @param {number} [options.riskPct=0.02] - Fraction of capital to risk per trade (default 2%)
 * @param {number} [options.slPercent=1.0] - Stop-loss % distance (default 1%)
 * @param {number} [options.leverage=10] - Leverage multiplier (used in fallback)
 * @returns {number} Position size in quote currency
 */
export function computePositionSize(capital, highs, lows, closes, { riskPct = 0.02, slPercent = 1.0, leverage = 10 } = {}) {
  if (!slPercent || slPercent === 0) return capital * leverage; // fallback
  return (capital * riskPct) / (slPercent / 100);
}

/**
 * Compute indicator overlay data for a given strategy.
 * @param {number[]} closes - Array of close prices
 * @param {string[]} times - Array of ISO 8601 time strings (one per candle)
 * @param {string} strategy - Strategy name
 * @returns {object} overlayData object with indicator arrays
 */
export function computeOverlayData(closes, times, strategy) {
  try {
    const needsEma = ['EMA', 'EMA_CROSS', 'EMA_CROSS_V2', 'EMA_RSI', 'EMA_BB_RSI'].includes(strategy);
    const needsBb = ['BB', 'BB_RSI', 'EMA_BB_RSI'].includes(strategy);
    const needsRsi = ['RSI', 'RSI_TREND', 'EMA_RSI', 'BB_RSI', 'EMA_BB_RSI'].includes(strategy);

    if (!needsEma && !needsBb && !needsRsi) {
      return {};
    }

    const result = {};

    if (needsEma) {
      const ema20Values = emaCalc(closes, 20);
      const ema50Values = emaCalc(closes, 50);
      // emaCalc(values, period) returns array of length (values.length - period + 1)
      const ema20Offset = closes.length - ema20Values.length;
      const ema50Offset = closes.length - ema50Values.length;
      result.ema20 = ema20Values.map((value, i) => ({ time: times[ema20Offset + i], value }));
      result.ema50 = ema50Values.map((value, i) => ({ time: times[ema50Offset + i], value }));
    }

    if (needsBb) {
      const bbValues = bbCalc(closes, 20, 2);
      // bbCalc returns array of length (values.length - period + 1)
      const bbOffset = closes.length - bbValues.length;
      result.bbUpper = bbValues.map((b, i) => ({ time: times[bbOffset + i], value: b.upper }));
      result.bbMiddle = bbValues.map((b, i) => ({ time: times[bbOffset + i], value: b.middle }));
      result.bbLower = bbValues.map((b, i) => ({ time: times[bbOffset + i], value: b.lower }));
    }

    if (needsRsi) {
      const rsiValues = rsiCalc(closes, 14);
      // rsiCalc returns array of length (values.length - period)
      const rsiOffset = closes.length - rsiValues.length;
      result.rsi = rsiValues.map((value, i) => ({ time: times[rsiOffset + i], value }));
    }

    return result;
  } catch {
    return {};
  }
}

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
    tpMultiplier = 2.0,
    slMultiplier = 1.0,
    trailMult: configTrailMult = null,
    trailActivation: configTrailActivation = null,
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
  const highs = klines.map(k => parseFloat(k[2]));
  const lows = klines.map(k => parseFloat(k[3]));

  // Auto-detect engine from STRATEGY_REGISTRY (Requirement 9.3, 9.4, 9.6)
  const isPython = STRATEGY_REGISTRY[strategy]?.engine === 'python';

  // For Python strategies, fetch all signals in a single batch call before the loop
  let batchSignals = null;
  let batchConfidences = null;
  if (isPython) {
    try {
      const batchResult = await getBatchSignals(strategy, {
        closes,
        highs,
        lows,
        volumes: klines.map(k => parseFloat(k[5])),
        params: config,
        symbol,
      });
      batchSignals = batchResult.signals;
      batchConfidences = batchResult.confidences;
    } catch {
      return { error: 'Strategy AI service unavailable' };
    }
  }

  let currentCapital = capital;
  let inPosition = false;
  let positionSide = null;
  let entryPrice = 0;
  let entryTime = null;
  let entryReason = '';
  let entryConfidence = null;
  let lastConfidence = null;
  let positionSize = 0;
  // ATR-based dynamic TP/SL state
  let dynamicTp = null;
  let dynamicSl = null;
  let posAtr = null;
  let posRegime = null;
  // ATR trailing stop state
  let trailingHighest = null;
  let trailingLowest  = null;
  let trailingSl      = null;
  const trades = [];
  const equityCurvePerCandle = []; // one point per candle


  for (let i = MIN_CANDLES; i < klines.length; i++) {
    const closesSlice = closes.slice(0, i); // no look-ahead
    const highsSlice  = highs.slice(0, i);
    const lowsSlice   = lows.slice(0, i);

    let signal;
    if (isPython) {
      signal = batchSignals[i];
      lastConfidence = batchConfidences[i];
    } else {
      signal = computeSignal(closesSlice, strategy, config);
      lastConfidence = computeSignalConfidence(signal, closesSlice);
    }

    const currPrice = closes[i];

    if (!inPosition) {
      if (signal === 'LONG' || signal === 'SHORT') {
        inPosition = true;
        positionSide = signal;
        entryPrice = applySlippage(currPrice, signal, 'open');
        positionSize = computePositionSize(currentCapital, highsSlice, lowsSlice, closesSlice, { leverage, slPercent });
        entryTime = new Date(klines[i][0]).toISOString();
        entryConfidence = lastConfidence;
        entryReason = isPython
          ? `Python:${strategy} → ${signal}`
          : generateEntryReason(signal, strategy, closesSlice, config);

        // ── Compute ATR-based dynamic TP/SL at entry ──────────────────────
        posAtr = computeATR(highsSlice, lowsSlice, closesSlice);
        const tpsl = computeTPSL(entryPrice, signal, posAtr, { tpMultiplier, slMultiplier });
        if (tpsl) {
          dynamicTp = tpsl.tp;
          dynamicSl = tpsl.sl;
        } else {
          dynamicTp = null;
          dynamicSl = null;
        }
        // Detect regime for trailing multiplier
        const vol = closesSlice.length >= 21
          ? (() => {
              const ret = [];
              for (let j = closesSlice.length - 20; j < closesSlice.length; j++)
                ret.push((closesSlice[j] - closesSlice[j - 1]) / closesSlice[j - 1]);
              return Math.sqrt(ret.reduce((s, r) => s + r * r, 0) / ret.length);
            })()
          : 0;
        const mom = closesSlice.length >= 10
          ? (closesSlice.at(-1) - closesSlice.at(-10)) / closesSlice.at(-10)
          : 0;
        posRegime = vol > 0.03 ? 'volatile'
          : Math.abs(mom) > 0.02 ? (mom > 0 ? 'trending_up' : 'trending_down')
          : 'ranging';

        trailingHighest = entryPrice;
        trailingLowest  = entryPrice;
        trailingSl      = null;
      }
    } else {
      const effectiveExitPrice = applySlippage(currPrice, positionSide, 'close');
      const pnlPct =
        positionSide === 'LONG'
          ? ((effectiveExitPrice - entryPrice) / entryPrice) * 100
          : ((entryPrice - effectiveExitPrice) / entryPrice) * 100;

      // ── Feature #4: Alpha Decay — immediate close on signal flip ─────────
      const signalFlipped = signal !== 'NONE' && signal !== positionSide;

      // ── Feature #3: ATR Chandelier Trailing Stop ──────────────────────────
      if (posAtr && posAtr > 0) {
        const defaultMult = (posRegime === 'trending_up' || posRegime === 'trending_down') ? 4.0 : 2.5;
        const trailDist = posAtr * (configTrailMult ?? defaultMult);
        const activationDist = posAtr * (configTrailActivation ?? 1.0);
        const activated = positionSide === 'LONG'
          ? currPrice >= entryPrice + activationDist
          : currPrice <= entryPrice - activationDist;

        if (activated) {
          if (positionSide === 'LONG') {
            trailingHighest = Math.max(trailingHighest, currPrice);
            const newSl = trailingHighest - trailDist;
            if (trailingSl === null || newSl > trailingSl) trailingSl = newSl;
          } else {
            trailingLowest = Math.min(trailingLowest, currPrice);
            const newSl = trailingLowest + trailDist;
            if (trailingSl === null || newSl < trailingSl) trailingSl = newSl;
          }
        }
      }

      // ── Determine exit condition ──────────────────────────────────────────
      let exitReason = null;
      if (signalFlipped) {
        exitReason = 'Alpha Decay: Signal Flipped';
      } else if (trailingSl !== null) {
        const trailHit = positionSide === 'LONG'
          ? currPrice <= trailingSl
          : currPrice >= trailingSl;
        if (trailHit) exitReason = 'ATR Trailing Stop';
      }
      if (!exitReason && dynamicSl !== null) {
        const slHit = positionSide === 'LONG'
          ? currPrice <= dynamicSl
          : currPrice >= dynamicSl;
        if (slHit) exitReason = 'ATR SL';
      }
      if (!exitReason && dynamicTp !== null) {
        const tpHit = positionSide === 'LONG'
          ? currPrice >= dynamicTp
          : currPrice <= dynamicTp;
        if (tpHit) exitReason = 'ATR TP';
      }
      // Fallback to fixed % TP/SL when no ATR data
      if (!exitReason && dynamicSl === null && dynamicTp === null) {
        if (pnlPct >= tpPercent)      exitReason = 'TP';
        else if (pnlPct <= -slPercent) exitReason = 'SL';
      }

      if (exitReason) {
        const totalFeeThisTrade = 2 * positionSize * TAKER_FEE_RATE;
        const pnl = (pnlPct / 100) * positionSize - totalFeeThisTrade;
        currentCapital += pnl;

        const tpPrice = dynamicTp ?? (positionSide === 'LONG'
          ? entryPrice * (1 + tpPercent / 100)
          : entryPrice * (1 - tpPercent / 100));
        const slPrice = dynamicSl ?? (positionSide === 'LONG'
          ? entryPrice * (1 - slPercent / 100)
          : entryPrice * (1 + slPercent / 100));

        trades.push({
          symbol,
          type: positionSide,
          entryPrice,
          exitPrice: effectiveExitPrice,
          entryTime,
          exitTime: new Date(klines[i][0]).toISOString(),
          pnl,
          pnlPct,
          positionSize,
          entryReason,
          entryConfidence,
          exitReason,
          tpPrice,
          slPrice,
          atr: posAtr,
          regime: posRegime,
        });

        inPosition = false;
        positionSide = null;
        entryPrice = 0;
        entryTime = null;
        entryReason = '';
        entryConfidence = null;
        dynamicTp = null;
        dynamicSl = null;
        posAtr = null;
        posRegime = null;
        trailingHighest = null;
        trailingLowest  = null;
        trailingSl      = null;
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

  // Compute overlay data for chart rendering
  const times = klines.map(k => new Date(k[0]).toISOString());
  const overlayData = computeOverlayData(closes, times, strategy);

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
      overlayData,
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
    overlayData,
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

/**
 * Run walk-forward validation by partitioning klines into sequential train/test windows.
 *
 * For each window:
 *  - Train slice: klines[windowStart .. windowStart + trainCandles]
 *  - Test slice:  klines[windowStart + trainCandles .. windowStart + trainCandles + testCandles]
 *  - A full backtest is run on the test slice using the provided config
 *
 * Window count = floor((total_candles - trainCandles) / testCandles)
 *
 * @param {object} exchange - BinanceAdapter instance
 * @param {object} config - BacktestConfig extended with:
 *   @param {number} [config.trainCandles=2160] - Number of candles in each train window (~3mo on 1h)
 *   @param {number} [config.testCandles=720]   - Number of candles in each test window (~1mo on 1h)
 * @returns {Promise<{ windows: WalkForwardWindow[], avgSharpe: number, avgPnl: number }
 *                  | { error: string }>}
 */
export async function runWalkForward(exchange, config) {
  const {
    symbol,
    interval,
    startDate = null,
    endDate = null,
    trainCandles = 2160,
    testCandles = 720,
  } = config;

  // Fetch the full kline dataset
  const klines = await fetchKlines(exchange, symbol, interval, {
    startDate,
    endDate,
    maxKlines: trainCandles + testCandles * 20, // fetch enough for multiple windows
  });

  if (!klines || klines.length < trainCandles + testCandles) {
    return { error: 'Insufficient data for walk-forward validation' };
  }

  const total = klines.length;
  const windowCount = Math.floor((total - trainCandles) / testCandles);

  const windows = [];

  for (let w = 0; w < windowCount; w++) {
    const windowStart = w * testCandles;
    const trainSlice = klines.slice(windowStart, windowStart + trainCandles);
    const testSlice = klines.slice(windowStart + trainCandles, windowStart + trainCandles + testCandles);

    const trainStart = new Date(trainSlice[0][0]).toISOString();
    const trainEnd = new Date(trainSlice[trainSlice.length - 1][0]).toISOString();
    const testStart = new Date(testSlice[0][0]).toISOString();
    const testEnd = new Date(testSlice[testSlice.length - 1][0]).toISOString();

    // Run backtest on the test slice by injecting the pre-sliced klines
    // We pass the test klines directly via a synthetic exchange that returns them
    const syntheticExchange = {
      _wfKlines: testSlice,
    };

    const windowConfig = {
      ...config,
      startDate: null,
      endDate: null,
      _walkForwardKlines: testSlice,
    };

    const backtestResult = await _runBacktestOnKlines(testSlice, windowConfig);

    windows.push({
      trainStart,
      trainEnd,
      testStart,
      testEnd,
      sharpeRatio: backtestResult.sharpeRatio ?? 0,
      totalPnl: backtestResult.totalPnl ?? 0,
      winRate: backtestResult.winRate ?? 0,
    });
  }

  const avgSharpe = windows.length > 0
    ? windows.reduce((sum, w) => sum + w.sharpeRatio, 0) / windows.length
    : 0;

  const avgPnl = windows.length > 0
    ? windows.reduce((sum, w) => sum + w.totalPnl, 0) / windows.length
    : 0;

  return { windows, avgSharpe, avgPnl };
}

/**
 * Internal helper: run a backtest simulation directly on a pre-fetched klines array.
 * Mirrors runBacktest() but accepts klines directly instead of fetching them.
 * @param {Array} klines - Pre-fetched kline array
 * @param {object} config - BacktestConfig
 * @returns {Promise<BacktestResult>}
 */
async function _runBacktestOnKlines(klines, config) {
  const {
    symbol,
    strategy,
    interval,
    tpPercent = 2.0,
    slPercent = 1.0,
    leverage = 10,
    capital = 1000,
  } = config;

  if (!klines || klines.length < MIN_CANDLES) {
    return { error: 'Insufficient data for backtesting (need > 50 klines)', sharpeRatio: 0, totalPnl: 0, winRate: 0 };
  }

  const closes = klines.map(k => parseFloat(k[4]));
  const highs = klines.map(k => parseFloat(k[2]));
  const lows = klines.map(k => parseFloat(k[3]));

  // Auto-detect engine from STRATEGY_REGISTRY (Requirement 9.3, 9.4, 9.6)
  const isPython = STRATEGY_REGISTRY[strategy]?.engine === 'python';

  let batchSignals = null;
  let batchConfidences = null;
  if (isPython) {
    try {
      const batchResult = await getBatchSignals(strategy, {
        closes,
        highs,
        lows,
        volumes: klines.map(k => parseFloat(k[5])),
        params: config,
        symbol,
      });
      batchSignals = batchResult.signals;
      batchConfidences = batchResult.confidences;
    } catch {
      return { error: 'Strategy AI service unavailable', sharpeRatio: 0, totalPnl: 0, winRate: 0 };
    }
  }

  let currentCapital = capital;
  let inPosition = false;
  let positionSide = null;
  let entryPrice = 0;
  let entryTime = null;
  let positionSize = 0;
  const trades = [];

  for (let i = MIN_CANDLES; i < klines.length; i++) {
    const closesSlice = closes.slice(0, i);

    let signal;
    if (isPython) {
      signal = batchSignals[i];
    } else {
      signal = computeSignal(closesSlice, strategy, config);
    }

    const currPrice = closes[i];

    if (!inPosition) {
      if (signal === 'LONG' || signal === 'SHORT') {
        inPosition = true;
        positionSide = signal;
        entryPrice = applySlippage(currPrice, signal, 'open');
        positionSize = computePositionSize(currentCapital, highs.slice(0, i), lows.slice(0, i), closesSlice, { leverage, slPercent });
        entryTime = new Date(klines[i][0]).toISOString();
      }
    } else {
      const effectiveExitPrice = applySlippage(currPrice, positionSide, 'close');
      const pnlPct =
        positionSide === 'LONG'
          ? ((effectiveExitPrice - entryPrice) / entryPrice) * 100
          : ((entryPrice - effectiveExitPrice) / entryPrice) * 100;

      const signalFlipped = signal !== 'NONE' && signal !== positionSide;

      if (pnlPct >= tpPercent || pnlPct <= -slPercent || signalFlipped) {
        const totalFeeThisTrade = 2 * positionSize * TAKER_FEE_RATE;
        const pnl = (pnlPct / 100) * positionSize - totalFeeThisTrade;
        currentCapital += pnl;

        trades.push({
          type: positionSide,
          entryPrice,
          exitPrice: effectiveExitPrice,
          entryTime,
          exitTime: new Date(klines[i][0]).toISOString(),
          pnl,
          pnlPct,
        });

        inPosition = false;
        positionSide = null;
        entryPrice = 0;
        entryTime = null;
      }
    }
  }

  if (trades.length === 0) {
    return { sharpeRatio: 0, totalPnl: 0, winRate: 0 };
  }

  const pnlList = trades.map(t => t.pnl);
  const winningTrades = trades.filter(t => t.pnl > 0);

  return {
    sharpeRatio: calculateSharpe(pnlList),
    totalPnl: currentCapital - capital,
    winRate: (winningTrades.length / trades.length) * 100,
  };
}
