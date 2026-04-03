import { readJson, writeJson, DATA_FILES } from '../DatabaseManager.js';
import { DEFAULT_BINANCE_CONFIG } from '../../../shared/config.js';

// ─── Config Repository ────────────────────────────────────────────────────────

export function loadBinanceConfig() {
  return readJson(DATA_FILES.binanceConfig, DEFAULT_BINANCE_CONFIG);
}

export function saveBinanceConfig(config) {
  return writeJson(DATA_FILES.binanceConfig, config);
}

export function patchBinanceConfig(patch) {
  const current = loadBinanceConfig();
  const updated = { ...current };
  // Only update keys that are provided and not masked
  for (const [key, val] of Object.entries(patch)) {
    if (val !== undefined && val !== '' && val !== '********') {
      updated[key] = val;
    }
  }
  return saveBinanceConfig(updated);
}

export function loadPaperState() {
  return readJson(DATA_FILES.paperState, null);
}

export function savePaperState(state) {
  return writeJson(DATA_FILES.paperState, state);
}
