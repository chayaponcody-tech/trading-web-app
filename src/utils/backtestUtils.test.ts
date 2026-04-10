import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { convertEquityCurve, buildMarkersFromTrades, formatTradeRow, sortTradesDescending } from './backtestUtils';
import type { Trade } from './backtestUtils';

// ─── Property 3: Equity curve ISO-to-Unix conversion ───────────────────────
// Feature: backtest-ui-api-integration, Property 3
describe('convertEquityCurve', () => {
  it('Property 3: round-trip ISO→Unix is within 1 second — Validates: Requirements 3.1, 3.2', () => {
    // Use integer ms timestamps to avoid fc.date() edge cases with invalid dates
    const MIN_TS = 0;                          // 1970-01-01
    const MAX_TS = new Date('2100-01-01').getTime();
    const isoTs = fc.integer({ min: MIN_TS, max: MAX_TS }).map(ms => new Date(ms).toISOString());

    fc.assert(
      fc.property(
        // Generate arrays of 1–20 equity curve points with valid ISO timestamps
        fc.array(
          fc.record({
            time: isoTs,
            value: fc.float({ min: 0, max: 1_000_000, noNaN: true }),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (curve) => {
          const result = convertEquityCurve(curve);

          expect(result).toHaveLength(curve.length);

          for (let i = 0; i < curve.length; i++) {
            const unix = result[i].time as number;
            const originalMs = new Date(curve[i].time).getTime();
            const roundTripMs = unix * 1000;

            // Round-trip must be within 1 second
            expect(Math.abs(roundTripMs - originalMs)).toBeLessThan(1000);

            // Value must be preserved exactly
            expect(result[i].value).toBe(curve[i].value);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns empty array for empty input', () => {
    expect(convertEquityCurve([])).toEqual([]);
  });
});

// ─── Property 4: Trade marker completeness and correctness ──────────────────
// Feature: backtest-ui-api-integration, Property 4
describe('buildMarkersFromTrades', () => {
  // Use integer ms timestamps to avoid fc.date() edge cases with invalid dates
  const MIN_TS = new Date('2020-01-01').getTime();
  const MAX_TS = new Date('2024-01-01').getTime();
  const isoTimestamp = fc.integer({ min: MIN_TS, max: MAX_TS }).map(ms => new Date(ms).toISOString());

  const tradeArbitrary = fc.record<Trade>({
    symbol: fc.constantFrom('BTCUSDT', 'ETHUSDT', 'SOLUSDT'),
    type: fc.constantFrom('LONG' as const, 'SHORT' as const),
    entryPrice: fc.float({ min: 1, max: 100_000, noNaN: true }),
    exitPrice: fc.float({ min: 1, max: 100_000, noNaN: true }),
    entryTime: isoTimestamp,
    exitTime: isoTimestamp,
    pnl: fc.float({ min: -10_000, max: 10_000, noNaN: true }),
    pnlPct: fc.float({ min: -100, max: 1000, noNaN: true }),
    exitReason: fc.constantFrom('TP' as const, 'SL' as const, 'Signal Flipped' as const),
  });

  it('Property 4: marker count = 2 × trades.length, times/colors/positions/text correct — Validates: Requirements 4.1, 4.2, 4.3, 4.4', () => {
    fc.assert(
      fc.property(
        fc.array(tradeArbitrary, { minLength: 1, maxLength: 20 }),
        (trades) => {
          const markers = buildMarkersFromTrades(trades);

          // 4.1 — exactly 2 markers per trade
          expect(markers).toHaveLength(2 * trades.length);

          for (const trade of trades) {
            const expectedEntryTs = Math.floor(new Date(trade.entryTime).getTime() / 1000);
            const expectedExitTs  = Math.floor(new Date(trade.exitTime).getTime() / 1000);

            // Find the entry marker for this trade (matched by time + color)
            const entryColor = trade.type === 'LONG' ? '#0ecb81' : '#f6465d';
            const entryPosition = trade.type === 'LONG' ? 'belowBar' : 'aboveBar';

            const entryMarker = markers.find(
              m => (m.time as number) === expectedEntryTs &&
                   m.color === entryColor &&
                   m.position === entryPosition &&
                   m.text === trade.type
            );

            // 4.2 — entry time correct
            expect(entryMarker, `entry marker not found for trade ${JSON.stringify(trade)}`).toBeDefined();

            // 4.3 — LONG entry: belowBar + #0ecb81; SHORT entry: aboveBar + #f6465d
            expect(entryMarker!.position).toBe(entryPosition);
            expect(entryMarker!.color).toBe(entryColor);

            // Find exit marker by time + exitReason text
            const exitMarker = markers.find(
              m => (m.time as number) === expectedExitTs &&
                   m.text === trade.exitReason &&
                   m.shape === 'arrowDown'
            );

            // 4.4 — exit marker text = exitReason
            expect(exitMarker, `exit marker not found for trade ${JSON.stringify(trade)}`).toBeDefined();
            expect(exitMarker!.text).toBe(trade.exitReason);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns empty array for empty trades', () => {
    expect(buildMarkersFromTrades([])).toEqual([]);
  });

  it('output is sorted by time ascending', () => {
    fc.assert(
      fc.property(
        fc.array(tradeArbitrary, { minLength: 2, maxLength: 20 }),
        (trades) => {
          const markers = buildMarkersFromTrades(trades);
          for (let i = 1; i < markers.length; i++) {
            expect((markers[i].time as number)).toBeGreaterThanOrEqual((markers[i - 1].time as number));
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Shared trade arbitrary (reused by Properties 5 & 6) ────────────────────
const MIN_TS_56 = new Date('2020-01-01').getTime();
const MAX_TS_56 = new Date('2024-01-01').getTime();
const isoTimestamp56 = fc.integer({ min: MIN_TS_56, max: MAX_TS_56 }).map(ms => new Date(ms).toISOString());

const tradeArb56 = fc.record<Trade>({
  symbol: fc.constantFrom('BTCUSDT', 'ETHUSDT', 'SOLUSDT'),
  type: fc.constantFrom('LONG' as const, 'SHORT' as const),
  entryPrice: fc.float({ min: 1, max: 100_000, noNaN: true }),
  exitPrice: fc.float({ min: 1, max: 100_000, noNaN: true }),
  entryTime: isoTimestamp56,
  exitTime: isoTimestamp56,
  pnl: fc.float({ min: -10_000, max: 10_000, noNaN: true }),
  pnlPct: fc.float({ min: -100, max: 1000, noNaN: true }),
  exitReason: fc.constantFrom('TP' as const, 'SL' as const, 'Signal Flipped' as const),
});

// ─── Property 5: Trade log field completeness ────────────────────────────────
// Feature: backtest-ui-api-integration, Property 5
describe('formatTradeRow', () => {
  it('Property 5: all required display fields are present and non-empty — Validates: Requirements 5.1, 5.2, 5.3', () => {
    fc.assert(
      fc.property(tradeArb56, (trade) => {
        const row = formatTradeRow(trade);

        // All required fields must be present
        expect(row).toHaveProperty('entryTime');
        expect(row).toHaveProperty('exitTime');
        expect(row).toHaveProperty('type');
        expect(row).toHaveProperty('entryPrice');
        expect(row).toHaveProperty('exitPrice');
        expect(row).toHaveProperty('pnl');
        expect(row).toHaveProperty('pnlPct');
        expect(row).toHaveProperty('exitReason');

        // String fields must be non-empty
        expect(row.entryTime.length).toBeGreaterThan(0);
        expect(row.exitTime.length).toBeGreaterThan(0);
        expect(row.type.length).toBeGreaterThan(0);
        expect(row.exitReason.length).toBeGreaterThan(0);

        // Values must match the original trade
        expect(row.entryTime).toBe(trade.entryTime);
        expect(row.exitTime).toBe(trade.exitTime);
        expect(row.type).toBe(trade.type);
        expect(row.entryPrice).toBe(trade.entryPrice);
        expect(row.exitPrice).toBe(trade.exitPrice);
        expect(row.pnl).toBe(trade.pnl);
        expect(row.pnlPct).toBe(trade.pnlPct);
        expect(row.exitReason).toBe(trade.exitReason);
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Property 6: Trade log reverse chronological order ──────────────────────
// Feature: backtest-ui-api-integration, Property 6
describe('sortTradesDescending', () => {
  it('Property 6: adjacent rows satisfy exitTime[i] >= exitTime[i+1] — Validates: Requirements 5.4', () => {
    fc.assert(
      fc.property(
        fc.array(tradeArb56, { minLength: 2, maxLength: 20 }),
        (trades) => {
          const sorted = sortTradesDescending(trades);

          expect(sorted).toHaveLength(trades.length);

          for (let i = 1; i < sorted.length; i++) {
            const prev = new Date(sorted[i - 1].exitTime).getTime();
            const curr = new Date(sorted[i].exitTime).getTime();
            expect(prev).toBeGreaterThanOrEqual(curr);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('does not mutate the original array', () => {
    fc.assert(
      fc.property(
        fc.array(tradeArb56, { minLength: 1, maxLength: 10 }),
        (trades) => {
          const original = trades.map(t => t.exitTime);
          sortTradesDescending(trades);
          const after = trades.map(t => t.exitTime);
          expect(after).toEqual(original);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns empty array for empty input', () => {
    expect(sortTradesDescending([])).toEqual([]);
  });
});

// ─── Property 12: History summary field completeness ────────────────────────
// Feature: backtest-ui-api-integration, Property 12
import { formatHistorySummaryRow } from './backtestUtils';
import type { BacktestSummary } from './backtestUtils';

describe('formatHistorySummaryRow', () => {
  const MIN_TS_12 = new Date('2020-01-01').getTime();
  const MAX_TS_12 = new Date('2024-01-01').getTime();
  const isoTimestamp12 = fc.integer({ min: MIN_TS_12, max: MAX_TS_12 }).map(ms => new Date(ms).toISOString());

  const summaryArb = fc.record<BacktestSummary>({
    backtestId: fc.uuid(),
    symbol: fc.constantFrom('BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'),
    strategy: fc.constantFrom('EMA', 'RSI', 'BB', 'EMA_RSI', 'BB_RSI', 'EMA_BB_RSI', 'GRID', 'AI_SCOUTER', 'EMA_SCALP', 'STOCH_RSI', 'VWAP_SCALP'),
    interval: fc.constantFrom('5m', '15m', '1h', '4h', '1d'),
    totalPnl: fc.float({ min: -10_000, max: 10_000, noNaN: true }),
    winRate: fc.float({ min: 0, max: 100, noNaN: true }),
    totalTrades: fc.integer({ min: 0, max: 500 }),
    createdAt: isoTimestamp12,
  });

  it('Property 12: all required history summary fields are present — Validates: Requirements 7.2, 7.3', () => {
    fc.assert(
      fc.property(
        fc.array(summaryArb, { minLength: 1, maxLength: 20 }),
        (summaries) => {
          for (const summary of summaries) {
            const row = formatHistorySummaryRow(summary);

            // All required fields must be present
            expect(row).toHaveProperty('symbol');
            expect(row).toHaveProperty('strategy');
            expect(row).toHaveProperty('interval');
            expect(row).toHaveProperty('totalPnl');
            expect(row).toHaveProperty('winRate');
            expect(row).toHaveProperty('totalTrades');
            expect(row).toHaveProperty('createdAt');

            // String fields must be non-empty
            expect(row.symbol.length).toBeGreaterThan(0);
            expect(row.strategy.length).toBeGreaterThan(0);
            expect(row.interval.length).toBeGreaterThan(0);
            expect(row.createdAt.length).toBeGreaterThan(0);

            // Values must match the original summary
            expect(row.symbol).toBe(summary.symbol);
            expect(row.strategy).toBe(summary.strategy);
            expect(row.interval).toBe(summary.interval);
            expect(row.totalPnl).toBe(summary.totalPnl);
            expect(row.winRate).toBe(summary.winRate);
            expect(row.totalTrades).toBe(summary.totalTrades);
            expect(row.createdAt).toBe(summary.createdAt);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 10: Compare request body completeness ─────────────────────────
// Feature: backtest-ui-api-integration, Property 10
import { buildCompareRequestBody, formatCompareRow } from './backtestUtils';
import type { BacktestConfig, CompareResult } from './backtestUtils';

describe('buildCompareRequestBody', () => {
  const configArb = fc.record<BacktestConfig>({
    symbol: fc.constantFrom('BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'),
    strategy: fc.constantFrom('EMA', 'RSI', 'BB', 'EMA_RSI', 'BB_RSI', 'EMA_BB_RSI', 'GRID', 'AI_SCOUTER', 'EMA_SCALP', 'STOCH_RSI', 'VWAP_SCALP'),
    interval: fc.constantFrom('5m', '15m', '1h', '4h', '1d'),
    tpPercent: fc.float({ min: Math.fround(0.1), max: Math.fround(20), noNaN: true }),
    slPercent: fc.float({ min: Math.fround(0.1), max: Math.fround(20), noNaN: true }),
    leverage: fc.integer({ min: 1, max: 125 }),
    capital: fc.float({ min: Math.fround(100), max: Math.fround(1_000_000), noNaN: true }),
    startDate: fc.option(fc.constantFrom('2023-01-01', '2023-06-01', '2024-01-01'), { nil: undefined }),
    endDate: fc.option(fc.constantFrom('2023-12-31', '2024-06-30', '2024-12-31'), { nil: undefined }),
  });

  it('Property 10: configs array in request body matches added configs in order — Validates: Requirements 8.2, 8.3', () => {
    fc.assert(
      fc.property(
        fc.array(configArb, { minLength: 1, maxLength: 10 }),
        (configs) => {
          const body = buildCompareRequestBody(configs);

          // Must have a configs key
          expect(body).toHaveProperty('configs');

          // Length must match
          expect(body.configs).toHaveLength(configs.length);

          // Each config must match in order
          for (let i = 0; i < configs.length; i++) {
            expect(body.configs[i]).toEqual(configs[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns empty configs array for empty input', () => {
    const body = buildCompareRequestBody([]);
    expect(body).toEqual({ configs: [] });
  });
});

// ─── Property 11: Compare results display completeness ───────────────────────
// Feature: backtest-ui-api-integration, Property 11
describe('formatCompareRow', () => {
  const MIN_TS_11 = new Date('2020-01-01').getTime();
  const MAX_TS_11 = new Date('2024-01-01').getTime();
  const isoTimestamp11 = fc.integer({ min: MIN_TS_11, max: MAX_TS_11 }).map(ms => new Date(ms).toISOString());

  const tradeArb11 = fc.record<Trade>({
    symbol: fc.constantFrom('BTCUSDT', 'ETHUSDT'),
    type: fc.constantFrom('LONG' as const, 'SHORT' as const),
    entryPrice: fc.float({ min: Math.fround(1), max: Math.fround(100_000), noNaN: true }),
    exitPrice: fc.float({ min: Math.fround(1), max: Math.fround(100_000), noNaN: true }),
    entryTime: isoTimestamp11,
    exitTime: isoTimestamp11,
    pnl: fc.float({ min: Math.fround(-10_000), max: Math.fround(10_000), noNaN: true }),
    pnlPct: fc.float({ min: Math.fround(-100), max: Math.fround(1000), noNaN: true }),
    exitReason: fc.constantFrom('TP' as const, 'SL' as const, 'Signal Flipped' as const),
  });

  const compareResultArb = fc.record<CompareResult>({
    rank: fc.integer({ min: 1, max: 10 }),
    configLabel: fc.string({ minLength: 1, maxLength: 50 }),
    backtestId: fc.uuid(),
    symbol: fc.constantFrom('BTCUSDT', 'ETHUSDT', 'SOLUSDT'),
    strategy: fc.constantFrom('EMA', 'RSI', 'BB', 'EMA_SCALP'),
    interval: fc.constantFrom('1h', '4h', '1d'),
    config: fc.record<BacktestConfig>({
      symbol: fc.constantFrom('BTCUSDT', 'ETHUSDT'),
      strategy: fc.constantFrom('EMA', 'RSI'),
      interval: fc.constantFrom('1h', '4h'),
      tpPercent: fc.float({ min: Math.fround(0.5), max: Math.fround(10), noNaN: true }),
      slPercent: fc.float({ min: Math.fround(0.5), max: Math.fround(10), noNaN: true }),
      leverage: fc.integer({ min: 1, max: 50 }),
      capital: fc.float({ min: Math.fround(100), max: Math.fround(100_000), noNaN: true }),
      startDate: fc.option(fc.constant('2023-01-01'), { nil: undefined }),
      endDate: fc.option(fc.constant('2023-12-31'), { nil: undefined }),
    }),
    initialCapital: fc.float({ min: Math.fround(100), max: Math.fround(100_000), noNaN: true }),
    finalCapital: fc.float({ min: Math.fround(0), max: Math.fround(200_000), noNaN: true }),
    totalPnl: fc.float({ min: Math.fround(-10_000), max: Math.fround(10_000), noNaN: true }),
    netPnlPct: fc.float({ min: Math.fround(-100), max: Math.fround(1000), noNaN: true }),
    totalTrades: fc.integer({ min: 0, max: 500 }),
    winRate: fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true }),
    sharpeRatio: fc.float({ min: Math.fround(-5), max: Math.fround(10), noNaN: true }),
    maxDrawdown: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
    profitFactor: fc.float({ min: Math.fround(0), max: Math.fround(10), noNaN: true }),
    avgWin: fc.float({ min: Math.fround(0), max: Math.fround(10_000), noNaN: true }),
    avgLoss: fc.float({ min: Math.fround(0), max: Math.fround(10_000), noNaN: true }),
    maxConsecutiveLosses: fc.integer({ min: 0, max: 50 }),
    equityCurve: fc.array(fc.record({ time: isoTimestamp11, value: fc.float({ min: Math.fround(0), max: Math.fround(200_000), noNaN: true }) }), { maxLength: 5 }),
    trades: fc.array(tradeArb11, { maxLength: 5 }),
    createdAt: isoTimestamp11,
    error: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  });

  it('Property 11: all required compare fields are present, error included when present — Validates: Requirements 8.4, 8.6', () => {
    fc.assert(
      fc.property(
        fc.array(compareResultArb, { minLength: 1, maxLength: 10 }),
        (results) => {
          for (const result of results) {
            const row = formatCompareRow(result);

            // All required fields must be present
            expect(row).toHaveProperty('rank');
            expect(row).toHaveProperty('configLabel');
            expect(row).toHaveProperty('totalPnl');
            expect(row).toHaveProperty('winRate');
            expect(row).toHaveProperty('sharpeRatio');
            expect(row).toHaveProperty('maxDrawdown');
            expect(row).toHaveProperty('profitFactor');

            // Values must match
            expect(row.rank).toBe(result.rank);
            expect(row.configLabel).toBe(result.configLabel);
            expect(row.totalPnl).toBe(result.totalPnl);
            expect(row.winRate).toBe(result.winRate);
            expect(row.sharpeRatio).toBe(result.sharpeRatio);
            expect(row.maxDrawdown).toBe(result.maxDrawdown);
            expect(row.profitFactor).toBe(result.profitFactor);

            // error field must be included when present
            if (result.error !== undefined) {
              expect(row).toHaveProperty('error');
              expect(row.error).toBe(result.error);
            } else {
              expect(row.error).toBeUndefined();
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


