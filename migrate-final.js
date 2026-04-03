import fs from 'fs';
import path from 'path';
import { 
  initDb, 
  DATA_FILES, 
  db, 
  useSqlite 
} from './packages/data-layer/src/DatabaseManager.js';
import { upsertBot } from './packages/data-layer/src/repositories/botRepository.js';
import { appendTrade } from './packages/data-layer/src/repositories/tradeRepository.js';
import { saveBinanceConfig, savePaperState } from './packages/data-layer/src/repositories/configRepository.js';

async function migrate() {
    console.log('🚀 Finalizing Data Migration: JSON -> SQLite Architecture');
    
    // 1. Ensure DB initialized
    initDb();
    if (!useSqlite) {
        console.error('❌ Could not initialize SQLite. Migration aborted.');
        process.exit(1);
    }

    // 2. Migrate Config
    if (fs.existsSync(DATA_FILES.binanceConfig)) {
        const config = JSON.parse(fs.readFileSync(DATA_FILES.binanceConfig, 'utf8'));
        saveBinanceConfig(config);
        console.log('✅ Migrated Binance Config');
    }

    if (fs.existsSync(DATA_FILES.paperState)) {
        const state = JSON.parse(fs.readFileSync(DATA_FILES.paperState, 'utf8'));
        savePaperState(state);
        console.log('✅ Migrated Paper State');
    }

    // 3. Migrate Bots
    if (fs.existsSync(DATA_FILES.bots)) {
        const bots = JSON.parse(fs.readFileSync(DATA_FILES.bots, 'utf8'));
        if (Array.isArray(bots)) {
            for (const bot of bots) {
                // Store bot
                upsertBot(bot);
                
                // Store trades related to this bot if they exist
                if (bot.trades && Array.isArray(bot.trades)) {
                    for (const t of bot.trades) {
                        try {
                            db.prepare(`
                                INSERT INTO trades (botId, symbol, type, entryPrice, exitPrice, pnl, exitTime, reason, strategy, entryReason)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `).run(
                                bot.id, t.symbol || bot.config.symbol, t.type, t.entryPrice, t.exitPrice, 
                                t.pnl || 0, t.exitTime, t.reason, t.strategy || bot.config.strategy, t.entryReason
                            );
                        } catch (e) {
                           // Skip duplicates or errors
                        }
                    }
                }
            }
            console.log(`✅ Migrated ${bots.length} Bots and their internal history`);
        }
    }

    // 4. Migrate Trade Memory (AI Memory)
    if (fs.existsSync(DATA_FILES.tradeMemory)) {
        const history = JSON.parse(fs.readFileSync(DATA_FILES.tradeMemory, 'utf8'));
        if (Array.isArray(history)) {
            for (const item of history) {
                appendTrade(item);
            }
            console.log(`✅ Migrated ${history.length} Trade Memory records`);
        }
    }

    console.log('🏁 Migration Complete! All data moved to trading_app.db');
    process.exit(0);
}

migrate();
