import { Router } from 'express';
import crypto from 'crypto';
import {
  createStrategy,
  getStrategyById,
  getAllStrategies,
  updateStrategy,
  deleteStrategy,
  strategyNameExists,
  saveStrategyBacktestResult,
  getStrategyBacktestHistory,
  getStrategyBacktestById,
  getStrategyByName,
} from '../../../data-layer/src/repositories/strategyRepository.js';
import { getAllBots } from '../../../data-layer/src/repositories/botRepository.js';
import {
  runMultiAssetBacktest,
  runRandomWindowBacktest,
} from '../services/multiAssetBacktestService.js';

// ─── Built-in JS strategies (mirrors useStrategyList.ts) ─────────────────────

const BUILTIN_STRATEGY_KEYS = [
  'EMA', 'RSI', 'BB', 'EMA_RSI', 'BB_RSI', 'EMA_BB_RSI',
  'GRID', 'AI_SCOUTER', 'EMA_SCALP', 'STOCH_RSI', 'VWAP_SCALP',
  'EMA_CROSS', 'EMA_CROSS_V2', 'RSI_TREND', 'BB_BREAKOUT', 'OI_FUNDING_ALPHA',
  'SATS', 'AI_GRID', 'AI_GRID_SCALP', 'AI_GRID_SWING', 'RSI_DIVERGENCE',
];

/**
 * Resolve a strategy by id (UUID) or by key name (built-in).
 * Returns a StrategyDefinition-compatible object or null.
 */
function resolveStrategy(idOrKey) {
  // Try database by UUID first
  const fromDb = getStrategyById(idOrKey);
  if (fromDb) return fromDb;

  // Try database by name (case-insensitive)
  const byName = getStrategyByName(idOrKey);
  if (byName) return byName;

  // Fallback: built-in strategy by key name (case-insensitive)
  const upper = idOrKey.toUpperCase();
  if (BUILTIN_STRATEGY_KEYS.includes(upper)) {
    return {
      id: `builtin:${upper}`,
      name: upper,
      description: '',
      engineType: 'python',
      defaultParams: {},
      tags: ['built-in'],
      createdAt: '',
      updatedAt: '',
    };
  }

  return null;
}

// ─── Validation Middleware ────────────────────────────────────────────────────

function validateCreateStrategy(req, res, next) {
  const { name } = req.body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Missing required fields: name' });
  }

  if (!req.body.pythonCode || !req.body.pythonCode.trim()) {
    return res.status(400).json({ error: 'pythonCode is required' });
  }

  // Force engineType to python always
  req.body.engineType = 'python';

  next();
}

// ─── Python Service Registration ─────────────────────────────────────────────

