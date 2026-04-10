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
 * Clear the in-memory cache. Used for testing purposes.
 */
export function clearCache() {
  cache.clear();
}
