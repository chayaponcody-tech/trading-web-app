/**
 * Unit tests for strategyRoutes validation
 *
 * Validates: Requirements 1.3, 1.6, 2.5, 3.3, 4.4, 5.3, 5.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports that use them
// ---------------------------------------------------------------------------

vi.mock('../../../data-layer/src/repositories/strategyRepository.js', () => ({
  createStrategy: vi.fn(),
  getStrategyById: vi.fn(),
  getAllStrategies: vi.fn(() => []),
  updateStrategy: vi.fn(),
  deleteStrategy: vi.fn(),
  strategyNameExists: vi.fn(() => false),
  saveStrategyBacktestResult: vi.fn(),
  getStrategyBacktestHistory: vi.fn(() => []),
  getStrategyBacktestById: vi.fn(() => null),
  getStrategyByName: vi.fn(() => null),
}));

vi.mock('../../../data-layer/src/repositories/botRepository.js', () => ({
  getAllBots: vi.fn(() => []),
}));

vi.mock('../services/multiAssetBacktestService.js', () => ({
  runMultiAssetBacktest: vi.fn(),
  runRandomWindowBacktest: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createStrategyRoutes } from '../routes/strategyRoutes.js';
import {
  createStrategy,
  getStrategyById,
  strategyNameExists,
  deleteStrategy,
  getStrategyByName,
} from '../../../data-layer/src/repositories/strategyRepository.js';
import { getAllBots } from '../../../data-layer/src/repositories/botRepository.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/strategies', createStrategyRoutes(/* exchange= */ {}));
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: strategy not found
  getStrategyById.mockReturnValue(null);
  strategyNameExists.mockReturnValue(false);
  getAllBots.mockReturnValue([]);
});

// ---------------------------------------------------------------------------
// POST /api/strategies — validation
// ---------------------------------------------------------------------------

describe('POST /api/strategies — validation', () => {
  it('returns 400 with error containing "name" when name is missing', async () => {
    const app = buildApp();

    const res = await request(app)
      .post('/api/strategies')
      .send({ engineType: 'js' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.toLowerCase()).toContain('name');
  });

  it('returns 400 with error containing "pythonCode" when pythonCode is missing', async () => {
    const app = buildApp();

    const res = await request(app)
      .post('/api/strategies')
      .send({ name: 'My Strategy' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.toLowerCase()).toContain('pythoncode');
  });


  it('returns 201 when valid data is provided', async () => {
    const mockStrategy = { id: 'abc-123', name: 'My Strategy', engineType: 'python' };
    createStrategy.mockReturnValue(mockStrategy);

    const app = buildApp();

    const res = await request(app)
      .post('/api/strategies')
      .send({ name: 'My Strategy', pythonCode: 'print("hello")' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject(mockStrategy);
  });
});

// ---------------------------------------------------------------------------
// POST /api/strategies/:id/backtest/multi-asset — symbols > 20 validation
// ---------------------------------------------------------------------------

describe('POST /api/strategies/:id/backtest/multi-asset — validation', () => {
  it('returns 400 with Thai error message when symbols array has more than 20 items', async () => {
    const app = buildApp();

    const symbols = Array.from({ length: 21 }, (_, i) => `COIN${i}USDT`);

    const res = await request(app)
      .post('/api/strategies/some-id/backtest/multi-asset')
      .send({ symbols, interval: '1h', startDate: '2024-01-01', endDate: '2024-02-01' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toBe('รองรับสูงสุด 20 coin ต่อการรัน backtest');
  });

  it('allows exactly 20 symbols (proceeds past validation)', async () => {
    // Strategy not found → 404, but validation passed (not 400)
    const app = buildApp();

    const symbols = Array.from({ length: 20 }, (_, i) => `COIN${i}USDT`);

    const res = await request(app)
      .post('/api/strategies/nonexistent-id/backtest/multi-asset')
      .send({ symbols, interval: '1h', startDate: '2024-01-01', endDate: '2024-02-01' })
      .set('Content-Type', 'application/json');

    // Should not be 400 (validation passed); 404 because strategy not found
    expect(res.status).not.toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/strategies/:id/backtest/random-window — numWindows > 10 validation
// ---------------------------------------------------------------------------

describe('POST /api/strategies/:id/backtest/random-window — validation', () => {
  it('returns 400 with Thai error message when numWindows > 10', async () => {
    const app = buildApp();

    const res = await request(app)
      .post('/api/strategies/some-id/backtest/random-window')
      .send({
        symbols: ['BTCUSDT'],
        interval: '1h',
        windowDays: 30,
        lookbackYears: 2,
        numWindows: 11,
      })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toBe('รองรับสูงสุด 10 windows ต่อการรัน');
  });

  it('allows exactly 10 windows (proceeds past validation)', async () => {
    // Strategy not found → 404, but validation passed (not 400)
    const app = buildApp();

    const res = await request(app)
      .post('/api/strategies/nonexistent-id/backtest/random-window')
      .send({
        symbols: ['BTCUSDT'],
        interval: '1h',
        windowDays: 30,
        lookbackYears: 2,
        numWindows: 10,
      })
      .set('Content-Type', 'application/json');

    expect(res.status).not.toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/strategies/:id — not found
// ---------------------------------------------------------------------------

describe('GET /api/strategies/:id', () => {
  it('returns 404 with Thai error message when strategy id is not found', async () => {
    getStrategyById.mockReturnValue(null);
    const app = buildApp();

    const res = await request(app)
      .get('/api/strategies/nonexistent-id')
      .set('Accept', 'application/json');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toBe('ไม่พบกลยุทธ์ที่ระบุ');
  });

  it('returns 200 with strategy data when id exists', async () => {
    const mockStrategy = { id: 'abc-123', name: 'Test', engineType: 'js' };
    getStrategyById.mockReturnValue(mockStrategy);
    const app = buildApp();

    const res = await request(app)
      .get('/api/strategies/abc-123')
      .set('Accept', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject(mockStrategy);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/strategies/:id — active bot conflict
// ---------------------------------------------------------------------------

describe('DELETE /api/strategies/:id', () => {
  it('returns 409 with Thai error message when strategy has an active bot', async () => {
    const mockStrategy = { id: 'abc-123', name: 'My Strategy', engineType: 'js' };
    getStrategyById.mockReturnValue(mockStrategy);
    getAllBots.mockReturnValue([
      { isRunning: true, config: { strategy: 'My Strategy' } },
    ]);

    const app = buildApp();

    const res = await request(app)
      .delete('/api/strategies/abc-123')
      .set('Accept', 'application/json');

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toBe('ไม่สามารถลบกลยุทธ์ที่มี bot กำลังใช้งานอยู่');
  });

  it('returns 200 when strategy has no active bots', async () => {
    const mockStrategy = { id: 'abc-123', name: 'My Strategy', engineType: 'js' };
    getStrategyById.mockReturnValue(mockStrategy);
    getAllBots.mockReturnValue([
      { isRunning: false, config: { strategy: 'My Strategy' } },
    ]);
    deleteStrategy.mockReturnValue(undefined);

    const app = buildApp();

    const res = await request(app)
      .delete('/api/strategies/abc-123')
      .set('Accept', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });

  it('returns 404 when strategy id does not exist', async () => {
    getStrategyById.mockReturnValue(null);
    const app = buildApp();

    const res = await request(app)
      .delete('/api/strategies/nonexistent-id')
      .set('Accept', 'application/json');

    expect(res.status).toBe(404);
  });
});
