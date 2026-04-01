import http from 'http';
import https from 'https';
import url from 'url';
import querystring from 'querystring';
import fs from 'fs';
import path from 'path';
import { EMA, BollingerBands, RSI } from 'technicalindicators';
import { BinanceTestnetService } from './binance-service.js';

const TZ_OPTS = { timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'medium' };

const STRATEGIES = [
  { value: 'EMA', label: 'EMA Crossover (20/50)' },
  { value: 'BB', label: 'BB Mean Reversion' },
  { value: 'RSI', label: 'RSI (30/70) Cross' },
  { value: 'EMA_RSI', label: '⚡ EMA + RSI' },
  { value: 'BB_RSI', label: '⚡ BB + RSI' },
  { value: 'EMA_BB_RSI', label: '⚡ EMA + BB + RSI' },
  { value: 'GRID', label: 'Grid Bot Simulation' },
  { value: 'AI_SCOUTER', label: '🏹 AI Scouting (5m Scalp)' },
];

const PORT = 4001;
const dataFile = path.resolve('paper-trading-db.json');

process.on('uncaughtException', (err) => {
  console.error('[FATAL ERROR] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL ERROR] Unhandled Rejection at:', promise, 'reason:', reason);
});

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

// ─── Forward Test State (multi-bot) ─────────────────────────────────────────
const bots = new Map(); // botId -> botState
const botTimers = new Map(); // botId -> intervalHandle
const botsFile = path.resolve('forward-bots-db.json');
const goldWalletFile = path.resolve('gold-wallet.json');
const tradeMemoryFile = path.resolve('trade-memory.json');
let symbolRules = {}; // Cache for stepSize and precision

let goldWallet = { balance: 10000, allTimeTrades: 0, allTimePnL: 0 };
if (fs.existsSync(goldWalletFile)) {
  try { goldWallet = JSON.parse(fs.readFileSync(goldWalletFile, 'utf8')); }
  catch (e) { console.error('[Gold Wallet] load error:', e.message); }
} else { fs.writeFileSync(goldWalletFile, JSON.stringify(goldWallet, null, 2)); }

function saveGoldWallet() {
  try { fs.writeFileSync(goldWalletFile, JSON.stringify(goldWallet, null, 2)); }
  catch (e) { console.error('[Gold Wallet] save error:', e.message); }
}

function makeBotId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function saveBotsToFile() {
  try {
    const data = Array.from(bots.values()).map(bot => ({ ...bot, lastCandle: null }));
    fs.writeFileSync(botsFile, JSON.stringify(data, null, 2));
  } catch (e) { console.error('[Persist] save error:', e.message); }
}

function saveTradeMemory(trade) {
    try {
        let history = [];
        if (fs.existsSync(tradeMemoryFile)) {
            history = JSON.parse(fs.readFileSync(tradeMemoryFile, 'utf8'));
        }
        history.push({ ...trade, recordedAt: new Date().toLocaleString('th-TH', TZ_OPTS) });
        fs.writeFileSync(tradeMemoryFile, JSON.stringify(history.slice(-100), null, 2)); // เก็บ 100 รายการล่าสุด
    } catch (e) { console.error('[Memory] save error:', e.message); }
}

function loadBotsFromFile() {
  try {
    if (!fs.existsSync(botsFile)) return;
    const data = JSON.parse(fs.readFileSync(botsFile, 'utf8'));
    if (!Array.isArray(data)) return;
    let resumed = 0;
    for (const bot of data) {
      bot.openPositions = bot.openPositions || [];
      bot.aiHistory = bot.aiHistory || [];
      // Safety: Never auto-resume bots on server restart
      bot.isRunning = false; 
      bots.set(bot.id, bot);
    }
    console.log(`[Persist] Loaded ${data.length} bot(s) (Safety: All Set to IDLE)`);
  } catch (e) { console.error('[Persist] load error:', e.message); }
}

// ─── Binance Testnet Config ───────────────────────────────────────────────────
const configPath = path.resolve('binance-config.json');
let binanceConfig = { apiKey: '', apiSecret: '', openRouterKey: '', openRouterModel: 'deepseek/deepseek-chat' };
if (fs.existsSync(configPath)) {
  try { binanceConfig = JSON.parse(fs.readFileSync(configPath, 'utf8')); }
  catch (e) { console.error('[Binance Config] load error:', e.message); }
}

let binanceService = null;
if (binanceConfig.apiKey && binanceConfig.apiSecret) {
  binanceService = new BinanceTestnetService(binanceConfig.apiKey, binanceConfig.apiSecret);
  // Fetch exchange info once at startup
  binanceService.getExchangeInfo()
    .then(info => {
      symbolRules = {};
      info.symbols.forEach(s => {
        const lotSize = s.filters.find(f => f.filterType === 'LOT_SIZE');
        if (lotSize) {
          symbolRules[s.symbol] = {
            stepSize: parseFloat(lotSize.stepSize),
            minQty: parseFloat(lotSize.minQty)
          };
        }
      });
      console.log(`[Binance] Loaded rules for ${Object.keys(symbolRules).length} symbols`);
    })
    .catch(err => console.error('[Binance] Failed to load exchange info:', err.message));
}

function saveBinanceConfig() {
  fs.writeFileSync(configPath, JSON.stringify(binanceConfig, null, 2));
  if (binanceConfig.apiKey && binanceConfig.apiSecret) {
    binanceService = new BinanceTestnetService(binanceConfig.apiKey, binanceConfig.apiSecret);
    binanceService.getExchangeInfo()
      .then(info => {
        symbolRules = {};
        info.symbols.forEach(s => {
          const lotSize = s.filters.find(f => f.filterType === 'LOT_SIZE');
          if (lotSize) {
            symbolRules[s.symbol] = {
              stepSize: parseFloat(lotSize.stepSize),
              minQty: parseFloat(lotSize.minQty)
            };
          }
        });
        console.log(`[Binance] Loaded rules for ${Object.keys(symbolRules).length} symbols`);
      })
      .catch(err => console.error('[Binance] Failed to load exchange info:', err.message));
  } else {
    binanceService = null;
  }
}

loadBotsFromFile(); // restore + auto-resume on startup
function emaCalc(values, period) {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  let ema = [values.slice(0, period).reduce((a, b) => a + b, 0) / period];
  for (let i = period; i < values.length; i++) {
    ema.push(values[i] * k + ema[ema.length - 1] * (1 - k));
  }
  return ema;
}

function rsiCalc(values, period = 14) {
  if (values.length <= period) return [];
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gains += d; else losses -= d;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  const rsi = [avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)];
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }
  return rsi;
}

function bbCalc(values, period = 20, stdDev = 2) {
  if (values.length < period) return [];
  const bands = [];
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    bands.push({ upper: mean + stdDev * sd, lower: mean - stdDev * sd, middle: mean });
  }
  return bands;
}

function computeSignal(closes, strategy, options = {}) {
  if (closes.length < 50) return 'NONE';
  const curr = closes[closes.length - 1];
  const lastIdx = closes.length - 1;

  if (strategy === 'EMA') {
    const e20 = EMA.calculate({ period: 20, values: closes });
    const e50 = EMA.calculate({ period: 50, values: closes });
    if (e20.length < 2 || e50.length < 2) return 'NONE';
    const pE20 = e20[e20.length - 2], cE20 = e20[e20.length - 1];
    const pE50 = e50[e50.length - 2], cE50 = e50[e50.length - 1];
    if (pE20 <= pE50 && cE20 > cE50) return 'LONG';
    if (pE20 >= pE50 && cE20 < cE50) return 'SHORT';
  } 
  else if (strategy === 'BB') {
    const bb = BollingerBands.calculate({ period: 20, stdDev: 2, values: closes });
    if (bb.length < 2) return 'NONE';
    const pB = bb[bb.length - 2], cB = bb[bb.length - 1];
    const pPrice = closes[lastIdx - 1];
    if (pPrice <= pB.lower && curr > cB.lower) return 'LONG';
    if (pPrice >= pB.upper && curr < cB.upper) return 'SHORT';
  } 
  else if (strategy === 'RSI') {
    const rsi = RSI.calculate({ period: 14, values: closes });
    if (rsi.length < 2) return 'NONE';
    const pR = rsi[rsi.length - 2], cR = rsi[rsi.length - 1];
    if (pR <= 30 && cR > 30) return 'LONG';
    if (pR >= 70 && cR < 70) return 'SHORT';
  } 
  else if (strategy === 'EMA_RSI' || strategy === 'BB_RSI' || strategy === 'EMA_BB_RSI') {
    const e20 = EMA.calculate({ period: 20, values: closes });
    const e50 = EMA.calculate({ period: 50, values: closes });
    const bb = BollingerBands.calculate({ period: 20, stdDev: 2, values: closes });
    const rsi = RSI.calculate({ period: 14, values: closes });

    if (rsi.length < 2) return 'NONE';
    const currRsi = rsi[rsi.length - 1];
    const prevRsi = rsi[rsi.length - 2];
    const pPrice = closes[lastIdx - 1];

    if (strategy === 'EMA_RSI') {
      if (e20.length < 2 || e50.length < 2) return 'NONE';
      const crossUp = e20[e20.length-2] <= e50[e50.length-2] && e20[e20.length-1] > e50[e50.length-1];
      const crossDown = e20[e20.length-2] >= e50[e50.length-2] && e20[e20.length-1] < e50[e50.length-1];
      if (crossUp && currRsi < 40) return 'LONG';
      if (crossDown && currRsi > 60) return 'SHORT';
    } 
    else if (strategy === 'BB_RSI') {
      if (bb.length < 2) return 'NONE';
      const pB = bb[bb.length - 2], cB = bb[bb.length - 1];
      if (pPrice <= pB.lower && curr > cB.lower && prevRsi <= 30) return 'LONG';
      if (pPrice >= pB.upper && curr < cB.upper && prevRsi >= 70) return 'SHORT';
    } 
    else if (strategy === 'EMA_BB_RSI') {
      if (e20.length < 1 || e50.length < 1 || bb.length < 2) return 'NONE';
      const emaBull = e20[e20.length-1] > e50[e50.length-1];
      const emaBear = e20[e20.length-1] < e50[e50.length-1];
      const pB = bb[bb.length - 2], cB = bb[bb.length - 1];
      const bbUp = pPrice <= pB.lower && curr > cB.lower;
      const bbDown = pPrice >= pB.upper && curr < cB.upper;
      if (emaBull && bbUp && currRsi < 40) return 'LONG';
      if (emaBear && bbDown && currRsi > 60) return 'SHORT';
    }
  } 
  else if (strategy === 'GRID' || strategy === 'AI_GRID') {
    const { gridUpper, gridLower } = options || {};
    if (gridUpper && gridLower) {
      // Boundary-based Grid: LONG if price near lower, SHORT if price near upper
      // Add a small buffer to avoid jitter
      if (curr <= gridLower) return 'LONG';
      if (curr >= gridUpper) return 'SHORT';
      return 'NONE';
    }
    const e20 = EMA.calculate({ period: 20, values: closes });
    if (e20.length < 1) return 'NONE';
    const basis = e20[e20.length-1];
    const dev = (curr - basis) / basis;
    if (dev <= -0.01) return 'LONG';
    if (dev >= 0.01) return 'SHORT';
  }
  // AI-recommended aliases
  else if (strategy === 'EMA_CROSS' || strategy === 'EMA_CROSS_V2') {
    return computeSignal(closes, 'EMA');
  }
  else if (strategy === 'RSI_TREND') {
    return computeSignal(closes, 'RSI');
  }
  else if (strategy === 'AI_SCOUTER') {
    // Aggressive Scalping: 7/14 SMA + Tight RSI
    const lastPrice = closes[closes.length - 1];
    const sma7 = closes.slice(-7).reduce((a, b) => a + b, 0) / 7;
    const sma14 = closes.slice(-14).reduce((a, b) => a + b, 0) / 14;
    const rsi = (typeof calculateRSI === 'function' ? calculateRSI(closes, 14) : 50);
    
    // Simple SMA Cross + Overbought/Oversold check (Aggressive)
    if (sma7 > sma14 && rsi < 55) return 'LONG';
    if (sma7 < sma14 && rsi > 45) return 'SHORT';
  }
  return 'NONE';
}

