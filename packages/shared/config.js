// ─── Shared Configuration ─────────────────────────────────────────────────────
// Constants and configuration used across all packages.

export const TZ_OPTS = { timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'medium' };

export const STRATEGIES = [
  { value: 'EMA',         label: 'EMA Crossover (20/50)' },
  { value: 'BB',          label: 'BB Mean Reversion' },
  { value: 'RSI',         label: 'RSI (30/70) Cross' },
  { value: 'EMA_RSI',     label: '⚡ EMA + RSI' },
  { value: 'BB_RSI',      label: '⚡ BB + RSI' },
  { value: 'EMA_BB_RSI',  label: '⚡ EMA + BB + RSI' },
  { value: 'GRID',        label: 'Grid Bot Simulation' },
  { value: 'AI_GRID',     label: '🤖 AI Grid Trading' },
  { value: 'AI_SCOUTER',  label: '🏹 AI Scouting (5m Scalp)' },
];

export const DEFAULT_BOT_CONFIG = {
  symbol: 'BTCUSDT',
  interval: '1h',
  strategy: 'EMA',
  tpPercent: 2.0,
  slPercent: 1.0,
  leverage: 10,
  positionSizeUSDT: 100,
  exchange: 'binance_testnet',
  durationMinutes: 0,
  aiCheckInterval: 30,
  useReflection: false,
};

export const DEFAULT_BINANCE_CONFIG = {
  apiKey: '',
  apiSecret: '',
  openRouterKey: '',
  openRouterModel: 'google/gemini-2.0-flash-exp:free',
};

export const PORT = parseInt(process.env.PORT || '4001', 10);
