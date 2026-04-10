/**
 * Integration test: POST /api/backtest/run end-to-end
 *
 * Feature: backtest-system
 * Requirements: 4.1, 7.1, 7.2
 *
 * Strategy:
 *  - Use a real in-memory SQLite DB for the repository layer (no DB mock)
 *  - Mock KlineFetcher with synthetic klines (avoids real Binance calls)
 *  - Mock SignalEngine.computeSignal to produce a LONG signal so trades are generated
 *  - Verify BacktestResult shape, DB persistence, and GET /api/backtest/history
 */

import Database from 'better-sqlite3';
import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── 1. Create in-memory SQLite via vi.hoisted so it's available in vi.mock factories ──

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

// ─── 2. Inject the in-memory DB into DatabaseManager ──────────────────────────

vi.mock('../../../data-layer/src/DatabaseManager.js', () => ({
  db: testDb,
  useSqlite: true,
  initDb: () => testDb,
}));

// ─── 3. Mock KlineFetcher and SignalEngine ─────────────────────────────────────

vi.mock('../../../bot-engine/src/KlineFetcher.js', () => ({
  fetchKlines: vi.fn(),
}));

vi.mock('../../../bot-engine/src/SignalEngine.js', () => ({
  computeSignal: vi.fn(),
}));

// ─── 4. Import modules AFTER mocks are set up ──────────────────────────────────

import { fetchKlines } from '../../../bot-engine/src/KlineFetcher.js';
import { computeSignal } from '../../../bot-engine/src/SignalEngine.js';
import { createBacktestRoutes } from '../routes/backtestRoutes.js';

// ─── 5. Synthetic kline helpers ────────────────────────────────────────────────

const BASE_TIME = 1704067200000; // 2024-01-01 00:00:00 UTC
const INTERVAL_MS = 3600000;     // 1 hour

/**
 * Build n synthetic klines at a fixed price.
 * Format: [openTime, open, high, low, close, volume]
 */
function makeSyntheticKlines(n = 120, basePrice = 100) {
  return Array.from({ length: n }, (_, i) => [
    BASE_TIME + i * INTERVAL_MS,
    String(basePrice),
    String(basePrice + 1),
    String(basePrice - 1),
    String(basePrice),
    '1000',
  ]);
}

/**
 * Build klines where candles 51+ jump to trigger TP.
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

// ─── 6. Build test Express app ─────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(express.json());
  // Pass a non-null exchange stub so the route doesn't return 503
  app.use('/api/backtest', createBacktestRoutes(/* exchange= */ {}));
  return app;
}

// ─── 7. Tests ──────────────────────────────────────────────────────────────────

