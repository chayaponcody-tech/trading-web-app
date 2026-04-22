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
        aiLesson TEXT,
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
        recordedAt TEXT,
        aiLesson TEXT
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
        vaultBalance REAL DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS fleet_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fleetId TEXT,
        message TEXT,
        type TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS indicator_configs (
        id TEXT PRIMARY KEY,
        config_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ai_token_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feature TEXT NOT NULL,
        model TEXT NOT NULL,
        prompt_tokens INTEGER NOT NULL,
        completion_tokens INTEGER NOT NULL,
        total_tokens INTEGER NOT NULL,
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

    // Migrate fleets table
    const fleetColumns = db.prepare('PRAGMA table_info(fleets)').all();
    if (!fleetColumns.some(c => c.name === 'vaultBalance')) {
      db.exec('ALTER TABLE fleets ADD COLUMN vaultBalance REAL DEFAULT 0');
      console.log('✅ SQLite: Migrated fleets table — added vaultBalance');
    }

    // Migrate trades table
    const tradeColumns = db.prepare('PRAGMA table_info(trades)').all();
    if (!tradeColumns.some(c => c.name === 'entryTime')) {
      db.exec('ALTER TABLE trades ADD COLUMN entryTime TEXT');
      console.log('✅ SQLite: Migrated trades table — added entryTime');
    }
    if (!tradeColumns.some(c => c.name === 'fleetId')) {
      db.exec('ALTER TABLE trades ADD COLUMN fleetId TEXT');
      console.log('✅ SQLite: Migrated trades table — added fleetId');
    }
    if (!tradeColumns.some(c => c.name === 'aiLesson')) {
      db.exec('ALTER TABLE trades ADD COLUMN aiLesson TEXT');
      console.log('✅ SQLite: Migrated trades table — added aiLesson');
      
      // Perform Backfill: Sync old lessons from ai_memory to trades
      try {
        const result = db.prepare(`
          UPDATE trades 
          SET aiLesson = (
            SELECT aiLesson FROM ai_memory 
            WHERE ai_memory.symbol = trades.symbol AND ai_memory.exitTime = trades.exitTime
            LIMIT 1
          )
          WHERE aiLesson IS NULL
        `).run();
        if (result.changes > 0) {
          console.log(`🧠 SQLite: Backfilled ${result.changes} AI Lessons into Close History.`);
        }
      } catch (e) {
        console.warn('⚠️ SQLite: Backfill skip —', e.message);
      }
    }

    // Migrate ai_memory table
    const aiMemoryColumns = db.prepare('PRAGMA table_info(ai_memory)').all();
    if (aiMemoryColumns.length > 0 && !aiMemoryColumns.some(c => c.name === 'aiLesson')) {
      db.exec('ALTER TABLE ai_memory ADD COLUMN aiLesson TEXT');
      console.log('✅ SQLite: Migrated ai_memory table — added aiLesson');
    }

    // Migrate — add backtest tables if missing
    let backtestResultsColumns = [];
    try {
      backtestResultsColumns = db.prepare('PRAGMA table_info(backtest_results)').all();
    } catch {}
    
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

    // Migrate — add quant-engine tables if missing (Req 6.2, 6.4)
    const approvedStrategiesColumns = db.prepare('PRAGMA table_info(approved_strategies)').all();
    if (approvedStrategiesColumns.length === 0) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS approved_strategies (
          strategy_key    TEXT PRIMARY KEY,
          python_code     TEXT NOT NULL,
          backtest_metrics TEXT NOT NULL,
          approved_at     TEXT NOT NULL,
          status          TEXT NOT NULL DEFAULT 'active',
          lineage_id      TEXT NOT NULL,
          mutation_count  INTEGER NOT NULL DEFAULT 0,
          bot_id          TEXT,
          updated_at      TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_approved_strategies_status ON approved_strategies(status);
        CREATE INDEX IF NOT EXISTS idx_approved_strategies_lineage ON approved_strategies(lineage_id);
      `);
      console.log('✅ SQLite: Migrated — added approved_strategies table');
    }

    const sentimentScoresColumns = db.prepare('PRAGMA table_info(sentiment_scores)').all();
    if (sentimentScoresColumns.length === 0) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS sentiment_scores (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          symbol          TEXT NOT NULL,
          score           REAL NOT NULL,
          funding_rate    REAL NOT NULL,
          oi_change_pct   REAL NOT NULL,
          components      TEXT NOT NULL,
          timestamp       TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sentiment_scores_symbol_ts ON sentiment_scores(symbol, timestamp);
      `);
      console.log('✅ SQLite: Migrated — added sentiment_scores table');
    }

    const ohlcvMetadataColumns = db.prepare('PRAGMA table_info(ohlcv_metadata)').all();
    if (ohlcvMetadataColumns.length === 0) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS ohlcv_metadata (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          symbol          TEXT NOT NULL,
          interval        TEXT NOT NULL,
          last_updated    TEXT NOT NULL,
          row_count       INTEGER NOT NULL,
          parquet_path    TEXT NOT NULL,
          UNIQUE(symbol, interval)
        );
      `);
      console.log('✅ SQLite: Migrated — added ohlcv_metadata table');
    }

    const alphaDecayEventsColumns = db.prepare('PRAGMA table_info(alpha_decay_events)').all();
    if (alphaDecayEventsColumns.length === 0) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS alpha_decay_events (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          strategy_key    TEXT NOT NULL,
          decay_score     REAL NOT NULL,
          consecutive_losses INTEGER NOT NULL,
          rolling_sharpe_30d REAL NOT NULL,
          max_drawdown_7d REAL NOT NULL,
          action          TEXT NOT NULL,
          timestamp       TEXT NOT NULL
        );
      `);
      console.log('✅ SQLite: Migrated — added alpha_decay_events table');
    }

    const mutationHistoryColumns = db.prepare('PRAGMA table_info(mutation_history)').all();
    if (mutationHistoryColumns.length === 0) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS mutation_history (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          lineage_id      TEXT NOT NULL,
          parent_key      TEXT NOT NULL,
          child_key       TEXT NOT NULL,
          mutation_round  INTEGER NOT NULL,
          failure_reason  TEXT,
          decay_metrics   TEXT,
          created_at      TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_mutation_history_lineage ON mutation_history(lineage_id);
      `);
      console.log('✅ SQLite: Migrated — added mutation_history table');
    }

    const globalAiReportsColumns = db.prepare('PRAGMA table_info(global_ai_reports)').all();
    if (globalAiReportsColumns.length === 0) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS global_ai_reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          report_md TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ SQLite: Migrated — added global_ai_reports table');
    }

    // Migrate — add strategy management tables if missing (Req 1.1, 6.2)
    const strategyDefinitionsColumns = db.prepare('PRAGMA table_info(strategy_definitions)').all();
    if (strategyDefinitionsColumns.length === 0) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS strategy_definitions (
          id              TEXT PRIMARY KEY,
          name            TEXT NOT NULL UNIQUE,
          description     TEXT NOT NULL DEFAULT '',
          engineType      TEXT NOT NULL,
          defaultParams   TEXT NOT NULL DEFAULT '{}',
          tags            TEXT NOT NULL DEFAULT '[]',
          pythonCodeFile  TEXT,
          createdAt       TEXT NOT NULL,
          updatedAt       TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_strategy_definitions_engineType ON strategy_definitions(engineType);
        CREATE INDEX IF NOT EXISTS idx_strategy_definitions_updatedAt ON strategy_definitions(updatedAt DESC);
      `);
      console.log('✅ SQLite: Migrated — added strategy_definitions table');
    } else if (!strategyDefinitionsColumns.some(c => c.name === 'pythonCodeFile')) {
      db.exec('ALTER TABLE strategy_definitions ADD COLUMN pythonCodeFile TEXT');
      console.log('✅ SQLite: Migrated strategy_definitions — added pythonCodeFile');
    }

    if (!strategyDefinitionsColumns.some(c => c.name === 'baseStrategy')) {
      db.exec('ALTER TABLE strategy_definitions ADD COLUMN baseStrategy TEXT');
      console.log('✅ SQLite: Migrated strategy_definitions — added baseStrategy');
    }

    if (!strategyDefinitionsColumns.some(c => c.name === 'parameters')) {
      db.exec('ALTER TABLE strategy_definitions ADD COLUMN parameters TEXT DEFAULT "[]"');
      console.log('✅ SQLite: Migrated strategy_definitions — added parameters');
    }

    const strategyBacktestResultsColumns = db.prepare('PRAGMA table_info(strategy_backtest_results)').all();
    if (strategyBacktestResultsColumns.length === 0) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS strategy_backtest_results (
          backtestId     TEXT PRIMARY KEY,
          strategyId     TEXT NOT NULL,
          backtestType   TEXT NOT NULL,
          symbols        TEXT NOT NULL,
          interval       TEXT NOT NULL,
          config         TEXT NOT NULL,
          summaryMetrics TEXT NOT NULL,
          assetResults   TEXT NOT NULL,
          createdAt      TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_strategy_bt_results_strategyId ON strategy_backtest_results(strategyId, createdAt DESC);
      `);
      console.log('✅ SQLite: Migrated — added strategy_backtest_results table');
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
