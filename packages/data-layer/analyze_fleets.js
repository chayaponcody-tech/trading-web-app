
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = 'trading_app.db';
const db = new Database(dbPath);

try {
    console.log('--- Fleets Performance Analysis ---');
    
    // 1. List Fleets
    const fleets = db.prepare('SELECT id, name, description FROM fleets').all();
    console.log(`Total Fleets: ${fleets.length}`);

    for (const fleet of fleets) {
        console.log(`\nFleet: ${fleet.name} (ID: ${fleet.id})`);
        
        // 2. Counts Bots in this Fleet
        const bots = db.prepare('SELECT id, config, isRunning FROM bots WHERE fleetId = ?').all(fleet.id);
        const runningBots = bots.filter(b => b.isRunning).length;
        console.log(` - Bots: ${bots.length} (${runningBots} running)`);

        // 3. Trade Performance
        const trades = db.prepare('SELECT COUNT(*) as count, SUM(realizedPnl) as totalPnl FROM trades WHERE fleetId = ?').get(fleet.id);
        const openPositionsCount = bots.reduce((acc, b) => acc + JSON.parse(b.openPositions || '[]').length, 0);

        console.log(` - Closed Trades: ${trades.count}`);
        console.log(` - Total Realized PnL: ${trades.totalPnl?.toFixed(4) || '0.0000'} USDT`);
        console.log(` - Active Positions: ${openPositionsCount}`);

        if (bots.length > 0) {
            console.log(' - Symbols covered: ' + [...new Set(bots.map(b => JSON.parse(b.config).symbol))].join(', '));
        }
    }

    console.log('\n--- Diagnostic: Bots without Fleet ---');
    const orphanBots = db.prepare('SELECT id, config FROM bots WHERE fleetId IS NULL OR fleetId = ""').all();
    console.log(`Orphan Bots: ${orphanBots.length}`);

} catch (e) {
    console.error('Error:', e.message);
} finally {
    db.close();
}
