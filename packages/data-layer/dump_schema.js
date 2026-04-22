
import Database from 'better-sqlite3';

const db = new Database('trading_app.db');
try {
    const tables = ['fleets', 'bots', 'trades'];
    for (const table of tables) {
        const info = db.prepare(`PRAGMA table_info(${table})`).all();
        console.log(`Table: ${table}`);
        console.table(info);
    }
} finally {
    db.close();
}