function generateEntryReason(signal, strategy, closes) {
    if (signal === 'NONE') return '';
    const lastPrice = closes[closes.length - 1];
    
    if (strategy === 'EMA') {
        return signal === 'LONG' ? 'EMA 20 ตัดขึ้นเหนือ EMA 50 (Golden Cross)' : 'EMA 20 ตัดลงใต้ EMA 50 (Death Cross)';
    } 
    if (strategy === 'RSI') {
        const rsi = RSI.calculate({ period: 14, values: closes });
        const val = rsi[rsi.length - 1]?.toFixed(1);
        return signal === 'LONG' ? `RSI (${val}) ฟื้นตัวจากโซน Oversold (<30)` : `RSI (${val}) ปรับตัวลงจากโซน Overbought (>70)`;
    }
    if (strategy === 'BB') {
        return signal === 'LONG' ? 'ราคาทะลุ Lower Band และกลับตัวเข้าหาค่าเฉลี่ย' : 'ราคาทะลุ Upper Band และกลับตัวเข้าหาค่าเฉลี่ย';
    }
    if (strategy === 'EMA_RSI' || strategy === 'BB_RSI' || strategy === 'EMA_BB_RSI') {
        return `สัญญาณยืนยันร่วม (Confirmation) จาก ${strategy} ในทิศทาง ${signal}`;
    }
    if (strategy === 'GRID') {
        return signal === 'LONG' ? 'ราคาแตะขอบล่างของกรอบ Grid (Mean Reversion Buy)' : 'ราคาแตะขอบบนของกรอบ Grid (Mean Reversion Sell)';
    }
    if (strategy === 'AI_SCOUTER') {
        return `🏹 สัญญาณ Scalping จาก AI_SCOUTER (${signal})`;
    }
    return `เข้าตามกลยุทธ์ ${strategy} (${signal})`;
}

function calculateRSI(closes, period = 14) {
    if (closes.length < period + 1) return 50;
    let gains = 0; let losses = 0;
    for (let i = 1; i <= period; i++) {
        const diff = closes[closes.length - i] - closes[closes.length - i - 1];
        if (diff >= 0) gains += diff; else losses -= diff;
    }
    if (losses === 0) return 100;
    const rs = gains / losses;
    return 100 - (100 / (1 + rs));
}

async function performAiBotReview(botId) {
    const bot = bots.get(botId);
    if (!bot || !bot.isRunning || !binanceService || !binanceConfig.openRouterKey) return;
    
    const { symbol, strategy, interval } = bot.config;
    console.log(`[AI-Review] Starting periodic review for Bot ${botId} (${symbol})...`);
    
    try {
        let interval = bot.config.interval ? bot.config.interval.toLowerCase() : '1h';
        const klines = await binanceService.getKlines(symbol, interval, 50);
        if (!Array.isArray(klines)) {
            throw new Error(`Klines response is not an array: ${JSON.stringify(klines)}`);
        }
        const closes = klines.map(k => parseFloat(k[4]));
        const currPrice = closes[closes.length - 1];
        const tradeHistory = (bot.trades || []).slice(-10);

        // Capture current state before AI review
        const oldStrategy = bot.config.strategy;
        const oldInterval = bot.config.interval;
        const oldTp = bot.config.tpPercent;
        const oldSl = bot.config.slPercent;
        const oldLeverage = bot.config.leverage;

        const prompt = `You are a SENIOR QUANT STRATEGIST & RISK MANAGER. Review Bot [${botId}] (${symbol}) on ${interval} TF.
        Current Strategy: ${bot.config.strategy}
        TP: ${bot.config.tpPercent}%, SL: ${bot.config.slPercent}%, Leverage: ${bot.config.leverage}x
        Current Price: ${currPrice}
        Recent Performance (Last 10 trades): ${JSON.stringify(tradeHistory)}

        This is a PERIODIC STRATEGIC REVIEW (every 30-60 mins). 
        You have more historical context now. 

        TASK:
        1. **Market Phase Analysis**: Is the market currently Trending, Range-bound, or High Volatility? Does the current strategy/setup match this phase?
        2. **Volatility Adjustment**: Review if TP/SL are too tight/loose based on the latest candle ranges.
        3. **Optimization**: Suggest changes ONLY if they significantly improve the Risk/Reward ratio or safety.
        4. **Persistence**: If the current setup is performing well or the market hasn't changed much, set "should_update" to false.

        ALLOWED STRATEGIES: EMA, BB, RSI, EMA_RSI, BB_RSI, EMA_BB_RSI, GRID, AI_SCOUTER.

        RESPONSE FORMAT (JSON ONLY):
        { 
          "should_update": true/false,
          "strategy": "${bot.config.strategy}", 
          "tp": ${bot.config.tpPercent}, 
          "sl": ${bot.config.slPercent}, 
          "leverage": ${bot.config.leverage}, 
          "reason": "สรุปการวิเคราะห์เชิงกลยุทธ์เป็นภาษาไทย (เน้นเหตุผลทางเทคนิคและสถิติ)" 
        }
        
        IMPORTANT: "reason" MUST be in THAI. Only set "should_update" to true for meaningful improvements.`;

        const currentModel = binanceConfig.openRouterModel || "google/gemini-2.0-flash-exp:free";
        const apiBody = JSON.stringify({
            model: currentModel,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        });

        const options = {
            hostname: 'openrouter.ai',
            path: '/api/v1/chat/completions',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${binanceConfig.openRouterKey}`,
                'Content-Type': 'application/json'
            }
        };

        const apiReq = https.request(options, (apiRes) => {
            let resData = '';
            apiRes.on('data', d => resData += d);
            apiRes.on('end', () => {
                try {
                    if (apiRes.statusCode !== 200) return;
                    const result = JSON.parse(resData);
                    let aiText = result.choices?.[0]?.message?.content || '{}';
                    aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
                    const recommend = JSON.parse(aiText);
                    
                    if (recommend.should_update) {
                        console.log(`[AI-Review] Updating Bot ${botId} config based on AI recommendation.`);
                        bot.config.strategy = recommend.strategy || bot.config.strategy;
                        
                        let newInterval = recommend.interval || bot.config.interval;
                        if (typeof newInterval === 'string') {
                            newInterval = newInterval.toLowerCase().trim();
                        }
                        bot.config.interval = newInterval;
                        
                        bot.config.tpPercent = recommend.tp || bot.config.tpPercent;
                        bot.config.slPercent = recommend.sl || bot.config.slPercent;
                        bot.config.leverage = recommend.leverage || bot.config.leverage;
                    }

                    if (recommend.reason) {
                        bot.aiReason = recommend.reason;
                        bot.lastAiModel = currentModel;
                    }

                    // Record in AI History (Always record the review)
                    if (!bot.aiHistory) bot.aiHistory = [];
                    bot.aiHistory.push({
                        time: new Date().toLocaleString('th-TH', TZ_OPTS),
                        model: currentModel,
                        reason: recommend.reason || 'AI รีวิวความเหมาะสมของแผนปัจจุบันแล้ว ไม่มีการปรับเปลี่ยนพารามิเตอร์',
                        updated: recommend.should_update ? true : false,
                        changes: recommend.should_update ? {
                            strategy: oldStrategy !== bot.config.strategy ? { from: oldStrategy, to: bot.config.strategy } : null,
                            interval: oldInterval !== bot.config.interval ? { from: oldInterval, to: bot.config.interval } : null,
                            tp: oldTp !== bot.config.tpPercent ? { from: oldTp, to: bot.config.tpPercent } : null,
                            sl: oldSl !== bot.config.slPercent ? { from: oldSl, to: bot.config.slPercent } : null,
                            leverage: oldLeverage !== bot.config.leverage ? { from: oldLeverage, to: bot.config.leverage } : null,
                        } : null
                    });
                    
                    bot.lastAiCheck = new Date().toISOString();
                    saveBotsToFile();
                } catch (e) {
                    console.error('[AI-Review] Error processing AI response:', e.message);
                }
            });
        });
        apiReq.on('error', e => console.error('[AI-Review] API Req Error:', e.message));
        apiReq.write(apiBody);
        apiReq.end();

    } catch (err) {
        console.error(`[AI-Review] Error for Bot ${botId}:`, err.message);
    }
}

async function performAiReflection(bot, signal, closes, currPrice) {
    if (!binanceConfig.openRouterKey) {
        return { approved: true, reason: 'OpenRouter key not set, auto-approved' };
    }
    
    return new Promise((resolve) => {
        try {
            const { symbol, strategy } = bot.config;
            let interval = bot.config.interval ? bot.config.interval.toLowerCase() : '1h';
            
            const prompt = `You are a strict Quant Reflection Agent. A technical indicator just fired a [${signal}] signal for ${symbol} on the ${interval} timeframe using the ${strategy} strategy.
            The current price is ${currPrice}.
            
            Based on your analysis of the market context (volatility, trend, chop), should we execute this ${signal} trade?
            Only approve if it looks like a high probability setup with good risk-reward. Reject if it looks like a false breakout, choppy market, or bad timing.
            
            RESPONSE FORMAT (JSON ONLY):
            {
               "approved": true/false,
               "reason": "สรุปเหตุผลสั้นๆ เป็นภาษาไทย ว่าทำไมถึงอนุมัติหรือปฏิเสธ"
            }`;

            const currentModel = bot.config.aiModel || binanceConfig.openRouterModel || "google/gemini-2.0-flash-exp:free";
            const apiBody = JSON.stringify({
                model: currentModel,
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" }
            });

            const options = {
                hostname: 'openrouter.ai',
                path: '/api/v1/chat/completions',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${binanceConfig.openRouterKey}`,
                    'Content-Type': 'application/json'
                }
            };

            const apiReq = https.request(options, (apiRes) => {
                let resData = '';
                apiRes.on('data', d => resData += d);
                apiRes.on('end', () => {
                    try {
                        if (apiRes.statusCode !== 200) {
                            resolve({ approved: true, reason: 'API Error, auto-approved' });
                            return;
                        }
                        const result = JSON.parse(resData);
                        let aiText = result.choices?.[0]?.message?.content || '{}';
                        aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
                        const recommend = JSON.parse(aiText);
                        resolve({ 
                            approved: Boolean(recommend.approved), 
                            reason: recommend.reason || 'No reason provided'
                        });
                    } catch (e) {
                         resolve({ approved: true, reason: 'Parse Error, auto-approved' });
                    }
                });
            });
            apiReq.on('error', e => resolve({ approved: true, reason: 'Request Error, auto-approved' }));
            apiReq.write(apiBody);
            apiReq.end();

        } catch (err) {
            resolve({ approved: true, reason: 'Exception, auto-approved' });
        }
    });
}

