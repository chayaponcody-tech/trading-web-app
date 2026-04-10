/**
 * Property-based tests for backtestRepository
 *
 * Feature: backtest-system, Property 14: Backtest Persistence Round-Trip
 * Feature: backtest-system, Property 15: History Summary Excludes Trades
 */

import Database from 'better-sqlite3';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';

// ─── In-memory SQLite setup (must happen before importing repository) ─────────

const testDb = new Database(':memory:');

testDb.exec(`
  CREATE TABLE IF NOT EXISTS backtest_results (
    backtestId  TEXT PRIMARY KEY,
    symbol      TEXT NOT NULL,
    strategy    TEXT NOT NULL,
    interval    TEXT NOT NULL,
    config      TEXT NOT NULL,
    metrics     TEXT NOT NULL,
    createdAt   TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS backtest_trades (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    backtestId  TEXT NOT NULL,
    symbol      TEXT,
    type        TEXT,
    entryPrice  REAL,
    exitPrice   REAL,
    entryTime   TEXT,
    exitTime    TEXT,
    pnl         REAL,
    pnlPct      REAL,
    exitReason  TEXT,
    FOREIGN KEY (backtestId) REFERENCES backtest_results(backtestId)
  );
`);

vi.mock('../DatabaseManager.js', () => ({ db: testDb }));

// Import AFTER mock is set up
const { saveBacktestResult, getBacktestById, getBacktestHistory } = await import('../repositories/backtestRepository.js');

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const backtestResultArb = fc.record({
  backtestId: fc.uuid(),
  symbol: fc.constantFrom('BTCUSDT', 'ETHUSDT'),
  strategy: fc.constantFrom('EMA', 'RSI', 'BB'),
  interval: fc.constantFrom('1h', '15m', '4h'),
  config: fc.record({
    tpPercent: fc.float({ min: 0.5, max: 5 }),
    slPercent: fc.float({ min: 0.5, max: 3 }),
  }),
  totalTrades: fc.integer({ min: 0, max: 100 }),
  winRate: fc.float({ min: 0, max: 100 }),
  totalPnl: fc.float({ min: -1000, max: 1000 }),
  netPnlPct: fc.float({ min: -100, max: 100 }),
  sharpeRatio: fc.float({ min: -5, max: 5 }),
  maxDrawdown: fc.float({ min: 0, max: 1 }),
  profitFactor: fc.float({ min: 0, max: 10 }),
  avgWin: fc.float({ min: 0, max: 500 }),
  avgLoss: fc.float({ min: -500, max: 0 }),
  maxConsecutiveLosses: fc.integer({ min: 0, max: 20 }),
  equityCurve: fc.array(
    fc.record({
      time: fc.string(),
      value: fc.float({ min: 0, max: 5000 }),
    }),
    { maxLength: 5 }
  ),
  initialCapital: fc.float({ min: 100, max: 10000 }),
  finalCapital: fc.float({ min: 0, max: 20000 }),
  trades: fc.array(
    fc.record({
      symbol: fc.constantFrom('BTCUSDT'),
      type: fc.constantFrom('LONG', 'SHORT'),
      entryPrice: fc.float({ min: 100, max: 50000 }),
      exitPrice: fc.float({ min: 100, max: 50000 }),
      entryTime: fc.constant('2024-01-01T00:00:00.000Z'),
      exitTime: fc.constant('2024-01-01T01:00:00.000Z'),
      pnl: fc.float({ min: -100, max: 100 }),
      pnlPct: fc.float({ min: -10, max: 10 }),
      exitReason: fc.constantFrom('TP', 'SL', 'Signal Flipped'),
    }),
    { maxLength: 5 }
  ),
  createdAt: fc.constant(new Date().toISOString()),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clearTables() {
  testDb.exec('DELETE FROM backtest_trades; DELETE FROM backtest_results;');
}

function isClose(a, b, tolerance = 1e-4) {
  // SQLite stores NaN as NULL; treat null/undefined/NaN as equivalent non-finite values
  const aFinite = a !== null && a !== undefined && isFinite(a);
  const bFinite = b !== null && b !== undefined && isFinite(b);
  if (!aFinite && !bFinite) return true;
  if (!aFinite || !bFinite) return false;
  return Math.abs(a - b) <= tolerance + Math.abs(b) * tolerance;
}

// ─── Property 14: Backtest Persistence Round-Trip ─────────────────────────────
// Validates: Requirements 7.1, 7.3, 7.4

describe('Property 14: Backtest Persistence Round-Trip', () => {
  beforeEach(() => clearTables());

  it('fetching by ID returns equivalent symbol, strategy, interval, and metrics', async () => {
    await fc.assert(
      fc.asyncProperty(backtestResultArb, async (result) => {
        clearTables();

        const saved = saveBacktestResult(result);
        expect(saved).toBe(true);

        const fetched = getBacktestById(result.backtestId);
        expect(fetched).not.toBeNull();

        // Identity fields
        expect(fetched.backtestId).toBe(result.backtestId);
        expect(fetched.symbol).toBe(result.symbol);
        expect(fetched.strategy).toBe(result.strategy);
        expect(fetched.interval).toBe(result.interval);

        // Metric values — use tolerance for floats
        const metricFields = [
          'totalTrades', 'winRate', 'totalPnl', 'netPnlPct',
          'sharpeRatio', 'maxDrawdown', 'profitFactor',
          'avgWin', 'avgLoss', 'maxConsecutiveLosses',
          'initialCapital', 'finalCapital',
        ];

        for (const field of metricFields) {
          expect(isClose(fetched[field], result[field])).toBe(true);
        }

        // Trades count must match
        expect(fetched.trades.length).toBe(result.trades.length);
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Property 15: History Summary Excludes Trades ────────────────────────────
// Validates: Requirements 7.5

describe('Property 15: History Summary Excludes Trades', () => {
  beforeEach(() => clearTables());

  it('getBacktestHistory() returns no summary object with a trades field', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(backtestResultArb, { minLength: 1, maxLength: 5 }),
        async (results) => {
          clearTables();

          // Ensure unique backtestIds to avoid primary key conflicts
          const seen = new Set();
          const unique = results.filter(r => {
            if (seen.has(r.backtestId)) return false;
            seen.add(r.backtestId);
            return true;
          });

          for (const result of unique) {
            saveBacktestResult(result);
          }

          const history = getBacktestHistory();

          expect(Array.isArray(history)).toBe(true);
          expect(history.length).toBeGreaterThan(0);

          for (const summary of history) {
            expect(summary).not.toHaveProperty('trades');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
