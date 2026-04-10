import { EMACross } from './strategies/EMACross.js';
import { RSIStrategy } from './strategies/RSI.js';
import { BollingerBandsStrategy } from './strategies/BollingerBands.js';
import { GridStrategy } from './strategies/Grid.js';
import { ScouterStrategy } from './strategies/Scouter.js';
import { EMA_RSI, BB_RSI, EMA_BB_RSI } from './strategies/Composite.js';
import { EMAScalpStrategy } from './strategies/EMAScalp.js';
import { StochRSIStrategy } from './strategies/StochRSI.js';
import { VWAPScalpStrategy } from './strategies/VWAPScalp.js';

// ─── Signal Engine ────────────────────────────────────────────────────────────
// The single source of truth for all technical signal computations.
// Now modularized to allow easy extension.

const MIN_CANDLES = 50;

// ─── Strategy Registry ────────────────────────────────────────────────────────

const STRATEGY_REGISTRY = {
  EMA:         EMACross,
  EMA_CROSS:   EMACross,
  RSI:         RSIStrategy,
  BB:          BollingerBandsStrategy,
  GRID:        GridStrategy,
  AI_GRID:     GridStrategy,
  AI_GRID_SCALP: GridStrategy,
  AI_GRID_SWING: GridStrategy,
  AI_SCOUTER:  ScouterStrategy,
  EMA_RSI:     EMA_RSI,
  BB_RSI:      BB_RSI,
  EMA_BB_RSI:  EMA_BB_RSI,
  // ─── Scalping Strategies ───────────────────────────────────────────────────
  EMA_SCALP:   EMAScalpStrategy,
  STOCH_RSI:   StochRSIStrategy,
  VWAP_SCALP:  VWAPScalpStrategy,
  // Add more here...
};


/**
 * Compute trading signal for a given strategy.
 * @param {number[]} closes - Array of close prices (oldest → newest)
 * @param {string} strategy - Strategy key
 * @param {object} [options] - Strategy-specific options
 * @returns {'LONG'|'SHORT'|'NONE'}
 */
export function computeSignal(closes, strategy, options = {}) {
  if (closes.length < MIN_CANDLES) return 'NONE';
  
  const strat = STRATEGY_REGISTRY[strategy];
  if (!strat) {
    console.warn(`[SignalEngine] Unknown strategy: ${strategy}`);
    return 'NONE';
  }
  
  return strat.compute(closes, options);
}

/**
 * Generate a human-readable Thai entry reason for a signal.
 */
export function generateEntryReason(signal, strategy, closes = [], options = {}) {
  if (signal === 'NONE') return '';
  
  const strat = STRATEGY_REGISTRY[strategy];
  if (!strat || !strat.describe || typeof strat.describe !== 'function') {
    return `เข้าตามกลยุทธ์ ${strategy} (${signal})`;
  }
  
  return strat.describe(signal, options, closes);
}

/**
 * Generate a diagnostic "thought" for why a bot is in its current state.
 */
export function generateDiagnostic(strategy, closes = [], options = {}) {
  const strat = STRATEGY_REGISTRY[strategy];
  if (!strat || !strat.getDiagnostic || typeof strat.getDiagnostic !== 'function') {
    return `กำลังวิเคราะห์ตลาดด้วยกลยุทธ์ ${strategy}...`;
  }
  
  return strat.getDiagnostic(closes, options);
}