async function binanceTick(botId) {
  const bot = bots.get(botId);
  if (!bot || !bot.isRunning || !binanceService) return;
  const { symbol, strategy, tpPercent, slPercent, leverage = 10 } = bot.config;
  const interval = bot.config.interval ? bot.config.interval.toLowerCase() : '1h';
  const posValue = bot.config.positionSizeUSDT || 100;

  let klines = [];
  let ticker = {};
  let lastCloseTime = null;
  let closes = [];
  let signal = bot.lastSignal || 'NONE';

  try {
    // 1. Fetch market data (Klines for signals, Ticker for real-time price)
    klines = await binanceService.getKlines(symbol, interval, 250);
    ticker = await binanceService.getTickerPrice(symbol);
    
    if (!Array.isArray(klines)) {
      throw new Error(`Klines response is not an array: ${JSON.stringify(klines)}`);
    }

    const closed = klines.slice(0, -1);
    closes = closed.map(k => parseFloat(k[4]));
    const lastK = closed[closed.length - 1];
    lastCloseTime = lastK ? lastK[6] : null; 
    
    // Indicators
    const ema9 = closes.slice(-9).reduce((a, b) => a + b) / 9;
    const ema21 = closes.slice(-21).reduce((a, b) => a + b) / 21;
    const ema200 = closes.slice(-200).reduce((a, b) => a + b) / 200;
    const rsi = (typeof calculateRSI === 'function' ? calculateRSI(closes, 14) : 50);

    const currPrice = parseFloat(ticker.price);
    bot.currentPrice = currPrice;

    // 2. Sync account data (Balance & Positions) from Binance
    const accountInfo = await binanceService.getAccountInfo();
    const usdtAsset = (accountInfo.assets || []).find(a => a.asset === 'USDT');
    if (!usdtAsset) throw new Error('Could not find USDT asset in Binance account');

    bot.currentCash = parseFloat(usdtAsset.availableBalance);
    bot.equity = parseFloat(usdtAsset.marginBalance);
    
    // Ensure initialized
    if (bot.grossProfit === undefined) bot.grossProfit = 0;
    if (bot.grossLoss === undefined || isNaN(bot.grossLoss)) bot.grossLoss = 0;
    if (!bot.trades) bot.trades = [];

    // Calculate PnL ONLY for this bot's symbol using real Binance positions
    const symbolPositions = (accountInfo.positions || []).filter(p => p.symbol === symbol.toUpperCase());
    bot.unrealizedPnl = symbolPositions.reduce((sum, p) => sum + parseFloat(p.unrealizedProfit || 0), 0);
    
    const remotePositions = accountInfo.positions.filter(p => p.symbol === symbol.toUpperCase() && parseFloat(p.positionAmt) !== 0);
    
    // AUTO-DETECT CLOSED POSITIONS
    if (bot.openPositions.length > 0 && remotePositions.length === 0) {
      console.log(`[Binance Bot ${botId}] Position vanished from Binance. Recording trade...`);
      const lastPos = bot.openPositions[0];
      const finalPrice = currPrice;
      const finalPnL = (lastPos.type === 'LONG' ? (finalPrice - lastPos.entryPrice) : (lastPos.entryPrice - finalPrice)) * lastPos.quantity; 

      const tradeData = {
        type: lastPos.type,
        symbol: symbol,
        entryPrice: lastPos.entryPrice,
        exitPrice: finalPrice,
        pnl: finalPnL,
        reason: 'Closed (External/TP/SL)',
        entryReason: lastPos.entryReason || 'Technical Entry',
        exitTime: new Date().toISOString(),
        strategy: strategy
      };
      bot.trades.push(tradeData);
      saveTradeMemory(tradeData);
    }

    // AUTO-STOP ON EXPIRATION
    if (bot.expiresAt && new Date() > new Date(bot.expiresAt)) {
      console.log(`[Binance Bot ${botId}] Lifespan expired. Stopping...`);
      stopBot(botId);
      return;
    }

    // PERIODIC AI STRATEGIC REVIEW (Timer based - Optimized for costs & quality)
    const aiInterval = bot.config.aiCheckInterval || 30; // Default to 30 mins for the user's recommendation

    if (aiInterval > 0 && binanceConfig.openRouterKey) {
        const lastCheck = bot.lastAiCheck ? new Date(bot.lastAiCheck).getTime() : 0;
        const now = Date.now();
        if (now - lastCheck >= aiInterval * 60000) {
            performAiBotReview(botId);
        }
    }

    bot.openPositions = remotePositions.map(p => ({
      id: p.symbol + p.updateTime,
      type: parseFloat(p.positionAmt) > 0 ? 'LONG' : 'SHORT',
      entryPrice: parseFloat(p.entryPrice),
      entryTime: new Date(p.updateTime).toLocaleString('th-TH', TZ_OPTS),
      entryReason: bot.openPositions.find(op => op.id === (p.symbol + p.updateTime))?.entryReason || bot.lastEntryReason || 'Manual/Technical Entry',
      quantity: Math.abs(parseFloat(p.positionAmt)),
      unrealizedPnl: parseFloat(p.unrealizedProfit),
      liqId: parseFloat(p.liquidationPrice)
    }));

    // 2.5 REAL-TIME TP/SL CHECK (Executes on every tick, not just candle close)
    let positionsToKeep = [];
    for (const pos of bot.openPositions) {
      const pnlPct = (pos.type === 'LONG' ? (currPrice - pos.entryPrice) / pos.entryPrice : (pos.entryPrice - currPrice) / pos.entryPrice) * 100;
      let shouldClose = false;
      let reason = '';

      if (tpPercent > 0 && pnlPct >= tpPercent) { shouldClose = true; reason = `TP Hit (+${tpPercent}%)`; }
      else if (slPercent > 0 && pnlPct <= -slPercent) { shouldClose = true; reason = `SL Hit (-${slPercent}%)`; }

      if (shouldClose) {
        console.log(`[Binance Bot ${botId}] REAL-TIME Closing ${pos.type} pos: ${reason}`);
        await binanceService.closePosition(symbol, pos.type, pos.quantity);
        const tradeData = {
          type: pos.type, symbol: symbol, entryPrice: pos.entryPrice, exitPrice: currPrice,
          pnl: pos.unrealizedPnl, reason, exitTime: new Date().toISOString(),
          entryReason: pos.entryReason || 'Technical Entry',
          strategy: strategy
        };
        bot.trades.push(tradeData);
        saveTradeMemory(tradeData);
      } else {
        positionsToKeep.push(pos);
      }
    }
    bot.openPositions = positionsToKeep;

    // 3. Trading Logic on Candle Close (Signals & Trend Changes)
    bot.lastChecked = new Date().toLocaleString('th-TH', TZ_OPTS);
    
    // NEW CANDLE CHECK (For Signal Generation)
    if (bot.lastCandle !== lastCloseTime) {
      bot.lastCandle = lastCloseTime;

      // (Removed forced AI review on every candle close for AI_SCOUTER to focus on quality periodic reviews)
      
      signal = computeSignal(closes, strategy, { 
        gridUpper: bot.config.gridUpper, 
        gridLower: bot.config.gridLower 
      });
      bot.lastSignal = signal;

      // Close remaining positions if SIGNAL FLIPS
      for (const pos of bot.openPositions) {
        let shouldClose = false;
        let reason = '';
        if (signal !== 'NONE' && signal !== pos.type) { shouldClose = true; reason = 'Signal Flipped'; }

        if (shouldClose) {
          console.log(`[Binance Bot ${botId}] Closing ${pos.type} pos: ${reason}`);
          await binanceService.closePosition(symbol, pos.type, pos.quantity);
          const tradeData = {
            type: pos.type, symbol: symbol, entryPrice: pos.entryPrice, exitPrice: currPrice,
            pnl: pos.unrealizedPnl, reason, exitTime: new Date().toISOString(),
            entryReason: pos.entryReason || 'Technical Entry',
            strategy: strategy
          };
          bot.trades.push(tradeData);
          saveTradeMemory(tradeData);
        }
      }

      // If we closed via signal flip, clear local array so new entry works
      if (bot.openPositions.some(pos => signal !== 'NONE' && signal !== pos.type)) {
         bot.openPositions = bot.openPositions.filter(pos => signal === pos.type);
      }

      // Open new position
      if ((signal === 'LONG' || signal === 'SHORT') && bot.openPositions.length === 0) {
        
        // Multi-Agent Reflection Wait
        if (bot.config.useReflection) {
            console.log(`[Binance Bot ${botId}] 🧠 Reflection Agent triggered for ${signal}...`);
            bot.reflectionStatus = `Reflecting on ${signal}...`;
            saveBotsToFile();
            
            const critique = await performAiReflection(bot, signal, closes, currPrice);
            if (!bot.isRunning) return; // In case bot was stopped while waiting
            
            bot.reflectionStatus = null;
            if (!bot.reflectionHistory) bot.reflectionHistory = [];
            bot.reflectionHistory.unshift({
                time: new Date().toLocaleString('th-TH', TZ_OPTS),
                signal: signal,
                approved: critique.approved,
                reason: critique.reason
            });
            if (bot.reflectionHistory.length > 20) bot.reflectionHistory.pop();
            saveBotsToFile();
            
            if (!critique.approved) {
                console.log(`[Binance Bot ${botId}] ❌ Reflection Rejected ${signal}: ${critique.reason}`);
                bot.lastEntryReason = `[REJECTED] ${critique.reason}`;
                // Avoid continually checking the same closed candle
                return;
            }
            console.log(`[Binance Bot ${botId}] ✅ Reflection Approved ${signal}`);
        }

        const rule = symbolRules[symbol.toUpperCase()] || { stepSize: 0.001, minQty: 0.001 };
        let qty = (posValue * leverage) / currPrice;
        
        // Round to stepSize
        const steps = Math.floor(qty / rule.stepSize);
        let fixedQty = steps * rule.stepSize;
        
        // Ensure at least minQty
        if (fixedQty < rule.minQty) fixedQty = 0; 

        // Convert to string without scientific notation and with correct precision
        const precision = rule.stepSize.toString().split('.')[1]?.length || 0;
        const finalQtyStr = fixedQty.toFixed(precision);

        if (fixedQty > 0) {
          console.log(`[Binance Bot ${botId}] Opening ${signal} pos, Qty: ${finalQtyStr} (Step: ${rule.stepSize})`);
          bot.lastEntryReason = generateEntryReason(signal, strategy, closes);
          await binanceService.placeOrder(symbol, signal === 'LONG' ? 'BUY' : 'SELL', 'MARKET', finalQtyStr);
        }
      }
    }

    // FINAL RECALCULATION & SYNC
    bot.grossProfit = 0;
    bot.grossLoss = 0;
    bot.winCount = 0;
    bot.lossCount = 0;
    bot.totalTrades = (bot.trades || []).length;
    
    (bot.trades || []).forEach(t => {
      const pnlValue = parseFloat(t.pnl || 0);
      if (pnlValue >= 0) { bot.grossProfit += pnlValue; bot.winCount++; }
      else { bot.grossLoss += Math.abs(pnlValue); bot.lossCount++; }
    });

    bot.netPnl = (bot.unrealizedPnl || 0) + (bot.grossProfit - bot.grossLoss);

    if (bot.config.groupId) {
        evaluateGroupPnL(bot.config.groupId);
    }

    saveBotsToFile();
  } catch (err) {
    console.error(`[Binance Bot ${botId}] tick error:`, err.message);
  }
}

