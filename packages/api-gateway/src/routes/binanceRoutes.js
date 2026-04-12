import { Router } from 'express';
import { BinanceAdapter } from '../../../exchange-connector/src/BinanceAdapter.js';
import { loadBinanceConfig } from '../../../data-layer/src/repositories/configRepository.js';
import { getAllTradesFromBots } from '../../../data-layer/src/repositories/tradeRepository.js';
import { recommendBot, proposeFleet, huntBestSymbols } from '../../../ai-agents/src/index.js';
import { calculateSharpe, calculateMaxDrawdown, calculateProfitFactor, generateEquityCurve } from '../../../shared/AnalyticsUtils.js';

// ─── Binance Routes ───────────────────────────────────────────────────────────
export function createBinanceRoutes(botManager, portfolioManager, binanceConfig) {
  const r = Router();

  const getService = () => {
    return botManager.exchange;
  };

  const getLiveService = () => {
    if (!botManager.liveExchange) {
      console.warn('[BinanceRoutes] liveExchange not initialized — falling back to testnet exchange. Set Live API keys in Configuration.');
    }
    return botManager.liveExchange || botManager.exchange;
  };

  // ─── Live (Production) Account Endpoints ─────────────────────────────────
  r.get('/live/account', async (req, res) => {
    try {
      const cfg = loadBinanceConfig();
      const hasLive = !!(cfg.liveApiKey && cfg.liveApiSecret);
      if (!hasLive && !cfg.apiKey) {
        return res.json({ assets: [], positions: [], error: 'Live API Keys not configured' });
      }
      const svc = getLiveService();
      const [account, risk] = await Promise.all([
        svc.getAccountInfo().catch(() => ({ assets: [], positions: [] })),
        svc.getPositionRisk().catch(() => [])
      ]);
      const merged = (account.positions || []).map((p) => {
        const rk = Array.isArray(risk) ? risk.find((r) => r.symbol === p.symbol) : null;
        return { ...p, markPrice: rk?.markPrice, liquidationPrice: rk?.liquidationPrice };
      });
      res.json({ ...account, positions: merged });
    } catch (e) {
      res.status(200).json({ assets: [], positions: [], error: e.message });
    }
  });

  r.get('/live/position-risk', async (req, res) => {
    try {
      const svc = getLiveService();
      res.json(await svc.getPositionRisk());
    } catch (e) {
      res.json([]);
    }
  });

  r.get('/account', async (req, res) => {
    try {
      const cfg = loadBinanceConfig();
      if (!cfg.apiKey || !cfg.apiSecret) {
        return res.json({ assets: [], positions: [], error: 'API Keys not configured' });
      }

      const svc = getService();
      const [account, risk] = await Promise.all([
        svc.getAccountInfo().catch(() => ({ assets: [], positions: [] })),
        svc.getPositionRisk().catch(() => [])
      ]);

      const merged = (account.positions || []).map((p) => {
        const r = Array.isArray(risk) ? risk.find((rk) => rk.symbol === p.symbol) : null;
        return { ...p, markPrice: r?.markPrice, liquidationPrice: r?.liquidationPrice };
      });
      res.json({ ...account, positions: merged });
    } catch (e) {
      res.status(200).json({ assets: [], positions: [], error: e.message });
    }
  });

  r.get('/balance', async (req, res, next) => {
    try { res.json({ balance: await getService().getUSDTBalance() }); }
    catch (e) { next(e); }
  });

  r.get('/position-risk', async (req, res) => {
    try {
      const cfg = loadBinanceConfig();
      if (!cfg.apiKey || !cfg.apiSecret) return res.json([]);
      const svc = getService();
      res.json(await svc.getPositionRisk());
    } catch (e) {
      res.json([]);
    }
  });

  r.post('/close-manual', async (req, res, next) => {
    try {
      const { symbol, type, quantity, isLive } = req.body;
      const svc = isLive ? getLiveService() : getService();
      
      // 0. Fetch LIVE POSITION to get real Entry Price BEFORE closing
      const account = await svc.getAccountInfo().catch(() => ({ positions: [] }));
      const livePos = (account.positions || []).find(p => p.symbol.toUpperCase() === symbol.toUpperCase() && parseFloat(p.positionAmt) !== 0);
      const realEntryPrice = livePos ? parseFloat(livePos.entryPrice) : 0;
      const realQuantity = livePos ? Math.abs(parseFloat(livePos.positionAmt)) : parseFloat(quantity || 0);

      // 1. Close on Binance
      const result = await svc.closePosition(symbol, type, quantity);
      const exitPrice = result.price || (await svc.getTickerPrice(symbol)).price;

      // 2. Try to find a matching bot
      const targetBot = botManager.findBotBySymbol(symbol);
      const { appendTrade } = await import('../../../data-layer/src/repositories/tradeRepository.js');

      if (targetBot && targetBot.openPositions && targetBot.openPositions.length > 0) {
          const pos = targetBot.openPositions[0];
          const finalEntry = pos.entryPrice || realEntryPrice;
          const finalQty = pos.quantity || realQuantity;
          const outTrade = {
              botId: targetBot.id,
              symbol: symbol,
              type: pos.type === 'LONG' ? 'SELL' : 'BUY',
              entryPrice: finalEntry,
              exitPrice: exitPrice,
              exitTime: new Date().toISOString(),
              pnl: (pos.type === 'LONG' ? (exitPrice - finalEntry) : (finalEntry - exitPrice)) * finalQty,
              strategy: targetBot.config.strategy,
              reason: '[MANUAL] User Closed'
          };
          appendTrade(outTrade);
          targetBot.openPositions = [];
      } else {
        // 3. Fallback: Manual Trade (Using real entry from exchange if possible)
        const side = type === 'SELL' ? 'BUY' : 'SELL'; // Closure side
        const pnl = (side === 'SELL' ? (exitPrice - realEntryPrice) : (realEntryPrice - exitPrice)) * realQuantity;

        appendTrade({
          botId: 'MANUAL_CLOSE',
          symbol: symbol,
          type: side,
          entryPrice: realEntryPrice || exitPrice,
          exitPrice: exitPrice,
          exitTime: new Date().toISOString(),
          pnl: pnl,
          reason: '[MANUAL] User Closed',
          strategy: 'Direct Manual'
        });
      }

      res.json(result);
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
      telegramChatId: cfg.telegramChatId || '',
      hasTelegram: !!(cfg.telegramToken && cfg.telegramChatId)
    });
  });

  // Handle POST to /api/binance/config (fix for frontend error)
  r.post('/config', async (req, res, next) => {
    try {
        const { apiKey, apiSecret, openRouterKey, openRouterModel, telegramToken, telegramChatId } = req.body;
        const { patchBinanceConfig } = await import('../../../data-layer/src/repositories/configRepository.js');
        patchBinanceConfig({ apiKey, apiSecret, openRouterKey, openRouterModel, telegramToken, telegramChatId });
        
        // Refresh BotManager config
        const updated = loadBinanceConfig();
        botManager.setConfig(updated);

        // Reset shared adapter to use new keys and propagate to all managers
        const newAdapter = new BinanceAdapter(updated.apiKey || '', updated.apiSecret || '');
        botManager.setExchange(newAdapter);
        if (portfolioManager) portfolioManager.setExchange(newAdapter);
        
        // Hot-swap telegram service and restart polling
        const { NotificationService } = await import('../../../bot-engine/src/NotificationService.js');
        const newNotif = new NotificationService(updated);
        botManager.setNotificationService(newNotif);
        // portfolioManager here is a single PM (legacy); polling will be restarted properly via /api/config
        if (portfolioManager) newNotif.startPolling(botManager, [portfolioManager]);

        res.json({ success: true });
    } catch (e) { next(e); }
  });

  r.get('/telegram-logs', async (req, res, next) => {
    try {
        const { getTelegramLogs } = await import('../../../data-layer/src/index.js');
        const logs = getTelegramLogs(50);
        res.json(logs);
    } catch (e) { next(e); }
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
      const { goal = 'High Volume Scalp', strategyType = null } = req.body;
      const svc = new BinanceAdapter(cfg.apiKey || '', cfg.apiSecret || '');
      const tickers = await svc.get24hTickers();

      // Pre-filter and compute regime suitability when strategyType is provided
      let regimeData = [];
      if (strategyType) {
        const { MarketScanner } = await import('../../../exchange-connector/src/MarketScanner.js');
        const scanner = new MarketScanner(svc);

        // Pick scan mode based on strategy type
        const scanMode = strategyType === 'grid' ? 'grid' : strategyType === 'scalp' ? 'scout' : 'precision';
        const candidates = await scanner.scanTopUSDT(40, scanMode);

        // Compute regime for top candidates in parallel (limit concurrency)
        const interval = strategyType === 'grid' ? '1h' : strategyType === 'scalp' ? '5m' : '15m';
        const BATCH = 10;
        for (let i = 0; i < Math.min(candidates.length, 40); i += BATCH) {
          const batch = candidates.slice(i, i + BATCH);
          const results = await Promise.all(
            batch.map(c => scanner.assessSuitability(c.symbol, strategyType, interval)
              .then(r => ({ symbol: c.symbol, ...r }))
              .catch(() => ({ symbol: c.symbol, suitable: false, score: 0 }))
            )
          );
          regimeData.push(...results);
        }

        // Sort tickers to put suitable coins first
        const suitableSet = new Set(regimeData.filter(r => r.suitable).map(r => r.symbol));
        tickers.sort((a, b) => {
          const aS = suitableSet.has(a.symbol) ? 1 : 0;
          const bS = suitableSet.has(b.symbol) ? 1 : 0;
          return bS - aS;
        });
      }

      const candidates = await huntBestSymbols(tickers, goal, cfg.openRouterKey, cfg.openRouterModel, regimeData);
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

  r.get('/mistakes', async (req, res, next) => {
    try {
        const { getRecentMistakes } = await import('../../../data-layer/src/index.js');
        const mistakes = getRecentMistakes(null, 20); // Get last 20 mistakes across all symbols
        res.json(mistakes);
    } catch (e) { next(e); }
  });

  r.get('/analytics', async (req, res, next) => {
    try {
      // 1. Get all closed trades
      const allTrades = getAllTradesFromBots(botManager.bots);
      if (!allTrades || allTrades.length === 0) {
        return res.json({
          sharpe: 0,
          maxDrawdown: 0,
          profitFactor: 0,
          equityCurve: [],
          totalTrades: 0,
          winRate: 0
        });
      }

      const pnlList = allTrades.map(t => parseFloat(t.pnl || 0));
      const equityCurve = generateEquityCurve(allTrades, 1000); // 1000 is default base

      const winCount = pnlList.filter(p => p > 0).length;
      
      res.json({
        sharpe: calculateSharpe(pnlList),
        maxDrawdown: calculateMaxDrawdown(equityCurve.map(e => e.value)),
        profitFactor: calculateProfitFactor(pnlList),
        equityCurve,
        totalTrades: allTrades.length,
        winRate: (winCount / allTrades.length) * 100
      });
    } catch (e) { next(e); }
  });

  r.post('/backtest', async (req, res, next) => {
    try {
      const { symbol, strategy, interval = '1h', tpPercent, slPercent, leverage, capital } = req.body;
      const { runBacktest } = await import('../../../bot-engine/src/Backtester.js');
      const svc = getService();
      const klines = await svc.getKlines(symbol, interval, 500); // 500 bars for backtest
      const result = runBacktest(klines, { symbol, strategy, interval, tpPercent, slPercent, leverage, capital });
      res.json(result);
    } catch (e) { next(e); }
  });

  r.get('/klines', async (req, res, next) => {
    try {
      const { symbol, interval = '1h', limit = 500 } = req.query;
      const svc = getService();
      const klines = await svc.getKlines(symbol, interval, parseInt(limit));
      res.json(klines);
    } catch (e) { next(e); }
  });

  r.get('/market-depth', async (req, res, next) => {
    try {
      const { symbol } = req.query;
      if (!symbol) return res.status(400).json({ error: 'Symbol is required' });
      const svc = getService();
      
      // Fetch microstructure data (OI and Funding)
      const [oi, funding] = await Promise.all([
        svc.getOpenInterest(symbol).catch(() => null),
        svc.getFundingRate(symbol).catch(() => null)
      ]);

      res.json({
        symbol,
        openInterest: oi?.openInterest || oi?.openInterestAmount || oi?.info?.sumOpenInterest || 0,
        fundingRate: funding?.lastFundingRate || funding?.fundingRate || 0,
        nextFundingTime: funding?.nextFundingTime || 0,
        timestamp: Date.now()
      });
    } catch (e) { next(e); }
  });

  return r;
}

