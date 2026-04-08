import { Router } from 'express';
import { BinanceAdapter } from '../../../exchange-connector/src/BinanceAdapter.js';
import { loadBinanceConfig, patchBinanceConfig } from '../../../data-layer/src/repositories/configRepository.js';

// ─── Config Routes ────────────────────────────────────────────────────────────
export function createConfigRoutes(botManager, portfolioManagers = new Map()) {
  const r = Router();

  r.get('/', (req, res) => {
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

  r.post('/', async (req, res, next) => {
    try {
      const { apiKey, apiSecret, openRouterKey, openRouterModel, telegramToken, telegramChatId } = req.body;
      patchBinanceConfig({ apiKey, apiSecret, openRouterKey, openRouterModel, telegramToken, telegramChatId });

      const updated = loadBinanceConfig();

      // Hot-swap exchange
      if (updated.apiKey && updated.apiSecret) {
        const newExchange = new BinanceAdapter(updated.apiKey, updated.apiSecret);
        botManager.setExchange(newExchange);
        newExchange.getSymbolRules()
          .then((rules) => botManager.setSymbolRules(rules))
          .catch(() => {});
      }
      botManager.setConfig(updated);

      // Hot-swap Telegram NotificationService
      const { NotificationService } = await import('../../../bot-engine/src/NotificationService.js');
      const newNotif = new NotificationService(updated);
      botManager.setNotificationService(newNotif);
      // Restart polling with current portfolio managers
      const pmArray = Array.from(portfolioManagers.values());
      newNotif.startPolling(botManager, pmArray);

      res.json({ success: true });
    } catch (e) { next(e); }
  });

  return r;
}
