import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const rootDir = process.cwd();
const dbPath = path.join(rootDir, 'trading_app.db');

// ─── Core Engine State ────────────────────────────────────────────────────────
export let useSqlite = false;
export let db = null;

export function initDb() {
  if (db) return db;
  try {
    const Database = require('better-sqlite3');
    db = new Database(dbPath);
    
    // Initialize Schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS bots (
        id TEXT PRIMARY KEY, 
        config TEXT, 
        isRunning INTEGER DEFAULT 0, 
        startedAt TEXT,
        lastSignal TEXT, 
        lastAiModel TEXT, 
        lastEntryReason TEXT, 
        unrealizedPnl REAL DEFAULT 0,
        netPnl REAL DEFAULT 0, 
        totalTrades INTEGER DEFAULT 0, 
        winCount INTEGER DEFAULT 0, 
        lossCount INTEGER DEFAULT 0,
        lastChecked TEXT, 
        currentPrice REAL, 
        equity REAL, 
        currentCash REAL,
        openPositions TEXT, 
        aiHistory TEXT, 
        reflectionHistory TEXT,
        expiresAt TEXT
      );
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        botId TEXT, 
        symbol TEXT, 
        type TEXT,
        entryPrice REAL, 
        exitPrice REAL, 
        pnl REAL, 
        entryTime TEXT,
        exitTime TEXT, 
        reason TEXT,
        strategy TEXT, 
        entryReason TEXT, 
        recordedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ai_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        symbol TEXT, 
        type TEXT, 
        pnl REAL, 
        strategy TEXT,
        reason TEXT, 
        entryPrice REAL, 
        exitPrice REAL, 
        exitTime TEXT, 
        recordedAt TEXT
      );
      CREATE TABLE IF NOT EXISTS bot_tuning_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        botId TEXT,
        symbol TEXT,
        oldParams TEXT,
        newParams TEXT,
        reasoning TEXT,
        marketCondition TEXT,
        engine TEXT DEFAULT 'optuna',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS telegram_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        direction TEXT, 
        chatId TEXT, 
        message TEXT, 
        recordedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS trade_mistakes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        botId TEXT,
        symbol TEXT,
        strategy TEXT,
        entryPrice REAL,
        exitPrice REAL,
        pnl REAL,
        marketContext TEXT,
        aiLesson TEXT,
        recordedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS fleets (
        id TEXT PRIMARY KEY,
        name TEXT,
        config TEXT,
        isRunning INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS fleet_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fleetId TEXT,
        message TEXT,
        type TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // --- MIGRATIONS ---
    const columns = db.prepare('PRAGMA table_info(bots)').all();
    const hasExpiresAt = columns.some(c => c.name === 'expiresAt');
    if (!hasExpiresAt) {
      db.exec('ALTER TABLE bots ADD COLUMN expiresAt TEXT');
      console.log('✅ SQLite: Migrated bots table — added expiresAt');
    }

    // Migrate trades table — add entryTime if missing
    const tradeColumns = db.prepare('PRAGMA table_info(trades)').all();
    if (!tradeColumns.some(c => c.name === 'entryTime')) {
      db.exec('ALTER TABLE trades ADD COLUMN entryTime TEXT');
      console.log('✅ SQLite: Migrated trades table — added entryTime');
    }

    // Migrate — add backtest tables if missing
    const backtestResultsColumns = db.prepare('PRAGMA table_info(backtest_results)').all();
    if (backtestResultsColumns.length === 0) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS backtest_results (
          backtestId  TEXT PRIMARY KEY,
          symbol      TEXT NOT NULL,
          strategy    TEXT NOT NULL,
          interval    TEXT NOT NULL,
          config      TEXT NOT NULL,
          metrics     TEXT NOT NULL,
          createdAt   TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS backtest_trades (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          backtestId  TEXT NOT NULL,
          symbol      TEXT,
          type        TEXT,
          entryPrice  REAL,
          exitPrice   REAL,
          entryTime   TEXT,
          exitTime    TEXT,
          pnl         REAL,
          pnlPct      REAL,
          exitReason  TEXT,
          FOREIGN KEY (backtestId) REFERENCES backtest_results(backtestId)
        );
      `);
      console.log('✅ SQLite: Migrated — added backtest_results and backtest_trades tables');
    }
    
    useSqlite = true;
    console.log('✅ DataLayer: SQLite Engine Active');
    return db;
  } catch (err) {
    console.warn('⚠️ DataLayer: SQLite failed. Falling back to JSON.', err.message);
    useSqlite = false;
    return null;
  }
}

// ─── Legacy JSON Paths (Fallback) ─────────────────────────────────────────────
export const DATA_FILES = {
  bots: path.join(rootDir, 'forward-bots-db.json'),
  tradeMemory: path.join(rootDir, 'trade-memory.json'),
  paperState: path.join(rootDir, 'paper-trading-db.json'),
  binanceConfig: path.join(rootDir, 'binance-config.json'),
  goldWallet: path.join(rootDir, 'gold-wallet.json'),
};

// ─── Unified Data Access API ──────────────────────────────────────────────────

export function readJson(filePath, defaultValue = null) {
  if (useSqlite) {
     const key = path.basename(filePath, '.json').replace(/-[a-z]/g, m => m[1].toUpperCase());
     try {
       const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
       return row ? JSON.parse(row.value) : defaultValue;
     } catch { return defaultValue; }
  }
  
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return defaultValue;
  }
}

export function writeJson(filePath, data) {
  if (useSqlite) {
    const key = path.basename(filePath, '.json').replace(/-[a-z]/g, m => m[1].toUpperCase());
    try {
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, JSON.stringify(data));
      return true;
    } catch { return false; }
  }
  
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    return false;
  }
}

// Ensure DB is initialized
initDb();
