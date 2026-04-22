
import Database from 'better-sqlite3';

const db = new Database('trading_app.db');
try {
    const bots = db.prepare('SELECT config, isRunning FROM bots').all();
    const fleets = db.prepare('SELECT id, name FROM fleets').all();

    const stats = {};
    for (const f of fleets) stats[f.id] = { name: f.name, bots: 0, running: 0, symbols: [] };
    stats['manual'] = { name: 'Manual/No Fleet', bots: 0, running: 0, symbols: [] };

    for (const b of bots) {
        const conf = JSON.parse(b.config);
        const fId = conf.managedBy || 'manual';
        if (!stats[fId]) stats[fId] = { name: 'Unknown', bots: 0, running: 0, symbols: [] };
        
        stats[fId].bots++;
        if (b.isRunning) stats[fId].running++;
        stats[fId].symbols.push(conf.symbol);
    }

    console.log('--- Fleet Distribution ---');
    console.table(stats);

} finally {
    db.close();
}
