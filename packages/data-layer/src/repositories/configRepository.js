import { readJson, writeJson, DATA_FILES } from '../DatabaseManager.js';
import { DEFAULT_BINANCE_CONFIG } from '../../../shared/config.js';

// ─── Config Repository ────────────────────────────────────────────────────────

export function loadBinanceConfig() {
  const jsonConfig = readJson(DATA_FILES.binanceConfig, DEFAULT_BINANCE_CONFIG);
  
  // Merge with Environment Variables (Priority to .env / ENV)
  return {
    ...jsonConfig,
    apiKey: process.env.BINANCE_API_KEY || jsonConfig.apiKey || '',
    apiSecret: process.env.BINANCE_API_SECRET || jsonConfig.apiSecret || '',
    openRouterKey: process.env.OPENROUTER_API_KEY || jsonConfig.openRouterKey || '',
    openRouterModel: process.env.OPENROUTER_MODEL || jsonConfig.openRouterModel || 'meta-llama/llama-3.1-8b-instruct',
    telegramToken: process.env.TELEGRAM_TOKEN || jsonConfig.telegramToken || '',
    telegramChatId: process.env.TELEGRAM_CHAT_ID || jsonConfig.telegramChatId || ''
  };
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
