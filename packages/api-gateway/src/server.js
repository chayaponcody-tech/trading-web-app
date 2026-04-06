import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

import { NotificationService } from '../../bot-engine/src/NotificationService.js';

import { BinanceAdapter } from '../../exchange-connector/src/BinanceAdapter.js';
import { BotManager } from '../../bot-engine/src/BotManager.js';
import { PortfolioManager } from '../../bot-engine/src/PortfolioManager.js';
import { loadBinanceConfig, getAllBots } from '../../data-layer/src/index.js';
import { PORT } from '../../shared/config.js';

import { createBotRoutes }       from './routes/botRoutes.js';
import { createAiRoutes }        from './routes/aiRoutes.js';
import { createBinanceRoutes }   from './routes/binanceRoutes.js';
import { createConfigRoutes }    from './routes/configRoutes.js';
import { createPortfolioRoutes } from './routes/portfolioRoutes.js';
import { createWalletRoutes }    from './routes/walletRoutes.js';
import { errorHandler }          from './middleware/errorHandler.js';

import { setupSwagger }          from './swagger.js';

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
const portfolioManager = new PortfolioManager(botManager, exchange);

// Initialize Notifications
const notificationService = new NotificationService(binanceConfig);
botManager.setNotificationService(notificationService);
notificationService.startPolling(botManager, portfolioManager);

// Pre-cache exchange symbol rules (best-effort)
if (exchange) {
  exchange.getSymbolRules()
    .then((rules) => botManager.setSymbolRules(rules))
    .catch((e) => console.warn('[Gateway] Could not prefetch symbol rules:', e.message));
}

// Load and resume persisted bots
botManager.loadBots(getAllBots());

// Start Portfolio Manager
portfolioManager.init().then(() => portfolioManager.start());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/bots',      createBotRoutes(botManager));
app.use('/api/ai',        createAiRoutes(botManager, binanceConfig));
app.use('/api/binance',   createBinanceRoutes(botManager, portfolioManager, binanceConfig));
app.use('/api/config',    createConfigRoutes(botManager));
app.use('/api/portfolio', createPortfolioRoutes(portfolioManager));
app.use('/api/wallet',    createWalletRoutes());


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

// ─── Compatibility Endpoints (Legacy State) ───────────────────────────────────
const dataFile = path.resolve('paper-trading-db.json');
const defaultState = {
  isBotRunning: false,
  selectedStrategy: 'EMA',
  tpPercent: 2.0,
  slPercent: 1.0,
  paperState: { balance: 10000, position: 'NONE', entryPrice: 0, trades: 0, equity: 10000 },
  tradeHistory: []
};
if (!fs.existsSync(dataFile)) {
  fs.writeFileSync(dataFile, JSON.stringify(defaultState, null, 2));
}

app.get('/api/state', (req, res) => {
  try {
    const data = fs.readFileSync(dataFile, 'utf8');
    res.json(JSON.parse(data));
  } catch (e) {
    res.status(500).json({ error: 'Failed to read data' });
  }
});

app.post('/api/state', (req, res) => {
  try {
    const currentState = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    const newState = { ...currentState, ...req.body };
    fs.writeFileSync(dataFile, JSON.stringify(newState, null, 2));
    res.json({ success: true, state: newState });
  } catch (e) {
    res.status(500).json({ error: 'Failed to write data' });
  }
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
