export interface ParamDef {
  key: string;
  label: string;
  type: 'number' | 'text';
  default: number | string;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}

export interface StrategyDefinition {
  id: string;                    // UUID v4
  name: string;
  description: string;           // markdown
  engineType: 'js' | 'python';
  baseStrategy?: string;         // built-in strategy key to use as engine (e.g. 'EMA', 'RSI')
  defaultParams: Record<string, unknown>;
  pythonCode?: string;           // Python source code (engine=python only)
  tags: string[];
  parameters?: ParamDef[];
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
}

export interface AssetResult {
  symbol: string;
  rank: number | null;
  totalPnl: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  totalTrades: number;
  equityCurve: { time: string; value: number }[];
  trades?: AssetTrade[];          // per-symbol trade list
  error?: string;
}

export interface AssetTrade {
  type: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  entryTime: string;
  exitTime: string;
  pnl: number;
  pnlPct: number;
  entryReason?: string;
  exitReason: string;
}

export interface MultiAssetBacktestResult {
  backtestId: string;
  strategyId: string;
  strategyName: string;
  results: AssetResult[];
  summary: {
    bestSymbol: string | null;
    worstSymbol: string | null;
    avgWinRate: number;
    avgSharpeRatio: number;
    avgTotalPnl: number;
    totalSymbolsTested: number;
    successfulSymbols: number;
    failedSymbols: number;
  };
  executionTimeMs: number;
}

export interface WindowResult {
  windowStart: string;           // ISO 8601
  windowEnd: string;             // ISO 8601
  totalPnl: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

export interface RandomWindowBacktestResult {
  backtestId: string;
  strategyId: string;
  strategyName: string;
  windows: WindowResult[];
  summary: {
    consistencyScore: number;    // 0.0 - 1.0
    avgWinRate: number;
    avgSharpeRatio: number;
    avgTotalPnl: number;
    bestWindow: WindowResult | null;
    worstWindow: WindowResult | null;
  };
  executionTimeMs: number;
}

export interface BacktestHistoryItem {
  backtestId: string;
  strategyId: string;
  backtestType: 'multi-asset' | 'random-window';
  symbols: string[];
  interval: string;
  config: Record<string, unknown>;
  summaryMetrics: Record<string, unknown>;
  createdAt: string;
}
