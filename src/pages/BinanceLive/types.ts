// ─── Shared Types for BinanceTestnet Feature ──────────────────────────────────

export const API = '';

export const STRATEGIES = [
  { value: 'EMA', label: 'EMA Crossover (20/50)' },
  { value: 'BB', label: 'BB Mean Reversion' },
  { value: 'RSI', label: 'RSI (30/70) Cross' },
  { value: 'EMA_RSI', label: '⚡ EMA + RSI' },
  { value: 'BB_RSI', label: '⚡ BB + RSI' },
  { value: 'EMA_BB_RSI', label: '⚡ EMA + BB + RSI' },
  { value: 'GRID', label: 'Grid Bot Simulation' },
  { value: 'AI_GRID', label: '🤖 AI Grid (Range Trading)' },
  { value: 'AI_GRID_SCALP', label: '⚡ AI Grid (Scalping - 15m)' },
  { value: 'AI_GRID_SWING', label: '🏛️ AI Grid (Swing - 1h)' },
  { value: 'AI_SCOUTER', label: '🏹 AI Scouting (5m Scalp)' },
];

export const INTERVALS = ['5m', '15m', '1h', '4h', '1d'];

export interface OpenPosition {
  id: string;
  type: string;
  entryPrice: number;
  entryTime: string;
  entryReason?: string;
  liqId?: number;
  initialMargin?: number;
}

export interface Trade {
  entryTime: string;
  exitTime: string;
  type: string;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  reason: string;
  symbol?: string;
  strategy?: string;
}

export interface Bot {
  id: string;
  isRunning: boolean;
  config: {
    symbol: string;
    interval: string;
    strategy: string;
    tpPercent: number;
    slPercent: number;
    capital: number;
    maxPositions?: number;
    leverage?: number;
    positionSizeUSDT?: number;
    exchange?: string;
    aiCheckInterval?: number;
    syncAiWithInterval?: boolean;
    aiReason?: string;
    aiModel?: string;
    aiType?: 'confident' | 'grid' | 'scout';
    gridLower?: number;
    gridUpper?: number;
    gridLayers?: number;
    durationMinutes?: number;
    groupName?: string;
    groupCapital?: number;
    groupTpPercent?: number;
    groupSlPercent?: number;
    useReflection?: boolean;
    groupId?: string;
    entry_steps?: any[];
    maxLossUSDT?: number;
  };
  openPositions: OpenPosition[];
  expiresAt?: string;
  capital: number;
  equity: number;
  currentCash: number;
  netPnl: number;
  netPnlPct: number;
  winRate: number;
  winCount: number;
  lossCount: number;
  totalTrades: number;
  lastSignal: string;
  lastChecked: string;
  lastAiCheck?: string;
  startedAt: string;
  aiReason?: string;
  lastAiModel?: string;
  currentPrice: number;
  unrealizedPnl: number;
  realizedPnl: number;
  realizedPnlPct?: number;
  trades: Trade[];
  aiHistory?: any[];
  useReflection?: boolean;
  reflectionStatus?: string | null;
  reflectionHistory?: any[];
  currentThought?: string;
  lastThoughtAt?: string;
  durationMinutes?: number;
}

export interface BinanceKeys {
  apiKey: string;
  apiSecret: string;
  openRouterKey: string;
  openRouterModel: string;
  hasKeys: boolean;
  hasOpenRouter: boolean;
}

export const statusColor = (pos: string) =>
  pos === 'LONG' ? 'var(--profit-color)' : pos === 'SHORT' ? 'var(--loss-color)' : 'var(--text-muted)';

export const formatPrice = (val: number) => {
  if (!val) return '0.00';
  const abs = Math.abs(val);
  if (abs < 0.001) return val.toFixed(8);
  if (abs < 1) return val.toFixed(6);
  if (abs < 100) return val.toFixed(4);
  return val.toFixed(2);
};
