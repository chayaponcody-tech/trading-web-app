import express from 'express';
import * as dbService from '../db/dbService.js';
import { BinanceTestnetService } from '../services/binanceService.js';

export function createBinanceRoutes(botService) {
    const router = express.Router();

    router.get('/config', (req, res) => {
        const config = dbService.loadBinanceConfig();
        res.json({
            apiKey: config.apiKey,
            openRouterKey: config.openRouterKey ? 'SET' : 'NOT_SET',
            openRouterModel: config.openRouterModel || 'google/gemini-2.0-flash-exp:free',
            telegramToken: config.telegramToken ? '********' : '',
            telegramChatId: config.telegramChatId || '',
            hasKeys: !!(config.apiKey && config.apiSecret),
            hasSecret: !!config.apiSecret,
            hasOpenRouter: !!config.openRouterKey,
            hasTelegram: !!(config.telegramToken && config.telegramChatId)
        });
    });

    // Internal endpoint for services (quant-engine, strategy-ai) to fetch the real key
    router.get('/config/internal-keys', (req, res) => {
        const config = dbService.loadBinanceConfig();
        res.json({
            openRouterKey: config.openRouterKey || '',
            openRouterModel: config.openRouterModel || 'google/gemini-2.0-flash-exp:free',
            binanceApiKey: config.apiKey || '',
        });
    });

    router.post('/config', async (req, res) => {
        const { apiKey, apiSecret, openRouterKey, openRouterModel, telegramToken, telegramChatId } = req.body;
        const config = dbService.loadBinanceConfig();
        
        if (apiKey) config.apiKey = apiKey;
        if (apiSecret) config.apiSecret = apiSecret;
        if (openRouterKey) config.openRouterKey = openRouterKey;
        if (openRouterModel) config.openRouterModel = openRouterModel;
        if (telegramToken) config.telegramToken = telegramToken;
        if (telegramChatId) config.telegramChatId = telegramChatId;
        
        dbService.saveBinanceConfigToFile(config);
        
        // Reload notification service if possible (optional but recommended)
        if (botService.setNotificationService) {
            const { NotificationService } = await import('../services/notificationService.js');
            botService.setNotificationService(new NotificationService(config));
        }

        res.json({ success: true });
    });

    router.get('/account', async (req, res) => {
        const config = dbService.loadBinanceConfig();
        if (!config.apiKey || !config.apiSecret) {
            return res.status(400).json({ error: 'API Keys not set' });
        }
        const service = new BinanceTestnetService(config.apiKey, config.apiSecret);
        try {
            const info = await service.getAccountInfo();
            res.json(info);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.get('/position-risk', async (req, res) => {
        const config = dbService.loadBinanceConfig();
        if (!config.apiKey || !config.apiSecret) {
            return res.status(400).json({ error: 'API Keys not set' });
        }
        const service = new BinanceTestnetService(config.apiKey, config.apiSecret);
        try {
            const risk = await service.getPositionRisk();
            res.json(risk);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/close-manual', async (req, res) => {
        const { symbol, type, quantity } = req.body;
        const config = dbService.loadBinanceConfig();
        if (!config.apiKey || !config.apiSecret) {
            return res.status(400).json({ error: 'API Keys not set' });
        }
        const service = new BinanceTestnetService(config.apiKey, config.apiSecret);
        try {
            const result = await service.closePosition(symbol, type, quantity);
            res.json(result);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Added to support frontend's legacy check at /api/binance/history
    router.get('/history', (req, res) => {
        const botsArray = Array.from(botService.bots.values());
        const allTrades = [];
        botsArray.forEach(bot => {
            if (bot.trades) {
                bot.trades.forEach(t => {
                    allTrades.push({
                        ...t,
                        symbol: t.symbol || bot.config.symbol,
                        strategy: t.strategy || bot.config.strategy
                    });
                });
            }
        });
        allTrades.sort((a, b) => new Date(b.exitTime || 0).getTime() - new Date(a.exitTime || 0).getTime());
        res.json(allTrades);
    });

    return router;
}
