// Feature: backtest-ui-api-integration, Property 9
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { isLeverageVisible } from './Backtest';
import {
  buildBacktestConfig,
  resolveApiErrorMessage,
  clearRunState,
  type RunBacktestParams,
  type RunState,
} from '../utils/backtestUtils';

/**
 * Property 9: Leverage visibility by strategy
 * Validates: Requirements 6.3
 *
 * For any strategy value, the Leverage input SHALL be visible
 * if and only if strategy !== 'GRID'.
 */

const ALL_STRATEGIES = [
  'EMA',
  'RSI',
  'BB',
  'EMA_RSI',
  'BB_RSI',
  'EMA_BB_RSI',
  'GRID',
  'AI_SCOUTER',
  'EMA_SCALP',
  'STOCH_RSI',
  'VWAP_SCALP',
] as const;

describe('Property 9: Leverage visibility by strategy', () => {
  it('should hide leverage only for GRID — verified for all 11 known strategies', () => {
    for (const strategy of ALL_STRATEGIES) {
      if (strategy === 'GRID') {
        expect(isLeverageVisible(strategy)).toBe(false);
      } else {
        expect(isLeverageVisible(strategy)).toBe(true);
      }
    }
  });

  it('property: isLeverageVisible(strategy) === (strategy !== "GRID") for any string', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_STRATEGIES),
        (strategy) => {
          return isLeverageVisible(strategy) === (strategy !== 'GRID');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('property: isLeverageVisible(strategy) === (strategy !== "GRID") for arbitrary strings', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (strategy) => {
          return isLeverageVisible(strategy) === (strategy !== 'GRID');
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Shared arbitraries ──────────────────────────────────────────────────────

const nonEmptyString = fc.string({ minLength: 1 });

const baseParamsArb = fc.record<RunBacktestParams>({
  symbol: nonEmptyString,
  strategy: nonEmptyString,
  interval: nonEmptyString,
  tpPercent: fc.float({ min: Math.fround(0.1), max: Math.fround(100), noNaN: true }),
  slPercent: fc.float({ min: Math.fround(0.1), max: Math.fround(100), noNaN: true }),
  leverage: fc.integer({ min: 1, max: 125 }),
  capital: fc.float({ min: Math.fround(1), max: Math.fround(1_000_000), noNaN: true }),
  startDate: fc.option(nonEmptyString, { nil: undefined }),
  endDate: fc.option(nonEmptyString, { nil: undefined }),
  isPythonMode: fc.constant(false),
  pythonStrategyName: fc.constant(''),
});

// ─── Property 1: Request body completeness ───────────────────────────────────

// Feature: backtest-ui-api-integration, Property 1
describe('Property 1: Request body completeness', () => {
  /**
   * For any BacktestConfig object (isPythonMode=false), buildBacktestConfig
   * SHALL produce an object containing all required fields with matching values.
   * Validates: Requirements 1.1, 1.2
   */
  it('property: all required fields present and match input params', () => {
    fc.assert(
      fc.property(baseParamsArb, (params) => {
        const config = buildBacktestConfig(params);

        expect(config.symbol).toBe(params.symbol);
        expect(config.strategy).toBe(params.strategy);
        expect(config.interval).toBe(params.interval);
        expect(config.tpPercent).toBe(params.tpPercent);
        expect(config.slPercent).toBe(params.slPercent);
        expect(config.leverage).toBe(params.leverage);
        expect(config.capital).toBe(params.capital);

        // All required keys must be present
        const requiredKeys = ['symbol', 'strategy', 'interval', 'tpPercent', 'slPercent', 'leverage', 'capital'];
        for (const key of requiredKeys) {
          expect(config).toHaveProperty(key);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('property: optional startDate/endDate included only when provided', () => {
    fc.assert(
      fc.property(baseParamsArb, (params) => {
        const config = buildBacktestConfig(params);
        if (params.startDate !== undefined) {
          expect(config.startDate).toBe(params.startDate);
        } else {
          expect(config.startDate).toBeUndefined();
        }
        if (params.endDate !== undefined) {
          expect(config.endDate).toBe(params.endDate);
        } else {
          expect(config.endDate).toBeUndefined();
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 2: API error message passthrough ───────────────────────────────

// Feature: backtest-ui-api-integration, Property 2
describe('Property 2: API error message passthrough', () => {
  /**
   * For any error string that is NOT the special AI service message,
   * resolveApiErrorMessage SHALL return the string unchanged.
   * Validates: Requirements 1.4, 9.2
   */
  it('property: non-special error strings pass through unchanged', () => {
    const nonSpecialString = fc.string({ minLength: 1 }).filter(
      (s) => s !== 'Strategy AI service unavailable',
    );

    fc.assert(
      fc.property(nonSpecialString, (errorStr) => {
        expect(resolveApiErrorMessage(errorStr)).toBe(errorStr);
      }),
      { numRuns: 100 },
    );
  });

  it('special case: "Strategy AI service unavailable" maps to specific message', () => {
    expect(resolveApiErrorMessage('Strategy AI service unavailable')).toBe(
      'Strategy AI service is not available. Please ensure the strategy-ai service is running.',
    );
  });
});

// ─── Property 7: Python strategy PYTHON: prefix ──────────────────────────────

// Feature: backtest-ui-api-integration, Property 7
describe('Property 7: Python strategy PYTHON: prefix', () => {
  /**
   * For any non-empty Python strategy name, buildBacktestConfig with
   * isPythonMode=true SHALL produce strategy === "PYTHON:" + name.
   * Validates: Requirements 11.3
   */
  it('property: strategy field equals "PYTHON:" + pythonStrategyName when isPythonMode is true', () => {
    fc.assert(
      fc.property(
        baseParamsArb,
        nonEmptyString,
        (params, name) => {
          const pythonParams: RunBacktestParams = {
            ...params,
            isPythonMode: true,
            pythonStrategyName: name,
          };
          const config = buildBacktestConfig(pythonParams);
          expect(config.strategy).toBe(`PYTHON:${name}`);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 8: JS strategy key passthrough ─────────────────────────────────

// Feature: backtest-ui-api-integration, Property 8
describe('Property 8: JS strategy key passthrough (no transformation)', () => {
  /**
   * For each of the 11 JS strategy keys, buildBacktestConfig with
   * isPythonMode=false SHALL produce strategy === the key exactly.
   * Validates: Requirements 10.3
   */
  const JS_STRATEGY_KEYS = [
    'EMA',
    'RSI',
    'BB',
    'EMA_RSI',
    'BB_RSI',
    'EMA_BB_RSI',
    'GRID',
    'AI_SCOUTER',
    'EMA_SCALP',
    'STOCH_RSI',
    'VWAP_SCALP',
  ] as const;

  it('all 11 JS strategy keys pass through without transformation', () => {
    for (const key of JS_STRATEGY_KEYS) {
      const params: RunBacktestParams = {
        symbol: 'BTCUSDT',
        strategy: key,
        interval: '1h',
        tpPercent: 2,
        slPercent: 1,
        leverage: 10,
        capital: 1000,
        isPythonMode: false,
        pythonStrategyName: '',
      };
      const config = buildBacktestConfig(params);
      expect(config.strategy).toBe(key);
    }
  });

  it('property: any JS strategy key passes through unchanged', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...JS_STRATEGY_KEYS),
        baseParamsArb,
        (key, params) => {
          const jsParams: RunBacktestParams = {
            ...params,
            isPythonMode: false,
            strategy: key,
          };
          const config = buildBacktestConfig(jsParams);
          expect(config.strategy).toBe(key);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 13: State cleared on new run ───────────────────────────────────

// Feature: backtest-ui-api-integration, Property 13
describe('Property 13: State cleared on new run', () => {
  /**
   * For any UI state containing previous results, clearRunState SHALL
   * return a new state with all fields reset to null/empty.
   * Validates: Requirements 9.4
   */
  const runStateArb = fc.record<RunState>({
    backtestResult: fc.option(
      fc.record({
        backtestId: nonEmptyString,
        symbol: nonEmptyString,
        strategy: nonEmptyString,
        interval: nonEmptyString,
        config: fc.record({
          symbol: nonEmptyString,
          strategy: nonEmptyString,
          interval: nonEmptyString,
          tpPercent: fc.float({ min: Math.fround(0.1), max: Math.fround(100), noNaN: true }),
          slPercent: fc.float({ min: Math.fround(0.1), max: Math.fround(100), noNaN: true }),
          leverage: fc.integer({ min: 1, max: 125 }),
          capital: fc.float({ min: Math.fround(1), max: Math.fround(1_000_000), noNaN: true }),
        }),
        initialCapital: fc.float({ min: Math.fround(1), noNaN: true }),
        finalCapital: fc.float({ min: 0, noNaN: true }),
        totalPnl: fc.float({ noNaN: true }),
        netPnlPct: fc.float({ noNaN: true }),
        totalTrades: fc.nat(),
        winRate: fc.float({ min: 0, max: Math.fround(100), noNaN: true }),
        sharpeRatio: fc.float({ noNaN: true }),
        maxDrawdown: fc.float({ min: 0, max: Math.fround(1), noNaN: true }),
        profitFactor: fc.float({ min: 0, noNaN: true }),
        avgWin: fc.float({ min: 0, noNaN: true }),
        avgLoss: fc.float({ min: 0, noNaN: true }),
        maxConsecutiveLosses: fc.nat(),
        equityCurve: fc.array(fc.record({ time: nonEmptyString, value: fc.float({ noNaN: true }) })),
        trades: fc.constant([]),
        createdAt: nonEmptyString,
      }),
      { nil: null },
    ),
    errorMessage: fc.option(nonEmptyString, { nil: null }),
    markers: fc.array(fc.record({
      time: fc.integer({ min: 0 }) as fc.Arbitrary<any>,
      position: fc.constantFrom('belowBar', 'aboveBar') as fc.Arbitrary<any>,
      color: nonEmptyString,
      shape: fc.constantFrom('arrowUp', 'arrowDown') as fc.Arbitrary<any>,
      text: nonEmptyString,
    })),
    equityCurve: fc.array(fc.record({
      time: fc.integer({ min: 0 }) as fc.Arbitrary<any>,
      value: fc.float({ noNaN: true }),
    })),
  });

  it('property: clearRunState always returns null/empty for all fields', () => {
    fc.assert(
      fc.property(runStateArb, (state) => {
        const cleared = clearRunState(state);
        expect(cleared.backtestResult).toBeNull();
        expect(cleared.errorMessage).toBeNull();
        expect(cleared.markers).toEqual([]);
        expect(cleared.equityCurve).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });

  it('clearRunState does not mutate the original state', () => {
    fc.assert(
      fc.property(runStateArb, (state) => {
        const originalResult = state.backtestResult;
        const originalError = state.errorMessage;
        clearRunState(state);
        // Original state should be unchanged
        expect(state.backtestResult).toBe(originalResult);
        expect(state.errorMessage).toBe(originalError);
      }),
      { numRuns: 100 },
    );
  });
});
