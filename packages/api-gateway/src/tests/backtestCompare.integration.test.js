/**
 * Integration test: POST /api/backtest/compare
 *
 * Feature: backtest-system
 * Requirements: 5.1, 5.2, 5.3
 *
 * Strategy:
 *  - Use a real in-memory SQLite DB for the repository layer (no DB mock)
 *  - Mock KlineFetcher and SignalEngine to produce different PnL outcomes per config
 *    (different tpPercent values cause different trade outcomes)
 *  - Verify results are sorted by totalPnl descending
 *  - Verify rank field equals 1-based position in sorted array
 *  - Verify configLabel format: {strategy}-{interval}-{tpPercent}/{slPercent}
 *  - Verify > 10 configs returns HTTP 400
 */

import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── 1. Create in-memory SQLite via vi.hoisted ─────────────────────────────

const { testDb } = vi.hoisted(() => {
  const Database = require('better-sqlite3');
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

  return { testDb };
});

// ─── 2. Inject in-memory DB into DatabaseManager ──────────────────────────

vi.mock('../../../data-layer/src/DatabaseManager.js', () => ({
  db: testDb,
  useSqlite: true,
  initDb: () => testDb,
}));

// ─── 3. Mock KlineFetcher and SignalEngine ─────────────────────────────────

vi.mock('../../../bot-engine/src/KlineFetcher.js', () => ({
  fetchKlines: vi.fn(),
}));

vi.mock('../../../bot-engine/src/PythonStrategyClient.js', () => ({
  getBatchSignals: vi.fn(),
}));

// ─── 4. Import modules AFTER mocks ────────────────────────────────────────

import { fetchKlines } from '../../../bot-engine/src/KlineFetcher.js';
import { getBatchSignals } from '../../../bot-engine/src/PythonStrategyClient.js';
import { createBacktestRoutes } from '../routes/backtestRoutes.js';

// ─── 5. Synthetic kline helpers ────────────────────────────────────────────

const BASE_TIME = 1704067200000; // 2024-01-01 00:00:00 UTC
const INTERVAL_MS = 3600000;     // 1 hour

/**
 * Build n klines where candles after index 50 jump to trigger TP at tpPercent.
 * Higher tpPercent → bigger price jump → bigger PnL per trade.
 */
