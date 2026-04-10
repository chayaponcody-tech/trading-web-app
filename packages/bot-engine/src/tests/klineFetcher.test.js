/**
 * Property-based tests for KlineFetcher
 *
 * Feature: backtest-system, Property 1: Kline Pagination Coverage
 * Feature: backtest-system, Property 2: Kline Deduplication
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { fetchKlines } from '../KlineFetcher.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INTERVAL_MS = 3600000; // 1h in milliseconds
const BATCH_SIZE = 500;

/**
 * Build a synthetic klines array covering [startTs, endTs] at 1h intervals.
 * Each kline: [openTime, open, high, low, close, volume]
 */
function buildKlines(startTs, endTs) {
  const klines = [];
  let t = startTs;
  while (t <= endTs) {
    klines.push([t, 100, 110, 90, 105, 1000]);
    t += INTERVAL_MS;
  }
  return klines;
}

/**
 * Create a mock exchange whose fetchOHLCV returns appropriate slices
 * of a pre-generated klines array based on the `since` parameter.
 */
function makeMockExchange(allKlines) {
  return {
    _getPublic() {
      return {
        fetchOHLCV(_symbol, _interval, since, limit = BATCH_SIZE) {
          if (since === undefined || since === null) {
            // No-date-range call: return last BATCH_SIZE klines
            return Promise.resolve(allKlines.slice(-BATCH_SIZE));
          }
          // Find the first kline at or after `since`
          const startIdx = allKlines.findIndex(k => k[0] >= since);
          if (startIdx === -1) return Promise.resolve([]);
          return Promise.resolve(allKlines.slice(startIdx, startIdx + limit));
        },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Property 1: Kline Pagination Coverage
// Validates: Requirements 1.1, 1.2, 1.3
// ---------------------------------------------------------------------------

describe('Property 1: Kline Pagination Coverage', () => {
  it('earliest kline ≤ startDate and latest kline ≥ endDate (within one interval)', async () => {
    // Use a fixed base timestamp (2024-01-01 00:00:00 UTC) to keep ranges reasonable
    const BASE = 1704067200000;

    await fc.assert(
      fc.asyncProperty(
        // Generate offset pairs: startOffset in [0, 100h], rangeLen in [1, 200h]
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 1, max: 200 }),
        async (startOffset, rangeLen) => {
          const startTs = BASE + startOffset * INTERVAL_MS;
          const endTs = startTs + rangeLen * INTERVAL_MS;

          const allKlines = buildKlines(startTs, endTs);
          const exchange = makeMockExchange(allKlines);

          const result = await fetchKlines(
            exchange,
            'BTCUSDT',
            '1h',
            {
              startDate: new Date(startTs).toISOString(),
              endDate: new Date(endTs).toISOString(),
            }
          );

          // Must return at least one kline
          expect(result.length).toBeGreaterThan(0);

          const earliest = result[0][0];
          const latest = result[result.length - 1][0];

          // Earliest kline open time must be ≤ startDate
          expect(earliest).toBeLessThanOrEqual(startTs);

          // Latest kline open time must be ≥ endDate - one interval
          // (the last kline's open time can be up to one interval before endDate)
          expect(latest).toBeGreaterThanOrEqual(endTs - INTERVAL_MS);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: Kline Deduplication
// Validates: Requirements 1.5
// ---------------------------------------------------------------------------

describe('Property 2: Kline Deduplication', () => {
  it('every open timestamp appears exactly once after fetchKlines processes duplicates', async () => {
    const BASE = 1704067200000;

    await fc.assert(
      fc.asyncProperty(
        // Generate a small set of unique timestamps (1–20 candles)
        fc.integer({ min: 1, max: 20 }),
        // How many extra duplicates to inject (0–50)
        fc.integer({ min: 0, max: 50 }),
        async (numCandles, numDuplicates) => {
          // Build unique klines
          const uniqueKlines = Array.from({ length: numCandles }, (_, i) => [
            BASE + i * INTERVAL_MS,
            100, 110, 90, 105, 1000,
          ]);

          // Pick random existing timestamps to duplicate
          const duplicates = Array.from({ length: numDuplicates }, (_, i) => {
            const srcIdx = i % numCandles;
            return [...uniqueKlines[srcIdx]]; // same openTime = duplicate
          });

          const klinesWithDuplicates = [...uniqueKlines, ...duplicates];

          // Shuffle so duplicates are interspersed
          klinesWithDuplicates.sort(() => Math.random() - 0.5);

          // Sort by openTime so the mock can serve slices correctly
          const sortedKlines = [...klinesWithDuplicates].sort((a, b) => a[0] - b[0]);

          const startTs = BASE;
          const endTs = BASE + (numCandles - 1) * INTERVAL_MS;

          const exchange = makeMockExchange(sortedKlines);

          const result = await fetchKlines(
            exchange,
            'BTCUSDT',
            '1h',
            {
              startDate: new Date(startTs).toISOString(),
              endDate: new Date(endTs).toISOString(),
            }
          );

          // Collect all open timestamps from result
          const openTimes = result.map(k => k[0]);
          const uniqueSet = new Set(openTimes);

          // Every open timestamp must appear exactly once
          expect(openTimes.length).toBe(uniqueSet.size);
        }
      ),
      { numRuns: 100 }
    );
  });
});
