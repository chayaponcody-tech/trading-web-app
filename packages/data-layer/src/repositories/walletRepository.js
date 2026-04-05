import { readJson, writeJson, DATA_FILES } from '../DatabaseManager.js';

/**
 * Main Crypto Wallet (Paper Trading)
 */
export function getWallet() {
  const data = readJson(DATA_FILES.paperState);
  const defaultWallet = { balance: 10000, position: 'NONE', entryPrice: 0, trades: 0, equity: 10000, allTimePnL: 0 };
  return { ...defaultWallet, ...(data?.paperState || {}) };
}


export function updateWallet(paperState) {
  const fullData = readJson(DATA_FILES.paperState) || {};
  fullData.paperState = paperState;
  return writeJson(DATA_FILES.paperState, fullData);
}

/**
 * Gold Wallet
 */
export function getGoldWallet() {
  const data = readJson(DATA_FILES.goldWallet, {});
  const defaultGold = { balance: 10000, allTimeTrades: 0, allTimePnL: 0 };
  return { ...defaultGold, ...data };
}


export function updateGoldWallet(data) {
  return writeJson(DATA_FILES.goldWallet, data);
}
