
import { db, readJson, writeJson, DATA_FILES } from '../DatabaseManager.js';

export function saveTelegramLog(direction, chatId, message) {
  try {
    if (db && typeof db.prepare === 'function') {
      db.prepare('INSERT INTO telegram_logs (direction, chatId, message) VALUES (?, ?, ?)')
        .run(direction, chatId.toString(), message);
    }
  } catch (e) {
    console.warn('[DataLayer] Could not save telegram log:', e.message);
  }
}

export function getTelegramLogs(limit = 100) {
  try {
    if (db && typeof db.prepare === 'function') {
      return db.prepare('SELECT * FROM telegram_logs ORDER BY id DESC LIMIT ?').all(limit);
    }
  } catch (e) {
    console.warn('[DataLayer] Could not get telegram logs:', e.message);
  }
  return [];
}
