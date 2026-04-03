import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'trading_app.db');
const jsonPath = path.join(process.cwd(), 'forward-bots-db.json');

async function recoverData() {
    if (!fs.existsSync(dbPath) || !fs.existsSync(jsonPath)) {
        console.error('❌ Database or JSON file not found.');
        return;
    }

    const db = new Database(dbPath);
    const legacyBots = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    
    let logOutput = `🔍 Found ${legacyBots.length} bots in legacy backup.\n`;
    console.log(logOutput);

    const updateStmt = db.prepare(`
        UPDATE bots 
        SET trades = ?, aiHistory = ?, reflectionHistory = ?, totalTrades = ?, netPnl = ?
        WHERE id = ?
    `);

    let recoveredCount = 0;
    for (const legacyBot of legacyBots) {
        // Check if this bot exists in current SQLite
        const existing = db.prepare('SELECT id, trades, aiHistory FROM bots WHERE id = ?').get(legacyBot.id);
        
        if (existing) {
            const currentTrades = JSON.parse(existing.trades || '[]');
            const currentAiHistory = JSON.parse(existing.aiHistory || '[]');
            
            const mergedTrades = [...(legacyBot.trades || []), ...currentTrades];
            const mergedAiHistory = [...(legacyBot.aiHistory || []), ...currentAiHistory];
            const mergedReflection = [...(legacyBot.reflectionHistory || [])];

            updateStmt.run(
                JSON.stringify(mergedTrades),
                JSON.stringify(mergedAiHistory),
                JSON.stringify(mergedReflection),
                mergedTrades.length,
                legacyBot.netPnl || 0,
                legacyBot.id
            );
            const msg = `✅ Recovered history for bot: ${legacyBot.id} (${legacyBot.config.symbol})`;
            console.log(msg);
            logOutput += msg + '\n';
            recoveredCount++;
        } else {
            logOutput += `ℹ️ Legacy bot ${legacyBot.id} not found in current session. Skipping.\n`;
        }
    }

    const finalMsg = `\n🎉 Recovery Complete! Successfully restored history for ${recoveredCount} bots.`;
    console.log(finalMsg);
    logOutput += finalMsg;
    
    fs.writeFileSync(path.join(process.cwd(), 'recovery_result.txt'), logOutput);
    db.close();
}

recoverData().catch(console.error);