async function evaluateGroupPnL(groupId) {
    const groupBots = Array.from(bots.values()).filter(b => b.config.groupId === groupId && b.isRunning);
    if (groupBots.length === 0) return;

    // Use the config of the first bot to determine group rules
    const firstConfig = groupBots[0].config;
    const groupTp = firstConfig.groupTpPercent || 0;
    const groupSl = firstConfig.groupSlPercent || 0;
    const groupCapital = firstConfig.groupCapital || 0;
    const groupName = firstConfig.groupName || groupId;

    if (groupCapital <= 0) return;

    let totalUnrealized = 0;
    let totalRealized = 0;
    groupBots.forEach(b => {
        totalUnrealized += (b.unrealizedPnl || 0);
        totalRealized += (b.grossProfit || 0) - (b.grossLoss || 0);
    });

    const totalGroupPnL = totalUnrealized + totalRealized;
    const pnlPercent = (totalGroupPnL / groupCapital) * 100;

    let shouldClose = false;
    let reason = '';

    if (groupTp > 0 && pnlPercent >= groupTp) {
        shouldClose = true;
        reason = `GROUP ${groupName} Target Reached (+${pnlPercent.toFixed(2)}%)`;
    } else if (groupSl > 0 && pnlPercent <= -groupSl) {
        shouldClose = true;
        reason = `GROUP ${groupName} Stop Loss Hit (${pnlPercent.toFixed(2)}%)`;
    }

    if (shouldClose) {
        console.log(`[Fleet Command] 🚨 ${reason}. Stopping all ${groupBots.length} bots in group!`);
        for (const b of groupBots) {
            b.isRunning = false;
            stopBot(b.id);
            for (const pos of b.openPositions) {
                try {
                    await binanceService.closePosition(b.config.symbol, pos.type, pos.quantity);
                    const tradeData = {
                        type: pos.type, symbol: b.config.symbol, entryPrice: pos.entryPrice, exitPrice: b.currentPrice || pos.entryPrice,
                        pnl: pos.unrealizedPnl, reason: reason, exitTime: new Date().toISOString(),
                        entryReason: pos.entryReason || 'Technical Entry',
                        strategy: b.config.strategy
                    };
                    b.trades.push(tradeData);
                    saveTradeMemory(tradeData);
                } catch(e) { console.error('[Fleet Close Error]:', e.message); }
            }
            b.openPositions = [];
        }
        saveBotsToFile();
    }
}

function startBot(config) {
  const botId = makeBotId();
  const capital = config.capital || 0;
  
  let expiresAt = null;
  if (config.durationMinutes > 0) {
    expiresAt = new Date(Date.now() + config.durationMinutes * 60000).toISOString();
  }

  const bot = {
    id: botId,
    isRunning: true,
    config,
    expiresAt,
    openPositions: [],
    capital,
    currentCash: capital,
    equity: capital,
    grossProfit: 0,
    grossLoss: 0,
    winCount: 0,
    lossCount: 0,
    lastSignal: 'NONE',
    lastCandle: null,
    lastChecked: '',
    currentPrice: 0,
    unrealizedPnl: 0,
    trades: [],
    aiHistory: [],
    reflectionHistory: [],
    reflectionStatus: null,
    startedAt: new Date().toLocaleString('th-TH', TZ_OPTS),
    lastAiCheck: new Date().toISOString(), // Initial check time
    aiReason: config.aiReason || '',
    lastAiModel: config.aiModel || null,
  };
  bots.set(botId, bot);
  
  if (config.exchange === 'binance_testnet') {
    if (!binanceService) throw new Error('Binance Service not initialized. Set API keys first.');
    binanceTick(botId);
    botTimers.set(botId, setInterval(() => binanceTick(botId), 30_000));
  } else {
    throw new Error('Unsupported exchange or Paper Trading disabled.');
  }
  
  saveBotsToFile();
  console.log(`[Bot ${botId}] Started (${config.exchange || 'paper'}):`, config.symbol, config.interval, config.strategy);
  return botId;
}

function stopBot(botId) {
  const timer = botTimers.get(botId);
  if (timer) { clearInterval(timer); botTimers.delete(botId); }
  const bot = bots.get(botId);
  if (bot) { bot.isRunning = false; }
  saveBotsToFile();
  console.log(`[Bot ${botId}] Stopped`);
}

function deleteBot(botId) {
  stopBot(botId);
  bots.delete(botId);
  saveBotsToFile();
  console.log(`[Bot ${botId}] Deleted`);
}

// ─── Gold Forward Test (Forex Lot Sizing) ──────────────────────────────────────
const goldBots = new Map(); // botId -> goldBotState
const goldBotTimers = new Map();
const goldBotsFile = path.resolve('gold-bots-db.json');
const OZ_PER_STD_LOT = 100;

function saveGoldBots() {
  try {
    const data = Array.from(goldBots.values()).map(b => ({ ...b, lastCandle: null }));
    fs.writeFileSync(goldBotsFile, JSON.stringify(data, null, 2));
  } catch (e) { console.error('[Gold] save error:', e.message); }
}

function loadGoldBots() {
  try {
    if (!fs.existsSync(goldBotsFile)) return;
    const data = JSON.parse(fs.readFileSync(goldBotsFile, 'utf8'));
    if (!Array.isArray(data)) return;
    let resumed = 0;
    for (const bot of data) {
      bot.openPositions = bot.openPositions || [];
      const was = bot.isRunning;
      bot.isRunning = false;
      goldBots.set(bot.id, bot);
      if (was) {
        bot.isRunning = true;
        goldTick(bot.id);
        goldBotTimers.set(bot.id, setInterval(() => goldTick(bot.id), 30_000));
        resumed++;
      }
    }
    console.log(`[Gold] Loaded ${data.length} bot(s) — resumed ${resumed}`);
  } catch (e) { console.error('[Gold] load error:', e.message); }
}
loadGoldBots();

