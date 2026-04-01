import fs from 'fs';
import path from 'path';
import db, { initDb, saveSetting, saveBot, addTrade, saveTradeMemoryItem } from './backend/db/sqlite.js';

const rootDir = process.cwd();
const botsFile = path.join(rootDir, 'forward-bots-db.json');
const dataFile = path.join(rootDir, 'paper-trading-db.json');
const goldWalletFile = path.join(rootDir, 'gold-wallet.json');
const tradeMemoryFile = path.join(rootDir, 'trade-memory.json');
const configPath = path.join(rootDir, 'binance-config.json');

async function migrate() {
    console.log('🚀 Starting Data Migration: JSON -> SQLite');
    
    // Safety: Wait for SQLite to be ready
    await initDb();

    // 1. Settings (Config, Paper State, Gold Wallet)
    if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        saveSetting('binanceConfig', config);
        console.log('✅ Migrated Binance Config');
    }

    if (fs.existsSync(dataFile)) {
        const paperState = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
        saveSetting('paperState', paperState);
        console.log('✅ Migrated Paper State');
    }

    if (fs.existsSync(goldWalletFile)) {
        const goldWallet = JSON.parse(fs.readFileSync(goldWalletFile, 'utf8'));
        saveSetting('goldWallet', goldWallet);
        console.log('✅ Migrated Gold Wallet');
    }

    // 2. Bots & History
    if (fs.existsSync(botsFile)) {
        const bots = JSON.parse(fs.readFileSync(botsFile, 'utf8'));
        if (Array.isArray(bots)) {
            for (const bot of bots) {
                // Extract trades from bot object
                const botTrades = bot.trades || [];
                
                // Format bot object for saveBot (remove internal trades array)
                const botToSave = { ...bot };
                delete botToSave.trades;
                
                saveBot(botToSave);
                
                // Store trades in separate table
                for (const trade of botTrades) {
                    addTrade({
                        botId: bot.id,
                        symbol: trade.symbol,
                        type: trade.type,
                        entryPrice: trade.entryPrice,
                        exitPrice: trade.exitPrice,
                        pnl: trade.pnl || 0,
                        exitTime: trade.exitTime,
                        reason: trade.reason,
                        strategy: trade.strategy,
                        entryReason: trade.entryReason
                    });
                }
            }
            console.log(`✅ Migrated ${bots.length} Bots and their trade history`);
        }
    }

    // 3. Global Trade Memory 
    if (fs.existsSync(tradeMemoryFile)) {
        const history = JSON.parse(fs.readFileSync(tradeMemoryFile, 'utf8'));
        if (Array.isArray(history)) {
            for (const item of history) {
                saveTradeMemoryItem({
                    symbol: item.symbol,
                    type: item.type,
                    pnl: item.pnl || 0,
                    strategy: item.strategy,
                    reason: item.reason,
                    entryPrice: item.entryPrice,
                    exitPrice: item.exitPrice,
                    exitTime: item.exitTime,
                    recordedAt: item.recordedAt
                });
            }
            console.log(`✅ Migrated ${history.length} Trade Memory records`);
        }
    }

    console.log('🏁 Migration Complete! SQLite Database is now ready.');
    process.exit(0);
}

migrate().catch(err => {
    console.error('❌ Migration Failed:', err);
    process.exit(1);
});
