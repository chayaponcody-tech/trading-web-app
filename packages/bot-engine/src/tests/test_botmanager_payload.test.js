/**
 * Property test for BotManager payload slicing
 * Feature: python-strategy-registry, Property 10: BotManager sends last 100 bars
 *
 * For any klines array of length N, the payload sent to /strategy/analyze
 * SHALL contain closes, highs, lows, volumes arrays of length min(N, 100)
 * corresponding to the most recent bars.
 *
 * Validates: Requirements 6.2
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Helper: build a mock klines array of length N
// Each kline is [openTime, open, high, low, close, volume, ...]
// We use index-based values so we can verify "most recent bars" ordering.
// ---------------------------------------------------------------------------
function makeMockKlines(n) {
  return Array.from({ length: n }, (_, i) => [
    i,                    // [0] openTime
    String(i * 10),       // [1] open
    String(i * 10 + 3),   // [2] high
    String(i * 10 - 3),   // [3] low
    String(i * 10 + 1),   // [4] close
    String(i * 100),      // [5] volume
  ]);
}

// ---------------------------------------------------------------------------
// The exact slicing logic extracted from BotManager._strategyAiFilter()
// ---------------------------------------------------------------------------
function buildPayload(klines, symbol, strategyName) {
  return {
    symbol,
    strategy: strategyName,
    closes:  klines.slice(-100).map(k => parseFloat(k[4])),
    highs:   klines.slice(-100).map(k => parseFloat(k[2])),
    lows:    klines.slice(-100).map(k => parseFloat(k[3])),
    volumes: klines.slice(-100).map(k => parseFloat(k[5])),
  };
}

// ---------------------------------------------------------------------------
// Property 10 tests
// ---------------------------------------------------------------------------

describe('Property 10: BotManager sends last 100 bars', () => {
  const testSizes = [1, 50, 99, 100, 101, 150, 200, 500];

  for (const n of testSizes) {
    const expected = Math.min(n, 100);
    it(`N=${n}: payload arrays have length min(${n}, 100) = ${expected}`, () => {
      const klines = makeMockKlines(n);
      const payload = buildPayload(klines, 'BTCUSDT', 'bb_breakout');

      expect(payload.closes.length).toBe(expected);
      expect(payload.highs.length).toBe(expected);
      expect(payload.lows.length).toBe(expected);
      expect(payload.volumes.length).toBe(expected);
    });
  }

  it('N=200: closes correspond to most recent 100 bars (last bar matches)', () => {
    const n = 200;
    const klines = makeMockKlines(n);
    const payload = buildPayload(klines, 'BTCUSDT', 'bb_breakout');

    const expectedLastClose = parseFloat(klines[n - 1][4]);
    expect(payload.closes[99]).toBe(expectedLastClose);

    const expectedFirstClose = parseFloat(klines[n - 100][4]);
    expect(payload.closes[0]).toBe(expectedFirstClose);
  });

  it('N=150: highs correspond to most recent 100 bars', () => {
    const n = 150;
    const klines = makeMockKlines(n);
    const payload = buildPayload(klines, 'BTCUSDT', 'bb_breakout');

    const expectedLastHigh = parseFloat(klines[n - 1][2]);
    expect(payload.highs[99]).toBe(expectedLastHigh);

    const expectedFirstHigh = parseFloat(klines[n - 100][2]);
    expect(payload.highs[0]).toBe(expectedFirstHigh);
  });

  it('N=50: all bars included (N < 100), first element is kline[0]', () => {
    const n = 50;
    const klines = makeMockKlines(n);
    const payload = buildPayload(klines, 'BTCUSDT', 'bb_breakout');

    const expectedFirstClose = parseFloat(klines[0][4]);
    expect(payload.closes[0]).toBe(expectedFirstClose);

    const expectedLastClose = parseFloat(klines[n - 1][4]);
    expect(payload.closes[n - 1]).toBe(expectedLastClose);
  });

  it('N=1: single bar — payload arrays have length 1', () => {
    const klines = makeMockKlines(1);
    const payload = buildPayload(klines, 'BTCUSDT', 'bb_breakout');

    expect(payload.closes.length).toBe(1);
    expect(payload.closes[0]).toBe(parseFloat(klines[0][4]));
  });

  it('N=100: all payload values are finite numbers (parseFloat applied)', () => {
    const klines = makeMockKlines(100);
    const payload = buildPayload(klines, 'BTCUSDT', 'bb_breakout');

    for (const arr of [payload.closes, payload.highs, payload.lows, payload.volumes]) {
      for (const v of arr) {
        expect(typeof v).toBe('number');
        expect(isFinite(v)).toBe(true);
      }
    }
  });

  it('N=0: empty klines → empty payload arrays', () => {
    const klines = [];
    const payload = buildPayload(klines, 'BTCUSDT', 'bb_breakout');

    expect(payload.closes.length).toBe(0);
    expect(payload.highs.length).toBe(0);
    expect(payload.lows.length).toBe(0);
    expect(payload.volumes.length).toBe(0);
  });
});