async function _registerWithPythonService(strategy) {
  if (!strategy?.pythonCode) return;
  try {
    const { loadBinanceConfig } = await import('../../../data-layer/src/repositories/configRepository.js');
    const { strategyAiUrl } = loadBinanceConfig();
    await fetch(`${strategyAiUrl}/strategy/register-dynamic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: strategy.name, python_code: strategy.pythonCode }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    console.warn(`[StrategyRoutes] Python service register failed for "${strategy.name}":`, e.message);
  }
}

// ─── Strategy Routes ──────────────────────────────────────────────────────────

export function createStrategyRoutes(exchange) {
  const r = Router();

  // GET / — list all strategies (supports ?engineType= and ?tags= query params)
  r.get('/', (req, res) => {
    try {
      const filter = {};
      if (req.query.engineType) {
        filter.engineType = req.query.engineType;
      }
      if (req.query.tags) {
        // Accept comma-separated tags: ?tags=trend,momentum
        filter.tags = req.query.tags.split(',').map(t => t.trim()).filter(Boolean);
      }
      const strategies = getAllStrategies(filter);
      res.json(strategies);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /:id — get strategy by id
  r.get('/:id', (req, res) => {
    try {
      const strategy = getStrategyById(req.params.id);
      if (!strategy) {
        return res.status(404).json({ error: 'ไม่พบกลยุทธ์ที่ระบุ' });
      }
      res.json(strategy);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST / — create strategy
  r.post('/', validateCreateStrategy, async (req, res) => {
    try {
      const { name } = req.body;

      if (strategyNameExists(name)) {
        return res.status(409).json({ error: 'ชื่อกลยุทธ์นี้มีอยู่แล้วในระบบ' });
      }

      const strategy = createStrategy(req.body);

      // Auto-register with Python service
      await _registerWithPythonService(strategy);

      res.status(201).json(strategy);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // PUT /:id — update strategy
  r.put('/:id', async (req, res) => {
    try {
      const existing = getStrategyById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'ไม่พบกลยุทธ์ที่ระบุ' });
      }

      if (req.body.name && req.body.name !== existing.name) {
        if (strategyNameExists(req.body.name, req.params.id)) {
          return res.status(409).json({ error: 'ชื่อกลยุทธ์นี้มีอยู่แล้วในระบบ' });
        }
      }

      const updated = updateStrategy(req.params.id, req.body);

      // Re-register with Python service if pythonCode changed
      if (req.body.pythonCode) {
        await _registerWithPythonService(updated);
      }

      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  // DELETE /:id — delete strategy
  r.delete('/:id', (req, res) => {
    try {
      const existing = resolveStrategy(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'ไม่พบกลยุทธ์ที่ระบุ' });
      }

      // Prevent deletion of built-in strategies (including PINE_ prefix)
      const isBuiltin = existing.id.startsWith('builtin:') || 
                        existing.name.startsWith('PINE_') || 
                        BUILTIN_STRATEGY_KEYS.includes(existing.name.toUpperCase());

      if (isBuiltin) {
        return res.status(403).json({ error: 'ไม่สามารถลบกลยุทธ์พื้นฐานหรือกลยุทธ์จาก Pine Script ได้' });
      }

      // Check if any active bot is using this strategy (by name)
      const allBots = getAllBots();
      const hasActiveBot = allBots.some(
        bot => bot.isRunning && bot.config?.strategy === existing.name
      );

      if (hasActiveBot) {
        return res.status(409).json({ error: 'ไม่สามารถลบกลยุทธ์ที่มี bot กำลังใช้งานอยู่' });
      }

      deleteStrategy(req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /:id/backtest/multi-asset — run multi-asset backtest
  r.post('/:id/backtest/multi-asset', async (req, res) => {
    try {
      const { symbols, interval, startDate, endDate, params } = req.body;

      // Validate required fields
      if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
        return res.status(400).json({ error: 'Missing required fields: symbols' });
      }
      if (symbols.length > 20) {
        return res.status(400).json({ error: 'รองรับสูงสุด 20 coin ต่อการรัน backtest' });
      }
      if (!interval) {
        return res.status(400).json({ error: 'Missing required fields: interval' });
      }
      if (!startDate) {
        return res.status(400).json({ error: 'Missing required fields: startDate' });
      }
      if (!endDate) {
        return res.status(400).json({ error: 'Missing required fields: endDate' });
      }

      // Load strategy (supports UUID or built-in key name)
      const strategy = resolveStrategy(req.params.id);
      if (!strategy) {
        return res.status(404).json({ error: 'ไม่พบกลยุทธ์ที่ระบุ' });
      }

      if (!exchange) {
        return res.status(503).json({ error: 'Exchange not available' });
      }

      const backtestResult = await runMultiAssetBacktest(exchange, strategy, {
        symbols,
        interval,
        startDate,
        endDate,
        params,
      });

      const backtestId = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      // Only save to DB for non-builtin strategies
      if (!strategy.id.startsWith('builtin:')) {
        saveStrategyBacktestResult({
          backtestId,
          strategyId: strategy.id,
          backtestType: 'multi-asset',
          symbols,
          interval,
          config: { startDate, endDate, params },
          summaryMetrics: backtestResult.summary,
          assetResults: backtestResult.results,
          createdAt,
        });
      }

      res.json({
        backtestId,
        strategyId: strategy.id,
        strategyName: strategy.name,
        ...backtestResult,
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /:id/backtest/random-window — run random window backtest
  r.post('/:id/backtest/random-window', async (req, res) => {
    try {
      const { symbols, interval, windowDays, lookbackYears, numWindows, params } = req.body;

      // Validate required fields
      if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
        return res.status(400).json({ error: 'Missing required fields: symbols' });
      }
      if (!interval) {
        return res.status(400).json({ error: 'Missing required fields: interval' });
      }
      if (!windowDays || typeof windowDays !== 'number' || windowDays < 1) {
        return res.status(400).json({ error: 'Missing required fields: windowDays' });
      }
      if (!lookbackYears || typeof lookbackYears !== 'number' || lookbackYears < 1 || lookbackYears > 5) {
        return res.status(400).json({ error: 'lookbackYears ต้องอยู่ในช่วง 1-5' });
      }
      if (!numWindows || typeof numWindows !== 'number' || numWindows < 1) {
        return res.status(400).json({ error: 'Missing required fields: numWindows' });
      }
      if (numWindows > 10) {
        return res.status(400).json({ error: 'รองรับสูงสุด 10 windows ต่อการรัน' });
      }

      // Load strategy (supports UUID or built-in key name)
      const strategy = resolveStrategy(req.params.id);
      if (!strategy) {
        return res.status(404).json({ error: 'ไม่พบกลยุทธ์ที่ระบุ' });
      }

      if (!exchange) {
        return res.status(503).json({ error: 'Exchange not available' });
      }

      const backtestResult = await runRandomWindowBacktest(exchange, strategy, {
        symbols,
        interval,
        windowDays,
        lookbackYears,
        numWindows,
        params,
      });

      const backtestId = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      // Only save to DB for non-builtin strategies
      if (!strategy.id.startsWith('builtin:')) {
        saveStrategyBacktestResult({
          backtestId,
          strategyId: strategy.id,
          backtestType: 'random-window',
          symbols,
          interval,
          config: { windowDays, lookbackYears, numWindows, params },
          summaryMetrics: backtestResult.summary,
          assetResults: backtestResult.windows,
          createdAt,
        });
      }

      res.json({
        backtestId,
        strategyId: strategy.id,
        strategyName: strategy.name,
        ...backtestResult,
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /:id/backtest/history — list backtest history for a strategy
  r.get('/:id/backtest/history', (req, res) => {
    try {
      const strategy = getStrategyById(req.params.id);
      if (!strategy) {
        return res.status(404).json({ error: 'ไม่พบกลยุทธ์ที่ระบุ' });
      }

      const history = getStrategyBacktestHistory(strategy.id);
      res.json(history);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /:id/backtest/history/:btId — get full backtest detail
  r.get('/:id/backtest/history/:btId', (req, res) => {
    try {
      const result = getStrategyBacktestById(req.params.btId);
      if (!result) {
        return res.status(404).json({ error: 'ไม่พบผลลัพธ์ backtest ที่ระบุ' });
      }
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return r;
}
