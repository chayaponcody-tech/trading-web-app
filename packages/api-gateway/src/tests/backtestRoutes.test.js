/**
 * Property-based tests for backtestRoutes
 *
 * Feature: backtest-system, Property 16: API Validation Rejects Incomplete Requests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import express from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports that use them
// ---------------------------------------------------------------------------

vi.mock('../../../bot-engine/src/Backtester.js', () => ({
  runBacktest: vi.fn(),
  runBacktestCompare: vi.fn(),
}));

vi.mock('../../../data-layer/src/repositories/backtestRepository.js', () => ({
  getBacktestHistory: vi.fn(() => []),
  getBacktestById: vi.fn(() => null),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { createBacktestRoutes } from '../routes/backtestRoutes.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal Express app with the backtest router mounted */
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/backtest', createBacktestRoutes(/* exchange= */ {}));
  return app;
}

const REQUIRED_FIELDS = ['symbol', 'strategy', 'interval'];

/**
 * Return all non-empty subsets of an array (power set minus empty set).
 * Used to enumerate every combination of fields to omit.
 */
function nonEmptySubsets(arr) {
  const result = [];
  for (let mask = 1; mask < (1 << arr.length); mask++) {
    result.push(arr.filter((_, i) => mask & (1 << i)));
  }
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Property 16: API Validation Rejects Incomplete Requests
// Validates: Requirements 4.2, 4.3
// ---------------------------------------------------------------------------

describe('Property 16: API Validation Rejects Incomplete Requests', () => {
  it('POST /run returns HTTP 400 when any required field is missing', async () => {
    // Feature: backtest-system, Property 16: API Validation Rejects Incomplete Requests

    const app = buildApp();

    // Arbitrary values for each required field
    const fieldArbitraries = {
      symbol:   fc.constantFrom('BTCUSDT', 'ETHUSDT', 'BNBUSDT'),
      strategy: fc.constantFrom('EMA', 'RSI', 'BB', 'EMA_RSI'),
      interval: fc.constantFrom('1m', '5m', '15m', '1h', '4h', '1d'),
    };

    // All possible non-empty subsets of required fields to omit (7 combinations)
    const fieldsToOmitArb = fc.constantFrom(...nonEmptySubsets(REQUIRED_FIELDS));

    await fc.assert(
      fc.asyncProperty(
        fc.record(fieldArbitraries),
        fieldsToOmitArb,
        async (fullBody, fieldsToOmit) => {
          // Build a body that is missing the selected fields
          const incompleteBody = { ...fullBody };
          for (const field of fieldsToOmit) {
            delete incompleteBody[field];
          }

          const response = await request(app)
            .post('/api/backtest/run')
            .send(incompleteBody)
            .set('Content-Type', 'application/json');

          // Must return 400
          expect(response.status).toBe(400);

          // Must have a descriptive error message (non-empty string)
          expect(response.body).toHaveProperty('error');
          expect(typeof response.body.error).toBe('string');
          expect(response.body.error.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('POST /run returns HTTP 400 when body is completely empty', async () => {
    // Feature: backtest-system, Property 16: API Validation Rejects Incomplete Requests

    const app = buildApp();

    const response = await request(app)
      .post('/api/backtest/run')
      .send({})
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(typeof response.body.error).toBe('string');
    expect(response.body.error.length).toBeGreaterThan(0);
  });

  it('POST /run succeeds (not 400) when all required fields are present', async () => {
    // Feature: backtest-system, Property 16: API Validation Rejects Incomplete Requests
    // (negative test — valid requests must NOT be rejected)

    const { runBacktest } = await import('../../../bot-engine/src/Backtester.js');
    runBacktest.mockResolvedValue({ totalTrades: 0, trades: [] });

    const app = buildApp();

    const fieldArbitraries = {
      symbol:   fc.constantFrom('BTCUSDT', 'ETHUSDT'),
      strategy: fc.constantFrom('EMA', 'RSI'),
      interval: fc.constantFrom('1h', '4h'),
    };

    await fc.assert(
      fc.asyncProperty(
        fc.record(fieldArbitraries),
        async (body) => {
          const response = await request(app)
            .post('/api/backtest/run')
            .send(body)
            .set('Content-Type', 'application/json');

          // Must NOT return 400 for a complete request
          expect(response.status).not.toBe(400);
        }
      ),
      { numRuns: 100 }
    );
  });
});
