import { Router } from 'express';
import { 
  getAllFleets, upsertFleet, deleteFleet, getFleetById, getFleetLogs 
} from '../../../data-layer/src/index.js';

/**
 * @param {Map<string, PortfolioManager>} portfolioManagers 
 * @param {Object} options - additional context (botManager, exchange)
 */
export function createPortfolioRoutes(portfolioManagers, { botManager, exchange }) {
  const r = Router();

  /** 🛒 List all fleets from DB */
  r.get('/fleets', (req, res) => {
    try {
      const fleets = getAllFleets();
      // Enrich with runtime status
      const enriched = fleets.map(f => {
        const pm = portfolioManagers.get(f.id);
        return {
          ...f,
          isRunning: pm ? pm.isRunning : false,
          currentAction: pm ? pm.currentAction : 'Inactive'
        };
      });
      res.json(enriched);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /** ➕ Create new fleet */
  r.post('/fleets', async (req, res) => {
    try {
      const { name, config } = req.body;
      const id = 'fleet_' + Math.random().toString(36).substr(2, 9);
      const newFleet = {
        id,
        name: name || 'New Fleet',
        config: config || {
            isAutonomous: false,
            totalBudget: 1000,
            maxDailyLossPct: 5,
            targetBotCount: 3,
            riskMode: 'confident'
        },
        isRunning: 0
      };
      
      upsertFleet(newFleet);
      
      // We don't automatically start the runtime Manager here, 
      // the orchestrator in server.js or a specific /start endpoint should do it.
      // For simplicity, let's suggest a restart or implement dynamic start.
      res.json({ message: 'Fleet created. Please restart or toggle to activate.', fleet: newFleet });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /** 📊 Get specific fleet status */
  r.get('/fleets/:id/status', (req, res) => {
    const { id } = req.params;
    const pm = portfolioManagers.get(id);
    const fleet = getFleetById(id);
    
    if (!fleet) return res.status(404).json({ error: 'Fleet not found' });

    res.json({
      id: fleet.id,
      name: fleet.name,
      isRunning: pm ? pm.isRunning : false,
      currentAction: pm ? pm.currentAction : 'Off',
      config: pm ? pm.config : fleet.config,
      logs: pm ? pm.logs : getFleetLogs(id, 50)
    });
  });

  /** 📈 Get specific fleet analytics & equity curve */
  r.get('/fleets/:id/analytics', async (req, res, next) => {
    try {
      const { id } = req.params;
      const pm = portfolioManagers.get(id);
      
      // Get bot IDs belonging to this fleet from the central botManager
      const botIds = Array.from(botManager.bots.values())
        .filter(b => b.config.managedBy === id)
        .map(b => b.id);

      const { getAllTradesByFleet } = await import('../../../data-layer/src/repositories/tradeRepository.js');
      const { calculateSharpe, calculateMaxDrawdown, calculateProfitFactor, generateEquityCurve } = await import('../../../shared/AnalyticsUtils.js');

      const trades = getAllTradesByFleet(id, botIds);
      if (!trades || trades.length === 0) {
        return res.json({ sharpe: 0, maxDrawdown: 0, profitFactor: 0, equityCurve: [], totalTrades: 0, winRate: 0 });
      }

      const pnlList = trades.map(t => parseFloat(t.pnl || 0));
      const equityCurve = generateEquityCurve(trades, 1000);

      res.json({
        sharpe: calculateSharpe(pnlList),
        maxDrawdown: calculateMaxDrawdown(equityCurve.map(e => e.value)),
        profitFactor: calculateProfitFactor(pnlList),
        equityCurve,
        totalTrades: trades.length,
        winRate: (pnlList.filter(p => p > 0).length / trades.length) * 100
      });
    } catch (e) { next(e); }
  });

  /** 🧠 CIO Global Portfolio Review */
  r.get('/global-review', async (req, res, next) => {
    try {
      const isLive = req.query.isLive === 'true';
      const { analyzeGlobalPortfolio } = await import('../../../ai-agents/src/index.js');
      const { loadBinanceConfig, saveGlobalAiReport } = await import('../../../data-layer/src/index.js');
      
      const binanceCfg = loadBinanceConfig();
      if (!binanceCfg.openRouterKey) return res.status(401).json({ error: 'OpenRouter Key missing' });

      const allFleets = getAllFleets();
      const filteredFleets = allFleets.filter(f => isLive ? f.config?.exchange === 'binance_live' : f.config?.exchange !== 'binance_live');
      
      // Enrich fleets with isRunning logic from portfolioManagers
      const enrichedFleets = filteredFleets.map(f => {
        const pm = portfolioManagers.get(f.id);
        return { ...f, isRunning: pm ? pm.isRunning : false };
      });
      
      const allBots = Array.from(botManager.bots.values()).filter(b => isLive ? b.config?.exchange === 'binance_live' : b.config?.exchange !== 'binance_live');
      const report = await analyzeGlobalPortfolio(enrichedFleets, allBots, binanceCfg.openRouterKey, binanceCfg.openRouterModel);
      
      // Save for future knowledge retrieval / RAG
      saveGlobalAiReport(report);

      res.json({ report });
    } catch (e) { next(e); }
  });

  /** ⚡ AI Master Strategy Wizard (AI CIO) */
  r.post('/propose-strategy', async (req, res, next) => {
    try {
      const { totalAmount } = req.body;
      const { proposeFundStrategy } = await import('../../../ai-agents/src/index.js');
      const { loadBinanceConfig } = await import('../../../data-layer/src/index.js');
      
      const binanceCfg = loadBinanceConfig();
      if (!binanceCfg.openRouterKey) return res.status(401).json({ error: 'OpenRouter Key missing' });

      // Get market context
      const tickersArr = await exchange.get24hTickers();
      const topTickers = (Array.isArray(tickersArr) ? tickersArr : Object.values(tickersArr))
        .sort((a, b) => (b.quoteVolume || 0) - (a.quoteVolume || 0))
        .slice(0, 30);

      // Returns all 3 tiers (safe, balanced, aggressive)
      const strategies = await proposeFundStrategy(
        totalAmount, 
        topTickers, 
        binanceCfg.openRouterKey, 
        binanceCfg.openRouterModel
      );

      res.json(strategies);
    } catch (e) { 
      console.error('❌ [propose-strategy] Critical Error:', e);
      next(e); 
    }
  });

  /** ⚙️ Update fleet settings */
  r.post('/fleets/:id/settings', async (req, res) => {
    const { id } = req.params;
    const pm = portfolioManagers.get(id);
    
    try {
      if (pm) {
        // Strip isAutonomous from config update — toggle route handles start/stop + persist
        const { isAutonomous, ...configWithoutAuto } = req.body;
        const updated = await pm.updateConfig(configWithoutAuto);
        res.json({ message: 'Fleet settings updated', config: updated });
      } else {
        const fleet = getFleetById(id);
        if (!fleet) return res.status(404).json({ error: 'Fleet not found' });
        
        if (req.body.name) {
          fleet.name = req.body.name;
          delete req.body.name;
        }

        fleet.config = { ...fleet.config, ...req.body };
        upsertFleet(fleet);
        res.json({ message: 'Fleet settings updated (persisted only)', config: fleet.config, name: fleet.name });
      }
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /** ⏯️ Toggle fleet */
  r.post('/fleets/:id/toggle', async (req, res) => {
    const { id } = req.params;
    const { active } = req.body;
    let pm = portfolioManagers.get(id);
    
    if (!pm && active) {
        // Dynamic instantiation if not running
        const { PortfolioManager } = await import('../../../bot-engine/src/PortfolioManager.js');
        const fleet = getFleetById(id);
        if (!fleet) return res.status(404).json({ error: 'Fleet not found' });
        
        pm = new PortfolioManager(botManager, exchange, { 
            managerId: fleet.id, 
            name: fleet.name,
            config: fleet.config
        });
        await pm.init();
        portfolioManagers.set(id, pm);
    }

    if (pm) {
        if (active) pm.start();
        else pm.stop();

        // Sync in-memory config
        pm.config.isAutonomous = !!active;

        // ─── Persist state to DB so it survives restart ───────────────────
        const fleet = getFleetById(id);
        if (fleet) {
            upsertFleet({
                ...fleet,
                isRunning: active ? 1 : 0,
                config: { ...fleet.config, isAutonomous: !!active }
            });
        }
        res.json({ isRunning: pm.isRunning, isAutonomous: !!active });
    } else {
        res.status(404).json({ error: 'Manager not available' });
    }
  });

  /** ⏯️ Toggle all bots in fleet */
  r.post('/fleets/:id/bots-action', async (req, res) => {
    const { id } = req.params;
    const { action } = req.body; // 'start' or 'stop'

    try {
      const botsInFleet = Array.from(botManager.bots.values())
        .filter(b => (b.managedBy || b.config?.managedBy) === id);

      for (const bot of botsInFleet) {
        if (action === 'start') {
          botManager.resumeBot(bot.id);
        } else {
          botManager.stopBot(bot.id);
        }
      }

      res.json({ success: true, count: botsInFleet.length });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /** 🚀 Clone fleet to Live Production */
  r.post('/fleets/:id/clone-live', async (req, res) => {
    const { id } = req.params;
    try {
      const sourceFleet = getFleetById(id);
      if (!sourceFleet) return res.status(404).json({ error: 'Source fleet not found' });

      const newId = 'fleet_live_' + Math.random().toString(36).substr(2, 6);
      const liveFleet = {
        ...sourceFleet,
        id: newId,
        name: `${sourceFleet.name} (LIVE)`,
        isRunning: 0,
        config: {
          ...sourceFleet.config,
          exchange: 'binance_live',
          isAutonomous: false // Start as stopped for safety
        }
      };

      upsertFleet(liveFleet);
      res.json({ message: 'Fleet cloned to Production (Live). Ready to activate.', fleet: liveFleet });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /** 🗑️ Delete fleet */

  r.delete('/fleets/:id', (req, res) => {
    const { id } = req.params;
    const pm = portfolioManagers.get(id);
    if (pm) pm.stop();
    portfolioManagers.delete(id);
    deleteFleet(id);
    res.json({ success: true, message: 'Fleet deleted' });
  });

  /** ⚡ Force immediate fleet review (skip interval) */
  r.post('/fleets/:id/review', async (req, res) => {
    const { id } = req.params;
    const pm = portfolioManagers.get(id);
    if (!pm) return res.status(404).json({ error: 'Fleet manager not running. Toggle fleet on first.' });
    if (pm.isScanning) return res.status(409).json({ error: 'Review already in progress.' });
    try {
      await pm.forceReview();
      res.json({ success: true, message: 'Fleet review triggered.', currentAction: pm.currentAction, logs: pm.logs.slice(0, 10) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /** ⚙️ Update Fleet Settings (Confidence/Model) */
  r.put('/fleets/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { minConfidence } = req.body;

      if (minConfidence === undefined) return res.status(400).json({ error: 'minConfidence is required' });

      const fleet = getFleetById(id);
      if (!fleet) return res.status(404).json({ error: 'Fleet not found' });

      const confidenceValue = Number(minConfidence);
      if (Number.isNaN(confidenceValue)) {
        return res.status(400).json({ error: 'minConfidence must be a number' });
      }

      // Persist minConfidence inside the fleet config JSON.
      fleet.config = {
        ...fleet.config,
        minConfidence: confidenceValue
      };
      upsertFleet(fleet);

      // Update Live Engine (If active)
      const pm = portfolioManagers.get(id);
      if (pm) {
        pm.config.minConfidence = confidenceValue;
        console.info(`[Fleet] Updated LIVE fleet ${id} minConfidence to ${confidenceValue}%`);
      }

      res.json({ success: true, message: 'Settings updated' });
    } catch (error) {
      console.error(`[Fleet Update Error] ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Legacy Compatibility (Targets default fleet) ---
  const getDefaultPM = () => Array.from(portfolioManagers.values())[0];

  r.get('/status', (req, res) => {
    const pm = getDefaultPM();
    if (!pm) return res.status(404).json({ error: 'No fleet active' });
    res.json({
      isRunning: pm.isRunning,
      currentAction: pm.currentAction,
      config: pm.config,
      logs: pm.logs
    });
  });

  r.post('/settings', async (req, res) => {
    const pm = getDefaultPM();
    if (!pm) return res.status(404).json({ error: 'No fleet active' });
    const updated = await pm.updateConfig(req.body);
    res.json({ message: 'Portfolio settings updated', config: updated });
  });

  r.post('/toggle', (req, res) => {
    const pm = getDefaultPM();
    if (!pm) return res.status(404).json({ error: 'No fleet active' });
    const { active } = req.body;
    if (active) pm.start();
    else pm.stop();
    res.json({ isRunning: pm.isRunning });
  });

  return r;
}