async function goldTick(botId) {
  const bot = goldBots.get(botId);
  if (!bot || !bot.isRunning) return;
  const { interval, strategy, lots, leverage = 100, tpUSD, slUSD } = bot.config;
  const maxPositions = bot.config.maxPositions || 3;
  const contractOz = lots * OZ_PER_STD_LOT;
  const maintenanceMargin = 0.005;

  try {
    const klines = await fetchKlines('PAXGUSDT', interval, 100);
    if (!Array.isArray(klines)) {
      throw new Error(`Gold Klines response is not an array: ${JSON.stringify(klines)}`);
    }
    const closed = klines.slice(0, -1);
    const closes = closed.map(k => parseFloat(k[4]));
    const lastK = closed[closed.length - 1];
    const lastCloseTime = lastK[6];
    const currPrice = closes[closes.length - 1];

    bot.currentPrice = currPrice;

    // Debounce
    if (bot.lastCandle === lastCloseTime) {
      bot.unrealizedPnl = (bot.openPositions || []).reduce((sum, p) => {
        const diff = p.type === 'LONG' ? currPrice - p.entryPrice : p.entryPrice - currPrice;
        return sum + diff * contractOz;
      }, 0);
      return;
    }
    bot.lastCandle = lastCloseTime;
    bot.lastChecked = new Date().toLocaleString('th-TH', TZ_OPTS);
    const signal = computeSignal(closes, strategy);
    bot.lastSignal = signal;

    const remaining = [];
    let stateChanged = false;
    for (const pos of (bot.openPositions || [])) {
      const pnl = (pos.type === 'LONG' ? currPrice - pos.entryPrice : pos.entryPrice - currPrice) * contractOz;
      const isLiquidated = pos.liqId && (pos.type === 'LONG' ? currPrice <= pos.liqId : currPrice >= pos.liqId);

      let closeReason = '';
      if (isLiquidated) closeReason = '🔴 LIQUIDATED';
      else if (tpUSD > 0 && pnl >= tpUSD) closeReason = `TP Hit (+$${tpUSD})`;
      else if (slUSD > 0 && pnl <= -slUSD) closeReason = `SL Hit (-$${slUSD})`;
      else if (signal !== 'NONE' && signal !== pos.type) closeReason = 'Signal Flipped';

      if (closeReason) {
        stateChanged = true;
        const finalPnL = isLiquidated ? -(pos.initialMargin || 0) : pnl;
        bot.walletBalance += finalPnL;
        goldWallet.balance += finalPnL;
        goldWallet.allTimePnL += finalPnL;
        goldWallet.allTimeTrades++;
        saveGoldWallet();
        if (finalPnL >= 0) { bot.grossProfit += finalPnL; bot.winCount++; }
        else { bot.grossLoss += Math.abs(finalPnL); bot.lossCount++; }
        bot.trades.push({ posId: pos.id, entryTime: pos.entryTime, exitTime: new Date().toLocaleString('th-TH', TZ_OPTS), type: pos.type, entryPrice: pos.entryPrice, exitPrice: currPrice, pnl: finalPnL, reason: closeReason, lots, isLiquidated });
      } else {
        remaining.push(pos);
      }
    }
    bot.openPositions = remaining;

    if ((signal === 'LONG' || signal === 'SHORT') && (bot.openPositions || []).length < maxPositions) {
      bot.openPositions.push({
        id: makeBotId(), type: signal,
        entryPrice: currPrice, entryTime: new Date().toLocaleString('th-TH', TZ_OPTS),
        liqId: signal === 'LONG'
          ? currPrice * (1 - 1/leverage + maintenanceMargin)
          : currPrice * (1 + 1/leverage - maintenanceMargin),
        initialMargin: (contractOz * currPrice) / leverage,
        lots,
      });
      stateChanged = true;
    }

    bot.unrealizedPnl = (bot.openPositions || []).reduce((sum, p) => {
      const diff = p.type === 'LONG' ? currPrice - p.entryPrice : p.entryPrice - currPrice;
      return sum + diff * contractOz;
    }, 0);

    if (stateChanged) saveGoldBots();
  } catch (err) { console.error(`[Gold Bot ${botId}] tick error:`, err.message); }
}

function startGoldBot(config) {
  const botId = makeBotId();
  const bot = {
    id: botId, isRunning: true, config,
    openPositions: [],
    walletBalance: goldWallet.balance,
    startBalance: goldWallet.balance,
    grossProfit: 0, grossLoss: 0,
    winCount: 0, lossCount: 0,
    lastSignal: 'NONE', lastCandle: null, lastChecked: '',
    currentPrice: 0, unrealizedPnl: 0, trades: [],
    startedAt: new Date().toLocaleString('th-TH', TZ_OPTS),
  };
  goldBots.set(botId, bot);
  goldTick(botId);
  goldBotTimers.set(botId, setInterval(() => goldTick(botId), 30_000));
  saveGoldBots();
  console.log(`[Gold Bot ${botId}] Started: ${config.interval} ${config.strategy} ${config.lots} lots`);
  return botId;
}

function stopGoldBot(botId) {
  const t = goldBotTimers.get(botId);
  if (t) { clearInterval(t); goldBotTimers.delete(botId); }
  const bot = goldBots.get(botId);
  if (bot) bot.isRunning = false;
  saveGoldBots();
}

