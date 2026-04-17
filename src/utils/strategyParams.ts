// ─── Strategy Parameter Definitions ──────────────────────────────────────────
// Single source of truth for all strategy-specific parameters

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

export const STRATEGY_PARAMS: Record<string, ParamDef[]> = {
  EMA: [
    { key: 'fastPeriod', label: 'Fast EMA Period', type: 'number', default: 20, min: 2, max: 200, step: 1 },
    { key: 'slowPeriod', label: 'Slow EMA Period', type: 'number', default: 50, min: 5, max: 500, step: 1 },
  ],
  EMA_CROSS: [
    { key: 'fastPeriod', label: 'Fast EMA Period', type: 'number', default: 20, min: 2, max: 200, step: 1 },
    { key: 'slowPeriod', label: 'Slow EMA Period', type: 'number', default: 50, min: 5, max: 500, step: 1 },
  ],
  EMA_SCALP: [
    { key: 'fastPeriod', label: 'Fast EMA Period', type: 'number', default: 3, min: 2, max: 20, step: 1 },
    { key: 'slowPeriod', label: 'Slow EMA Period', type: 'number', default: 8, min: 3, max: 50, step: 1 },
  ],
  RSI: [
    { key: 'rsiPeriod', label: 'RSI Period', type: 'number', default: 14, min: 2, max: 50, step: 1 },
    { key: 'rsiOversold', label: 'Oversold Level', type: 'number', default: 30, min: 10, max: 49, step: 1, hint: 'BUY signal เมื่อ RSI ต่ำกว่านี้' },
    { key: 'rsiOverbought', label: 'Overbought Level', type: 'number', default: 70, min: 51, max: 90, step: 1, hint: 'SELL signal เมื่อ RSI สูงกว่านี้' },
  ],
  BB: [
    { key: 'bbPeriod', label: 'BB Period', type: 'number', default: 20, min: 5, max: 200, step: 1 },
    { key: 'bbStdDev', label: 'Std Dev Multiplier', type: 'number', default: 2, min: 0.5, max: 4, step: 0.5 },
  ],
  STOCH_RSI: [
    { key: 'rsiPeriod', label: 'RSI Period', type: 'number', default: 14, min: 2, max: 50, step: 1 },
    { key: 'stochPeriod', label: 'Stoch Period', type: 'number', default: 14, min: 2, max: 50, step: 1 },
    { key: 'oversold', label: 'Oversold Level', type: 'number', default: 20, min: 5, max: 49, step: 1 },
    { key: 'overbought', label: 'Overbought Level', type: 'number', default: 80, min: 51, max: 95, step: 1 },
  ],
  VWAP_SCALP: [
    { key: 'rsiPeriod', label: 'RSI Period', type: 'number', default: 9, min: 2, max: 30, step: 1 },
    { key: 'emaPeriod', label: 'EMA Period (VWAP fallback)', type: 'number', default: 20, min: 5, max: 100, step: 1 },
  ],
  EMA_RSI: [
    { key: 'fastPeriod', label: 'Fast EMA Period', type: 'number', default: 20, min: 2, max: 200, step: 1 },
    { key: 'slowPeriod', label: 'Slow EMA Period', type: 'number', default: 50, min: 5, max: 500, step: 1 },
    { key: 'rsiPeriod', label: 'RSI Period', type: 'number', default: 14, min: 2, max: 50, step: 1 },
  ],
  BB_RSI: [
    { key: 'bbPeriod', label: 'BB Period', type: 'number', default: 20, min: 5, max: 200, step: 1 },
    { key: 'bbStd', label: 'BB Std Dev', type: 'number', default: 2, min: 0.5, max: 4, step: 0.5 },
    { key: 'rsiPeriod', label: 'RSI Period', type: 'number', default: 14, min: 2, max: 50, step: 1 },
    { key: 'rsiBuy', label: 'RSI Buy Level', type: 'number', default: 30, min: 10, max: 49, step: 1 },
    { key: 'rsiSell', label: 'RSI Sell Level', type: 'number', default: 70, min: 51, max: 90, step: 1 },
  ],
  EMA_BB_RSI: [
    { key: 'fastPeriod', label: 'Fast EMA Period', type: 'number', default: 20, min: 2, max: 200, step: 1 },
    { key: 'slowPeriod', label: 'Slow EMA Period', type: 'number', default: 50, min: 5, max: 500, step: 1 },
    { key: 'bbPeriod', label: 'BB Period', type: 'number', default: 20, min: 5, max: 200, step: 1 },
    { key: 'bbStd', label: 'BB Std Dev', type: 'number', default: 2, min: 0.5, max: 4, step: 0.5 },
    { key: 'rsiPeriod', label: 'RSI Period', type: 'number', default: 14, min: 2, max: 50, step: 1 },
  ],
  GRID: [
    { key: 'gridUpper', label: 'Grid Upper Bound', type: 'number', default: 70000, min: 0, step: 100, hint: 'ราคาขอบบน — SHORT เมื่อราคาถึงจุดนี้' },
    { key: 'gridLower', label: 'Grid Lower Bound', type: 'number', default: 50000, min: 0, step: 100, hint: 'ราคาขอบล่าง — LONG เมื่อราคาถึงจุดนี้' },
  ],
  AI_SCOUTER: [
    { key: 'rsiPeriod', label: 'RSI Period', type: 'number', default: 14, min: 2, max: 50, step: 1 },
  ],
  SATS: [
    { key: 'atr_len', label: 'ATR Period', type: 'number', default: 14, min: 5, max: 50, step: 1 },
    { key: 'base_mult', label: 'Base Multiplier', type: 'number', default: 2.0, min: 1.0, max: 5.0, step: 0.1 },
    { key: 'er_len', label: 'ER Period', type: 'number', default: 20, min: 5, max: 100, step: 1 },
    { key: 'adx_len', label: 'ADX Period', type: 'number', default: 14, min: 5, max: 50, step: 1 },
    { key: 'tqi_min_entry', label: 'Min TQI Entry', type: 'number', default: 0.3, min: 0.1, max: 0.9, step: 0.05, hint: 'คุณภาพเทรนด์ขั้นต่ำในการเปิดออเดอร์' },
    { key: 'tqi_exit_floor', label: 'TQI Exit Floor', type: 'number', default: 0.18, min: 0.05, max: 0.5, step: 0.01, hint: 'หนีทันทีถ้าคความเชื่อมั่นร่วงต่ำกว่านี้' },
    { key: 'tqi_slope_threshold', label: 'TQI Slope Crash', type: 'number', default: -0.15, min: -0.5, max: -0.01, step: 0.01, hint: 'หนีเมื่อความมั่นใจดิ่งแรง (Slope)' },
  ],
};

/**
 * Get param definitions for a strategy key.
 * Returns empty array if no specific params defined.
 */
export function getStrategyParams(strategyKey: string): ParamDef[] {
  const key = strategyKey.toUpperCase().replace(/\s+/g, '_');
  return STRATEGY_PARAMS[key] ?? [];
}

/**
 * Build default params object for a strategy.
 */
export function getDefaultParams(strategyKey: string): Record<string, number | string> {
  return Object.fromEntries(getStrategyParams(strategyKey).map(p => [p.key, p.default]));
}
