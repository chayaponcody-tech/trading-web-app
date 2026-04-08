import express from 'express';
import cors from 'cors';
import { BinanceTestnetService } from './services/binanceService.js';
import { BotService } from './services/botService.js';
import { createBinanceRoutes } from './routes/binanceRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import { createBotRoutes } from './routes/botRoutes.js';
import { NotificationService } from '../packages/bot-engine/src/NotificationService.js';
import * as dbService from './db/dbService.js';
import { initDb } from './db/sqlite.js';

const app = express();
const PORT = process.env.PORT || 4001;

app.use(cors());
app.use(express.json());

async function startServer() {
    console.log('🚀 Initializing Modular Backend (Absolute Path Mode)...');
    
    // 1. Ensure Database is Ready
    await initDb();

    // 2. Initialize Services
    const binanceConfig = dbService.loadBinanceConfig();
    let binanceService = null;
    if (binanceConfig.apiKey && binanceConfig.apiSecret) {
        binanceService = new BinanceTestnetService(binanceConfig.apiKey, binanceConfig.apiSecret);
        console.log('✅ Binance Service Initialized');
    } else {
        console.warn('⚠️ Binance API Keys missing. Using Offline mode.');
    }

    const botService = new BotService(binanceService, binanceConfig);
    const notificationService = new NotificationService(binanceConfig);
    botService.setNotificationService(notificationService);

    // 3. Perform startup tasks (async)
    if (binanceService) {
        binanceService.getExchangeInfo()
            .then(info => {
                const rules = {};
                info.symbols.forEach(s => {
                    const lotSize = s.filters.find(f => f.filterType === 'LOT_SIZE');
                    const priceFilter = s.filters.find(f => f.filterType === 'PRICE_FILTER');
                    
                    rules[s.symbol] = {
                        stepSize: lotSize ? parseFloat(lotSize.stepSize) : 0.001,
                        minQty: lotSize ? parseFloat(lotSize.minQty) : 0.001,
                        precision: lotSize ? (lotSize.stepSize.toString().split('.')[1]?.length || 0) : 3,
                        tickSize: priceFilter ? parseFloat(priceFilter.tickSize) : 0.0001,
                        pricePrecision: priceFilter ? (priceFilter.tickSize.toString().split('.')[1]?.length || 0) : 4
                    };
                });
                botService.setSymbolRules(rules);
                console.log(`[Binance] Loaded rules for ${Object.keys(rules).length} symbols`);
                
                // --- AUTO RESUME LOGIC ---
                console.log('🚀 Auto-Resuming active bots with positions...');
                const bots = Array.from(botService.bots.values());
                bots.forEach(bot => {
                    if (bot.openPositions && bot.openPositions.length > 0) {
                        console.log(`[Bot ${bot.id}] Auto-Resuming (${bot.config.symbol})...`);
                        botService.resumeBot(bot.id);
                    }
                });
            })
            .catch(err => console.error('[Binance Init] Error:', err.message));
    }

    // 4. Mount Routes
    app.use('/api/binance', createBinanceRoutes(botService));
    app.use('/api/binance', aiRoutes); 
    app.use('/api/forward-test', createBotRoutes(botService));

    app.get('/api/ai/memory', (req, res) => {
        try {
            import('./db/sqlite.js').then(sqlite => {
                const history = sqlite.getTradeMemory(100);
                res.json(history);
            }).catch(() => res.json([]));
        } catch { res.json([]); }
    });

    app.listen(PORT, () => {
        console.log(`🚀 Modular Backend Server running on http://localhost:${PORT}`);
    });
}

startServer().catch(err => {
    console.error('❌ Failed to start server:', err);
});
