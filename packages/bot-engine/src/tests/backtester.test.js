/**
 * Property-based tests for Backtester
 *
 * Feature: backtest-system, Property 3:  Trade Record Completeness
 * Feature: backtest-system, Property 4:  TP/SL Exit Correctness
 * Feature: backtest-system, Property 5:  Signal Flip Exit
 * Feature: backtest-system, Property 6:  No Overlapping Positions
 * Feature: backtest-system, Property 7:  No Look-Ahead Bias
 * Feature: backtest-system, Property 8:  Metrics Completeness
 * Feature: backtest-system, Property 9:  Equity Curve Consistency
 * Feature: backtest-system, Property 10: Compare Sort Order
 * Feature: backtest-system, Property 11: ConfigLabel Format
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports that use them
// ---------------------------------------------------------------------------

vi.mock('../KlineFetcher.js', () => ({ fetchKlines: vi.fn() }));
vi.mock('../../data-layer/src/repositories/backtestRepository.js', () => ({
  saveBacktestResult: vi.fn(),
}));
vi.mock('../SignalEngine.js', () => ({ computeSignal: vi.fn() }));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { runBacktest, runBacktestCompare } from '../Backtester.js';
import { fetchKlines } from '../KlineFetcher.js';
import { computeSignal } from '../SignalEngine.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_TIME = 1704067200000; // 2024-01-01 00:00:00 UTC
const INTERVAL_MS = 3600000;     // 1 hour

/**
 * Build n flat klines at basePrice.
 * Format: [openTime, open, high, low, close, volume]
 */
function makeSyntheticKlines(n, basePrice = 100, intervalMs = INTERVAL_MS) {
  return Array.from({ length: n }, (_, i) => [
    BASE_TIME + i * intervalMs,
    String(basePrice),
    String(basePrice + 1),
    String(basePrice - 1),
    String(basePrice),
    '1000',
  ]);
}

/**
 * Build klines where:
 *  - candles 0..49  : flat at entryPrice  (warmup)
 *  - candle  50     : flat at entryPrice  (entry candle — signal fires here)
 *  - candles 51..n-1: price = entryPrice * (1 + tpPercent/100 + 0.01)  → triggers TP
 */
function makeTpKlines(entryPrice = 100, tpPercent = 2.0, n = 100) {
  const exitPrice = entryPrice * (1 + tpPercent / 100 + 0.01);
  return Array.from({ length: n }, (_, i) => {
    const price = i <= 50 ? entryPrice : exitPrice;
    return [
      BASE_TIME + i * INTERVAL_MS,
      String(price),
      String(price + 0.1),
      String(price - 0.1),
      String(price),
      '1000',
    ];
  });
}

/**
 * Build klines where candles 51+ drop to trigger SL.
 */
function makeSlKlines(entryPrice = 100, slPercent = 1.0, n = 100) {
  const exitPrice = entryPrice * (1 - slPercent / 100 - 0.01);
  return Array.from({ length: n }, (_, i) => {
    const price = i <= 50 ? entryPrice : exitPrice;
    return [
      BASE_TIME + i * INTERVAL_MS,
      String(price),
      String(price + 0.1),
      String(price - 0.1),
      String(price),
      '1000',
    ];
  });
}

