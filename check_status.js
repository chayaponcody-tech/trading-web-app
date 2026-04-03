import Database from 'better-sqlite3';
import fs from 'fs';

const dbPath = 'trading_app.db';

function check() {
    if (!fs.existsSync(dbPath)) {
        console.error('❌ Database not found');
        return;
    }

    const db = new Database(dbPath);
    const bots = db.prepare('SELECT id, symbol, lastSignal, currentPrice, isRunning, unrealizedPnl FROM bots').all();
    
    console.log('\n--- Live Bot Status Report ---');
    console.table(bots.map(b => ({
        ID: b.id,
        Symbol: b.symbol,
        Signal: b.lastSignal || 'NONE',
        Price: b.currentPrice || 0,
        Running: b.isRunning ? '✅' : '❌',
        PnL: b.unrealizedPnl || 0
    })));
    
    db.close();
}

check();
