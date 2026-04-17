/**
 * PythonStrategyClient.js
 * Calls the strategy-ai service for signals on candle windows.
 * Caches responses by window hash to avoid redundant HTTP calls.
 */

import { loadBinanceConfig } from '../../data-layer/src/repositories/configRepository.js';

const cache = new Map();

/**
 * Call strategy-ai service for a signal on a candle window.
 * @param {string} strategyKey - strategy name without "PYTHON:" prefix
 * @param {object} window - { closes, highs, lows, volumes, params, symbol }
 * @returns {Promise<{ signal: 'LONG'|'SHORT'|'NONE', confidence: number|null }>}
 */
export async function getPythonSignal(strategyKey, window) {
  const cacheKey = JSON.stringify(window.closes.slice(-50));

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const { strategyAiUrl } = loadBinanceConfig();
  const url = `${strategyAiUrl}/strategy/analyze`;

  const payload = {
    symbol: window.symbol,
    strategy: strategyKey,
    closes: window.closes,
    highs: window.highs,
    lows: window.lows,
    volumes: window.volumes,
    params: window.params,
  };

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('Strategy AI service unavailable');
  }

  const data = await response.json();
  const result = { signal: data.signal, confidence: data.confidence ?? null };

  cache.set(cacheKey, result);
  return result;
}

/**
 * Call strategy-ai service for signals on an entire OHLCV dataset (batch mode).
 * @param {string} strategyKey - strategy name without "PYTHON:" prefix
 * @param {object} payload - { closes, highs, lows, volumes, params, symbol }
 * @returns {Promise<{ signals: string[], confidences: number[] }>}
 */
export async function getBatchSignals(strategyKey, payload) {
  const { strategyAiUrl } = loadBinanceConfig();
  const url = `${strategyAiUrl}/strategy/analyze/batch`;

  const body = {
    strategy: strategyKey,
    closes: payload.closes,
    highs: payload.highs,
    lows: payload.lows,
    volumes: payload.volumes,
    params: payload.params,
    symbol: payload.symbol,
  };

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Strategy AI service unavailable');
  }

  const data = await response.json();

  if (!response.ok || !Array.isArray(data.signals)) {
    const detail = data.detail || data.error || `HTTP ${response.status}`;
    throw new Error(`Strategy AI batch error: ${detail}`);
  }

  return { signals: data.signals, confidences: data.confidences ?? [], metadatas: data.metadatas ?? [] };
}

/**
 * Call strategy-ai service to optimize strategy parameters via Bayesian search.
 * @param {string} strategyKey - strategy name without "PYTHON:" prefix
 * @param {object} payload - { closes, highs, lows, volumes, search_space, n_trials? }
 * @returns {Promise<{ best_params: object, best_sharpe: number, n_trials: number }>}
 */
export async function optimizeStrategy(strategyKey, payload) {
  const { strategyAiUrl } = loadBinanceConfig();
  const url = `${strategyAiUrl}/strategy/optimize`;

  const body = {
    strategy: strategyKey,
    closes: payload.closes,
    highs: payload.highs ?? [],
    lows: payload.lows ?? [],
    volumes: payload.volumes ?? [],
    search_space: payload.search_space,
    n_trials: payload.n_trials ?? 50,
  };

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Strategy AI service unavailable');
  }

  const data = await response.json();
  return { best_params: data.best_params, best_sharpe: data.best_sharpe, n_trials: data.n_trials };
}

/**
 * Call strategy-ai service to optimize strategy parameters via VectorBT grid sweep.
 * Faster than Bayesian search for small-to-medium search spaces.
 * Falls back to pure NumPy simulation if vectorbt is not installed on the server.
 *
 * @param {string} strategyKey - strategy name
 * @param {object} payload - { closes, highs, lows, volumes, search_space, n_trials?, fees?, slippage?, init_cash? }
 * @returns {Promise<{ best_params: object, best_sharpe: number, best_return: number, best_max_drawdown: number, n_trials: number, engine: string }>}
 */
export async function optimizeStrategyVbt(strategyKey, payload) {
  const { strategyAiUrl } = loadBinanceConfig();
  const url = `${strategyAiUrl}/strategy/optimize/vectorbt`;

  const body = {
    strategy: strategyKey,
    closes: payload.closes,
    highs: payload.highs ?? [],
    lows: payload.lows ?? [],
    volumes: payload.volumes ?? [],
    search_space: payload.search_space,
    n_trials: payload.n_trials ?? 50,
    fees: payload.fees ?? 0.0004,
    slippage: payload.slippage ?? 0.0005,
    init_cash: payload.init_cash ?? 1000.0,
  };

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Strategy AI service unavailable');
  }

  const data = await response.json();
  return {
    best_params: data.best_params,
    best_sharpe: data.best_sharpe,
    best_return: data.best_return,
    best_max_drawdown: data.best_max_drawdown,
    n_trials: data.n_trials,
    engine: data.engine,
  };
}

/**
 * Clear the in-memory cache. Used for testing purposes.
 */
export function clearCache() {
  cache.clear();
}
