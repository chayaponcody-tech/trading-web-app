import { Router } from 'express';
import { getAllTradesFromBots } from '../../../data-layer/src/repositories/tradeRepository.js';
import { getTuningHistory } from '../../../data-layer/src/repositories/botRepository.js';

// ─── Bot Routes ───────────────────────────────────────────────────────────────
export function createBotRoutes(botManager) {
  const r = Router();

  /**
   * @swagger
   * /api/forward-test/status:
   *   get:
   *     summary: Get full state of all bots
   *     tags: [Bots]
   *     responses:
   *       200:
   *         description: List of all bots with full internal state
   */
  r.get('/status', async (req, res) => {
    try {
      // Returns all bots currently managed in memory (Active/Stopped/etc)
      const allBots = Array.from(botManager.bots.values());
      res.json(allBots);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * @swagger
   * /api/forward-test/start:
   *   post:
   *     summary: Launch a new trading bot
   *     tags: [Bots]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               symbol: { type: string, example: "BTCUSDT" }
   *               strategy: { type: string, example: "AI_GRID_SCALP" }
   *               interval: { type: string, example: "15m" }
   *               leverage: { type: number, example: 10 }
   *               positionSizeUSDT: { type: number, example: 100 }
   *               tpPercent: { type: number, example: 1.5 }
   *               slPercent: { type: number, example: 1.0 }
   *     responses:
   *       200:
   *         description: Bot started successfully
   */
  r.post('/start',  async (req, res, next) => {
    try { res.json({ success: true, botId: await botManager.startBot(req.body) }); }
    catch (e) { next(e); }
  });

  /**
   * @swagger
   * /api/forward-test/stop:
   *   post:
   *     summary: Stop a running bot
   *     tags: [Bots]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               botId: { type: string }
   */
  r.post('/stop',   (req, res) => { botManager.stopBot(req.body.botId); res.json({ success: true }); });

  /**
   * @swagger
   * /api/forward-test/resume:
   *   post:
   *     summary: Resume a stopped bot
   *     tags: [Bots]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               botId: { type: string }
   */
  r.post('/resume', (req, res) => { botManager.resumeBot(req.body.botId); res.json({ success: true }); });

  /**
   * @swagger
   * /api/forward-test/delete:
   *   post:
   *     summary: Delete a bot permanently
   *     tags: [Bots]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               botId: { type: string }
   */
  r.post('/delete', (req, res) => { botManager.deleteBot(req.body.botId); res.json({ success: true }); });

  /**
   * @swagger
   * /api/forward-test/adopt:
   *   post:
   *     summary: Manually adopt an external position into a Guardian bot
   *     tags: [Bots]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               symbol: { type: string, example: "BNBUSDT" }
   */
  r.post('/adopt', async (req, res, next) => {
    try {
      const { symbol } = req.body;
      if (!symbol) return res.status(400).json({ error: 'Symbol is required' });
      await botManager.reattachOrphanPositions(symbol);
      res.json({ success: true, message: `Adoption process started for ${symbol}` });
    } catch (e) {
      next(e);
    }
  });

  /**
   * @swagger
   * /api/forward-test/clear-all:
   *   post:
   *     summary: Wipe ALL bots from memory and database
   *     tags: [Bots]
   */
  r.post('/clear-all', async (req, res) => {
    try {
      console.log('[Gateway] Hard Reset Triggered...');
      
      // 1. Stop all bots first (this stops timers)
      botManager.bots.forEach((bot, id) => {
        const timer = botManager.timers.get(id);
        if (timer) clearInterval(timer);
      });
      
      // 2. Clear memory maps COMPLETELY
      botManager.bots.clear();
      botManager.timers.clear();
      
      // 3. Wipe disk via repository and AWAIT it
      const { deleteAllBots } = await import('../../../data-layer/src/repositories/botRepository.js');
      await deleteAllBots(); // Ensure DB is wiped while memory is empty
      
      console.log('[Gateway] Hard Reset Complete. Blank slate.');
      res.json({ success: true, message: 'All bots wiped from memory and database.' });
    } catch (e) {
      console.error('[Gateway] Clear-all error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * @swagger
   * /api/forward-test/summary:
   *   get:
   *     summary: Get a lightweight summary of all bots (Used by Frontend)
   *     tags: [Bots]
   *     responses:
   *       200:
   *         description: Array of bot summaries
   */
  r.get('/summary', async (req, res) => {
    try {
      const activeBots = Array.from(botManager.bots.values());
      
      const summary = activeBots
        .sort((a, b) => (b.isRunning ? 1 : 0) - (a.isRunning ? 1 : 0))
        .map((bot) => ({
          id: bot.id, isRunning: bot.isRunning,
          symbol: bot.config?.symbol, interval: bot.config?.interval,
          strategy: bot.config?.strategy,
          netPnl: parseFloat((bot.netPnl || 0).toFixed(2)),
          unrealizedPnl: parseFloat((bot.unrealizedPnl || 0).toFixed(2)),
          totalTrades: (bot.trades || []).length,
          winRate: (bot.totalTrades > 0 && bot.winCount !== undefined)
            ? parseFloat(((bot.winCount / bot.totalTrades) * 100).toFixed(1)) : 0,
          openPositions: (bot.openPositions || []).length,
          currentPrice: bot.currentPrice || 0,
          lastSignal: bot.lastSignal,
          lastEntryReason: bot.lastEntryReason,
          startedAt: bot.startedAt,
          aiReason: bot.aiReason,
          managedBy: bot.config?.managedBy || bot.managedBy || null,
          currentThought: bot.currentThought || '...',
          lastThoughtAt: bot.lastThoughtAt,
          durationMinutes: bot.config?.durationMinutes
        }));
      res.json(summary);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  r.post('/update', (req, res, next) => {
    try {
      const { botId, config } = req.body;
      const bot = botManager.bots.get(botId);
      if (!bot) return res.status(404).json({ error: 'Bot not found' });
      if (config.tpPercent !== undefined) bot.config.tpPercent = config.tpPercent;
      if (config.slPercent !== undefined) bot.config.slPercent = config.slPercent;
      if (config.trailingStopPct !== undefined) bot.config.trailingStopPct = config.trailingStopPct;
      if (config.trailingActivationPct !== undefined) bot.config.trailingActivationPct = config.trailingActivationPct;
      if (config.aiCheckInterval !== undefined) bot.config.aiCheckInterval = config.aiCheckInterval;
      botManager._save();
      res.json({ success: true });
    } catch (e) { next(e); }
  });

  /**
   * @swagger
   * /api/forward-test/reattach:
   *   post:
   *     summary: Scan Binance for unmanaged positions and re-attach them to bots
   *     tags: [Bots]
   *     responses:
   *       200:
   *         description: Re-attach scan completed
   */
  r.post('/reattach', async (req, res, next) => {
    try {
      await botManager.reattachOrphanPositions();
      res.json({ success: true, message: 'Re-attach scan completed' });
    } catch (e) { next(e); }
  });

  /**
   * @swagger
   * /api/forward-test/tuning-history:
   *   get:
   *     summary: Get parameter tuning history with engine info (optuna vs vectorbt)
   *     tags: [Bots]
   *     parameters:
   *       - in: query
   *         name: limit
   *         schema: { type: integer, default: 50 }
   */
  r.get('/tuning-history', (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const rows = getTuningHistory(limit);
      const parsed = rows.map(r => ({
        ...r,
        oldParams: JSON.parse(r.oldParams || '{}'),
        newParams: JSON.parse(r.newParams || '{}'),
        engine: r.engine ?? 'optuna',
        timestamp: r.timestamp && !r.timestamp.endsWith('Z') ? r.timestamp.replace(' ', 'T') + 'Z' : r.timestamp,
      }));
      res.json(parsed);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * @swagger
   * /api/forward-test/tune-all:
   *   post:
   *     summary: Force AI parameter tuning for all running bots immediately
   *     tags: [Bots]
   */
  r.post('/tune-all', async (req, res) => {
    try {
      const runningBots = Array.from(botManager.bots.values()).filter(b => b.isRunning);
      console.log(`[Gateway] Manual Tuning triggered for ${runningBots.length} bots`);
      
      // Run tuning in background to not block response
      for (const bot of runningBots) {
        if (bot._lastKlines && bot._lastKlines.length > 50) {
          const closed = bot._lastKlines.slice(0, -1);
          const closes = closed.map(k => parseFloat(k[4]));
          const highs = closed.map(k => parseFloat(k[2]));
          const lows = closed.map(k => parseFloat(k[3]));
          const volumes = closed.map(k => parseFloat(k[5]));
          botManager.tuningService.tuneBot(bot, closes, highs, lows, volumes).catch(e => console.error(`[Manual Tune] Bot ${bot.id} error:`, e.message));
        }
      }
      
      res.json({ success: true, message: `Tuning started for ${runningBots.length} bots.` });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return r;
}
