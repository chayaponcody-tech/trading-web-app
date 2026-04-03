import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const rootDir = process.cwd();
const dbPath = path.join(rootDir, 'trading_app.db');
const jsonPath = path.join(rootDir, 'forward-bots-db.json');

try {
  // 1. Clear SQLite tables
  const db = new Database(dbPath);
  db.prepare('DELETE FROM bots').run();
  db.prepare('DELETE FROM trades').run();
  db.prepare('DELETE FROM bot_tuning_history').run();
  db.prepare('DELETE FROM ai_memory').run();
  db.close();
  console.log('✅ SQLite: All bots, trades, and memory CLEARED.');

  // 2. Clear Legacy JSON file
  fs.writeFileSync(jsonPath, JSON.stringify([], null, 2));
  console.log('✅ JSON: forward-bots-db.json CLEARED.');

  console.log('\n🚀 ALL BOTS REMOVED! You are ready to start fresh.');

} catch (err) {
  console.error('❌ Error during total cleanup:', err.message);
}
