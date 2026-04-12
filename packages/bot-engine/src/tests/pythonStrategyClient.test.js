/**
 * Property-based tests for PythonStrategyClient
 *
 * Feature: backtest-system, Property 12: Python Strategy Payload Integrity
 * Feature: backtest-system, Property 13: Python Strategy Response Caching (Idempotence)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { getPythonSignal, getBatchSignals, clearCache } from '../PythonStrategyClient.js';

beforeEach(() => {
  clearCache();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Property 12: Python Strategy Payload Integrity
// Validates: Requirements 6.3
// ---------------------------------------------------------------------------

describe('Property 12: Python Strategy Payload Integrity', () => {
  it('captured request payload contains all required fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          closes:  fc.array(fc.float({ min: 100, max: 200 }), { minLength: 1, maxLength: 100 }),
          highs:   fc.array(fc.float({ min: 100, max: 200 }), { minLength: 1, maxLength: 100 }),
          lows:    fc.array(fc.float({ min: 100, max: 200 }), { minLength: 1, maxLength: 100 }),
          volumes: fc.array(fc.float({ min: 0, max: 1000 }), { minLength: 1, maxLength: 100 }),
          params:  fc.record({ period: fc.integer({ min: 1, max: 50 }) }),
          symbol:  fc.constantFrom('BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'),
        }),
        fc.string({ minLength: 1, maxLength: 30 }),
        async (window, strategyKey) => {
          clearCache();

          let capturedBody = null;
          const mockFetch = vi.fn().mockImplementation((_url, options) => {
            capturedBody = JSON.parse(options.body);
            return Promise.resolve({
              json: () => Promise.resolve({ signal: 'LONG' }),
            });
          });
          vi.stubGlobal('fetch', mockFetch);

          await getPythonSignal(strategyKey, window);

          expect(capturedBody).not.toBeNull();
          expect(capturedBody).toHaveProperty('symbol');
          expect(capturedBody).toHaveProperty('strategy');
          expect(capturedBody).toHaveProperty('closes');
          expect(capturedBody).toHaveProperty('highs');
          expect(capturedBody).toHaveProperty('lows');
          expect(capturedBody).toHaveProperty('volumes');
          expect(capturedBody).toHaveProperty('params');

          vi.unstubAllGlobals();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 13: Python Strategy Response Caching (Idempotence)
// Validates: Requirements 6.5
// ---------------------------------------------------------------------------

describe('Property 13: Python Strategy Response Caching (Idempotence)', () => {
  it('same closes window triggers exactly one HTTP call regardless of call count', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.float({ min: 100, max: 200 }), { minLength: 50, maxLength: 100 }),
        fc.integer({ min: 2, max: 10 }),
        async (closes, callCount) => {
          clearCache();

          let httpCallCount = 0;
          const mockFetch = vi.fn().mockImplementation(() => {
            httpCallCount++;
            return Promise.resolve({
              json: () => Promise.resolve({ signal: 'LONG' }),
            });
          });
          vi.stubGlobal('fetch', mockFetch);

          const window = {
            closes,
            highs: closes.map(c => c + 1),
            lows: closes.map(c => c - 1),
            volumes: closes.map(() => 500),
            params: { period: 14 },
            symbol: 'BTCUSDT',
          };

          for (let i = 0; i < callCount; i++) {
            await getPythonSignal('test_strategy', window);
          }

          expect(httpCallCount).toBe(1);

          vi.unstubAllGlobals();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Unit tests for getBatchSignals (Requirement 2.5)
// ---------------------------------------------------------------------------

describe('getBatchSignals', () => {
  const mockPayload = {
    closes:  [100, 101, 102, 103, 104],
    highs:   [101, 102, 103, 104, 105],
    lows:    [99,  100, 101, 102, 103],
    volumes: [500, 600, 700, 800, 900],
    params:  { period: 14 },
    symbol:  'BTCUSDT',
  };

  it('calls POST /strategy/analyze/batch with correct body', async () => {
    let capturedUrl = null;
    let capturedBody = null;

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url, options) => {
      capturedUrl = url;
      capturedBody = JSON.parse(options.body);
      return Promise.resolve({
        json: () => Promise.resolve({ signals: ['LONG', 'NONE', 'SHORT', 'NONE', 'LONG'], confidences: [0.8, 0.0, 0.7, 0.0, 0.9] }),
      });
    }));

    await getBatchSignals('rsi', mockPayload);

    expect(capturedUrl).toMatch(/\/strategy\/analyze\/batch$/);
    expect(capturedBody.strategy).toBe('rsi');
    expect(capturedBody.symbol).toBe('BTCUSDT');
    expect(capturedBody.closes).toEqual(mockPayload.closes);
    expect(capturedBody.highs).toEqual(mockPayload.highs);
    expect(capturedBody.lows).toEqual(mockPayload.lows);
    expect(capturedBody.volumes).toEqual(mockPayload.volumes);
    expect(capturedBody.params).toEqual(mockPayload.params);
  });

  it('returns { signals, confidences } from response', async () => {
    const mockSignals = ['LONG', 'NONE', 'SHORT', 'NONE', 'LONG'];
    const mockConfidences = [0.8, 0.0, 0.7, 0.0, 0.9];

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ signals: mockSignals, confidences: mockConfidences }),
    }));

    const result = await getBatchSignals('rsi', mockPayload);

    expect(result.signals).toEqual(mockSignals);
    expect(result.confidences).toEqual(mockConfidences);
  });

  it('throws "Strategy AI service unavailable" when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    await expect(getBatchSignals('rsi', mockPayload)).rejects.toThrow('Strategy AI service unavailable');
  });
});
