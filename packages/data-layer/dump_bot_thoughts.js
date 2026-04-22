
import Database from 'better-sqlite3';

const db = new Database('trading_app.db');
try {
    const bots = db.prepare('SELECT id, config, lastSignal, isRunning, unrealizedPnl FROM bots').all();
    
    console.log('--- Current Bot Thoughts & Status ---');
    for (const b of bots) {
        const conf = JSON.parse(b.config);
        const managed = conf.managedBy || 'MANUAL';
        console.log(`Bot: ${b.id} | Symbol: ${conf.symbol} | Fleet: ${managed}`);
        console.log(` - Running: ${b.isRunning ? '✅' : '❌'} | Last Signal: ${b.lastSignal || 'NONE'}`);
        console.log(` - Unrealized PnL: ${b.unrealizedPnl || 0} USDT`);
        // Note: 'currentThought' is in-memory only usually, unless I added it to DB
        // Let's check if it exists in DB
    }

} finally {
    db.close();
}