/** Minimal valid config */
function baseConfig(overrides = {}) {
  return {
    symbol: 'BTCUSDT',
    strategy: 'EMA',
    interval: '1h',
    tpPercent: 2.0,
    slPercent: 1.0,
    leverage: 10,
    capital: 1000,
    startDate: null,
    endDate: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Property 3: Trade Record Completeness
// Validates: Requirements 2.7
// ---------------------------------------------------------------------------

describe('Property 3: Trade Record Completeness', () => {
  it('every trade contains all required fields', async () => {
    // Feature: backtest-system, Property 3: Trade Record Completeness

    const REQUIRED_FIELDS = [
      'entryPrice', 'exitPrice', 'entryTime', 'exitTime',
      'type', 'pnl', 'pnlPct', 'exitReason',
    ];

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tpPercent: fc.float({ min: 0.5, max: 5.0, noNaN: true }),
          slPercent: fc.float({ min: 0.5, max: 3.0, noNaN: true }),
          leverage:  fc.integer({ min: 1, max: 20 }),
          capital:   fc.integer({ min: 100, max: 10000 }),
        }),
        async (params) => {
          const klines = makeTpKlines(100, params.tpPercent, 100);
          fetchKlines.mockResolvedValue(klines);

          // Signal: LONG at closes.length === 50, NONE otherwise
          computeSignal.mockImplementation((closes) => {
            if (closes.length === 50) return 'LONG';
            return 'NONE';
          });

          const result = await runBacktest(null, baseConfig(params));

          // If trades were generated, every trade must have all required fields
          for (const trade of result.trades ?? []) {
            for (const field of REQUIRED_FIELDS) {
              expect(trade, `trade missing field: ${field}`).toHaveProperty(field);
              expect(trade[field], `field ${field} should not be undefined`).toBeDefined();
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: TP/SL Exit Correctness
// Validates: Requirements 2.4, 2.5, 2.8, 8.5
// ---------------------------------------------------------------------------

describe('Property 4: TP/SL Exit Correctness', () => {
  it('TP exit: exitReason is TP and pnl matches formula', async () => {
    // Feature: backtest-system, Property 4: TP/SL Exit Correctness

    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: 0.5, max: 5.0, noNaN: true }),   // tpPercent
        fc.float({ min: 0.5, max: 3.0, noNaN: true }),   // slPercent
        fc.integer({ min: 1, max: 20 }),                  // leverage
        fc.integer({ min: 100, max: 10000 }),             // capital
        async (tpPercent, slPercent, leverage, capital) => {
          const entryPrice = 100;
          const klines = makeTpKlines(entryPrice, tpPercent, 100);
          fetchKlines.mockResolvedValue(klines);

          computeSignal.mockImplementation((closes) => {
            if (closes.length === 50) return 'LONG';
            return 'NONE';
          });

          const result = await runBacktest(null, baseConfig({ tpPercent, slPercent, leverage, capital }));

          const tpTrades = (result.trades ?? []).filter(t => t.exitReason === 'TP');
          if (tpTrades.length === 0) return; // no TP trade generated — skip

          for (const trade of tpTrades) {
            expect(trade.exitReason).toBe('TP');
            expect(trade.pnlPct).toBeGreaterThanOrEqual(tpPercent);

            // pnl = pnlPct/100 * positionSize - fees
            const positionSize = capital * leverage;
            const TAKER_FEE_RATE = 0.0004;
            const totalFee = 2 * positionSize * TAKER_FEE_RATE;
            const expectedPnl = (trade.pnlPct / 100) * positionSize - totalFee;
            expect(trade.pnl).toBeCloseTo(expectedPnl, 5);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('SL exit: exitReason is SL and pnl matches formula', async () => {
    // Feature: backtest-system, Property 4: TP/SL Exit Correctness

    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: 0.5, max: 5.0, noNaN: true }),   // tpPercent
        fc.float({ min: 0.5, max: 3.0, noNaN: true }),   // slPercent
        fc.integer({ min: 1, max: 20 }),                  // leverage
        fc.integer({ min: 100, max: 10000 }),             // capital
        async (tpPercent, slPercent, leverage, capital) => {
          const entryPrice = 100;
          const klines = makeSlKlines(entryPrice, slPercent, 100);
          fetchKlines.mockResolvedValue(klines);

          computeSignal.mockImplementation((closes) => {
            if (closes.length === 50) return 'LONG';
            return 'NONE';
          });

          const result = await runBacktest(null, baseConfig({ tpPercent, slPercent, leverage, capital }));

          const slTrades = (result.trades ?? []).filter(t => t.exitReason === 'SL');
          if (slTrades.length === 0) return; // no SL trade generated — skip

          for (const trade of slTrades) {
            expect(trade.exitReason).toBe('SL');
            expect(trade.pnlPct).toBeLessThanOrEqual(-slPercent);

            const positionSize = capital * leverage;
            const TAKER_FEE_RATE = 0.0004;
            const totalFee = 2 * positionSize * TAKER_FEE_RATE;
            const expectedPnl = (trade.pnlPct / 100) * positionSize - totalFee;
            expect(trade.pnl).toBeCloseTo(expectedPnl, 5);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5: Signal Flip Exit
// Validates: Requirements 2.6
// ---------------------------------------------------------------------------

describe('Property 5: Signal Flip Exit', () => {
  it('signal flip closes position with exitReason "Signal Flipped"', async () => {
    // Feature: backtest-system, Property 5: Signal Flip Exit

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('LONG', 'SHORT'),  // initial signal direction
        async (initialSignal) => {
          const flipSignal = initialSignal === 'LONG' ? 'SHORT' : 'LONG';

          // Flat klines — price never moves enough to trigger TP/SL
          const klines = makeSyntheticKlines(100, 100);
          fetchKlines.mockResolvedValue(klines);

          // Signal: initialSignal at i=50, flipSignal at i=51, NONE after
          computeSignal.mockImplementation((closes) => {
            if (closes.length === 50) return initialSignal;
            if (closes.length === 51) return flipSignal;
            return 'NONE';
          });

          const result = await runBacktest(null, baseConfig({ tpPercent: 50, slPercent: 50 }));

          const flippedTrades = (result.trades ?? []).filter(t => t.exitReason === 'Signal Flipped');
          expect(flippedTrades.length).toBeGreaterThan(0);

          for (const trade of flippedTrades) {
            expect(trade.exitReason).toBe('Signal Flipped');
            expect(trade.type).toBe(initialSignal);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6: No Overlapping Positions
// Validates: Requirements 8.4
// ---------------------------------------------------------------------------

describe('Property 6: No Overlapping Positions', () => {
  it('entryTime of trade N+1 >= exitTime of trade N', async () => {
    // Feature: backtest-system, Property 6: No Overlapping Positions

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: 200 }),  // number of klines
        async (numKlines) => {
          const klines = makeSyntheticKlines(numKlines, 100);
          fetchKlines.mockResolvedValue(klines);

          // Alternate LONG/SHORT every 5 candles to generate multiple trades
          computeSignal.mockImplementation((closes) => {
            const i = closes.length;
            if (i < 50) return 'NONE';
            const cycle = Math.floor((i - 50) / 5);
            if ((i - 50) % 5 === 0) return cycle % 2 === 0 ? 'LONG' : 'SHORT';
            return 'NONE';
          });

          const result = await runBacktest(null, baseConfig({ tpPercent: 50, slPercent: 50 }));
          const trades = result.trades ?? [];

          for (let i = 1; i < trades.length; i++) {
            const prevExit = new Date(trades[i - 1].exitTime).getTime();
            const currEntry = new Date(trades[i].entryTime).getTime();
            expect(currEntry).toBeGreaterThanOrEqual(prevExit);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 7: No Look-Ahead Bias
// Validates: Requirements 8.1
// ---------------------------------------------------------------------------

describe('Property 7: No Look-Ahead Bias', () => {
  it('closes array passed to computeSignal at candle i has length exactly i', async () => {
    // Feature: backtest-system, Property 7: No Look-Ahead Bias

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 60, max: 120 }),  // number of klines
        async (numKlines) => {
          const klines = makeSyntheticKlines(numKlines, 100);
          fetchKlines.mockResolvedValue(klines);

          const callLog = []; // capture (closesLength, callIndex)

          computeSignal.mockImplementation((closes) => {
            callLog.push(closes.length);
            return 'NONE';
          });

          await runBacktest(null, baseConfig());

          // The loop starts at i = MIN_CANDLES (50), so first call has closes.length = 50
          // At loop iteration i, closesSlice = closes.slice(0, i) → length = i
          for (let callIdx = 0; callIdx < callLog.length; callIdx++) {
            const expectedLength = 50 + callIdx; // i starts at 50
            expect(callLog[callIdx]).toBe(expectedLength);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 8: Metrics Completeness
// Validates: Requirements 3.1, 3.2, 3.3
// ---------------------------------------------------------------------------

describe('Property 8: Metrics Completeness', () => {
  it('result contains all required metric fields with numeric values', async () => {
    // Feature: backtest-system, Property 8: Metrics Completeness

    const REQUIRED_METRICS = [
      'totalTrades', 'winRate', 'totalPnl', 'netPnlPct',
      'sharpeRatio', 'maxDrawdown', 'profitFactor',
      'avgWin', 'avgLoss', 'maxConsecutiveLosses', 'equityCurve',
    ];

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tpPercent: fc.float({ min: 0.5, max: 5.0, noNaN: true }),
          slPercent: fc.float({ min: 0.5, max: 3.0, noNaN: true }),
          leverage:  fc.integer({ min: 1, max: 20 }),
          capital:   fc.integer({ min: 100, max: 10000 }),
        }),
        async (params) => {
          const klines = makeSyntheticKlines(100, 100);
          fetchKlines.mockResolvedValue(klines);
          computeSignal.mockReturnValue('NONE');

          const result = await runBacktest(null, baseConfig(params));

          for (const field of REQUIRED_METRICS) {
            expect(result, `result missing field: ${field}`).toHaveProperty(field);
          }

          // All numeric metrics must be numbers (not NaN, not undefined)
          const numericFields = REQUIRED_METRICS.filter(f => f !== 'equityCurve');
          for (const field of numericFields) {
            expect(typeof result[field]).toBe('number');
            expect(Number.isNaN(result[field])).toBe(false);
          }

          // equityCurve must be an array
          expect(Array.isArray(result.equityCurve)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 9: Equity Curve Consistency
// Validates: Requirements 3.2
// ---------------------------------------------------------------------------

describe('Property 9: Equity Curve Consistency', () => {
  it('equityCurve[0].value == initialCapital and last value ≈ finalCapital', async () => {
    // Feature: backtest-system, Property 9: Equity Curve Consistency

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: 10000 }),  // capital
        fc.float({ min: 0.5, max: 5.0, noNaN: true }),  // tpPercent
        async (capital, tpPercent) => {
          const klines = makeTpKlines(100, tpPercent, 100);
          fetchKlines.mockResolvedValue(klines);

          computeSignal.mockImplementation((closes) => {
            if (closes.length === 50) return 'LONG';
            return 'NONE';
          });

          const result = await runBacktest(null, baseConfig({ capital, tpPercent }));

          if (!result.equityCurve || result.equityCurve.length === 0) return; // no trades

          // First point must equal initialCapital
          expect(result.equityCurve[0].value).toBe(result.initialCapital);

          // Last point must approximate finalCapital
          const lastValue = result.equityCurve[result.equityCurve.length - 1].value;
          expect(lastValue).toBeCloseTo(result.finalCapital, 5);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 10: Compare Sort Order
// Validates: Requirements 5.2, 5.3
// ---------------------------------------------------------------------------

describe('Property 10: Compare Sort Order', () => {
  it('results sorted by totalPnl DESC and rank is 1-based', async () => {
    // Feature: backtest-system, Property 10: Compare Sort Order

    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            tpPercent: fc.float({ min: 0.5, max: 5.0, noNaN: true }),
            slPercent: fc.float({ min: 0.5, max: 3.0, noNaN: true }),
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (paramSets) => {
          // Each config gets its own klines — alternate TP/no-trade to vary totalPnl
          let callCount = 0;
          fetchKlines.mockImplementation(() => {
            const idx = callCount++;
            // Even configs: TP triggered; odd configs: no trades
            if (idx % 2 === 0) {
              return Promise.resolve(makeTpKlines(100, 2.0, 100));
            }
            return Promise.resolve(makeSyntheticKlines(100, 100));
          });

          computeSignal.mockImplementation((closes) => {
            if (closes.length === 50) return 'LONG';
            return 'NONE';
          });

          const configs = paramSets.map((p, i) =>
            baseConfig({ ...p, strategy: 'EMA', interval: '1h', symbol: `SYM${i}` })
          );

          const results = await runBacktestCompare(null, configs);

          // Filter out error results
          const valid = results.filter(r => !r.error);

          // Must be sorted by totalPnl descending
          for (let i = 1; i < valid.length; i++) {
            expect(valid[i - 1].totalPnl).toBeGreaterThanOrEqual(valid[i].totalPnl);
          }

          // rank must be 1-based and sequential
          for (let i = 0; i < results.length; i++) {
            expect(results[i].rank).toBe(i + 1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 11: ConfigLabel Format
// Validates: Requirements 5.4
// ---------------------------------------------------------------------------

describe('Property 11: ConfigLabel Format', () => {
  it('configLabel matches {strategy}-{interval}-{tpPercent}/{slPercent}', async () => {
    // Feature: backtest-system, Property 11: ConfigLabel Format

    const STRATEGIES = ['EMA', 'RSI', 'BB', 'EMA_RSI', 'BB_RSI'];
    const INTERVALS  = ['1m', '5m', '15m', '1h', '4h', '1d'];

    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            strategy:   fc.constantFrom(...STRATEGIES),
            interval:   fc.constantFrom(...INTERVALS),
            tpPercent:  fc.float({ min: 0.5, max: 10.0, noNaN: true }),
            slPercent:  fc.float({ min: 0.5, max: 5.0, noNaN: true }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (paramSets) => {
          fetchKlines.mockResolvedValue(makeSyntheticKlines(100, 100));
          computeSignal.mockReturnValue('NONE');

          const configs = paramSets.map(p =>
            baseConfig({
              strategy:  p.strategy,
              interval:  p.interval,
              tpPercent: p.tpPercent,
              slPercent: p.slPercent,
            })
          );

          const results = await runBacktestCompare(null, configs);

          for (let i = 0; i < results.length; i++) {
            const cfg = configs[i];
            const tp = cfg.tpPercent ?? 2.0;
            const sl = cfg.slPercent ?? 1.0;
            const expectedLabel = `${cfg.strategy}-${cfg.interval}-${tp}/${sl}`;
            expect(results[i].configLabel).toBe(expectedLabel);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
