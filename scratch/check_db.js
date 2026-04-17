import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve('trading_app.db');
const db = new Database(dbPath);

const rows = db.prepare('SELECT id, name FROM strategy_definitions').all();
console.log('--- Strategy Definitions ---');
rows.forEach(row => {
    console.log(`ID: ${row.id} | Name: ${row.name}`);
});

const results = db.prepare('SELECT backtestId, strategyId FROM strategy_backtest_results LIMIT 5').all();
console.log('\n--- Recent Backtest Results ---');
results.forEach(row => {
    console.log(`BT_ID: ${row.backtestId} | StratID: ${row.strategyId}`);
});