describe('Integration: POST /api/backtest/run end-to-end', () => {
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  afterAll(() => {
    testDb.exec('DELETE FROM backtest_trades; DELETE FROM backtest_results;');
  });

  it('returns a complete BacktestResult shape for a valid config (with trades)', async () => {
    // Arrange: klines that trigger a TP trade
    fetchKlines.mockResolvedValue(makeTpKlines(120, 100, 2.0));

    // Signal: LONG at candle 50 (closes.length === 50), NONE otherwise
    computeSignal.mockImplementation((closes) =>
      closes.length === 50 ? 'LONG' : 'NONE'
    );

    const config = {
      symbol: 'BTCUSDT',
      strategy: 'EMA',
      interval: '1h',
      tpPercent: 2.0,
      slPercent: 1.0,
      leverage: 10,
      capital: 1000,
    };

    // Act
    const res = await request(app)
      .post('/api/backtest/run')
      .send(config)
      .set('Content-Type', 'application/json');

    // Assert: HTTP 200
    expect(res.status).toBe(200);

    const body = res.body;

    // Required identity fields
    expect(body).toHaveProperty('backtestId');
    expect(typeof body.backtestId).toBe('string');
    expect(body.backtestId.length).toBeGreaterThan(0);

    expect(body.symbol).toBe('BTCUSDT');
    expect(body.strategy).toBe('EMA');
    expect(body.interval).toBe('1h');

    // Required metric fields — all must be present and numeric
    const numericMetrics = [
      'totalTrades', 'winRate', 'totalPnl', 'netPnlPct',
      'sharpeRatio', 'maxDrawdown', 'profitFactor',
      'avgWin', 'avgLoss', 'maxConsecutiveLosses',
      'initialCapital', 'finalCapital',
    ];
    for (const field of numericMetrics) {
      expect(body, `missing field: ${field}`).toHaveProperty(field);
      expect(typeof body[field], `${field} should be number`).toBe('number');
      expect(Number.isNaN(body[field]), `${field} should not be NaN`).toBe(false);
    }

    // equityCurve must be an array
    expect(Array.isArray(body.equityCurve)).toBe(true);

    // trades must be an array
    expect(Array.isArray(body.trades)).toBe(true);

    // config echo
    expect(body).toHaveProperty('config');

    // createdAt must be a valid ISO string
    expect(body).toHaveProperty('createdAt');
    expect(() => new Date(body.createdAt)).not.toThrow();

    // Since we triggered a TP, there should be at least one trade
    expect(body.totalTrades).toBeGreaterThan(0);
    expect(body.trades.length).toBeGreaterThan(0);

    // Verify trade shape
    const trade = body.trades[0];
    const tradeFields = ['entryPrice', 'exitPrice', 'entryTime', 'exitTime', 'type', 'pnl', 'pnlPct', 'exitReason'];
    for (const field of tradeFields) {
      expect(trade, `trade missing field: ${field}`).toHaveProperty(field);
    }
  });

  it('saves the result to DB and GET /api/backtest/history returns the entry', async () => {
    // Clean tables for isolation
    testDb.exec('DELETE FROM backtest_trades; DELETE FROM backtest_results;');

    // Arrange: klines that trigger a TP trade
    fetchKlines.mockResolvedValue(makeTpKlines(120, 100, 2.0));

    computeSignal.mockImplementation((closes) =>
      closes.length === 50 ? 'LONG' : 'NONE'
    );

    const config = {
      symbol: 'ETHUSDT',
      strategy: 'RSI',
      interval: '4h',
      tpPercent: 2.0,
      slPercent: 1.0,
      leverage: 5,
      capital: 500,
    };

    // Act: run backtest
    const runRes = await request(app)
      .post('/api/backtest/run')
      .send(config)
      .set('Content-Type', 'application/json');

    expect(runRes.status).toBe(200);
    const savedId = runRes.body.backtestId;
    expect(typeof savedId).toBe('string');

    // Act: fetch history
    const historyRes = await request(app).get('/api/backtest/history');

    expect(historyRes.status).toBe(200);
    expect(Array.isArray(historyRes.body)).toBe(true);
    expect(historyRes.body.length).toBeGreaterThan(0);

    // The saved result must appear in history
    const entry = historyRes.body.find(r => r.backtestId === savedId);
    expect(entry).toBeDefined();
    expect(entry.symbol).toBe('ETHUSDT');
    expect(entry.strategy).toBe('RSI');
    expect(entry.interval).toBe('4h');

    // History entries must NOT contain a trades field (Requirement 7.5)
    expect(entry).not.toHaveProperty('trades');
  });

  it('returns HTTP 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/backtest/run')
      .send({ symbol: 'BTCUSDT' }) // missing strategy and interval
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(typeof res.body.error).toBe('string');
    expect(res.body.error.length).toBeGreaterThan(0);
  });

  it('returns a valid result with zero trades when no signals fire', async () => {
    // Arrange: flat klines, no signals
    fetchKlines.mockResolvedValue(makeSyntheticKlines(120, 100));
    computeSignal.mockReturnValue('NONE');

    const config = {
      symbol: 'BNBUSDT',
      strategy: 'BB',
      interval: '15m',
    };

    const res = await request(app)
      .post('/api/backtest/run')
      .send(config)
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.totalTrades).toBe(0);
    expect(res.body.trades).toEqual([]);
    expect(Array.isArray(res.body.equityCurve)).toBe(true);
    expect(res.body.equityCurve).toHaveLength(0);

    // All zero-trade metrics must be 0
    const zeroMetrics = ['winRate', 'totalPnl', 'netPnlPct', 'sharpeRatio', 'maxDrawdown', 'profitFactor'];
    for (const field of zeroMetrics) {
      expect(res.body[field]).toBe(0);
    }
  });
});
