import express from 'express';
import cors from 'cors';

import { BinanceAdapter } from '../../exchange-connector/src/BinanceAdapter.js';
import { BotManager } from '../../bot-engine/src/BotManager.js';
import { loadBinanceConfig, getAllBots } from '../../data-layer/src/index.js';
import { PORT } from '../../shared/config.js';

import { createBotRoutes }     from './routes/botRoutes.js';
import { createAiRoutes }      from './routes/aiRoutes.js';
import { createBinanceRoutes } from './routes/binanceRoutes.js';
import { createConfigRoutes }  from './routes/configRoutes.js';
import { errorHandler }        from './middleware/errorHandler.js';
import { setupSwagger }        from './swagger.js';

// ─── Bootstrap ────────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());
setupSwagger(app);

// ─── Initialise Exchange + Bot Engine ─────────────────────────────────────────
const binanceConfig = loadBinanceConfig();
const exchange = binanceConfig.apiKey && binanceConfig.apiSecret
  ? new BinanceAdapter(binanceConfig.apiKey, binanceConfig.apiSecret)
  : null;

const botManager = new BotManager(exchange, binanceConfig);

// Pre-cache exchange symbol rules (best-effort)
if (exchange) {
  exchange.getSymbolRules()
    .then((rules) => botManager.setSymbolRules(rules))
    .catch((e) => console.warn('[Gateway] Could not prefetch symbol rules:', e.message));
}

// Load and resume persisted bots
botManager.loadBots(getAllBots());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/bots',    createBotRoutes(botManager));
app.use('/api/ai',      createAiRoutes(botManager, binanceConfig));
app.use('/api/binance', createBinanceRoutes(botManager, binanceConfig));
app.use('/api/config',  createConfigRoutes(botManager));

// Backwards-compat aliases (legacy frontend calls these paths)
app.use('/api/forward-test', createBotRoutes(botManager));

// Proxy Binance public klines for backtest (no auth needed)
app.get('/api/backtest', async (req, res, next) => {
  try {
    const https = await import('https');
    const { symbol = 'BTCUSDT', interval = '1h', limit = 1000, startTime, endTime } = req.query;
    let url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    if (startTime) url += `&startTime=${startTime}`;
    if (endTime)   url += `&endTime=${endTime}`;
    https.get(url, (apiRes) => {
      let data = '';
      apiRes.on('data', (c) => (data += c));
      apiRes.on('end', () => res.json(JSON.parse(data)));
    }).on('error', next);
  } catch (e) { next(e); }
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Process Safety ───────────────────────────────────────────────────────────
process.on('uncaughtException',  (e) => console.error('[FATAL]', e));
process.on('unhandledRejection', (e) => console.error('[UNHANDLED]', e));

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 API Gateway running on http://localhost:${PORT}`);
  console.log(`📦 Packages: exchange-connector, bot-engine, ai-agents, data-layer`);
});

export { app, botManager };
