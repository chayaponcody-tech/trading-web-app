import express from 'express';
import * as aiService from '../services/aiService.js';
import * as dbService from '../db/dbService.js';
import { BinanceTestnetService } from '../services/binanceService.js';

const router = express.Router();

router.post('/ai-recommend', async (req, res) => {
    const config = dbService.loadBinanceConfig();
    const { symbol, interval, mode, strategy } = req.body;
    
    if (!config.apiKey || !config.apiSecret || !config.openRouterKey) {
        return res.status(400).json({ error: 'API Keys not set' });
    }

    const service = new BinanceTestnetService(config.apiKey, config.apiSecret);
    try {
        const klines = await service.getKlines(symbol, interval || '1h', 100);
        const closes = klines.map(k => parseFloat(k[4]));
        const aiResponse = await aiService.getBotRecommendations(closes, 1, mode || 'confident', config.openRouterKey, config.openRouterModel, symbol, strategy);
        res.json(aiResponse);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/ai-fleet-propose', async (req, res) => {
    const config = dbService.loadBinanceConfig();
    const { count, capital, durationMins, instructions, model } = req.body;
    
    if (!config.openRouterKey) {
        return res.status(400).json({ error: 'OpenRouter Key not set' });
    }

    const service = new BinanceTestnetService(config.apiKey || '', config.apiSecret || '');
    try {
        const tickers = await service.get24hTickers();
        const topSymbols = tickers
            .filter(t => t.symbol.endsWith('USDT'))
            .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
            .slice(0, 50);

        const aiResponse = await aiService.getFleetProposal(
            topSymbols, 
            count || 5, 
            capital || 1000, 
            durationMins || 240, 
            instructions || '', 
            config.openRouterKey, 
            model || config.openRouterModel
        );
        res.json(aiResponse);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
