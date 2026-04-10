import type { Time, SeriesMarker } from 'lightweight-charts';

export interface Trade {
  symbol: string;
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  entryTime: string;
  exitTime: string;
  pnl: number;
  pnlPct: number;
  entryReason?: string;
  entryConfidence?: number | null;
  exitReason: 'TP' | 'SL' | 'Signal Flipped';
}

export interface EquityCurvePoint {
  time: string;            // ISO 8601 from API
  value: number;
}

export interface BacktestConfig {
  symbol: string;
  strategy: string;
  interval: string;
  tpPercent: number;
  slPercent: number;
  leverage: number;
  capital: number;
  startDate?: string;
  endDate?: string;
}

export interface BacktestResult {
  backtestId: string;
  symbol: string;
  strategy: string;
  interval: string;
  config: BacktestConfig;
  initialCapital: number;
  finalCapital: number;
  totalPnl: number;
  netPnlPct: number;
  totalTrades: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  maxConsecutiveLosses: number;
  equityCurve: EquityCurvePoint[];
  trades: Trade[];
  createdAt: string;
}

export interface BacktestSummary {
  backtestId: string;
  symbol: string;
  strategy: string;
  interval: string;
  totalPnl: number;
  winRate: number;
  totalTrades: number;
  createdAt: string;
}

export interface CompareResult extends BacktestResult {
  rank: number;
  configLabel: string;
  error?: string;
}

const TZ_OFFSET = 7 * 3600; // UTC+7 (Bangkok) — must match candle chart offset

/**
 * Converts an equity curve with ISO 8601 time strings to Unix seconds
 * compatible with lightweight-charts. Applies the same UTC+7 offset used
 * by the candlestick chart so both charts stay in sync.
 */
export function convertEquityCurve(curve: EquityCurvePoint[]): { time: Time; value: number }[] {
  return curve.map(p => ({
    time: (Math.floor(new Date(p.time).getTime() / 1000) + TZ_OFFSET) as Time,
    value: p.value,
  }));
}

/**
 * Builds trade markers from a trades array for use with lightweight-charts.
 * Produces exactly 2 markers per trade (entry + exit), sorted by time ascending.
 */
export function buildMarkersFromTrades(trades: Trade[]): SeriesMarker<Time>[] {
  const markers: SeriesMarker<Time>[] = [];
  for (const trade of trades) {
    const entryTs = Math.floor(new Date(trade.entryTime).getTime() / 1000) as Time;
    const exitTs  = Math.floor(new Date(trade.exitTime).getTime() / 1000) as Time;

    // Entry marker
    markers.push({
      time: entryTs,
      position: trade.type === 'LONG' ? 'belowBar' : 'aboveBar',
      color: trade.type === 'LONG' ? '#0ecb81' : '#f6465d',
      shape: 'arrowUp',
      text: trade.type,
    });

    // Exit marker
    markers.push({
      time: exitTs,
      position: trade.type === 'LONG' ? 'aboveBar' : 'belowBar',
      color: '#f6465d',
      shape: 'arrowDown',
      text: trade.exitReason,
    });
  }
  return markers.sort((a, b) => (a.time as number) - (b.time as number));
}

// ─── Pure helpers for testable backtest logic ───────────────────────────────

export interface RunBacktestParams {
  symbol: string;
  strategy: string;
  interval: string;
  tpPercent: number;
  slPercent: number;
  leverage: number;
  capital: number;
  startDate?: string;
  endDate?: string;
  isPythonMode: boolean;
  pythonStrategyName: string;
}

/**
 * Builds a BacktestConfig from UI params.
 * When isPythonMode is true, prefixes the strategy name with "PYTHON:".
 */
