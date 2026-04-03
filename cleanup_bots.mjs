import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'trading_app.db');
const db = new Database(dbPath);

try {
  const bots = db.prepare('SELECT id, config FROM bots').all();
  const toDelete = [];

  bots.forEach(bot => {
    const config = JSON.parse(bot.config || '{}');
    if (config.exchange !== 'binance_testnet') {
      toDelete.push(bot.id);
    }
  });

  console.log(`Found ${toDelete.length} bots to delete: ${toDelete.join(', ')}`);

  if (toDelete.length > 0) {
    const deleteStmt = db.prepare('DELETE FROM bots WHERE id = ?');
    const deleteTrades = db.prepare('DELETE FROM trades WHERE botId = ?');
    
    const trx = db.transaction((ids) => {
      for (const id of ids) {
        deleteStmt.run(id);
        deleteTrades.run(id);
      }
    });

    trx(toDelete);
    console.log('✅ Successfully deleted bots and their history.');
  } else {
    console.log('No matching bots found for deletion.');
  }

} catch (err) {
  console.error('Error during cleanup:', err.message);
} finally {
  db.close();
}
