/**
 * Property-based tests for multiAssetBacktestService
 *
 * Feature: strategy-management-backtest
 * Properties 7–11
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports that use them
// ---------------------------------------------------------------------------

vi.mock('../../../bot-engine/src/Backtester.js', () => ({
  runBacktest: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { runBacktest } from '../../../bot-engine/src/Backtester.js';
import {
  runMultiAssetBacktest,
  runRandomWindowBacktest,
  generateNonOverlappingWindows,
} from '../services/multiAssetBacktestService.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Simple deterministic hash of a string → integer in range [min, max].
 * Used to derive stable pnl / winRate values from a symbol name.
 */
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h;
}

/** Map a symbol name to a deterministic totalPnl in [-500, 500] */
function symbolToPnl(symbol) {
  return (hashString(symbol) % 1001) / 1; // -500 … 500 (integer)
}

/** Map a symbol name to a deterministic winRate in [0, 1] */
function symbolToWinRate(symbol) {
  return Math.abs(hashString(symbol + 'wr') % 101) / 100; // 0.00 … 1.00
}

/** Build a mock runBacktest that returns deterministic results per symbol */
function setupDeterministicMock() {
  runBacktest.mockImplementation((_exchange, config) => {
    const { symbol } = config;
    return Promise.resolve({
      totalPnl: symbolToPnl(symbol),
      winRate: symbolToWinRate(symbol),
      sharpeRatio: 1.0,
      maxDrawdown: 0.1,
      totalTrades: 10,
      equityCurve: [],
    });
  });
}

/** Minimal strategyDef stub */
const STRATEGY_DEF = {
  name: 'TestStrategy',
  defaultParams: {},
};

/** Minimal exchange stub */
const EXCHANGE = {};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const symbolsArb = fc.uniqueArray(
  fc.string({ minLength: 3, maxLength: 10 }),
  { minLength: 1, maxLength: 10 }
);

const lookbackYearsArb = fc.integer({ min: 1, max: 5 });
const windowDaysArb = fc.integer({ min: 1, max: 30 });
const numWindowsArb = fc.integer({ min: 1, max: 10 });

// ---------------------------------------------------------------------------
// Property 7: Multi-Asset Results Cover All Symbols
// Validates: Requirements 3.1, 3.5
// ---------------------------------------------------------------------------

