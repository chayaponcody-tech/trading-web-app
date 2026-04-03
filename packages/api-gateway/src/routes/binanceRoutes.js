import { Router } from 'express';
import { BinanceAdapter } from '../../../exchange-connector/src/BinanceAdapter.js';
import { loadBinanceConfig } from '../../../data-layer/src/repositories/configRepository.js';
import { getAllTradesFromBots } from '../../../data-layer/src/repositories/tradeRepository.js';
import { recommendBot, proposeFleet, huntBestSymbols } from '../../../ai-agents/src/index.js';

// ─── Binance Routes ───────────────────────────────────────────────────────────
export function createBinanceRoutes(botManager, binanceConfig) {
  const r = Router();

  const getService = () => {
    const cfg = loadBinanceConfig();
    if (!cfg.apiKey || !cfg.apiSecret) throw Object.assign(new Error('API keys not set'), { status: 400 });
    return new BinanceAdapter(cfg.apiKey, cfg.apiSecret);
  };

  r.get('/account', async (req, res, next) => {
    try {
      const svc = getService();
      const [account, risk] = await Promise.all([svc.getAccountInfo(), svc.getPositionRisk()]);
      const merged = (account.positions || []).map((p) => {
        const r = risk.find((rk) => rk.symbol === p.symbol);
        return { ...p, markPrice: r?.markPrice, liquidationPrice: r?.liquidationPrice };
      });
      res.json({ ...account, positions: merged });
    } catch (e) { next(e); }
  });

  r.get('/balance', async (req, res, next) => {
    try { res.json({ balance: await getService().getUSDTBalance() }); }
    catch (e) { next(e); }
  });

  r.get('/position-risk', async (req, res, next) => {
    try { res.json(await getService().getPositionRisk()); }
    catch (e) { next(e); }
  });

  r.post('/close-manual', async (req, res, next) => {
    try {
      const { symbol, type, quantity } = req.body;
      res.json(await getService().closePosition(symbol, type, quantity));
    } catch (e) { next(e); }
  });

  // Trade history (legacy frontend path /api/binance/history)
  r.get('/history', (req, res) => {
    res.json(getAllTradesFromBots(botManager.bots));
  });

  // Legacy config (for Binance dashboard)
  r.get('/config', (req, res) => {
    const cfg = loadBinanceConfig();
    res.json({
      apiKey: cfg.apiKey ? '****' + cfg.apiKey.slice(-4) : '',
      hasSecret: !!cfg.apiSecret,
      hasOpenRouter: !!cfg.openRouterKey,
      openRouterModel: cfg.openRouterModel,
    });
  });

  // AI aliases inside /api/binance
  r.post('/ai-recommend', async (req, res, next) => {
    try {
      const cfg = loadBinanceConfig();
      if (!cfg.openRouterKey) return res.status(400).json({ error: 'OpenRouter key not set' });
      const { symbol, interval = '1h', mode = 'confident' } = req.body;
      const svc = new BinanceAdapter(cfg.apiKey, cfg.apiSecret);
      const klines = await svc.getKlines(symbol, interval, 100);
      const closes = klines.map((k) => parseFloat(k[4]));
      res.json(await recommendBot(closes, mode, cfg.openRouterKey, cfg.openRouterModel, symbol));
    } catch (e) { next(e); }
  });

  r.post('/ai-fleet-propose', async (req, res, next) => {
    try {
      const cfg = loadBinanceConfig();
      if (!cfg.openRouterKey) return res.status(400).json({ error: 'OpenRouter key not set' });
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

  r.post('/ai-hunt', async (req, res, next) => {
    try {
      const cfg = loadBinanceConfig();
      if (!cfg.openRouterKey) return res.status(400).json({ error: 'OpenRouter key not set' });
      const { goal = 'High Volume Scalp' } = req.body;
      const svc = new BinanceAdapter(cfg.apiKey || '', cfg.apiSecret || '');
      const tickers = await svc.get24hTickers();
      const candidates = await huntBestSymbols(tickers, goal, cfg.openRouterKey, cfg.openRouterModel);
      res.json(candidates);
    } catch (e) { next(e); }
  });

  r.get('/market-scan', async (req, res, next) => {
    try {
      const { limit = 20, mode = 'volume' } = req.query;
      const { MarketScanner } = await import('../../../exchange-connector/src/MarketScanner.js');
      const svc = getService();
      const scanner = new MarketScanner(svc);
      res.json(await scanner.scanTopUSDT(parseInt(limit), mode));
    } catch (e) { next(e); }
  });

  return r;
}

