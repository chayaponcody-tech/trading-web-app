import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve('trading_app.db');
const db = new Database(dbPath);

console.log('--- ANALYZING BOT THOUGHTS & SIGNALS ---');
const bots = db.prepare('SELECT id, config, aiHistory, lastSignal, lastEntryReason FROM bots WHERE isRunning = 1').all();

bots.forEach(bot => {
    const config = JSON.parse(bot.config || '{}');
    const history = JSON.parse(bot.aiHistory || '[]');
    const latest = history.length > 0 ? history[history.length - 1] : null;

    console.log(`\nBot: ${bot.id} (${config.symbol})`);
    console.log(`Strategy: ${config.strategy} | Interval: ${config.interval}`);
    console.log(`Last Signal: ${bot.lastSignal || 'NONE'}`);
    console.log(`Last Reason: ${bot.lastEntryReason || 'N/A'}`);
    
    if (latest) {
        console.log(`Latest AI Analysis (${latest.timestamp || 'unknown'}):`);
        console.log(`  Regime: ${latest.regime || 'N/A'}`);
        console.log(`  Confidence: ${latest.confidence}%`);
        console.log(`  Wait/Action: ${latest.comment || latest.reasoning || 'No comment'}`);
    } else {
        console.log('  No AI History recorded yet.');
    }
});

db.close();
