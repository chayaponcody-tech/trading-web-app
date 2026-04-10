import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

import { NotificationService } from '../../bot-engine/src/NotificationService.js';

import { BinanceAdapter } from '../../exchange-connector/src/BinanceAdapter.js';
import { BotManager } from '../../bot-engine/src/BotManager.js';
import { PortfolioManager } from '../../bot-engine/src/PortfolioManager.js';
import { 
  loadBinanceConfig, getAllBots, getAllFleets, getSetting, upsertFleet 
} from '../../data-layer/src/index.js';
import { PORT } from '../../shared/config.js';

import { createBotRoutes }       from './routes/botRoutes.js';
import { createAiRoutes }        from './routes/aiRoutes.js';
import { createBinanceRoutes }   from './routes/binanceRoutes.js';
import { createConfigRoutes }    from './routes/configRoutes.js';
import { createPortfolioRoutes } from './routes/portfolioRoutes.js';
import { createWalletRoutes }    from './routes/walletRoutes.js';
import { createBacktestRoutes }  from './routes/backtestRoutes.js';
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

// ─── Multi-Fleet Orchestration ────────────────────────────────────────────────
const portfolioManagers = new Map();

async function initFleets() {
  let fleets = getAllFleets();
  
  // Migration: If no fleets exist, try to migrate from old settings
  if (fleets.length === 0) {
    const oldConfig = getSetting('portfolio_config');
    if (oldConfig) {
        console.log('🚚 [Server] Migrating old portfolio config to new fleet system...');
        const defaultFleet = {
            id: 'portfolio1',
            name: 'Main AI Fleet',
            config: oldConfig,
            isRunning: 1
        };
        upsertFleet(defaultFleet);
        fleets = [defaultFleet];
    }
  }

  for (const f of fleets) {
    const pm = new PortfolioManager(botManager, exchange, { 
        managerId: f.id, 
        name: f.name,
        config: f.config
    });
    await pm.init();
    portfolioManagers.set(f.id, pm);
    if (f.isRunning) pm.start();
  }
  console.log(`📡 [Server] Multi-Fleet Active: ${portfolioManagers.size} fleets initialized.`);
}

// Initialize Notifications
const notificationService = new NotificationService(binanceConfig);
botManager.setNotificationService(notificationService);

// Load and resume persisted bots
botManager.loadBots(getAllBots());

// Start all fleets
const fleetsInitPromise = initFleets().then(() => {
    notificationService.startPolling(botManager, Array.from(portfolioManagers.values()));
});