export function buildBacktestConfig(params: RunBacktestParams): BacktestConfig {
  return {
    symbol: params.symbol,
    strategy: params.isPythonMode ? `PYTHON:${params.pythonStrategyName}` : params.strategy,
    interval: params.interval,
    tpPercent: params.tpPercent,
    slPercent: params.slPercent,
    leverage: params.leverage,
    capital: params.capital,
    ...(params.startDate ? { startDate: params.startDate } : {}),
    ...(params.endDate ? { endDate: params.endDate } : {}),
  };
}

/**
 * Resolves an API error string to a user-facing message.
 * Handles the special "Strategy AI service unavailable" case.
 */
export function resolveApiErrorMessage(errorStr: string): string {
  if (errorStr === 'Strategy AI service unavailable') {
    return 'Strategy AI service is not available. Please ensure the strategy-ai service is running.';
  }
  return errorStr;
}

export interface RunState {
  backtestResult: BacktestResult | null;
  errorMessage: string | null;
  markers: SeriesMarker<Time>[];
  equityCurve: { time: Time; value: number }[];
}

/**
 * Returns a new state with all run-related fields cleared.
 * Used to reset UI before a new backtest run.
 */
export function clearRunState(_state: RunState): RunState {
  return {
    backtestResult: null,
    errorMessage: null,
    markers: [],
    equityCurve: [],
  };
}

// ─── Trade log helpers ───────────────────────────────────────────────────────

export interface TradeRow {
  entryTime: string;
  exitTime: string;
  type: string;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPct: number;
  exitReason: string;
}

/**
 * Extracts all required display fields from a Trade object for the trade log.
 * Returns an object with all fields needed to render a trade log row.
 */
export function formatTradeRow(trade: Trade): TradeRow {
  return {
    entryTime: trade.entryTime,
    exitTime: trade.exitTime,
    type: trade.type,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
    pnl: trade.pnl,
    pnlPct: trade.pnlPct,
    exitReason: trade.exitReason,
  };
}

/**
 * Sorts a trades array in reverse chronological order by exitTime (most recent first).
 * Does not mutate the original array.
 */
export function sortTradesDescending(trades: Trade[]): Trade[] {
  return trades.slice().sort(
    (a, b) => new Date(b.exitTime).getTime() - new Date(a.exitTime).getTime()
  );
}

// ─── History summary helpers ─────────────────────────────────────────────────

export interface HistorySummaryRow {
  symbol: string;
  strategy: string;
  interval: string;
  totalPnl: number;
  winRate: number;
  totalTrades: number;
  createdAt: string;
}

/**
 * Extracts all required display fields from a BacktestSummary for the History tab.
 * Returns an object with all fields needed to render a history table row.
 */
export function formatHistorySummaryRow(summary: BacktestSummary): HistorySummaryRow {
  return {
    symbol: summary.symbol,
    strategy: summary.strategy,
    interval: summary.interval,
    totalPnl: summary.totalPnl,
    winRate: summary.winRate,
    totalTrades: summary.totalTrades,
    createdAt: summary.createdAt,
  };
}

// ─── Compare Mode helpers ────────────────────────────────────────────────────

/**
 * Builds the POST /api/backtest/compare request body from a list of configs.
 * Returns { configs } matching the API contract.
 */
export function buildCompareRequestBody(configs: BacktestConfig[]): { configs: BacktestConfig[] } {
  return { configs };
}

export interface CompareRow {
  rank: number;
  configLabel: string;
  totalPnl: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  profitFactor: number;
  error?: string;
}

/**
 * Extracts all required display fields from a CompareResult for the Compare tab table.
 * Includes the optional error field when present.
 */
export function formatCompareRow(result: CompareResult): CompareRow {
  const row: CompareRow = {
    rank: result.rank,
    configLabel: result.configLabel,
    totalPnl: result.totalPnl,
    winRate: result.winRate,
    sharpeRatio: result.sharpeRatio,
    maxDrawdown: result.maxDrawdown,
    profitFactor: result.profitFactor,
  };
  if (result.error !== undefined) {
    row.error = result.error;
  }
  return row;
}
