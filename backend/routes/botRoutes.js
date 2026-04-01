import express from 'express';
import * as dbService from '../db/dbService.js';

export function createBotRoutes(botService) {
    const router = express.Router();

    router.get('/status', (req, res) => {
        const botsArray = Array.from(botService.bots.values());
        res.json(botsArray);
    });

    router.post('/start', async (req, res) => {
        try {
            const config = req.body;
            const botId = await botService.startBot(config);
            res.json({ success: true, botId });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/stop', (req, res) => {
        const { botId } = req.body;
        botService.stopBot(botId);
        res.json({ success: true });
    });

    router.post('/resume', (req, res) => {
        const { botId } = req.body;
        botService.resumeBot(botId);
        res.json({ success: true });
    });

    router.delete('/delete', (req, res) => {
        const { botId } = req.body;
        botService.deleteBot(botId);
        res.json({ success: true });
    });

    // Support POST for deletion too for compatibility
    router.post('/delete', (req, res) => {
        const { botId } = req.body;
        botService.deleteBot(botId);
        res.json({ success: true });
    });

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