function makeTpKlines(n = 120, basePrice = 100, tpPercent = 2.0) {
  const exitPrice = basePrice * (1 + tpPercent / 100 + 0.01);
  return Array.from({ length: n }, (_, i) => {
    const price = i <= 50 ? basePrice : exitPrice;
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

// ─── 6. Build test Express app ─────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/backtest', createBacktestRoutes(/* exchange= */ {}));
  return app;
}

// ─── 7. Tests ──────────────────────────────────────────────────────────────

describe('Integration: POST /api/backtest/compare', () => {
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  afterAll(() => {
    testDb.exec('DELETE FROM backtest_trades; DELETE FROM backtest_results;');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    testDb.exec('DELETE FROM backtest_trades; DELETE FROM backtest_results;');

    // Default: one LONG signal at candle 50
    const signals = Array.from({ length: 1000 }, (_, i) => i === 50 ? 'LONG' : 'NONE');
    getBatchSignals.mockResolvedValue({
      signals,
      confidences: signals.map(s => s === 'NONE' ? 0 : 0.85),
      metadatas: signals.map(() => ({})),
    });
  });

  it('returns results sorted by totalPnl descending with correct rank fields', async () => {
    // Arrange: 3 configs with different tpPercent → different PnL outcomes
    // Config A: tpPercent=5.0 → highest PnL (rank 1)
    // Config B: tpPercent=3.0 → medium PnL (rank 2)
    // Config C: tpPercent=1.5 → lowest PnL (rank 3)
    const configs = [
      { symbol: 'BTCUSDT', strategy: 'EMA',  interval: '1h', tpPercent: 5.0, slPercent: 1.0, leverage: 10, capital: 1000 },
      { symbol: 'BTCUSDT', strategy: 'RSI',  interval: '1h', tpPercent: 3.0, slPercent: 1.0, leverage: 10, capital: 1000 },
      { symbol: 'BTCUSDT', strategy: 'BB',   interval: '1h', tpPercent: 1.5, slPercent: 1.0, leverage: 10, capital: 1000 },
    ];

    // Each config gets klines that trigger its own TP level
    fetchKlines
      .mockResolvedValueOnce(makeTpKlines(120, 100, 5.0))  // config A
      .mockResolvedValueOnce(makeTpKlines(120, 100, 3.0))  // config B
      .mockResolvedValueOnce(makeTpKlines(120, 100, 1.5)); // config C

    // Signal: LONG at candle 50, NONE otherwise
    getBatchSignals.mockResolvedValue({
      signals: Array.from({ length: 120 }, (_, i) => i === 50 ? 'LONG' : 'NONE'),
      confidences: Array.from({ length: 120 }, () => 0.8),
      metadatas: Array.from({ length: 120 }, () => ({})),
    });

    // Act
    const res = await request(app)
      .post('/api/backtest/compare')
      .send({ configs })
      .set('Content-Type', 'application/json');

    // Assert: HTTP 200
    expect(res.status).toBe(200);
    const results = res.body;
    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(3);

    // Verify sorted by totalPnl descending
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].totalPnl).toBeGreaterThanOrEqual(results[i + 1].totalPnl);
    }

    // Verify rank field equals 1-based position (rank 1 = highest totalPnl)
    results.forEach((r, idx) => {
      expect(r.rank).toBe(idx + 1);
    });

    // Verify rank 1 has the highest totalPnl
    expect(results[0].rank).toBe(1);
    expect(results[0].totalPnl).toBeGreaterThan(results[1].totalPnl);
    expect(results[1].totalPnl).toBeGreaterThan(results[2].totalPnl);
  });

  it('includes configLabel in format {strategy}-{interval}-{tpPercent}/{slPercent}', async () => {
    const configs = [
      { symbol: 'BTCUSDT', strategy: 'EMA',  interval: '1h',  tpPercent: 2.0, slPercent: 1.0, leverage: 10, capital: 1000 },
      { symbol: 'BTCUSDT', strategy: 'RSI',  interval: '4h',  tpPercent: 3.5, slPercent: 2.0, leverage: 10, capital: 1000 },
      { symbol: 'BTCUSDT', strategy: 'BB',   interval: '15m', tpPercent: 1.5, slPercent: 0.5, leverage: 10, capital: 1000 },
    ];

    fetchKlines.mockResolvedValue(makeTpKlines(120, 100, 2.0));
    // getBatchSignals mock provided by beforeEach

    const res = await request(app)
      .post('/api/backtest/compare')
      .send({ configs })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    const results = res.body;

    // Build expected labels keyed by strategy (order may differ after sort)
    // Note: JS number-to-string drops trailing zeros: 2.0 → "2", 1.0 → "1"
    const expectedLabels = {
      'EMA':  'EMA-1h-2/1',
      'RSI':  'RSI-4h-3.5/2',
      'BB':   'BB-15m-1.5/0.5',
    };

    for (const result of results) {
      expect(result).toHaveProperty('configLabel');
      expect(typeof result.configLabel).toBe('string');

      // configLabel must match pattern: strategy-interval-tpPercent/slPercent
      expect(result.configLabel).toMatch(/^[A-Z_]+-\w+-[\d.]+\/[\d.]+$/);
    }

    // Verify each strategy's configLabel is correct
    for (const result of results) {
      const strategy = result.strategy;
      if (expectedLabels[strategy]) {
        expect(result.configLabel).toBe(expectedLabels[strategy]);
      }
    }
  });

  it('returns HTTP 400 when more than 10 configs are submitted', async () => {
    const configs = Array.from({ length: 11 }, (_, i) => ({
      symbol: 'BTCUSDT',
      strategy: 'EMA',
      interval: '1h',
      tpPercent: 2.0 + i * 0.1,
      slPercent: 1.0,
      leverage: 10,
      capital: 1000,
    }));

    const res = await request(app)
      .post('/api/backtest/compare')
      .send({ configs })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/10/);
  });

  it('returns HTTP 400 when configs is not an array', async () => {
    const res = await request(app)
      .post('/api/backtest/compare')
      .send({ configs: 'not-an-array' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('each result contains all required BacktestResult fields', async () => {
    const configs = [
      { symbol: 'BTCUSDT', strategy: 'EMA', interval: '1h', tpPercent: 2.0, slPercent: 1.0, leverage: 10, capital: 1000 },
      { symbol: 'BTCUSDT', strategy: 'RSI', interval: '1h', tpPercent: 3.0, slPercent: 1.0, leverage: 10, capital: 1000 },
    ];

    fetchKlines.mockResolvedValue(makeTpKlines(120, 100, 2.0));
    // getBatchSignals mock provided by beforeEach

    const res = await request(app)
      .post('/api/backtest/compare')
      .send({ configs })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);

    for (const result of res.body) {
      // Compare-specific fields
      expect(result).toHaveProperty('rank');
      expect(typeof result.rank).toBe('number');
      expect(result).toHaveProperty('configLabel');
      expect(typeof result.configLabel).toBe('string');

      // Standard BacktestResult fields
      expect(result).toHaveProperty('backtestId');
      expect(result).toHaveProperty('totalPnl');
      expect(result).toHaveProperty('totalTrades');
      expect(result).toHaveProperty('winRate');
      expect(result).toHaveProperty('sharpeRatio');
      expect(result).toHaveProperty('maxDrawdown');
      expect(result).toHaveProperty('profitFactor');
      expect(result).toHaveProperty('equityCurve');
      expect(result).toHaveProperty('trades');
    }
  });
});
