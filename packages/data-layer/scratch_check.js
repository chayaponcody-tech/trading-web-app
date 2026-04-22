
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = 'trading_app.db';
const db = new Database(dbPath);

try {
    const rows = db.prepare('SELECT id, config, openPositions FROM bots').all();
    
    console.log('--- Active Bots Status for HIGHUSDT ---');
    let found = false;

    for (const row of rows) {
        const config = JSON.parse(row.config || '{}');
        const symbol = (config.symbol || '').toUpperCase();
        
        if (symbol === 'HIGHUSDT' || symbol.includes('HIGH')) {
            found = true;
            console.log(`Bot ID: ${row.id}`);
            console.log(`Symbol: ${symbol} | Strategy: ${config.strategy}`);
            
            const positions = JSON.parse(row.openPositions || '[]');
            if (positions.length > 0) {
                positions.forEach((p, idx) => {
                    console.log(`Position #${idx+1}: ${p.type}`);
                    console.log(` - Entry Price: ${p.entryPrice}`);
                    console.log(` - Fixed TP %: ${config.tpPercent}%`);
                    console.log(` - Fixed SL %: ${config.slPercent}%`);
                    if (p.dynamicTp) console.log(` - ✨ AI Dynamic TP Price: ${p.dynamicTp}`);
                    if (p.dynamicSl) console.log(` - ✨ AI Dynamic SL Price: ${p.dynamicSl}`);
                    if (p.trailingSl) console.log(` - 📈 ATR Trailing SL Price: ${p.trailingSl}`);
                });
            } else {
                console.log('Status: Flat (No open positions)');
                console.log(` - Configured TP %: ${config.tpPercent}%`);
                console.log(` - Configured SL %: ${config.slPercent}%`);
            }
            console.log('---------------------------------------');
        }
    }

    if (!found) {
        console.log('No bots found for HIGHUSDT.');
    }

} catch (e) {
    console.error('Error querying DB:', e.message);
} finally {
    db.close();
}