// Pre-cache exchange symbol rules (best-effort)
if (exchange) {
  exchange.getSymbolRules()
    .then((rules) => botManager.setSymbolRules(rules))
    .catch((e) => console.warn('[Gateway] Could not prefetch symbol rules:', e.message));
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/bots',      createBotRoutes(botManager));
app.use('/api/ai',        createAiRoutes(botManager, binanceConfig));
app.use('/api/binance',   createBinanceRoutes(botManager, Array.from(portfolioManagers.values())[0], binanceConfig)); // Fallback for binance routes
app.use('/api/config',    createConfigRoutes(botManager, portfolioManagers));
app.use('/api/portfolio', createPortfolioRoutes(portfolioManagers, { botManager, exchange }));
app.use('/api/wallet',    createWalletRoutes());
app.use('/api/backtest', createBacktestRoutes(exchange));


// Backwards-compat aliases (legacy frontend calls these paths)
app.use('/api/forward-test', createBotRoutes(botManager));

// ─── Phase 1.5: Python Strategy Bridge ────────────────────────────────────────
// This endpoint is called by the 'strategy-ai' container (Python)
app.post('/api/execute-python', async (req, res, next) => {
  try {
    const { symbol, type, quantity, source = 'Python-AI' } = req.body;
    
    if (!exchange) return res.status(503).json({ error: 'Exchange not initialized' });
    if (!symbol || !type || !quantity) return res.status(400).json({ error: 'Missing parameters' });

    console.log(`📡 [Gateway] Execution Request from ${source}: ${type} ${quantity} ${symbol}`);
    
    // Execute a standard MARKET order via CCXT
    const result = await exchange.placeOrder(symbol, type === 'BUY' ? 'BUY' : 'SELL', 'MARKET', quantity);
    
    // Optional: Log it in our history
    const { appendTrade } = await import('../../data-layer/src/repositories/tradeRepository.js');
    appendTrade({
        botId: 'STRATEGY_AI_PYTHON',
        symbol: symbol,
        type: type === 'BUY' ? 'BUY' : 'SELL',
        entryPrice: result.price || 0,
        exitPrice: 0,
        exitTime: null,
        pnl: 0,
        strategy: `Python-${source}`,
        reason: 'Signal from Remote Strategy Layer',
        entryTime: new Date().toISOString()
    });

    res.json({ success: true, result });
  } catch (e) {
    console.error('[Gateway] Python Bridge Error:', e.message);
    res.status(500).json({ error: e.message });
  }
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

// ─── Strategies Metadata ──────────────────────────────────────────────────────
app.get('/strategies', (req, res) => {
  // Microstructure filter applied to ALL strategies at entry time
  const microstructureFilter = {
    description: 'ดึง OI + Funding Rate จาก Binance ทันทีก่อนเปิด position เพื่อยืนยัน signal',
    appliedAt: 'pre-entry (on-demand, ไม่กระทบ tick ปกติ)',
    dataSource: {
      fundingRate: 'Binance getFundingRate — อัปเดตทุก 8 ชั่วโมง',
      openInterest: 'Binance getOpenInterestStatistics — interval 15m, ดึง 3 จุดล่าสุด',
    },
    flow: [
      '1. Technical signal (EMA/RSI/BB ฯลฯ) ออก LONG หรือ SHORT บน candle close',
      '2. ดึง Funding Rate + OI history แบบ parallel (on-demand)',
      '3. ตรวจ Funding Rate ก่อน — ถ้าไม่ผ่านจะ block ทันที ไม่ตรวจ OI ต่อ',
      '4. ตรวจ OI trend — ถ้าไม่ผ่านจะ block',
      '5. ผ่านทั้งคู่ → เปิด position พร้อมแสดง note ใน currentThought',
    ],
    rules: [
      {
        metric: 'Funding Rate',
        condition: 'fundingRate > +threshold (default +0.05%)',
        appliesTo: 'LONG signal',
        action: 'BLOCK',
        reason: 'ตลาด over-leveraged ฝั่ง Long — Long squeeze risk สูง ราคามักกลับทิศหลัง funding settlement',
      },
      {
        metric: 'Funding Rate',
        condition: 'fundingRate < -threshold (default -0.05%)',
        appliesTo: 'SHORT signal',
        action: 'BLOCK',
        reason: 'Short squeeze risk สูง — Shorts จ่าย funding ให้ Longs แรงซื้อกลับมักตามมา',
      },
      {
        metric: 'Open Interest',
        condition: 'OI เปลี่ยนแปลง < -10% เทียบกับ period ก่อนหน้า (15m)',
        appliesTo: 'LONG และ SHORT',
        action: 'BLOCK',
        reason: 'OI ลดลงแรง = position ถูกปิดออกจากตลาด แรงหนุน signal อ่อน ไม่น่าเชื่อถือ',
      },
      {
        metric: 'Open Interest',
        condition: 'OI เปลี่ยนแปลง >= 0% (เพิ่มขึ้น)',
        appliesTo: 'LONG และ SHORT',
        action: 'CONFIRM',
        reason: 'OI เพิ่ม = เงินใหม่เข้าตลาด ยืนยัน signal มีแรงหนุนจริง',
      },
    ],
    configurable: {
      fundingThreshold: 'bot.config.fundingThreshold (default: 0.0005 = 0.05%)',
    },
    failBehavior: 'fail-open — ถ้าดึง API ไม่ได้จะไม่ block entry เพื่อไม่ให้บอทหยุดทำงานโดยไม่จำเป็น',
    output: 'ผลการตรวจจะแสดงใน bot.currentThought เช่น "⚠️ [Microstructure Block] ..." หรือ "✅ [Microstructure OK] Funding 0.0100% | OI +2.3% ยืนยันแรงซื้อ"',
  };

  res.json([
    {
      id: 'EMA_RSI',
      name: 'EMA Cross + RSI',
      description: 'Trend following — เข้าเมื่อ EMA20 ตัด EMA50 พร้อม RSI ยืนยัน',
      marketRegime: 'trending',
      regimeLabel: 'ตลาด Trending / มีทิศทางชัดเจน',
      bestInterval: '15m',
      indicators: ['EMA20', 'EMA50', 'RSI14'],
      suitabilityHints: { adxMin: 25, bbWidthMin: 4, priceChangeMin: 3 },
      riskProfile: 'medium',
      tags: ['trend', 'momentum'],
      microstructureFilter,
    },
    {
      id: 'AI_GRID',
      name: 'AI Grid Trading',
      description: 'Mean reversion — ซื้อขอบล่าง ขายขอบบนของกรอบราคา เหมาะกับตลาด Sideway',
      marketRegime: 'sideway',
      regimeLabel: 'ตลาด Sideway / ราคาวิ่งในกรอบ',
      bestInterval: '1h',
      indicators: ['EMA20', 'BollingerBands'],
      suitabilityHints: { adxMax: 25, bbWidthMax: 5, priceChangeMax: 8 },
      riskProfile: 'low',
      tags: ['grid', 'range', 'mean-reversion'],
      microstructureFilter,
    },
    {
      id: 'AI_GRID_SCALP',
      name: 'AI Grid Scalp',
      description: 'Grid ระยะสั้น — กรอบแคบ TP/SL เล็ก เหมาะกับ Sideway ระยะสั้น',
      marketRegime: 'sideway',
      regimeLabel: 'ตลาด Sideway ระยะสั้น',
      bestInterval: '15m',
      indicators: ['EMA20', 'BollingerBands'],
      suitabilityHints: { adxMax: 22, bbWidthMax: 4, priceChangeMax: 5 },
      riskProfile: 'low',
      tags: ['grid', 'scalp', 'range'],
      microstructureFilter,
    },
    {
      id: 'AI_GRID_SWING',
      name: 'AI Grid Swing',
      description: 'Grid ระยะยาว — กรอบกว้าง TP/SL ใหญ่ เหมาะกับ Sideway ระยะยาว',
      marketRegime: 'sideway',
      regimeLabel: 'ตลาด Sideway ระยะยาว',
      bestInterval: '4h',
      indicators: ['EMA20', 'BollingerBands'],
      suitabilityHints: { adxMax: 28, bbWidthMax: 7, priceChangeMax: 12 },
      riskProfile: 'medium',
      tags: ['grid', 'swing', 'range'],
      microstructureFilter,
    },
    {
      id: 'AI_SCOUTER',
      name: 'AI Scouter (Scalp)',
      description: 'Momentum scalping — เข้าตาม SMA7/SMA14 cross + RSI เหมาะกับตลาด Volatile',
      marketRegime: 'volatile',
      regimeLabel: 'ตลาด Volatile / มีแรงส่งสูง',
      bestInterval: '5m',
      indicators: ['SMA7', 'SMA14', 'RSI14'],
      suitabilityHints: { adxMin: 20, bbWidthMin: 3, priceChangeMin: 2 },
      riskProfile: 'high',
      tags: ['scalp', 'momentum', 'volatile'],
      microstructureFilter,
    },
    {
      id: 'BB_RSI',
      name: 'Bollinger Bands + RSI',
      description: 'Mean reversion — เข้าเมื่อราคาแตะ BB band พร้อม RSI oversold/overbought',
      marketRegime: 'ranging',
      regimeLabel: 'ตลาด Ranging / Sideway ที่มี Volatility',
      bestInterval: '1h',
      indicators: ['BollingerBands', 'RSI14'],
      suitabilityHints: { adxMax: 30, bbWidthMin: 3 },
      riskProfile: 'medium',
      tags: ['mean-reversion', 'range', 'bb'],
      microstructureFilter,
    },
    {
      id: 'EMA_BB_RSI',
      name: 'EMA + BB + RSI (Composite)',
      description: 'Composite — รวม 3 indicator กรอง signal เข้มข้น เหมาะกับตลาดที่มีทิศทางแต่ยังมี pullback',
      marketRegime: 'trending',
      regimeLabel: 'ตลาด Trending พร้อม Pullback',
      bestInterval: '1h',
      indicators: ['EMA20', 'EMA50', 'BollingerBands', 'RSI14'],
      suitabilityHints: { adxMin: 22, bbWidthMin: 3 },
      riskProfile: 'medium',
      tags: ['composite', 'trend', 'pullback'],
      microstructureFilter,
    },
  ]);
});



// ─── Process Safety ───────────────────────────────────────────────────────────
process.on('uncaughtException',  (e) => console.error('[FATAL]', e));
process.on('unhandledRejection', (e) => console.error('[UNHANDLED]', e));

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 API Gateway running on http://localhost:${PORT}`);
  console.log(`📦 Packages: exchange-connector, bot-engine, ai-agents, data-layer`);
});

export { app, botManager };
