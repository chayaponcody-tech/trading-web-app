import express from 'express';
import crypto from 'crypto';
import { runBacktest } from '../../../bot-engine/src/Backtester.js';
import { PineScriptConverter } from '../PineScriptConverter.js';
import { loadBinanceConfig } from '../../../data-layer/src/repositories/configRepository.js';

const converter = new PineScriptConverter();

/**
 * Validate a Pine Script input.
 * Returns { isValid: boolean, error: string|null }
 */
export function validatePineScript(input) {
  if (typeof input !== 'string' || input.length < 10) {
    return { isValid: false, error: 'Pine Script ไม่ถูกต้องหรือสั้นเกินไป' };
  }
  if (input.length > 200_000) {
    return { isValid: false, error: 'Pine Script ยาวเกินขีดจำกัด (200,000 ตัวอักษร)' };
  }
  const hasKeyword =
    input.includes('//@version') ||
    input.includes('strategy(') ||
    input.includes('indicator(');
  if (!hasKeyword) {
    return { isValid: false, error: 'Pine Script ต้องมี keyword //@version, strategy( หรือ indicator(' };
  }
  return { isValid: true, error: null };
}

/**
 * Convert a strategy name to a registry key.
 * "My EMA" → "PINE_MY_EMA"
 */
export function strategyNameToKey(name) {
  return 'PINE_' + name.trim().toUpperCase().replace(/ /g, '_');
}

/**
 * Get the strategy-ai base URL from config or env.
 */
function getStrategyAiUrl() {
  try {
    const cfg = loadBinanceConfig();
    return cfg.strategyAiUrl || process.env.STRATEGY_AI_URL || 'http://strategy-ai:8000';
  } catch {
    return process.env.STRATEGY_AI_URL || 'http://strategy-ai:8000';
  }
}

export function createPineScriptRoutes(exchange) {
  const router = express.Router();

  // POST /convert — convert Pine Script to Python via AI
  router.post('/convert', async (req, res) => {
    try {
      const { pineScript, model } = req.body;

      if (!pineScript) {
        return res.status(400).json({ error: 'pineScript is required' });
      }

      const validation = validatePineScript(pineScript);
      if (!validation.isValid) {
        return res.status(400).json({ error: validation.error });
      }

      const result = await converter.convert(pineScript, model || null);
      res.json(result);
    } catch (e) {
      console.error('[PineScript /convert] error:', e.message);
      const status = e.message?.includes('หมดเวลา') ? 504 : 500;
      res.status(status).json({ error: e.message });
    }
  });

  // POST /backtest — register temp strategy, run backtest, then unregister
  router.post('/backtest', async (req, res) => {
    const { pythonCode, config } = req.body;

    if (!pythonCode) {
      return res.status(400).json({ error: 'pythonCode is required' });
    }
    if (!config) {
      return res.status(400).json({ error: 'config is required' });
    }

    const tempKey = `PINE_TEMP_${crypto.randomUUID()}`;
    const strategyAiUrl = getStrategyAiUrl();

    // Register dynamic strategy
    let registerRes;
    try {
      registerRes = await fetch(`${strategyAiUrl}/strategy/register-dynamic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: tempKey, python_code: pythonCode }),
      });
    } catch (e) {
      return res.status(503).json({ error: 'Strategy AI service unavailable' });
    }

    if (!registerRes.ok) {
      const errBody = await registerRes.json().catch(() => ({}));
      return res.status(registerRes.status).json({ error: errBody.detail || 'Failed to register strategy' });
    }

    let backtestResult;
    try {
      if (!exchange) {
        return res.status(503).json({ error: 'Exchange not available' });
      }
      backtestResult = await runBacktest(exchange, {
        ...config,
        strategy: `PYTHON:${tempKey}`,
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    } finally {
      // Always unregister temp key
      try {
        await fetch(`${strategyAiUrl}/strategy/unregister`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: tempKey }),
        });
      } catch {
        // Best-effort cleanup — ignore errors
      }
    }

    res.json(backtestResult);
  });

  // POST /save — validate name and forward to strategy-ai
  router.post('/save', async (req, res) => {
    const { pythonCode, name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!/^[a-zA-Z0-9 ]+$/.test(name)) {
      return res.status(400).json({ error: 'ชื่อ strategy ใช้ได้เฉพาะตัวอักษร ตัวเลข และ space' });
    }
    if (!pythonCode) {
      return res.status(400).json({ error: 'pythonCode is required' });
    }

    const key = strategyNameToKey(name);
    const filename = `pine_${name.trim().toLowerCase().replace(/ /g, '_')}.py`;
    const strategyAiUrl = getStrategyAiUrl();

    let saveRes;
    try {
      saveRes = await fetch(`${strategyAiUrl}/strategy/save-pine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, python_code: pythonCode, filename }),
      });
    } catch (e) {
      return res.status(503).json({ error: 'Strategy AI service unavailable' });
    }

    const data = await saveRes.json().catch(() => ({}));

    if (!saveRes.ok) {
      return res.status(saveRes.status).json({ error: data.detail || data.error || 'Failed to save strategy' });
    }

    res.json(data);
  });

  // GET /list — fetch strategy list from strategy-ai and filter PINE_ prefix
  router.get('/list', async (req, res) => {
    const strategyAiUrl = getStrategyAiUrl();

    let listRes;
    try {
      listRes = await fetch(`${strategyAiUrl}/strategy/list`);
    } catch (e) {
      return res.status(503).json({ error: 'Strategy AI service unavailable' });
    }

    if (!listRes.ok) {
      return res.status(listRes.status).json({ error: 'Failed to fetch strategy list' });
    }

    const data = await listRes.json().catch(() => ({ strategies: [] }));
    const strategies = (data.strategies || []).filter((s) => {
      const key = typeof s === 'string' ? s : s.key;
      return key && key.startsWith('PINE_');
    });

    res.json({ strategies });
  });

  return router;
}
