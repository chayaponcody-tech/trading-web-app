/**
 * Property-based tests for PythonStrategyClient
 *
 * Feature: backtest-system, Property 12: Python Strategy Payload Integrity
 * Feature: backtest-system, Property 13: Python Strategy Response Caching (Idempotence)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { getPythonSignal, clearCache } from '../PythonStrategyClient.js';

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
