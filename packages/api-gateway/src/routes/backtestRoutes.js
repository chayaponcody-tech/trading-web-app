import express from 'express';
import { runBacktest, runBacktestCompare } from '../../../bot-engine/src/Backtester.js';
import { getBacktestHistory, getBacktestById } from '../../../data-layer/src/repositories/backtestRepository.js';

export function createBacktestRoutes(exchange) {
  const router = express.Router();

  // GET / — fetch klines for chart preview (used by Backtest.tsx frontend)
  router.get('/', async (req, res) => {
    try {
      if (!exchange) return res.status(503).json({ error: 'Exchange not available' });

      const { symbol = 'BTCUSDT', interval = '1h', limit = 1000, startTime, endTime } = req.query;

      const klines = await exchange.getKlines(
        symbol,
        interval,
        parseInt(limit),
        startTime ? parseInt(startTime) : undefined,
        endTime   ? parseInt(endTime)   : undefined,
      );
      res.json(klines);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /run — run a single backtest
  router.post('/run', async (req, res) => {
    try {
      const { symbol, strategy, interval } = req.body;

      if (!symbol || !strategy || !interval) {
        return res.status(400).json({ error: 'Missing required fields: symbol, strategy, interval' });
      }

      if (!exchange) {
        return res.status(503).json({ error: 'Exchange not available' });
      }

      const result = await runBacktest(exchange, req.body);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /compare — run multiple backtest configs for comparison
  router.post('/compare', async (req, res) => {
    try {
      const { configs } = req.body;

      if (!Array.isArray(configs)) {
        return res.status(400).json({ error: 'configs must be an array' });
      }

      if (configs.length > 10) {
        return res.status(400).json({ error: 'Maximum 10 configs per comparison' });
      }

      const results = await runBacktestCompare(exchange, configs);
      res.json(results);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /history — list backtest history (no trades)
  router.get('/history', (req, res) => {
    try {
      const history = getBacktestHistory();
      res.json(history);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /history/:backtestId — get full backtest result by ID
  router.get('/history/:backtestId', (req, res) => {
    try {
      const result = getBacktestById(req.params.backtestId);
      if (!result) {
        return res.status(404).json({ error: 'Backtest result not found' });
      }
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
