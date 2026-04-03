import * as sqlite from './sqlite.js';

export const defaultState = {
  isBotRunning: false,
  selectedStrategy: 'EMA',
  tpPercent: 2.0,
  slPercent: 1.0,
  paperState: { balance: 10000, position: 'NONE', entryPrice: 0, trades: 0, equity: 10000 },
  tradeHistory: []
};

// Paper State
export function loadPaperState() {
    return sqlite.getSetting('paperState', defaultState);
}

export function savePaperState(state) {
    sqlite.saveSetting('paperState', state);
}

// Gold Wallet
export function getGoldWallet() {
    return sqlite.getSetting('goldWallet', { balance: 10000, allTimeTrades: 0, allTimePnL: 0 });
}

export function saveGoldWallet(wallet) {
    sqlite.saveSetting('goldWallet', wallet);
}

// Bots
export function loadBots() {
    return sqlite.getAllBots();
}

export function saveBot(bot) {
    sqlite.saveBot(bot);
}

export function saveBots(botsMap) {
    for (const bot of botsMap.values()) {
        sqlite.saveBot(bot);
    }
}

export function saveBotTuningLog(log) {
    sqlite.saveBotTuningLog(log);
}

export function getTuningHistory(limit = 50) {
    return sqlite.getBotTuningHistory(limit);
}

// Trade Memory
export function saveTradeMemory(trade) {
    sqlite.saveTradeMemoryItem({
        symbol: trade.symbol,
        type: trade.type,
        pnl: trade.pnl || 0,
        strategy: trade.strategy,
        reason: trade.reason,
        entryPrice: trade.entryPrice,
        exitPrice: trade.exitPrice,
        exitTime: trade.exitTime,
        recordedAt: new Date().toISOString()
    });
}

// Configs
export function loadBinanceConfig() {
    return sqlite.getSetting('binanceConfig', { apiKey: '', apiSecret: '', openRouterKey: '', openRouterModel: 'deepseek/deepseek-chat' });
}

export function saveBinanceConfigToFile(config) {
    sqlite.saveSetting('binanceConfig', config);
}