function deleteGoldBot(botId) {
  stopGoldBot(botId);
  goldBots.delete(botId);
  saveGoldBots();
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const parsedUrl = url.parse(req.url, true);

  if (parsedUrl.pathname === '/api/state' && req.method === 'GET') {
    try {
      const data = fs.readFileSync(dataFile, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    } catch { res.writeHead(500); res.end(JSON.stringify({ error: 'Failed to read data' })); }

  } else if (parsedUrl.pathname === '/api/state' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const currentState = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
        const newState = { ...currentState, ...payload };
        fs.writeFileSync(dataFile, JSON.stringify(newState, null, 2));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, state: newState }));
      } catch { res.writeHead(500); res.end(JSON.stringify({ error: 'Failed to write data' })); }
    });

  } else if (parsedUrl.pathname === '/api/backtest' && req.method === 'GET') {
    const symbol = parsedUrl.query.symbol || 'BTCUSDT';
    const interval = parsedUrl.query.interval || '1h';
    const startTime = parsedUrl.query.startTime;
    const endTime = parsedUrl.query.endTime;
    const limit = parsedUrl.query.limit || '1000';
    let binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    if (startTime) binanceUrl += `&startTime=${startTime}`;
    if (endTime) binanceUrl += `&endTime=${endTime}`;
    https.get(binanceUrl, (apiRes) => {
      let data = '';
      apiRes.on('data', chunk => { data += chunk; });
      apiRes.on('end', () => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(data); });
    }).on('error', (err) => { res.writeHead(500); res.end(JSON.stringify({ error: err.message })); });

  } else if (parsedUrl.pathname === '/api/forward-test/resume' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { botId } = JSON.parse(body);
        const bot = bots.get(botId);
        if (!bot) throw new Error('Bot not found');
        if (bot.isRunning) throw new Error('Bot already running');
        
        bot.isRunning = true;
        
        // Reset expiration time upon resuming so it doesn't immediately stop
        if (bot.config.durationMinutes > 0) {
          bot.expiresAt = new Date(Date.now() + bot.config.durationMinutes * 60000).toISOString();
        } else {
          bot.expiresAt = null;
        }

        if (bot.config.exchange === 'binance_testnet') {
          binanceTick(bot.id);
          botTimers.set(bot.id, setInterval(() => binanceTick(bot.id), 30_000));
        }
        saveBotsToFile();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: e.message })); }
    });

  } else if (parsedUrl.pathname === '/api/forward-test/start' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const config = JSON.parse(body);
        const botId = startBot(config);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, botId }));
      } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: e.message })); }
    });

  } else if (parsedUrl.pathname === '/api/forward-test/stop' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { botId } = JSON.parse(body);
        stopBot(botId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: e.message })); }
    });

  } else if (parsedUrl.pathname === '/api/forward-test/delete' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { botId } = JSON.parse(body);
        deleteBot(botId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: e.message })); }
    });
  } else if (parsedUrl.pathname === '/api/forward-test/update' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { botId, config } = JSON.parse(body);
        const bot = bots.get(botId);
        if (!bot) throw new Error('Bot not found');
        if (config.aiCheckInterval !== undefined) bot.config.aiCheckInterval = config.aiCheckInterval;
        if (config.tpPercent !== undefined) bot.config.tpPercent = config.tpPercent;
        if (config.slPercent !== undefined) bot.config.slPercent = config.slPercent;
        saveBotsToFile();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: e.message })); }
    });

  } else if (parsedUrl.pathname === '/api/wallet/gold' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(goldWallet));

  } else if (parsedUrl.pathname === '/api/wallet/gold/fund' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { amount, reset } = JSON.parse(body);
        if (reset) {
          goldWallet = { balance: amount, allTimePnL: 0, allTimeTrades: 0 };
        } else {
          goldWallet.balance += amount;
        }
        saveGoldWallet();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, wallet: goldWallet }));
      } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: e.message })); }
    });

  } else if (parsedUrl.pathname === '/api/forward-test/summary' && req.method === 'GET') {
    // Lightweight summary: all bots (running first), key PnL metrics only
    const summary = Array.from(bots.values())
      .sort((a, b) => (b.isRunning ? 1 : 0) - (a.isRunning ? 1 : 0))
      .map(bot => {
        const netPnl = bot.netPnl || 0;
        const netPnlPct = bot.capital > 0 ? (netPnl / bot.capital) * 100 : 0;
        const totalTrades = (bot.trades || []).length;
        const winRate = totalTrades > 0 ? (bot.winCount / totalTrades) * 100 : 0;
        return {
          id: bot.id,
          isRunning: bot.isRunning,
          symbol: bot.config?.symbol,
          interval: bot.config?.interval,
          strategy: bot.config?.strategy,
          capital: bot.capital,
          equity: parseFloat((bot.equity || 0).toFixed(2)),
          currentPrice: bot.currentPrice || 0,
          netPnl: parseFloat(netPnl.toFixed(2)),
          netPnlPct: parseFloat(netPnlPct.toFixed(2)),
          unrealizedPnl: parseFloat((bot.unrealizedPnl || 0).toFixed(2)),
          openPositions: (bot.openPositions || []).length,
          totalTrades,
          winCount: bot.winCount,
          lossCount: bot.lossCount,
          winRate: parseFloat(winRate.toFixed(1)),
          lastSignal: bot.lastSignal,
          lastChecked: bot.lastChecked,
          startedAt: bot.startedAt,
          aiReason: bot.aiReason,
        };
      });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(summary, null, 2));

  } else if (parsedUrl.pathname === '/api/forward-test/status' && req.method === 'GET') {
    const all = Array.from(bots.values()).map(bot => {
      const totalTrades = (bot.trades || []).length;
      const winRate = totalTrades > 0 ? (bot.winCount / totalTrades) * 100 : 0;
      const netPnl = bot.netPnl || 0;
      const netPnlPct = bot.capital > 0 ? (netPnl / bot.capital) * 100 : 0;
      return { ...bot, totalTrades, winRate, netPnl, netPnlPct };
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(all));

  } else if (parsedUrl.pathname === '/api/gold-forward/start' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const config = JSON.parse(body);
        const botId = startGoldBot(config);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, botId }));
      } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: e.message })); }
    });

  } else if (parsedUrl.pathname === '/api/gold-forward/stop' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { botId } = JSON.parse(body);
        stopGoldBot(botId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: e.message })); }
    });

  } else if (parsedUrl.pathname === '/api/gold-forward/delete' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { botId } = JSON.parse(body);
        deleteGoldBot(botId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: e.message })); }
    });

  } else if (parsedUrl.pathname === '/api/gold-forward/status' && req.method === 'GET') {
    const all = Array.from(goldBots.values()).map(bot => ({
      ...bot,
      totalTrades: (bot.trades || []).length,
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(all));

  } else if (parsedUrl.pathname === '/api/binance/config' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        console.log('[API] Updating Binance & AI Config...');
        const data = JSON.parse(body);
        
        const updateIfValid = (newVal, oldVal) => {
          if (newVal === undefined || newVal === '********' || newVal === '') return oldVal;
          return newVal;
        };

        binanceConfig = { 
          apiKey: updateIfValid(data.apiKey, binanceConfig.apiKey), 
          apiSecret: updateIfValid(data.apiSecret, binanceConfig.apiSecret),
          openRouterKey: updateIfValid(data.openRouterKey, binanceConfig.openRouterKey),
          openRouterModel: data.openRouterModel || binanceConfig.openRouterModel
        };
        saveBinanceConfig();
        
        if (binanceConfig.apiKey && binanceConfig.apiSecret) {
            binanceService = new BinanceTestnetService(binanceConfig.apiKey, binanceConfig.apiSecret);
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) { 
        console.error('[API] Config error:', e.message);
        res.writeHead(400); 
        res.end(JSON.stringify({ error: e.message })); 
      }
    });

  } else if (parsedUrl.pathname === '/api/binance/config' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      apiKey: binanceConfig.apiKey ? '********' : '', 
      hasSecret: !!binanceConfig.apiSecret,
      hasOpenRouter: !!binanceConfig.openRouterKey,
      openRouterModel: binanceConfig.openRouterModel
    }));

  } else if (parsedUrl.pathname === '/api/binance/account' && req.method === 'GET') {
    if (!binanceService) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Binance credentials not set' }));
      return;
    }
    Promise.all([
      binanceService.getAccountInfo(),
      binanceService.getPositionRisk()
    ])
      .then(([account, risk]) => {
        // Merge Mark Price and Liq Price from risk into account positions
        const mergedPositions = (account.positions || []).map(p => {
          const r = risk.find(rk => rk.symbol === p.symbol);
          return {
            ...p,
            markPrice: r ? r.markPrice : p.markPrice,
            liquidationPrice: r ? r.liquidationPrice : p.liquidationPrice,
            marginType: r ? r.marginType : 'isolated', // 'cross' or 'isolated'
            isolatedMargin: r ? r.isolatedMargin : '0'
          };
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ...account, positions: mergedPositions }));
      })
      .catch(err => {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      });

  } else if (parsedUrl.pathname === '/api/binance/balance' && req.method === 'GET') {
    if (!binanceService) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Binance credentials not set' }));
      return;
    }
    binanceService.getUSDTBalance()
      .then(balance => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ balance }));
      })
      .catch(err => {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      });

  } else if (parsedUrl.pathname === '/api/binance/close-manual' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const { symbol, type, quantity } = JSON.parse(body);
        if (!binanceService) throw new Error('Binance service not initialized');
        
        console.log(`[API] Manual Close: ${symbol} ${type} Qty:${quantity}`);
        const result = await binanceService.closePosition(symbol, type, quantity);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, result }));
      } catch (e) {
        console.error('[API] Close manual error:', e.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });

  } else if (parsedUrl.pathname === '/api/binance/ai-analyze' && req.method === 'POST') {
    if (!binanceConfig.openRouterKey) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'OpenRouter API Key not set' }));
        return;
    }

    const botsArray = Array.from(bots.values());
    const currentConfigs = botsArray.map(b => ({
        symbol: b.config.symbol,
        strategy: b.config.strategy,
        tp: b.config.tpPercent,
        sl: b.config.slPercent,
        leverage: b.config.leverage,
        botId: b.id
    }));

    let tradeHistory = [];
    try {
        if (fs.existsSync(tradeMemoryFile)) {
            tradeHistory = JSON.parse(fs.readFileSync(tradeMemoryFile, 'utf8'));
        }
    } catch (e) { console.error('[AI] Load memory error:', e.message); }
    tradeHistory = tradeHistory.slice(-30); // Take last 30 for context

    const prompt = `You are a MASTER CRYPTO QUANT TRADER. Analyze the following data from my Binance Testnet operations:

    [Current Bot Configurations]
    ${JSON.stringify(currentConfigs, null, 2)}

    [Recent Performance History (Last 30 Trades)]
    ${JSON.stringify(tradeHistory, null, 2)}

    TASK:
    1. **Strategic Audit**: Compare the current configurations with the results. Are the TP/SL levels realistic for the current market volatility?
    2. **Pattern Identification**: Identify if certain coins or strategies are consistently failing/succeeding (e.g. "EMA 200 is too slow for BTC at 15m").
    3. **Profit Maximization Plan**: Provide EXACT numbers to change in my settings (e.g. "Lower BTC TP to 1.5%", "Increase SOL Leverage to 5x").
    4. **Risk Advisory**: Highlight any "Danger Zones" where the current setup might lead to major drawdowns.

    Format your report in a professional Markdown with clear sections and bullet points. 
    IMPORTANT: The entire response MUST be in THAI language.`;

    const apiBody = JSON.stringify({
        model: binanceConfig.openRouterModel || "meta-llama/llama-3.1-8b-instruct",
        messages: [{ role: "user", content: prompt }]
    });

    const options = {
        hostname: 'openrouter.ai',
        path: '/api/v1/chat/completions',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${binanceConfig.openRouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'Binance Trading Dashboard'
        }
    };

    const apiReq = https.request(options, (apiRes) => {
        let responseData = '';
        apiRes.on('data', (chunk) => { responseData += chunk; });
        apiRes.on('end', () => {
            try {
                if (apiRes.statusCode !== 200) {
                    console.error('[AI] OpenRouter Error Status:', apiRes.statusCode, responseData);
                    res.writeHead(apiRes.statusCode, { 'Content-Type': 'application/json' });
                    res.end(responseData || JSON.stringify({ error: `OpenRouter returned ${apiRes.statusCode}` }));
                    return;
                }
                const result = JSON.parse(responseData);
                const aiMessage = result.choices?.[0]?.message?.content || 'AI could not generate an analysis.';
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ analysis: aiMessage }));
            } catch (e) {
                console.error('[AI] Parse error:', e.message, responseData);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to process AI response' }));
            }
        });
    });

    apiReq.on('error', (e) => {
        console.error('[AI] Request error:', e.message);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Request to AI failed: ' + e.message }));
    });

    apiReq.write(apiBody);
    apiReq.end();

  } else if (parsedUrl.pathname === '/api/ai/chat/direct' && req.method === 'POST') {
    if (!binanceConfig.openRouterKey) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'OpenRouter API Key not set' }));
        return;
    }
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
        try {
            const { prompt, model } = JSON.parse(body);
            const apiBody = JSON.stringify({
                model: model || binanceConfig.openRouterModel || "google/gemini-2.0-flash-exp:free",
                messages: [{ role: "user", content: prompt }]
            });
            const apiReq = https.request({
                hostname: 'openrouter.ai',
                path: '/api/v1/chat/completions',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${binanceConfig.openRouterKey}`,
                    'Content-Type': 'application/json'
                }
            }, (apiRes) => {
                let resData = '';
                apiRes.on('data', d => resData += d);
                apiRes.on('end', () => {
                    try {
                        const result = JSON.parse(resData);
                        const content = result.choices?.[0]?.message?.content || '';
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ content }));
                    } catch (e) {
                        res.writeHead(500);
                        res.end(JSON.stringify({ error: 'AI Parse Error' }));
                    }
                });
            });
            apiReq.on('error', e => {
                res.writeHead(500);
                res.end(JSON.stringify({ error: e.message }));
            });
            apiReq.write(apiBody);
            apiReq.end();
        } catch (e) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: e.message }));
        }
    });

  } else if (parsedUrl.pathname === '/api/binance/ai-recommend' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const { symbol, strategy, interval, mode = 'confident' } = JSON.parse(body);
        if (!binanceService || !binanceConfig.openRouterKey) throw new Error('Ready your Binance Keys & OpenRouter Key first');

        let targetInterval = interval || '1h';
        if (mode === 'scout') targetInterval = '5m';
        if (mode === 'grid' && targetInterval === '1h') targetInterval = '15m'; // Prefer 15m for Grid

        const klines = await binanceService.getKlines(symbol, targetInterval, 100);
        if (!Array.isArray(klines)) {
          throw new Error(`Recommend Klines response is not an array: ${JSON.stringify(klines)}`);
        }
        const closes = klines.map(k => parseFloat(k[4]));
        const currPrice = closes[closes.length - 1];
        
        let promptStyle = '';
        if (mode === 'grid') {
          promptStyle = `STYLE: GRID TRADING (Fast entry). 
          - Recommend 'GRID' as strategy. 
          - Define 'grid_upper' and 'grid_lower' price boundaries based on current volatility.
          - Set tight TP/SL for high frequency trades.`;
        } else if (mode === 'scout') {
          promptStyle = `STYLE: AGGRESSIVE SCOUTING/SCALPING. 
          - Recommend 'AI_SCOUTER' as strategy. 
          - Use very tight TP/SL (e.g. 0.5% - 1.0%).
          - Focus on quick entries on 5m intervals.`;
        } else {
          promptStyle = `STYLE: PRECISE/CONFIDENT (Wait for trend). 
          - Recommend 'RSI_TREND', 'EMA_RSI' or 'EMA_CROSS'. 
          - Focus on high win-rate setups.`;
        }

        const prompt = `You are a MASTER QUANT. Analyze ${symbol} at ${targetInterval} (MANDATORY). Price: ${currPrice}. 
        ${promptStyle}

        Strategies available:
        - EMA: Crossover 20/50
        - RSI: RSI 30/70
        - EMA_RSI: Crossover with RSI filter (Safest)
        - AI_SCOUTER: Aggressive SMA cross for scalping.
        - GRID: Boundary-based Grid or Deviation-based entry.

        TASK:
        1. Select the BEST STRATEGY for current market and the chosen STYLE (If SCOUT, MUST use AI_SCOUTER).
        2. Set TP/SL % & Leverage (1-20).
        3. Predict how many minutes this SETUP will be valid (expected_duration_min).
        4. (If GRID mode) Provide "grid_upper" and "grid_lower" prices.

        RESPONSE FORMAT (JSON ONLY, NO MARKDOWN):
        { 
          "strategy": "...", "interval": "${targetInterval}", "tp": 1.5, "sl": 0.8, "leverage": 10, 
          "expected_duration_min": 60, "reason": "คำอธิบายเหตุผลเป็นภาษาไทย",
          "grid_upper": 0.0, "grid_lower": 0.0 
        }
        
        IMPORTANT: The "reason" field MUST be in THAI language.`;

        const currentModel = binanceConfig.openRouterModel || "google/gemini-2.0-flash-exp:free";
        const apiBody = JSON.stringify({
            model: currentModel,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        });

        const options = {
            hostname: 'openrouter.ai',
            path: '/api/v1/chat/completions',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${binanceConfig.openRouterKey}`,
                'Content-Type': 'application/json'
            }
        };

        const apiReq = https.request(options, (apiRes) => {
            let resData = '';
            apiRes.on('data', d => resData += d);
            apiRes.on('end', () => {
                try {
                    if (apiRes.statusCode !== 200) {
                        console.error('[AI] Recommend Error Status:', apiRes.statusCode, resData);
                        res.writeHead(apiRes.statusCode, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: `AI Provider Error: ${apiRes.statusCode}` }));
                        return;
                    }
                    const result = JSON.parse(resData);
                    let aiText = result.choices?.[0]?.message?.content || '{}';
                    
                    // Clean AI text: strip markdown if present (```json ... ```)
                    aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
                    console.log('[AI] Cleaned AI Response:', aiText);
                    
                    // Add model info to the response
                    const recommend = JSON.parse(aiText);
                    recommend.model = currentModel;
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(recommend));
                } catch (e) { 
                    console.error('[AI] Parse/Validation error:', e.message, resData);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'AI returned invalid formatting. Please try again.' })); 
                }
            });
        });
        apiReq.on('error', e => { throw e; });
        apiReq.write(apiBody);
        apiReq.end();
      } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: e.message })); }
    });

  } else if (parsedUrl.pathname === '/api/binance/ai-market-scan' && req.method === 'POST') {
    if (!binanceConfig.openRouterKey) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'OpenRouter API Key not set' }));
        return;
    }

    let bodyData = '';
    req.on('data', chunk => bodyData += chunk.toString());
    req.on('end', () => {
        let aiType = 'scout';
        let count = 10;
        let customModel = null;
        try {
            const parsed = JSON.parse(bodyData);
            if (parsed.aiType) aiType = parsed.aiType;
            if (parsed.count && !isNaN(parsed.count)) count = parseInt(parsed.count);
            if (parsed.model) customModel = parsed.model;
        } catch(e) {}

        // Get valid symbols from Binance Testnet first
        binanceService.getExchangeInfo().then(info => {
          const validSet = new Set(info.symbols.filter(s => s.status === 'TRADING').map(s => s.symbol));
          
          https.get('https://api.binance.com/api/v3/ticker/24hr', (apiRes) => {
              let tickerData = '';
              apiRes.on('data', d => tickerData += d);
              apiRes.on('end', () => {
                try {
                  const allTickers = JSON.parse(tickerData);
                  const candidates = allTickers
                      .filter(s => s.symbol.endsWith('USDT') && validSet.has(s.symbol))
                      .sort((a,b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
                      .slice(0, 40);

                  if (candidates.length === 0) {
                     // Fallback if no volume data match valid set
                     const fallback = Array.from(validSet).slice(0, 20).map(s => ({ s: s, p: '0', c: '0%', v: '0' }));
                     return sendToAi(fallback);
                  }

                  const context = candidates.map(t => ({
                      s: t.symbol,
                      p: t.lastPrice,
                      c: t.priceChangePercent + '%',
                      v: Math.round(parseFloat(t.quoteVolume))
                  }));

                  sendToAi(context);
                } catch(e) {
                  res.writeHead(500);
                  res.end(JSON.stringify({ error: 'Ticker parse failed' }));
                }
              });
          }).on('error', e => {
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Binance API unreachable' }));
          });

          function sendToAi(context) {
            let promptDesc = "BEST for 5m Scalping (AI_SCOUTER)";
            let expectedStrategy = "AI_SCOUTER";
            let expectedInterval = "5m";
            
            if (aiType === 'confident') {
                promptDesc = "BEST for 15m Trend following / High Winrate (EMA_RSI)";
                expectedStrategy = "EMA_RSI";
                expectedInterval = "15m";
            } else if (aiType === 'grid') {
                promptDesc = "BEST for 1h Grid Trading boundary mapping (GRID)";
                expectedStrategy = "GRID";
                expectedInterval = "1h";
            }

            const prompt = `You are a QUANT SCANNER. Review these top performers on Binance:
            ${JSON.stringify(context)}

            TASK:
            1. Pick exactly ${count} symbols from the provided list.
            2. The symbols must be ${promptDesc} right now.
            3. MANDATORY: You MUST return EXACTLY ${count} symbols in the "recommendations" array. Not more, not less.
            4. RESPONSE FORMAT MUST BE VALID JSON:
            {
              "recommendations": [
                {
                  "symbol": "BTCUSDT",
                  "strategy": "${expectedStrategy}",
                  "interval": "${expectedInterval}",
                  "tp": 0.8,
                  "sl": 0.5,
                  "leverage": 15,
                  "reason": "Explain in THAI why this coin is perfect for this strategy right now."
                }
              ]
            }
            Do NOT include any text before or after the JSON.`;

        const currentModel = customModel || binanceConfig.openRouterModel || "google/gemini-2.0-flash-exp:free";
        const apiBody = JSON.stringify({
            model: currentModel,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        });

        const apiReq = https.request({
            hostname: 'openrouter.ai',
            path: '/api/v1/chat/completions',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${binanceConfig.openRouterKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 25000 // 25 seconds timeout
        }, (routerRes) => {
            let resData = '';
            routerRes.on('data', d => resData += d);
            routerRes.on('end', () => {
                try {
                    if (routerRes.statusCode !== 200) {
                        throw new Error(`AI Provider returned status ${routerRes.statusCode}`);
                    }
                    const result = JSON.parse(resData);
                    let aiText = result.choices?.[0]?.message?.content;
                    if (!aiText) throw new Error('AI returned empty response');
                    
                    aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
                    const finalData = JSON.parse(aiText);
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(finalData));
                } catch (e) {
                    console.error('[Market Scanner] Processing Error:', e.message);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'AI Analysis failed or timed out. Please try again.' }));
                }
            });
        });

        apiReq.on('timeout', () => {
            apiReq.destroy();
            res.writeHead(504, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'AI Scanner timed out (25s). Power is too low, please try again.' }));
        });

        apiReq.on('error', e => { 
            res.writeHead(500, { 'Content-Type': 'application/json' }); 
            res.end(JSON.stringify({ error: 'Connection Error: ' + e.message })); 
        });
        apiReq.write(apiBody);
        apiReq.end();
          } // end sendToAi
        }).catch(err => {
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Could not fetch Exchange Info: ' + err.message }));
        });
    }); // end req.on('end')

  } else if (parsedUrl.pathname === '/api/binance/ai-fleet-propose' && req.method === 'POST') {
    if (!binanceConfig.openRouterKey) {
        res.writeHead(400); return res.end(JSON.stringify({ error: 'OpenRouter API Key not set' }));
    }

    let bodyData = '';
    req.on('data', chunk => bodyData += chunk.toString());
    req.on('end', () => {
        let count = 5;
        let capital = 500;
        let durationMins = 480;
        let customModel = null;
        let customInstructions = '';
        try {
            const parsed = JSON.parse(bodyData);
            if (parsed.count && !isNaN(parsed.count)) count = parseInt(parsed.count);
            if (parsed.capital && !isNaN(parsed.capital)) capital = parseFloat(parsed.capital);
            if (parsed.durationMins && !isNaN(parsed.durationMins)) durationMins = parseInt(parsed.durationMins);
            if (parsed.model) customModel = parsed.model;
            if (parsed.instructions) customInstructions = parsed.instructions;
        } catch(e) {}

        binanceService.getExchangeInfo().then(info => {
          const validSet = new Set(info.symbols.filter(s => s.status === 'TRADING').map(s => s.symbol));
          
          https.get('https://api.binance.com/api/v3/ticker/24hr', (apiRes) => {
              let tickerData = '';
              apiRes.on('data', d => tickerData += d);
              apiRes.on('end', () => {
                try {
                  const allTickers = JSON.parse(tickerData);
                  const candidates = allTickers
                      .filter(s => s.symbol.endsWith('USDT') && validSet.has(s.symbol))
                      .sort((a,b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
                      .slice(0, 40);

                  if (candidates.length === 0) {
                     res.writeHead(400); return res.end(JSON.stringify({ error: 'No valid tickers found' }));
                  }

                  const context = candidates.map(t => ({
                      s: t.symbol, 
                      p: t.lastPrice, 
                      h: t.highPrice, 
                      l: t.lowPrice,
                      c: t.priceChangePercent + '%', 
                      v: Math.round(parseFloat(t.quoteVolume))
                  }));

                  const prompt = `You are an EXPERT CRYPTO QUANT. Plan a FLEET of exactly ${count} bot(s).
                   Capital: $${capital} USDT | Duration: ${durationMins} mins
                   Goal: "${customInstructions}"

                   Top Selection List (24h stats):
                   ${JSON.stringify(context.slice(0, 30))}

                   STRATEGY TYPES:
                   1. "EMA_RSI": Trend following, interval 15m.
                   2. "AI_SCOUTER": Aggressive scalping, interval 5m.
                   3. "AI_GRID": Range trading. Suggest for coins in consolidation. REQUIRE "grid_upper" and "grid_lower" (numbers) based on 24h High/Low context.

                   RESPONSE FORMAT (STRICT VALID JSON ONLY, NO CONVERSATION):
                   {
                     "confident": {
                       "name": "🛡️ Confident Fleet",
                       "description": "Thai rationale..",
                       "coins": [ { "symbol": "BTCUSDT", "strategy": "EMA_RSI", "interval": "15m", "tp": 2.0, "sl": 1.0, "leverage": 10 } ]
                     },
                     "scout": {
                       "name": "🏹 Scouting Fleet",
                       "description": "Thai rationale..",
                       "coins": [ { "symbol": "DOGEUSDT", "strategy": "AI_SCOUTER", "interval": "5m", "tp": 1.5, "sl": 0.5, "leverage": 20 } ]
                     }
                   }
                   Rules: 
                   1. "coins" arrays MUST have exactly ${count} objects.
                   2. If using "AI_GRID", you MUST include "grid_upper" and "grid_lower" (numbers) for that coin.
                   3. NO MARKDOWN.`;

                  // End of old long prompt part

                  const currentModel = customModel || binanceConfig.openRouterModel || "google/gemini-2.0-flash-exp:free";
                  const apiBody = JSON.stringify({
                      model: currentModel,
                      messages: [{ role: "user", content: prompt }],
                      max_tokens: 4000,
                      temperature: 0.1
                  });

                  const apiReq = https.request({
                      hostname: 'openrouter.ai',
                      path: '/api/v1/chat/completions',
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${binanceConfig.openRouterKey}`, 'Content-Type': 'application/json' },
                      timeout: 40000
                  }, (routerRes) => {
                      let resData = '';
                      routerRes.on('data', d => resData += d);
                      routerRes.on('end', () => {
                          if (responseSent) return;
                          responseSent = true;
                          try {
                              if (routerRes.statusCode !== 200) throw new Error('API Error ' + routerRes.statusCode + ' ' + resData);
                              const result = JSON.parse(resData);
                              let aiText = result.choices?.[0]?.message?.content || '{}';
                              
                              // Aggressively extract JSON from potential Markdown or conversational fluff
                              const jsonStart = aiText.indexOf('{');
                              const jsonEnd = aiText.lastIndexOf('}');
                              if (jsonStart !== -1 && jsonEnd !== -1) {
                                  aiText = aiText.substring(jsonStart, jsonEnd + 1);
                              }

                              // Validate that it is actual JSON before sending it back
                              let parsedJson = null;
                              try {
                                  parsedJson = JSON.parse(aiText);
                              } catch (parseAttemptError) {
                                  console.error('[AI Parse Error] RAW:', aiText);
                                  throw new Error('AI output was malformed JSON. Check server logs.');
                              }

                              res.writeHead(200, { 'Content-Type': 'application/json' });
                              res.end(JSON.stringify(parsedJson));
                          } catch (e) {
                              res.writeHead(500, { 'Content-Type': 'application/json' }); 
                              res.end(JSON.stringify({ error: e.message || 'AI Parse error' }));
                          }
                      });
                  });
                  let responseSent = false;
                  apiReq.on('timeout', () => { 
                      apiReq.destroy(); 
                      if (!responseSent) { responseSent = true; res.writeHead(504, {'Content-Type': 'application/json'}); res.end(JSON.stringify({error:'AI Request Timeout - Try again'})); }
                  });
                  apiReq.on('error', e => { 
                      if (!responseSent) { responseSent = true; res.writeHead(500, {'Content-Type': 'application/json'}); res.end(JSON.stringify({error: 'AI Output Error: ' + e.message})); }
                  });
                  apiReq.write(apiBody);
                  apiReq.end();
                } catch(e) {
                  res.writeHead(500); res.end(JSON.stringify({ error: 'Ticker parse failed' }));
                }
              });
          }).on('error', e => { res.writeHead(500); res.end(JSON.stringify({ error: 'Binance API unreachable' })); });
        }).catch(err => {
            res.writeHead(500); res.end(JSON.stringify({ error: 'Exchange info fail' }));
        });
    });

  } else if (parsedUrl.pathname === '/api/ai/memory' && req.method === 'GET') {
    try {
        let history = [];
        if (fs.existsSync(tradeMemoryFile)) {
            history = JSON.parse(fs.readFileSync(tradeMemoryFile, 'utf8'));
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(history));
    } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
    }

  } else if (parsedUrl.pathname === '/api/forward-test/review-mistakes' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const { botId } = JSON.parse(body);
        const bot = bots.get(botId);
        if (!bot) throw new Error('Bot not found');
        if (!binanceConfig.openRouterKey) throw new Error('OpenRouter Key not set');

        // Filter last 10 losing trades
        const losingTrades = (bot.trades || [])
          .filter(t => parseFloat(t.pnl) < 0)
          .slice(-10);

        if (losingTrades.length === 0) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ analysis: 'ยังไม่มีข้อมูลการขาดทุนเพียงพอสําหรับการวิเคราะห์ในขณะนี้' }));
          return;
        }

        const prompt = `You are an AI TRADING PSYCHOLOGIST & ANALYST. Review the LOSING trades for bot [${botId}] (${bot.config.symbol}).
        
        [Bot Configuration]
        Strategy: ${bot.config.strategy}
        Timeframe: ${bot.config.interval}
        TP: ${bot.config.tpPercent}%, SL: ${bot.config.slPercent}%, Leverage: ${bot.config.leverage}x

        [Losing Trades (Recent 10)]
        ${JSON.stringify(losingTrades, null, 2)}

        TASK:
        1. **Mistake Review**: Identify WHY these trades lost. Was it a premature Stop Loss? Was the signal flipped? Did price hit TP but then reverse before closing?
        2. **Pattern Recognition**: Is there a recurring mistake (e.g. "SL is too tight for the current volatility of ${bot.config.symbol}")?
        3. **Strategic Adjustment**: Suggest EXACT changes to TP, SL, or Leverage to minimize these specific types of losses.
        4. **Psychology/Market Context**: Briefly explain if these losses are "Healthy" (part of strategy) or "Unhealthy" (strategy failure).

        Format your report in a professional, empathetic, and actionable Markdown.
        MANDATORY: The entire response MUST be in THAI language.`;

        const currentModel = binanceConfig.openRouterModel || "google/gemini-2.0-flash-exp:free";
        const apiBody = JSON.stringify({
            model: currentModel,
            messages: [{ role: "user", content: prompt }]
        });

        const options = {
            hostname: 'openrouter.ai',
            path: '/api/v1/chat/completions',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${binanceConfig.openRouterKey}`,
                'Content-Type': 'application/json'
            }
        };

        const apiReq = https.request(options, (apiRes) => {
            let resData = '';
            apiRes.on('data', d => resData += d);
            apiRes.on('end', () => {
                try {
                    const result = JSON.parse(resData);
                    const aiMessage = result.choices?.[0]?.message?.content || 'AI could not generate a review.';
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ analysis: aiMessage }));
                } catch (e) {
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: 'AI Parse Error' }));
                }
            });
        });
        apiReq.on('error', e => { throw e; });
        apiReq.write(apiBody);
        apiReq.end();

      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: e.message }));
      }
    });

    } else if (req.url === '/api/binance/history') {
        console.log('[API] Fetching Unified Trade History...');
        try {
            if (!fs.existsSync(botsFile)) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify([]));
            }
            const botsData = JSON.parse(fs.readFileSync(botsFile, 'utf8'));
            let allTrades = [];
            botsData.forEach(bot => {
                if (bot.trades && Array.isArray(bot.trades)) {
                    bot.trades.forEach(t => {
                        allTrades.push({
                            ...t,
                            symbol: t.symbol || (bot.config && bot.config.symbol) || 'Unknown',
                            strategy: t.strategy || (bot.config && bot.config.strategy) || 'Manual',
                            type: t.type || 'N/A'
                        });
                    });
                }
            });
            allTrades.sort((a, b) => new Date(b.exitTime || 0).getTime() - new Date(a.exitTime || 0).getTime());
            console.log(`[API] Found ${allTrades.length} legacy trades.`);
            res.writeHead(200, { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*' 
            });
            res.end(JSON.stringify(allTrades));
        } catch (e) {
            console.error('[API Error]', e);
            res.writeHead(500);
            res.end(JSON.stringify({ error: e.message }));
        }
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(PORT, () => {
  console.log(`Backend Server running on http://localhost:${PORT}`);
});
