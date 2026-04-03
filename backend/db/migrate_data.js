import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const dbPath = path.join(root, 'trading_app.db');
const jsonPath = path.join(root, 'forward-bots-db.json');

function migrate() {
    console.log('--- Data Migration Started ---');
    if (!fs.existsSync(dbPath)) return console.error('Database not found at ' + dbPath);
    if (!fs.existsSync(jsonPath)) return console.error('Legacy JSON not found at ' + jsonPath);

    const db = new Database(dbPath);
    const legacyBots = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    
    let count = 0;
    const stmt = db.prepare('UPDATE bots SET trades = ?, aiHistory = ?, reflectionHistory = ?, totalTrades = ?, netPnl = ? WHERE id = ?');

    legacyBots.forEach(legacy => {
        const existing = db.prepare('SELECT id, trades FROM bots WHERE id = ?').get(legacy.id);
        if (existing) {
            const currentTrades = JSON.parse(existing.trades || '[]');
            const mergedTrades = [...(legacy.trades || []), ...currentTrades];
            
            stmt.run(
                JSON.stringify(mergedTrades),
                JSON.stringify(legacy.aiHistory || []),
                JSON.stringify(legacy.reflectionHistory || []),
                mergedTrades.length,
                legacy.netPnl || 0,
                legacy.id
            );
            console.log(`Merged ${mergedTrades.length} trades for ${legacy.id}`);
            count++;
        }
    });

    console.log(`--- Migration Finished: ${count} bots updated ---`);
    db.close();
}

migrate();
