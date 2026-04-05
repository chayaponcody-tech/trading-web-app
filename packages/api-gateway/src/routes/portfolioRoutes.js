import { Router } from 'express';

export function createPortfolioRoutes(portfolioManager) {
  const r = Router();

  /**
   * @swagger
   * /api/portfolio/status:
   *   get:
   *     summary: Get current portfolio manager status and config
   *     tags: [Portfolio]
   */
  r.get('/status', (req, res) => {
    res.json({
      isRunning: portfolioManager.isRunning,
      currentAction: portfolioManager.currentAction,
      config: portfolioManager.config,
      logs: portfolioManager.logs
    });
  });

  /**
   * @swagger
   * /api/portfolio/settings:
   *   post:
   *     summary: Update portfolio management settings
   *     tags: [Portfolio]
   */
  r.post('/settings', async (req, res) => {
    try {
      const updated = await portfolioManager.updateConfig(req.body);
      res.json({ message: 'Portfolio settings updated', config: updated });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * @swagger
   * /api/portfolio/toggle:
   *   post:
   *     summary: Start or stop the portfolio manager loop
   *     tags: [Portfolio]
   */
  r.post('/toggle', (req, res) => {
    const { active } = req.body;
    if (active) portfolioManager.start();
    else portfolioManager.stop();
    res.json({ isRunning: portfolioManager.isRunning });
  });

  return r;
}
