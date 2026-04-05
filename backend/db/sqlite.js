import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const rootDir = process.cwd();
const dbPath = path.join(rootDir, 'trading_app.db');

// --- Dual-Mode Database Engine ---
let useSqlite = false;
let db = null;

async function initDb() {
    try {
        const Database = require('better-sqlite3');
        db = new Database(dbPath);
        useSqlite = true;
        
        // Initialize Tables
        db.exec(`
          CREATE TABLE IF NOT EXISTS bots (
            id TEXT PRIMARY KEY, config TEXT, isRunning INTEGER DEFAULT 0, startedAt TEXT,
            lastSignal TEXT, lastAiModel TEXT, lastEntryReason TEXT, unrealizedPnl REAL DEFAULT 0,
            netPnl REAL DEFAULT 0, totalTrades INTEGER DEFAULT 0, grossProfit REAL DEFAULT 0,
            grossLoss REAL DEFAULT 0, winCount INTEGER DEFAULT 0, lossCount INTEGER DEFAULT 0,
            lastChecked TEXT, currentPrice REAL, equity REAL, currentCash REAL,
            openPositions TEXT, aiHistory TEXT, reflectionHistory TEXT, trades TEXT
          );
          CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
          CREATE TABLE IF NOT EXISTS trades (
            id INTEGER PRIMARY KEY AUTOINCREMENT, botId TEXT, symbol TEXT, type TEXT,
            entryPrice REAL, exitPrice REAL, pnl REAL, exitTime TEXT, reason TEXT,
            strategy TEXT, entryReason TEXT, recordedAt DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS trade_memory (
            id INTEGER PRIMARY KEY AUTOINCREMENT, symbol TEXT, type TEXT, pnl REAL, strategy TEXT,
            reason TEXT, entryPrice REAL, exitPrice REAL, exitTime TEXT, recordedAt TEXT
          );
          CREATE TABLE IF NOT EXISTS bot_tuning_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT, botId TEXT, symbol TEXT, 
            oldParams TEXT, newParams TEXT, reasoning TEXT, marketCondition TEXT,
            recordedAt DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS telegram_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT, direction TEXT, chatId TEXT, 
            message TEXT, recordedAt DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // Migration: Ensure trades column exists in bots table
        try {
            db.prepare('ALTER TABLE bots ADD COLUMN trades TEXT').run();
            console.log('✅ SQLite Migration: Added trades column to bots table');
        } catch (e) {
            // Column already exists, ignore
        }
        
        console.log('✅ SQLite Mode Active');
    } catch (err) {
        console.warn('⚠️ SQLite engine not found. Running in JSON-Fallback Mode.');
        useSqlite = false;
    }
}

initDb();

// Unified Path Resolver for Fallback Mode
const getFallbackPath = (key) => {
    const fileMap = {
        'binanceConfig': 'binance-config.json',
        'paperState': 'paper-trading-db.json',
        'goldWallet': 'gold-wallet.json',
        'bots': 'forward-bots-db.json',
        'tradeMemory': 'trade-memory.json'
    };
    const fileName = fileMap[key];
    return fileName ? path.join(rootDir, fileName) : null;
};

// --- Unified API ---

export function getSetting(key, defaultValue = null) {
    if (useSqlite) {
        try {
            const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
            return row ? JSON.parse(row.value) : defaultValue;
        } catch { return defaultValue; }
    } else {
        const filePath = getFallbackPath(key);
        if (filePath && fs.existsSync(filePath)) {
            try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return defaultValue; }
        }
        return defaultValue;
    }
}

export function saveSetting(key, value) {
    if (useSqlite) {
        try { db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, JSON.stringify(value)); } catch {}
    } else {
        const filePath = getFallbackPath(key);
        if (filePath) fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
    }
}

export function getAllBots() {
    if (useSqlite) {
        try {
            const rows = db.prepare('SELECT * FROM bots').all();
            return rows.map(b => ({
                ...b,
                config: JSON.parse(b.config || '{}'),
                openPositions: JSON.parse(b.openPositions || '[]'),
                aiHistory: JSON.parse(b.aiHistory || '[]'),
                reflectionHistory: JSON.parse(b.reflectionHistory || '[]'),
                trades: JSON.parse(b.trades || '[]'),
                isRunning: b.isRunning === 1
            }));
        } catch { return []; }
    } else {
        const filePath = getFallbackPath('bots');
        if (fs.existsSync(filePath)) {
            try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return []; }
        }
        return [];
    }
}

export function saveBot(bot) {
    if (useSqlite) {
        try {
            const stmt = db.prepare(`
                INSERT OR REPLACE INTO bots (
                    id, config, isRunning, startedAt, lastSignal, lastAiModel, lastEntryReason,
                    unrealizedPnl, netPnl, totalTrades, grossProfit, grossLoss, winCount, lossCount,
                    lastChecked, currentPrice, equity, currentCash, openPositions, aiHistory, reflectionHistory, trades
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            `);
            stmt.run(
                bot.id, JSON.stringify(bot.config), bot.isRunning ? 1 : 0, bot.startedAt,
                bot.lastSignal, bot.lastAiModel, bot.lastEntryReason, bot.unrealizedPnl || 0,
                bot.netPnl || 0, bot.totalTrades || 0, bot.grossProfit || 0, bot.grossLoss || 0,
                bot.winCount || 0, bot.lossCount || 0, bot.lastChecked, bot.currentPrice,
                bot.equity, bot.currentCash, JSON.stringify(bot.openPositions || []),
                JSON.stringify(bot.aiHistory || []), JSON.stringify(bot.reflectionHistory || []),
                JSON.stringify(bot.trades || [])
            );
        } catch {}
    } else {
        const bots = getAllBots();
        const idx = bots.findIndex(b => b.id === bot.id);
        if (idx >= 0) bots[idx] = bot; else bots.push(bot);
        fs.writeFileSync(getFallbackPath('bots'), JSON.stringify(bots, null, 2));
    }
}

export function addTrade(trade) {
    if (useSqlite) {
        try {
            const stmt = db.prepare(`
                INSERT INTO trades (botId, symbol, type, entryPrice, exitPrice, pnl, exitTime, reason, strategy, entryReason)
                VALUES (?,?,?,?,?,?,?,?,?,?)
            `);
            stmt.run(trade.botId, trade.symbol, trade.type, trade.entryPrice, trade.exitPrice, trade.pnl, trade.exitTime, trade.reason, trade.strategy, trade.entryReason);
        } catch {}
    }
}

export function saveTradeMemoryItem(item) {
    if (useSqlite) {
        try {
            const stmt = db.prepare(`
                INSERT INTO trade_memory (symbol, type, pnl, strategy, reason, entryPrice, exitPrice, exitTime, recordedAt)
                VALUES (?,?,?,?,?,?,?,?,?)
            `);
            stmt.run(item.symbol, item.type, item.pnl, item.strategy, item.reason, item.entryPrice, item.exitPrice, item.exitTime, item.recordedAt);
        } catch {}
    } else {
        const filePath = getFallbackPath('tradeMemory');
        if (filePath && fs.existsSync(filePath)) {
            try {
                const history = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                history.push(item);
                fs.writeFileSync(filePath, JSON.stringify(history.slice(-100), null, 2));
            } catch {}
        }
    }
}

export function saveBotTuningLog(log) {
    if (useSqlite) {
        try {
            const stmt = db.prepare(`
                INSERT INTO bot_tuning_history (botId, symbol, oldParams, newParams, reasoning, marketCondition)
                VALUES (?,?,?,?,?,?)
            `);
            stmt.run(log.botId, log.symbol, JSON.stringify(log.oldParams), JSON.stringify(log.newParams), log.reasoning, log.marketCondition);
        } catch {}
    }
}

export function getBotTuningHistory(limit = 50) {
    if (useSqlite) {
        try {
            return db.prepare('SELECT * FROM bot_tuning_history ORDER BY id DESC LIMIT ?').all(limit);
        } catch { return []; }
    }
    return [];
}

export function deleteAllBots() {
    if (useSqlite) {
        try {
            db.prepare('DELETE FROM bots').run();
            db.prepare('DELETE FROM trades').run();
            db.prepare('VACUUM').run();
            return true;
        } catch (e) {
            console.error('[SQLite] deleteAllBots error:', e.message);
            return false;
        }
    } else {
        const filePath = getFallbackPath('bots');
        if (fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify([], null, 2));
            return true;
        }
        return false;
    }
}

export function getTradeMemory(limit = 100) {
    if (useSqlite) {
        try { return db.prepare('SELECT * FROM trade_memory ORDER BY id DESC LIMIT ?').all(limit); } catch { return []; }
    } else {
        const filePath = getFallbackPath('tradeMemory');
        if (filePath && fs.existsSync(filePath)) {
            try { return JSON.parse(fs.readFileSync(filePath, 'utf8')).slice(-limit); } catch { return []; }
        }
        return [];
    }
}

export function saveTelegramLog(direction, chatId, message) {
    if (useSqlite) {
        try { 
          db.prepare('INSERT INTO telegram_logs (direction, chatId, message) VALUES (?, ?, ?)')
            .run(direction, chatId, message); 
        } catch {}
    }
}

export function getTelegramLogs(limit = 100) {
    if (useSqlite) {
        try { return db.prepare('SELECT * FROM telegram_logs ORDER BY id DESC LIMIT ?').all(limit); } catch { return []; }
    }
    return [];
}

export { initDb };
export default db;
