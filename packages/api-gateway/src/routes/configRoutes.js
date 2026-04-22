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
      hasTelegram: !!(cfg.telegramToken && cfg.telegramChatId),
      strategyAiMode: cfg.strategyAiMode || 'off',
      strategyAiUrl: cfg.strategyAiUrl || 'http://strategy-ai:8000',
      strategyAiConfidenceThreshold: cfg.strategyAiConfidenceThreshold ?? 0.70,
      // Live keys status
      liveApiKey: cfg.liveApiKey ? '****' + cfg.liveApiKey.slice(-4) : '',
      hasLiveKeys: !!(cfg.liveApiKey && cfg.liveApiSecret),
      virtualTestBalance: cfg.virtualTestBalance || 1000,
    });
  });

  r.post('/', async (req, res, next) => {
    try {
      const { apiKey, apiSecret, openRouterKey, openRouterModel, telegramToken, telegramChatId, strategyAiMode, strategyAiUrl, strategyAiConfidenceThreshold, liveApiKey, liveApiSecret, virtualTestBalance } = req.body;
      patchBinanceConfig({ apiKey, apiSecret, openRouterKey, openRouterModel, telegramToken, telegramChatId, strategyAiMode, strategyAiUrl, strategyAiConfidenceThreshold, liveApiKey, liveApiSecret, virtualTestBalance });

      const updated = loadBinanceConfig();

      // Hot-swap testnet exchange
      if (updated.apiKey && updated.apiSecret) {
        const newExchange = new BinanceAdapter(updated.apiKey, updated.apiSecret);
        botManager.setExchange(newExchange);
        newExchange.getSymbolRules()
          .then((rules) => botManager.setSymbolRules(rules))
          .catch(() => {});
      }

      // Hot-swap live exchange
      const liveKey = updated.liveApiKey || updated.apiKey;
      const liveSecret = updated.liveApiSecret || updated.apiSecret;
      if (liveKey && liveSecret) {
        const newLiveExchange = new BinanceAdapter(liveKey, liveSecret, { useTestnet: false });
        botManager.setLiveExchange(newLiveExchange);
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

  // ─── Public IP ────────────────────────────────────────────────────────────
  r.get('/my-ip', async (req, res) => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      res.json({ ip: data.ip });
    } catch (e) {
      // Fallback: use request IP
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      res.json({ ip: String(ip).split(',')[0].trim() });
    }
  });

  // ─── Strategy AI Health Check ─────────────────────────────────────────────
  r.get('/strategy-ai/status', async (req, res) => {
    try {
      const status = await botManager.getStrategyAiStatus();
      res.json(status);
    } catch (e) {
      res.json({ online: false, url: '', mode: 'off', lastCheck: new Date().toISOString() });
    }
  });

  // ─── Strategy AI Log Level ────────────────────────────────────────────────
  r.get('/strategy-ai/log-level', async (req, res) => {
    const { strategyAiUrl } = loadBinanceConfig();
    try {
      const target = `${strategyAiUrl}/admin/log-level`;
      console.log(`📡 [Gateway] Fetching log level from: ${target}`);
      const response = await fetch(target, { signal: AbortSignal.timeout(4000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      res.json(data);
    } catch (e) {
      console.error(`❌ [Gateway] Strategy AI log-level fetch failed:`, e.message);
      res.status(503).json({ error: 'Strategy AI service unavailable', details: e.message });
    }
  });

  r.post('/strategy-ai/log-level', async (req, res) => {
    try {
      const { level } = req.body;
      const { strategyAiUrl } = loadBinanceConfig();
      const response = await fetch(`${strategyAiUrl}/admin/log-level`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level }),
        signal: AbortSignal.timeout(4000),
      });
      const data = await response.json();
      res.json(data);
    } catch {
      res.status(503).json({ error: 'Strategy AI service unavailable' });
    }
  });

  return r;
}
