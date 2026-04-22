import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve('trading_app.db');
const db = new Database(dbPath);

console.log('--- SCANNING DATABASE FOR BOTS ---');
const bots = db.prepare('SELECT id, isRunning, config, openPositions FROM bots').all();

bots.forEach(bot => {
    const config = JSON.parse(bot.config || '{}');
    const pos = JSON.parse(bot.openPositions || '[]');
    const symbol = config.symbol || 'Unknown';
    console.log(`Bot: ${bot.id} | Running: ${bot.isRunning} | Symbol: ${symbol} | Positions: ${pos.length}`);
    if (pos.length > 0) {
        console.log(`  -> Open Position details: ${JSON.stringify(pos)}`);
    }
});

console.log(`\nTotal Bots in DB: ${bots.length}`);
db.close();
