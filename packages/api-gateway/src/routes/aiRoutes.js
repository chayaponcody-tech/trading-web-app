import { Router } from 'express';
import { recommendBot, proposeFleet, analyzeMistakes, analyzeFleet, callOpenRouter } from '../../../ai-agents/src/index.js';
import { BinanceAdapter } from '../../../exchange-connector/src/BinanceAdapter.js';
import { loadBinanceConfig } from '../../../data-layer/src/repositories/configRepository.js';
import { getTradeMemory, getAllTradesFromBots } from '../../../data-layer/src/repositories/tradeRepository.js';

// ─── AI Routes ────────────────────────────────────────────────────────────────
export function createAiRoutes(botManager, binanceConfig) {
  const r = Router();

  const getCfg = () => loadBinanceConfig();
  const requireKey = (res, cfg) => {
    if (!cfg.openRouterKey) { res.status(400).json({ error: 'OpenRouter key not set' }); return false; }
    return true;
  };

  // Single-bot AI recommendation
  r.post('/recommend', async (req, res, next) => {
    try {
      const cfg = getCfg();
      if (!requireKey(res, cfg)) return;
      const { symbol, interval = '1h', mode = 'confident' } = req.body;
      const svc = new BinanceAdapter(cfg.apiKey, cfg.apiSecret);
      const klines = await svc.getKlines(symbol, interval, 100);
      const closes = klines.map((k) => parseFloat(k[4]));
      res.json(await recommendBot(closes, mode, cfg.openRouterKey, cfg.openRouterModel, symbol));
    } catch (e) { next(e); }
  });

  // Fleet proposal
  r.post('/fleet-propose', async (req, res, next) => {
    try {
      const cfg = getCfg();
      if (!requireKey(res, cfg)) return;
      const { count = 5, capital = 1000, durationMins = 240, instructions = '', model } = req.body;
      const svc = new BinanceAdapter(cfg.apiKey || '', cfg.apiSecret || '');
      const tickers = await svc.get24hTickers();
      const top = tickers
        .filter((t) => t.symbol.endsWith('USDT'))
        .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
        .slice(0, 50);
      res.json(await proposeFleet(top, count, capital, durationMins, instructions, cfg.openRouterKey, model || cfg.openRouterModel));
    } catch (e) { next(e); }
  });

  // Fleet-wide analysis
  r.post('/analyze', async (req, res, next) => {
    try {
      const cfg = getCfg();
      if (!requireKey(res, cfg)) return;
      const bots = [...botManager.bots.values()];
      const history = getTradeMemory(30);
      const analysis = await analyzeFleet(bots, history, cfg.openRouterKey, cfg.openRouterModel);
      res.json({ analysis });
    } catch (e) { next(e); }
  });

  // Single-bot mistake review
  r.post('/review-mistakes', async (req, res, next) => {
    try {
      const cfg = getCfg();
      if (!requireKey(res, cfg)) return;
      const bot = botManager.bots.get(req.body.botId);
      if (!bot) return res.status(404).json({ error: 'Bot not found' });
      const analysis = await analyzeMistakes(bot, cfg.openRouterKey, cfg.openRouterModel);
      res.json({ analysis });
    } catch (e) { next(e); }
  });

  // Direct AI chat (generic)
  r.post('/chat', async (req, res, next) => {
    try {
      const cfg = getCfg();
      if (!requireKey(res, cfg)) return;
      const { prompt, model } = req.body;
      const content = await callOpenRouter(prompt, cfg.openRouterKey, model || cfg.openRouterModel, { jsonMode: false });
      res.json({ content });
    } catch (e) { next(e); }
  });

  // Trade memory
  r.get('/memory', (req, res) => res.json(getTradeMemory()));

  // Single-bot parameter optimization
  r.post('/optimize', async (req, res, next) => {
    try {
      const cfg = getCfg();
      if (!requireKey(res, cfg)) return;
      const bot = botManager.bots.get(req.body.botId);
      if (!bot) return res.status(404).json({ error: 'Bot not found' });
      const { getOptimizedParams } = await import('../../../ai-agents/src/OptimizerAgent.js');
      const result = await getOptimizedParams(bot, cfg.openRouterKey, cfg.openRouterModel);
      res.json(result);
    } catch (e) { next(e); }
  });

  return r;
}

