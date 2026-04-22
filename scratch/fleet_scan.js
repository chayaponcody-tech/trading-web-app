import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve('trading_app.db');
const db = new Database(dbPath);

console.log('--- SCANNING DATABASE FOR FLEETS ---');
const fleets = db.prepare('SELECT id, name, config, isRunning FROM fleets').all();

fleets.forEach(f => {
    console.log(`Fleet: ${f.name} (ID: ${f.id}) | Running: ${f.isRunning}`);
    const cfg = JSON.parse(f.config || '{}');
    console.log(`  -> Config: ${JSON.stringify(cfg)}`);
});

console.log(`\nTotal Fleets in DB: ${fleets.length}`);
db.close();
