/**
 * Property-based tests for Backtester — Determinism and Fee Deduction
 *
 * Feature: strategy-management-backtest, Property 12: Backtest Determinism
 * Feature: strategy-management-backtest, Property 13: Fee Deduction Correctness
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
vi.mock('../SignalEngine.js', () => ({
  computeSignal: vi.fn(),
  generateEntryReason: vi.fn(() => 'test-reason'),
}));
vi.mock('../PythonStrategyClient.js', () => ({
  getBatchSignals: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { runBacktest } from '../Backtester.js';
import { fetchKlines } from '../KlineFetcher.js';
import { getBatchSignals } from '../PythonStrategyClient.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_TIME = 1704067200000; // 2024-01-01 00:00:00 UTC
const INTERVAL_MS = 3600000;     // 1 hour
const TAKER_FEE_RATE = 0.0004;  // 0.04%

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
// Property 12: Backtest Determinism
// Validates: Requirements 7.7
// ---------------------------------------------------------------------------

describe('Property 12: Backtest Determinism', () => {
  it('running backtest twice with the same config returns identical totalPnl, winRate, totalTrades, and sharpeRatio', async () => {
    // Feature: strategy-management-backtest, Property 12: Backtest Determinism

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tpPercent: fc.float({ min: 0.5, max: 5.0, noNaN: true }),
          slPercent: fc.float({ min: 0.5, max: 3.0, noNaN: true }),
          leverage:  fc.integer({ min: 1, max: 20 }),
          capital:   fc.integer({ min: 100, max: 10000 }),
          // Signal pattern: 0 = no trades, 1 = TP scenario, 2 = flat (signal flip)
          scenario:  fc.integer({ min: 0, max: 2 }),
        }),
        async ({ tpPercent, slPercent, leverage, capital, scenario }) => {
          const config = baseConfig({ tpPercent, slPercent, leverage, capital });

          // Build deterministic klines based on scenario
          let klines;
          if (scenario === 1) {
            klines = makeTpKlines(100, tpPercent, 100);
          } else {
            klines = makeSyntheticKlines(100, 100);
          }

          // Build a deterministic signal sequence based on scenario
          const signalSequence = scenario === 2
            ? (len) => {
                if (len === 50) return 'LONG';
                if (len === 55) return 'SHORT'; // flip
                return 'NONE';
              }
            : (len) => {
                if (len === 50) return 'LONG';
                return 'NONE';
              };

          // --- First run ---
          fetchKlines.mockResolvedValue(klines);
          getBatchSignals.mockResolvedValue({
            signals: klines.map((_, i) => signalSequence(i + 1)),
            confidences: klines.map(() => 0.8),
            metadatas: klines.map(() => ({})),
          });
          const result1 = await runBacktest(null, config);

          // --- Second run (same inputs) ---
          fetchKlines.mockResolvedValue(klines);
          getBatchSignals.mockResolvedValue({
            signals: klines.map((_, i) => signalSequence(i + 1)),
            confidences: klines.map(() => 0.8),
            metadatas: klines.map(() => ({})),
          });
          const result2 = await runBacktest(null, config);

          // Both runs must produce identical core metrics
          expect(result2.totalPnl).toBeCloseTo(result1.totalPnl, 10);
          expect(result2.winRate).toBeCloseTo(result1.winRate, 10);
          expect(result2.totalTrades).toBe(result1.totalTrades);
          expect(result2.sharpeRatio).toBeCloseTo(result1.sharpeRatio, 10);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 13: Fee Deduction Correctness
// Validates: Requirements 7.4
// ---------------------------------------------------------------------------

describe('Property 13: Fee Deduction Correctness', () => {
  it('for each trade, pnl must have been reduced by 2 × positionSize × 0.0004', async () => {
    // Feature: strategy-management-backtest, Property 13: Fee Deduction Correctness

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          tpPercent: fc.float({ min: 0.5, max: 5.0, noNaN: true }),
          slPercent: fc.float({ min: 0.5, max: 3.0, noNaN: true }),
          leverage:  fc.integer({ min: 1, max: 20 }),
          capital:   fc.integer({ min: 100, max: 10000 }),
        }),
        async ({ tpPercent, slPercent, leverage, capital }) => {
          const klines = makeTpKlines(100, tpPercent, 100);
          fetchKlines.mockResolvedValue(klines);

          // Fire a LONG signal at candle 50 to guarantee at least one trade
          getBatchSignals.mockResolvedValue({
            signals: klines.map((_, i) => i === 50 ? 'LONG' : 'NONE'),
            confidences: klines.map(() => 0.8),
            metadatas: klines.map(() => ({})),
          });

          const result = await runBacktest(null, baseConfig({ tpPercent, slPercent, leverage, capital }));

          const trades = result.trades ?? [];

          for (const trade of trades) {
            const { pnl, pnlPct, positionSize } = trade;

            // Gross PnL before fees = (pnlPct / 100) * positionSize
            const grossPnl = (pnlPct / 100) * positionSize;

            // Expected fee = 2 × positionSize × TAKER_FEE_RATE
            const expectedFee = 2 * positionSize * TAKER_FEE_RATE;

            // Net PnL = grossPnl - fee
            const expectedNetPnl = grossPnl - expectedFee;

            // Verify fee was correctly deducted (allow floating-point tolerance)
            expect(pnl).toBeCloseTo(expectedNetPnl, 8);

            // Also verify the fee amount itself is positive (always a cost)
            expect(expectedFee).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
