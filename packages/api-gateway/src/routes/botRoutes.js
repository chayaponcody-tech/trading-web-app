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
          startedAt: bot.startedAt,
          aiReason: bot.aiReason,
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
      if (config.aiCheckInterval !== undefined) bot.config.aiCheckInterval = config.aiCheckInterval;
      botManager._save();
      res.json({ success: true });
    } catch (e) { next(e); }
  });

  return r;
}
