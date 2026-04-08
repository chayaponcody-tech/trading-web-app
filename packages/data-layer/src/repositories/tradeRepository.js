import { readJson, writeJson, DATA_FILES, db, useSqlite } from '../DatabaseManager.js';

// ─── Trade Repository ─────────────────────────────────────────────────────────

export function getTradeMemory(limit = 100) {
  if (useSqlite) {
     try {
       const rows = db.prepare('SELECT * FROM ai_memory ORDER BY recordedAt DESC LIMIT ?').all(limit);
       return rows;
     } catch { return []; }
  }
  const all = readJson(DATA_FILES.tradeMemory, []);
  return all.slice(-limit);
}

export function appendTrade(trade) {
  if (useSqlite) {
    try {
      // 1. Insert into ai_memory (Historical Insight)
      db.prepare(`
        INSERT INTO ai_memory (symbol, type, pnl, strategy, reason, entryPrice, exitPrice, exitTime, recordedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        trade.symbol,
        trade.type,
        trade.pnl || 0,
        trade.strategy,
        trade.reason,
        trade.entryPrice,
        trade.exitPrice,
        trade.exitTime,
        new Date().toISOString()
      );

      // 2. Insert into trades (Close History UI)
      db.prepare(`
        INSERT INTO trades (botId, symbol, type, entryPrice, exitPrice, pnl, entryTime, exitTime, reason, strategy, entryReason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        trade.botId,
        trade.symbol,
        trade.type,
        trade.entryPrice,
        trade.exitPrice,
        trade.pnl || 0,
        trade.entryTime || null,
        trade.exitTime,
        trade.reason,
        trade.strategy,
        trade.entryReason
      );

      return true;
    } catch (e) { 
      console.error('[TradeRepo] appendTrade error:', e.message);
      return false; 
    }
  }
  const history = readJson(DATA_FILES.tradeMemory, []);
  history.push({ ...trade, recordedAt: new Date().toISOString() });
  return writeJson(DATA_FILES.tradeMemory, history.slice(-200));
}

export function getAllTradesFromBots(botsMap) {
  if (useSqlite) {
    try {
      // From SQLite, we might want all trades ever recorded in 'trades' table
      const rows = db.prepare('SELECT * FROM trades ORDER BY exitTime DESC').all();
      return rows;
    } catch { return []; }
  }
  const all = [];
  for (const bot of botsMap.values()) {
    if (!bot.trades) continue;
    bot.trades.forEach((t) =>
      all.push({
        ...t,
        symbol: t.symbol || bot.config?.symbol,
        strategy: t.strategy || bot.config?.strategy,
      })
    );
  }
  return all.sort((a, b) => new Date(b.exitTime || 0) - new Date(a.exitTime || 0));
}

// ─── AI Mistakes Repository ──────────────────────────────────────────────────

export function saveMistake(mistake) {
  if (useSqlite) {
    try {
      db.prepare(`
        INSERT INTO trade_mistakes (botId, symbol, strategy, entryPrice, exitPrice, pnl, marketContext, aiLesson)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        mistake.botId,
        mistake.symbol,
        mistake.strategy,
        mistake.entryPrice || 0,
        mistake.exitPrice || 0,
        mistake.pnl || 0,
        mistake.marketContext || '',
        mistake.aiLesson || ''
      );
      return true;
    } catch (e) {
      console.error('[TradeRepo] saveMistake SQL error:', e.message);
      return false;
    }
  }
  return false;
}

export function getRecentMistakes(symbol, limit = 5) {
  if (useSqlite) {
    try {
      return db.prepare(`
        SELECT * FROM trade_mistakes 
        WHERE (symbol = ? OR symbol IS NULL)
        ORDER BY recordedAt DESC LIMIT ?
      `).all(symbol, limit);
    } catch { return []; }
  }
  return [];
}
