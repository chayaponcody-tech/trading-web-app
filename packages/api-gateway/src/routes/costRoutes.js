import { Router } from 'express';
import { getTokenLogs, getTokenSummary } from '../../../data-layer/src/index.js';

export function createCostRoutes() {
  const router = Router();

  // Get token usage logs
  router.get('/token-logs', (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const logs = getTokenLogs(limit);
      res.json(logs);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Get token usage summary
  router.get('/token-summary', (req, res) => {
    try {
      const summary = getTokenSummary();
      res.json(summary);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
