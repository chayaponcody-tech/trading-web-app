import { readJson, writeJson, DATA_FILES, db, useSqlite } from '../DatabaseManager.js';

// ─── Bot Repository ──────────────────────────────────────────────────────────
// Swapped from JSON-persistence to direct SQLite persistence.

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
        isRunning: b.isRunning === 1
      }));
    } catch (e) {
      console.error('[BotRepo] getAllBots SQL error:', e.message);
      return [];
    }
  }
  return readJson(DATA_FILES.bots, []);
}

export function saveAllBots(bots) {
  if (useSqlite) {
    // Transactional save for all bots
    const insert = db.prepare(`
      INSERT OR REPLACE INTO bots (
        id, config, isRunning, startedAt, lastSignal, lastAiModel, lastEntryReason,
        unrealizedPnl, netPnl, totalTrades, winCount, lossCount, lastChecked,
        currentPrice, equity, currentCash, openPositions, aiHistory,
        reflectionHistory, expiresAt
      ) VALUES (
        @id, @config, @isRunning, @startedAt, @lastSignal, @lastAiModel, @lastEntryReason,
        @unrealizedPnl, @netPnl, @totalTrades, @winCount, @lossCount, @lastChecked,
        @currentPrice, @equity, @currentCash, @openPositions, @aiHistory,
        @reflectionHistory, @expiresAt
      )
    `);
    
    const trx = db.transaction((list) => {
      for (const bot of list) {
        insert.run({
          id: bot.id,
          config: JSON.stringify(bot.config || {}),
          isRunning: bot.isRunning ? 1 : 0,
          startedAt: bot.startedAt,
          lastSignal: bot.lastSignal,
          lastAiModel: bot.lastAiModel,
          lastEntryReason: bot.lastEntryReason,
          unrealizedPnl: bot.unrealizedPnl || 0,
          netPnl: bot.netPnl || 0,
          totalTrades: bot.totalTrades || 0,
          winCount: bot.winCount || 0,
          lossCount: bot.lossCount || 0,
          lastChecked: bot.lastChecked,
          currentPrice: bot.currentPrice || 0,
          equity: bot.equity || 0,
          currentCash: bot.currentCash || 0,
          openPositions: JSON.stringify(bot.openPositions || []),
          aiHistory: JSON.stringify(bot.aiHistory || []),
          reflectionHistory: JSON.stringify(bot.reflectionHistory || []),
          expiresAt: bot.expiresAt
        });
      }
    });
    
    try {
      trx(bots);
      return true;
    } catch (e) {
      console.error('[BotRepo] saveAllBots SQL error:', e.message);
      return false;
    }
  }
  
  const sanitized = bots.map((bot) => ({ ...bot, lastCandle: null }));
  return writeJson(DATA_FILES.bots, sanitized);
}

export function getBotById(id) {
  if (useSqlite) {
    try {
      const b = db.prepare('SELECT * FROM bots WHERE id = ?').get(id);
      if (!b) return null;
      return {
        ...b,
        config: JSON.parse(b.config || '{}'),
        openPositions: JSON.parse(b.openPositions || '[]'),
        aiHistory: JSON.parse(b.aiHistory || '[]'),
        reflectionHistory: JSON.parse(b.reflectionHistory || '[]'),
        isRunning: b.isRunning === 1
      };
    } catch { return null; }
  }
  const bots = getAllBots();
  return bots.find((b) => b.id === id) || null;
}

export function upsertBot(bot) {
  if (useSqlite) {
    return saveAllBots([bot]);
  }
  const bots = getAllBots();
  const idx = bots.findIndex((b) => b.id === bot.id);
  if (idx >= 0) bots[idx] = { ...bot, lastCandle: null };
  else bots.push({ ...bot, lastCandle: null });
  return writeJson(DATA_FILES.bots, bots);
}

export function deleteBot(id) {
  if (useSqlite) {
    try {
      db.prepare('DELETE FROM bots WHERE id = ?').run(id);
      return true;
    } catch { return false; }
  }
  const bots = getAllBots().filter((b) => b.id !== id);
  return writeJson(DATA_FILES.bots, bots);
}

export function deleteAllBots() {
  if (useSqlite) {
    try {
      db.prepare('DELETE FROM bots').run();
      db.prepare('DELETE FROM trades').run();
      db.prepare('VACUUM').run();
      return true;
    } catch (e) {
      console.error('[BotRepo] deleteAllBots error:', e.message);
      return false;
    }
  }
  return writeJson(DATA_FILES.bots, []);
}

export function saveBotMap(botsMap) {
  const arr = Array.from(botsMap.values());
  return saveAllBots(arr);
}

export function saveBotTuningLog(log) {
  if (useSqlite) {
    try {
      db.prepare(`
        INSERT INTO bot_tuning_history (botId, symbol, oldParams, newParams, reasoning, marketCondition)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        log.botId,
        log.symbol,
        JSON.stringify(log.oldParams || {}),
        JSON.stringify(log.newParams || {}),
        log.reasoning,
        log.marketCondition
      );
      return true;
    } catch (e) {
      console.error('[BotRepo] saveBotTuningLog error:', e.message);
      return false;
    }
  }
  return false;
}

export function getTuningHistory(limit = 50) {
  if (useSqlite) {
    try {
      return db.prepare('SELECT * FROM bot_tuning_history ORDER BY id DESC LIMIT ?').all(limit);
    } catch { return []; }
  }
  return [];
}