describe('Property 7: Multi-Asset Results Cover All Symbols', () => {
  it('results array has exactly one AssetResult per symbol', async () => {
    // **Validates: Requirements 3.1, 3.5**
    setupDeterministicMock();

    await fc.assert(
      fc.asyncProperty(symbolsArb, async (symbols) => {
        const config = {
          symbols,
          interval: '1h',
          startDate: '2023-01-01T00:00:00.000Z',
          endDate: '2023-06-01T00:00:00.000Z',
        };

        const { results } = await runMultiAssetBacktest(EXCHANGE, STRATEGY_DEF, config);

        // Must have exactly one result per symbol
        expect(results.length).toBe(symbols.length);

        // Every input symbol must appear exactly once in results
        const resultSymbols = results.map(r => r.symbol);
        for (const sym of symbols) {
          expect(resultSymbols.filter(s => s === sym).length).toBe(1);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 8: Multi-Asset Results Sorted by PnL
// Validates: Requirements 3.4, 3.6
// ---------------------------------------------------------------------------

describe('Property 8: Multi-Asset Results Sorted by PnL', () => {
  it('successful AssetResults are sorted by totalPnl descending and rank matches position', async () => {
    // **Validates: Requirements 3.4, 3.6**
    setupDeterministicMock();

    await fc.assert(
      fc.asyncProperty(symbolsArb, async (symbols) => {
        const config = {
          symbols,
          interval: '1h',
          startDate: '2023-01-01T00:00:00.000Z',
          endDate: '2023-06-01T00:00:00.000Z',
        };

        const { results } = await runMultiAssetBacktest(EXCHANGE, STRATEGY_DEF, config);

        // Separate successful results (no error field)
        const successful = results.filter(r => !r.error);

        // Must be sorted by totalPnl descending
        for (let i = 0; i < successful.length - 1; i++) {
          expect(successful[i].totalPnl).toBeGreaterThanOrEqual(successful[i + 1].totalPnl);
        }

        // rank must correspond to position (rank 1 = highest pnl = index 0)
        successful.forEach((r, idx) => {
          expect(r.rank).toBe(idx + 1);
        });
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 9: Summary Metrics Consistency
// Validates: Requirements 3.7, 8.1
// ---------------------------------------------------------------------------

describe('Property 9: Summary Metrics Consistency', () => {
  it('avgWinRate equals average of successful winRates, bestSymbol/worstSymbol are correct', async () => {
    // **Validates: Requirements 3.7, 8.1**
    setupDeterministicMock();

    await fc.assert(
      fc.asyncProperty(symbolsArb, async (symbols) => {
        const config = {
          symbols,
          interval: '1h',
          startDate: '2023-01-01T00:00:00.000Z',
          endDate: '2023-06-01T00:00:00.000Z',
        };

        const { results, summary } = await runMultiAssetBacktest(EXCHANGE, STRATEGY_DEF, config);

        const successful = results.filter(r => !r.error);

        if (successful.length === 0) {
          // No successful results — skip metric checks
          return;
        }

        // avgWinRate must equal average of successful winRates
        const expectedAvgWinRate =
          successful.reduce((sum, r) => sum + r.winRate, 0) / successful.length;
        expect(summary.avgWinRate).toBeCloseTo(expectedAvgWinRate, 10);

        // bestSymbol must be the symbol with highest totalPnl
        const maxPnl = Math.max(...successful.map(r => r.totalPnl));
        const bestResult = successful.find(r => r.totalPnl === maxPnl);
        expect(summary.bestSymbol).toBe(bestResult.symbol);

        // worstSymbol must be the symbol with lowest totalPnl
        const minPnl = Math.min(...successful.map(r => r.totalPnl));
        const worstResult = successful.find(r => r.totalPnl === minPnl);
        expect(summary.worstSymbol).toBe(worstResult.symbol);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 10: Random Windows Are Non-Overlapping
// Validates: Requirements 4.5
// ---------------------------------------------------------------------------

describe('Property 10: Random Windows Are Non-Overlapping', () => {
  it('all generated windows are pairwise non-overlapping', () => {
    // **Validates: Requirements 4.5**

    fc.assert(
      fc.property(
        lookbackYearsArb,
        windowDaysArb,
        numWindowsArb,
        (lookbackYears, windowDays, numWindows) => {
          const windows = generateNonOverlappingWindows(lookbackYears, windowDays, numWindows);

          // Check every pair (i, j) where i ≠ j
          for (let i = 0; i < windows.length; i++) {
            for (let j = i + 1; j < windows.length; j++) {
              const iStart = new Date(windows[i].startDate).getTime();
              const iEnd = new Date(windows[i].endDate).getTime();
              const jStart = new Date(windows[j].startDate).getTime();
              const jEnd = new Date(windows[j].endDate).getTime();

              // Non-overlapping: one ends before or at the other's start
              const nonOverlapping = iEnd <= jStart || jEnd <= iStart;
              expect(nonOverlapping).toBe(true);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 11: Consistency Score Matches Window Results
// Validates: Requirements 4.7
// ---------------------------------------------------------------------------

describe('Property 11: Consistency Score Matches Window Results', () => {
  it('consistencyScore equals count(windows with totalPnl > 0) / windows.length', async () => {
    // **Validates: Requirements 4.7**

    await fc.assert(
      fc.asyncProperty(
        symbolsArb,
        lookbackYearsArb,
        windowDaysArb,
        numWindowsArb,
        async (symbols, lookbackYears, windowDays, numWindows) => {
          // Use deterministic mock so results are stable
          setupDeterministicMock();

          const config = {
            symbols,
            interval: '1h',
            windowDays,
            lookbackYears,
            numWindows,
          };

          const { windows, summary } = await runRandomWindowBacktest(
            EXCHANGE,
            STRATEGY_DEF,
            config
          );

          if (windows.length === 0) {
            // No windows generated (range too small) — skip
            return;
          }

          const profitableCount = windows.filter(w => w.totalPnl > 0).length;
          const expectedScore = profitableCount / windows.length;

          expect(summary.consistencyScore).toBeCloseTo(expectedScore, 10);
        }
      ),
      { numRuns: 100 }
    );
  });
});
