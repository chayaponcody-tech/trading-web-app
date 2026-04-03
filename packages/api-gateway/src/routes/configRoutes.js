import { Router } from 'express';
import { BinanceAdapter } from '../../../exchange-connector/src/BinanceAdapter.js';
import { loadBinanceConfig, patchBinanceConfig } from '../../../data-layer/src/repositories/configRepository.js';

// ─── Config Routes ────────────────────────────────────────────────────────────
export function createConfigRoutes(botManager) {
  const r = Router();

  r.get('/', (req, res) => {
    const cfg = loadBinanceConfig();
    res.json({
      apiKey: cfg.apiKey ? '****' + cfg.apiKey.slice(-4) : '',
      hasSecret: !!cfg.apiSecret,
      hasOpenRouter: !!cfg.openRouterKey,
      openRouterModel: cfg.openRouterModel,
    });
  });

  r.post('/', async (req, res, next) => {
    try {
      const { apiKey, apiSecret, openRouterKey, openRouterModel } = req.body;
      patchBinanceConfig({ apiKey, apiSecret, openRouterKey, openRouterModel });

      // Hot-swap exchange on the running BotManager
      const updated = loadBinanceConfig();
      if (updated.apiKey && updated.apiSecret) {
        const newExchange = new BinanceAdapter(updated.apiKey, updated.apiSecret);
        botManager.setExchange(newExchange);
        // Refresh symbol rules
        newExchange.getSymbolRules()
          .then((rules) => botManager.setSymbolRules(rules))
          .catch(() => {});
      }
      botManager.setConfig(updated);

      res.json({ success: true });
    } catch (e) { next(e); }
  });

  return r;
}
