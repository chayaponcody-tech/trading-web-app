import { computeSignal, generateEntryReason, generateDiagnostic } from './SignalEngine.js';
import { reflect } from '../../ai-agents/src/ReflectionAgent.js';
import { reviewBot } from '../../ai-agents/src/ReviewerAgent.js';
import { saveBotMap, deleteBot } from '../../data-layer/src/repositories/botRepository.js';
import { appendTrade } from '../../data-layer/src/repositories/tradeRepository.js';
import { saveMistake, getRecentMistakes } from '../../data-layer/src/index.js';
import { TZ_OPTS } from '../../shared/config.js';
import { TuningService } from './TuningService.js';

// ─── Bot Manager ──────────────────────────────────────────────────────────────
// Manages bot lifecycle and orchestrates the tick loop.
// No HTTP / Express code belongs here — only pure trading logic.

function makeBotId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export class BotManager {
  /**
   * @param {import('@trading/exchange-connector').BinanceAdapter} exchange
   * @param {object} config - { openRouterKey, openRouterModel }
   */
  constructor(exchange, config = {}) {
    this.exchange = exchange;
    this.config = config;          // AI / provider config
    this.bots = new Map();         // botId → bot state
    this.timers = new Map();       // botId → intervalHandle
    this.symbolRules = {};         // symbol → { stepSize, minQty, precision }
    this.tuningService = new TuningService(exchange, config);
    this.tickCount = 0;
    this.notificationService = null;
  }

  // ─── Dependency Injection ────────────────────────────────────────────────────

  setExchange(exchange) { this.exchange = exchange; }
  setConfig(config)     { this.config = config; }
  setSymbolRules(rules) { this.symbolRules = rules; }

  setNotificationService(service) {
    this.notificationService = service;
  }

  findBotBySymbol(symbol) {
    const sym = symbol.toUpperCase();
    for (const bot of this.bots.values()) {
      if (bot.config.symbol.toUpperCase() === sym) return bot;
    }
    return null;
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  async startBot(botConfig) {
    if (!this.exchange) throw new Error('Exchange not initialized. Set API keys first.');

    const botId = makeBotId();
    const expiresAt = botConfig.durationMinutes > 0
      ? new Date(Date.now() + botConfig.durationMinutes * 60000).toISOString()
      : null;

    const capital = botConfig.capital || botConfig.positionSizeUSDT || 0;
    const bot = {
      id: botId,
      isRunning: true,
      config: botConfig,
      expiresAt,
      openPositions: [],
      capital: capital,
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
      realizedPnl: 0,
      netPnl: 0,
      trades: [],
      consecutiveLosses: 0,
      aiHistory: [],
      reflectionHistory: [],
      reflectionStatus: null,
      startedAt: new Date().toISOString(),
      lastAiCheck: new Date().toISOString(),
      aiReason: botConfig.aiReason || '',
      lastAiModel: botConfig.aiModel || null,
    };

    this.bots.set(botId, bot);
    this._scheduleBot(botId);
    this._save();
    console.log(`[BotManager] Started ${botId}: ${botConfig.symbol} ${botConfig.strategy}`);
    
    if (this.notificationService) {
        this.notificationService.send(`🚀 *Bot Lifecycle Started*\nSymbol: \`${botConfig.symbol}\`\nStrategy: \`${botConfig.strategy}\`\nBot ID: \`${botId.slice(-6)}\``);
    }

    return botId;
  }

  stopBot(botId) {
    const timer = this.timers.get(botId);
    if (timer) { clearInterval(timer); this.timers.delete(botId); }
    const bot = this.bots.get(botId);
    if (bot) bot.isRunning = false;
    this._save();
    console.log(`[BotManager] Stopped ${botId}`);
  }

  resumeBot(botId) {
    const bot = this.bots.get(botId);
    if (!bot) return;

    // Clear duplicate timer
    const old = this.timers.get(botId);
    if (old) clearInterval(old);

    // Extend expiry if already past
    if (bot.expiresAt && new Date() > new Date(bot.expiresAt)) {
      bot.expiresAt = bot.config.durationMinutes > 0
        ? new Date(Date.now() + bot.config.durationMinutes * 60000).toISOString()
        : null;
    }

    bot.isRunning = true;
    this._scheduleBot(botId);
    this._save();
    console.log(`[BotManager] Resumed ${botId}`);
  }

  deleteBot(botId) {
    this.stopBot(botId);
    this.bots.delete(botId);
    deleteBot(botId); // Also delete from persistent storage
    console.log(`[BotManager] Deleted ${botId}`);
    
    if (this.notificationService) {
        this.notificationService.send(`🗑️ *Bot Deleted*\nBot ID: \`${botId.slice(-6)}\``);
    }
  }

  loadBots(botsArray) {
    botsArray.forEach((bot) => {
      this.bots.set(bot.id, bot);
      if (bot.isRunning && bot.config.exchange === 'binance_testnet') {
        this.resumeBot(bot.id);
      }
    });
    console.log(`[BotManager] Loaded ${botsArray.length} bot(s).`);
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  _scheduleBot(botId) {
    this._tick(botId); // immediate tick
    const timer = setInterval(() => this._tick(botId), 30_000);
    this.timers.set(botId, timer);
  }

  async _tick(botId) {
    const bot = this.bots.get(botId);
    if (!bot || !bot.isRunning || !this.exchange) return;

    const { symbol, strategy, tpPercent, slPercent, leverage = 10,
            positionSizeUSDT = 100, aiCheckInterval = 30,
            trailingStopPct = 0, maxDrawdownPct = 0, cooldownMinutes = 0 } = bot.config;
    const interval = (bot.config.interval || '1h').toLowerCase();

    try {
      // ── Fetch market data ──────────────────────────────────────────────────
      const [klines, ticker, accountInfo] = await Promise.all([
        this.exchange.getKlines(symbol, interval, 250),
        this.exchange.getTickerPrice(symbol),
        this.exchange.getAccountInfo(),
      ]);

      if (!Array.isArray(klines)) return;

      const closed = klines.slice(0, -1);
      const closes = closed.map((k) => parseFloat(k[4]));
      const lastCloseTime = closed.at(-1)?.[6] ?? null;
      const currPrice = parseFloat(ticker.price);

      // Update memory & Handle Trailing Stop
      bot.currentPrice = currPrice;
      this._handleTrailingStop(botId, currPrice);
      
      this.bots.set(botId, bot);
      bot.lastChecked = new Date().toLocaleString('th-TH', TZ_OPTS);

      // ── Handle Max Drawdown ────────────────────────────────────────────────
      const usdtAsset = accountInfo.assets?.find((a) => a.asset === 'USDT');
      if (usdtAsset) {
        // Individual bot max drawdown logic now works on BOT equity, not wallet equity
        bot.peakEquity = Math.max(bot.peakEquity || bot.equity, bot.equity);
        if (maxDrawdownPct > 0 && bot.peakEquity > 0) {
          const dd = (bot.peakEquity - bot.equity) / bot.peakEquity;
          if (dd >= maxDrawdownPct / 100) {
            console.log(`[Bot ${botId}] STOPPED: Max Drawdown Hit (${(dd * 100).toFixed(2)}%)`);
            this.stopBot(botId);
            return;
          }
        }
      }

      // ── Sync open positions and PnL ────────────────────────────────────────
      const remotePos = (accountInfo.positions || []).filter(
        (p) => p.symbol === symbol.toUpperCase() && parseFloat(p.positionAmt) !== 0
      );

      // Handle field name variations (unrealizedProfit vs unRealizedProfit)
      bot.unrealizedPnl = remotePos.reduce(
        (sum, p) => sum + parseFloat(p.unrealizedProfit || p.unRealizedProfit || 0), 0
      );

      if (remotePos.length > 0 && bot.openPositions.length === 0) {
        remotePos.forEach((rp) => {
          const amt = parseFloat(rp.positionAmt);
          bot.openPositions.push({
            id: `recov_${Date.now()}`,
            type: amt > 0 ? 'LONG' : 'SHORT',
            entryPrice: parseFloat(rp.entryPrice),
            highestPrice: parseFloat(rp.entryPrice),
            lowestPrice: parseFloat(rp.entryPrice),
            entryTime: new Date().toISOString(),
            entryReason: 'Auto-Recovered from Binance',
            quantity: Math.abs(amt),
          });
        });
      } else if (remotePos.length === 0 && bot.openPositions.length > 0) {
        bot.openPositions = [];
      }

      // Sync stats AFTER unrealizedPnl is updated so Equity is correct
      this._syncStats(bot);

      // ── Check expiry ───────────────────────────────────────────────────────
      if (bot.expiresAt && new Date() > new Date(bot.expiresAt)) {
        this.stopBot(botId);
        return;
      }

      // ── Periodic AI Review ─────────────────────────────────────────────────
      const lastCheck = bot.lastAiCheck ? new Date(bot.lastAiCheck).getTime() : 0;
      if (aiCheckInterval > 0 && this.config.openRouterKey
          && Date.now() - lastCheck >= aiCheckInterval * 60_000) {
        this._aiReview(botId, closes).catch((e) =>
          console.error(`[Bot ${botId}] AI Review Error:`, e.message)
        );
      }

      // ── Real-time TP/SL/Trailing SL ────────────────────────────────────────
      for (const pos of [...bot.openPositions]) {
        const pnlPct = (pos.type === 'LONG'
          ? (currPrice - pos.entryPrice) / pos.entryPrice
          : (pos.entryPrice - currPrice) / pos.entryPrice) * 100;

        // Trailing Stop Logic
        if (trailingStopPct > 0) {
          if (pos.type === 'LONG') {
            pos.highestPrice = Math.max(pos.highestPrice || pos.entryPrice, currPrice);
            const tsPrice = pos.highestPrice * (1 - trailingStopPct / 100);
            if (currPrice <= tsPrice) {
              await this._closePosition(bot, pos, currPrice, `Trailing Stop Hit (${pnlPct.toFixed(2)}%)`);
              continue;
            }
          } else {
            pos.lowestPrice = Math.min(pos.lowestPrice || pos.entryPrice, currPrice);
            const tsPrice = pos.lowestPrice * (1 + trailingStopPct / 100);
            if (currPrice >= tsPrice) {
              await this._closePosition(bot, pos, currPrice, `Trailing Stop Hit (${pnlPct.toFixed(2)}%)`);
              continue;
            }
          }
        }

        if (tpPercent > 0 && pnlPct >= tpPercent) {
          await this._closePosition(bot, pos, currPrice, `TP Hit (+${pnlPct.toFixed(2)}%)`);
        } else if (slPercent > 0 && pnlPct <= -slPercent) {
          await this._closePosition(bot, pos, currPrice, `SL Hit (${pnlPct.toFixed(2)}%)`);
        }
      }

      // ── Signal on new candle ───────────────────────────────────────────────
      this.tickCount++;
      if (this.tickCount % 50 === 0) {
        this.tuningService.tuneBot(bot, closes).catch(e => console.error(e.message));
      }

      // ── Generate Live Thought ───────────────────────────────────────────────
      bot.currentThought = generateDiagnostic(strategy, closes, bot.config);
      bot.lastThoughtAt = new Date().toISOString();

      if (bot.lastCandle !== lastCloseTime) {
        bot.lastCandle = lastCloseTime;
        const signal = computeSignal(closes, strategy, bot.config);
        bot.lastSignal = signal;

        // Signal flip → exit current position
        for (const pos of [...bot.openPositions]) {
          if (signal !== 'NONE' && signal !== pos.type) {
            await this._closePosition(bot, pos, currPrice, 'Signal Flipped');
          }
        }

        // Enter new position if flat & cooldown passed
        if ((signal === 'LONG' || signal === 'SHORT') && bot.openPositions.length === 0) {
          const lastExit = bot.lastExitTime ? new Date(bot.lastExitTime).getTime() : 0;
          if (Date.now() - lastExit >= cooldownMinutes * 60_000) {
            await this._openPosition(bot, signal, currPrice, closes);
          } else {
            console.log(`[Bot ${botId}] Entry skipped: Cooldown active`);
          }
        }
      }


      this._syncStats(bot);
      this._save();
    } catch (err) {
      console.error(`[Bot ${botId}] Tick error:`, err.message);
      if (err.message.includes('-2015') || err.message.includes('-2008') || err.message.includes('API-key')) {
        console.warn(`[Bot ${botId}] AUTO-PAUSED due to Invalid API Keys.`);
        bot.isRunning = false;
        bot.aiReason = 'Stopped automatically due to Invalid API Keys. Please update Demo Keys.';
        this._save();
      }
    }
  }

  async _openPosition(bot, signal, currPrice, closes) {
    // 1. Optional Reflection Validation (Learning from Past Mistakes)
    if (bot.config.useReflection && this.binanceConfig.openRouterKey) {
       const pastMistakes = getRecentMistakes(bot.config.symbol, 3);
       const result = await ReflectionAgent.reflect(
         bot, signal, currPrice, 
         this.binanceConfig.openRouterKey, 
         this.binanceConfig.openRouterModel,
         pastMistakes
       );

      // Record reflection in history
      bot.reflectionHistory = bot.reflectionHistory || [];
      bot.reflectionHistory.push({
        time: new Date().toISOString().replace('T', ' ').split('.')[0],
        signal,
        price: currPrice,
        approved: result.approved,
        reason: result.reason,
        model: this.config.openRouterModel
      });

      if (!result.approved) {
        bot.lastEntryReason = `[REJECTED] ${result.reason}`;
        console.log(`[Bot ${bot.id}] Entry rejected by AI: ${result.reason}`);
        return;
      }
    }

    const rule = this.symbolRules[bot.config.symbol.toUpperCase()]
                 || { stepSize: 0.001, minQty: 0.001, precision: 3, tickSize: 0.0001, pricePrecision: 4 };
    const leverage = bot.config.leverage || 10;
    const posValue  = bot.config.positionSizeUSDT || 100;

    // Set leverage on exchange before placing any orders
    try {
      await this.exchange.setLeverage(bot.config.symbol, leverage);
    } catch (e) {
      console.warn(`[Bot ${bot.id}] setLeverage failed:`, e.message);
    }

    // Handle position sizing based on current equity (Safety Lock & Dynamic Sizing)
    let tradeValue = posValue;
    if (tradeValue > bot.equity) {
      // Critical threshold: if less than 5 USDT remains, stop the bot to prevent meaningless trades
      if (bot.equity < 5) {
        const msg = `CRITICAL FUND LOSS: Only ${bot.equity.toFixed(2)} USDT remains. Stopping for protection.`;
        console.warn(`[Bot ${bot.id}] ${msg}`);
        bot.aiReason = msg;
        this.stopBot(bot.id);
        return;
      }
      
      // Dynamic scaling: trade with whatever is left (e.g. 95 instead of 100)
      console.log(`[Bot ${bot.id}] Adjusting trade size from ${posValue} to ${bot.equity.toFixed(2)} USDT (Reason: Net PnL Drawdown)`);
      tradeValue = bot.equity;
    }

    const rawTotalQty = (tradeValue * leverage) / currPrice;
    
    // Get AI-recommended entry steps or default to simple 100% Market if none
    let steps = bot.config.entry_steps || [{ type: 'MARKET', weightPct: 100, offsetPct: 0 }];

    // If strategy is GRID and manual range is set, dynamically generate layering steps
    if (bot.config.strategy === 'GRID' && bot.config.gridUpper && bot.config.gridLower) {
        const layers = bot.config.gridLayers || 10;
        const targetPrice = signal === 'LONG' ? bot.config.gridLower : bot.config.gridUpper;
        const totalOffset = ((targetPrice - currPrice) / currPrice) * 100;
        
        steps = [];
        const weightPerLayer = 100 / layers;
        const offsetPerLayer = totalOffset / layers;

        for (let i = 0; i < layers; i++) {
            steps.push({
                type: i === 0 ? 'MARKET' : 'LIMIT', // First layer market, others limit
                weightPct: weightPerLayer,
                offsetPct: offsetPerLayer * i
            });
        }
        bot.config.entry_steps = steps; // Save the generated plan back to config!
        console.log(`[Bot ${bot.id}] Generated and saved ${layers} Grid Layer steps towards ${targetPrice.toFixed(4)}`);
    }

    for (const s of steps) {
      const stepQty = Math.floor((rawTotalQty * (s.weightPct / 100)) / rule.stepSize) * rule.stepSize;
      if (stepQty < rule.minQty) continue;

      const qtyStr = stepQty.toFixed(rule.precision || 3);
      
      if (s.type === 'MARKET') {
        const orderRes = await this.exchange.placeOrder(
          bot.config.symbol,
          signal === 'LONG' ? 'BUY' : 'SELL',
          'MARKET',
          qtyStr
        );
        bot.openPositions.push({
          id: `pos_mkt_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
          type: signal,
          entryPrice: currPrice,
          entryTime: new Date().toISOString(),
          entryReason: `${bot.config.strategy} - AI Step (Market ${s.weightPct}%)`,
          quantity: parseFloat(qtyStr),
        });
      } else {
        // LIMIT Order
        let rawLimitPrice = signal === 'LONG' 
          ? currPrice * (1 + s.offsetPct / 100) 
          : currPrice * (1 - s.offsetPct / 100);
        
        // High-precision rounding to ensure price is exactly a multiple of tickSize
        const tickSize = rule.tickSize || 0.0001;
        const pricePrecision = rule.pricePrecision || 4;
        
        // Formula: (round(price / tickSize) * tickSize) fixed to precision
        const roundedLimitPrice = Number((Math.round(rawLimitPrice / tickSize) * tickSize).toFixed(pricePrecision));
        const limitPriceStr = roundedLimitPrice.toFixed(pricePrecision);

        try {
          await this.exchange.placeOrder(
            bot.config.symbol,
            signal === 'LONG' ? 'BUY' : 'SELL',
            'LIMIT',
            qtyStr,
            limitPriceStr
          );
          console.log(`[Bot ${bot.id}] AI Step (Limit ${s.weightPct}%) Placed at ${limitPriceStr}`);
        } catch (e) {
          console.error(`[Bot ${bot.id}] AI Limit Step Error:`, e.message);
        }
      }
    }

    if (this.notificationService && bot.openPositions.length > 0) {
        this.notificationService.notifyOpen(bot, bot.openPositions[bot.openPositions.length - 1]);
    }

    bot.lastEntryReason = `AI Layered Entry initialized (${steps.length} steps)`;
  }

  async _closePosition(bot, pos, currPrice, reason) {
    try {
      await this.exchange.closePosition(bot.config.symbol, pos.type, pos.quantity);
      bot.openPositions = bot.openPositions.filter((p) => p.id !== pos.id);

      const pnl = (pos.type === 'LONG'
        ? (currPrice - pos.entryPrice)
        : (pos.entryPrice - currPrice)) * (pos.quantity || 0);

      const trade = {
        botId: bot.id,
        type: pos.type,
        symbol: bot.config.symbol,
        entryPrice: pos.entryPrice,
        exitPrice: currPrice,
        pnl,
        reason,
        exitTime: new Date().toISOString(),
        entryReason: pos.entryReason || 'Technical Entry',
        strategy: bot.config.strategy,
        entryTime: pos.entryTime,
      };

      bot.lastExitTime = new Date().toISOString();
      bot.trades = bot.trades || [];

      bot.trades.push(trade);
      appendTrade(trade);
      
      // If loss, record mistake lesson automatically
      if (pnl < 0) {
        bot.consecutiveLosses = (bot.consecutiveLosses || 0) + 1;
        this._recordAILesson(bot.id, trade).catch(err => console.error('Mistake Record Error:', err.message));
        
        // Quarantine Check (3 consecutive losses)
        if (bot.consecutiveLosses >= 3) {
          const msg = `🛡️ [QUARANTINE] Bot stopped after ${bot.consecutiveLosses} consecutive losses. AI analysis required.`;
          console.warn(`[Bot ${bot.id}] ${msg}`);
          bot.isRunning = false;
          bot.aiReason = msg;
          if (this.notificationService) {
            this.notificationService.send(`🚨 *Bot Quarantined*\nSymbol: \`${bot.config.symbol}\` \nReason: 3 consecutive losses. Stopping for safety.`);
          }
        }
      } else if (pnl > 0) {
        bot.consecutiveLosses = 0;
      }

      this._save();
      console.log(`[Bot ${bot.id}] ${reason}: ${pnl.toFixed(4)} USDT`);

      if (this.notificationService) {
          this.notificationService.notifyTrade(bot, trade);
      }
    } catch (e) {
      console.error(`[Bot ${bot.id}] Close error:`, e.message);
      if (e.message.includes('No open position')) {
        bot.openPositions = bot.openPositions.filter((p) => p.id !== pos.id);
      }
    }
  }

  _syncStats(bot) {
    bot.grossProfit = 0; bot.grossLoss = 0;
    bot.winCount = 0; bot.lossCount = 0;
    bot.totalTrades = (bot.trades || []).length;
    (bot.trades || []).forEach((t) => {
      const v = parseFloat(t.pnl || 0);
      if (v >= 0) { bot.grossProfit += v; bot.winCount++; }
      else { bot.grossLoss += Math.abs(v); bot.lossCount++; }
    });
    
    bot.realizedPnl = bot.grossProfit - bot.grossLoss;
    bot.unrealizedPnl = (bot.openPositions.length > 0 ? (bot.unrealizedPnl || 0) : 0);
    bot.netPnl = bot.realizedPnl + bot.unrealizedPnl;
    
    const capital = bot.capital || bot.config.positionSizeUSDT || 0;
    bot.equity = capital + bot.netPnl;
  }

  async _aiReview(botId, closes) {
    const bot = this.bots.get(botId);
    if (!bot) return;

    const result = await reviewBot(
      bot, closes,
      this.config.openRouterKey,
      this.config.openRouterModel
    );

    if (result.shouldUpdate) {
      if (result.strategy) bot.config.strategy = result.strategy;
      if (result.tp)       bot.config.tpPercent = result.tp;
      if (result.sl)       bot.config.slPercent = result.sl;
      if (result.leverage) bot.config.leverage  = result.leverage;
      if (result.gridUpper) bot.config.gridUpper = result.gridUpper;
      if (result.gridLower) bot.config.gridLower = result.gridLower;
    }

    bot.aiReason    = result.reason;
    bot.lastAiCheck = new Date().toISOString();
    bot.lastAiModel = this.config.openRouterModel;

    // Record AI Review in history
    bot.aiHistory = bot.aiHistory || [];
    bot.aiHistory.push({
      time: new Date().toISOString().replace('T', ' ').split('.')[0],
      message: result.reason,
      decision: result.shouldUpdate ? 'UPDATED' : 'STAY',
      model: bot.lastAiModel
    });

    console.log(`[Bot ${botId}] AI Review: ${result.shouldUpdate ? '✅ Updated' : '⏸️ No change'} — ${result.reason?.slice(0, 80)}`);
    this._save();
  }

  _save() {
    saveBotMap(this.bots);
  }

  // ─── Adaptive Trailing Stop Logic ──────────────────────────────────────────

  _handleTrailingStop(botId, currentPrice) {
    const bot = this.bots.get(botId);
    if (!bot || !bot.openPositions || bot.openPositions.length === 0) return;

    const pos = bot.openPositions[0];
    const side = pos.type.toUpperCase();
    const isLong = side === 'LONG' || side === 'BUY';
    
    // Calculate Trailing Activation
    // If price moves 1% in profit, start trailing with 1% distance
    const entryPrice = parseFloat(pos.entryPrice);
    const pnlPct = isLong ? (currentPrice - entryPrice) / entryPrice : (entryPrice - currentPrice) / entryPrice;
    
    // Activation threshold: 1.5% profit
    if (pnlPct > 0.015) {
       const trailDistance = currentPrice * 0.01; // 1% trailing
       const newSl = isLong ? currentPrice - trailDistance : currentPrice + trailDistance;
       
       // Only move SL in our favor (up for long, down for short)
       if (isLong) {
         if (!bot.config.slPrice || newSl > bot.config.slPrice) {
           bot.config.slPrice = newSl;
           console.log(`[Bot ${botId}] Trailing SL Moved Up: ${newSl.toFixed(2)}`);
         }
       } else {
         if (!bot.config.slPrice || newSl < bot.config.slPrice) {
           bot.config.slPrice = newSl;
           console.log(`[Bot ${botId}] Trailing SL Moved Down: ${newSl.toFixed(2)}`);
         }
       }
    }
  }

  // ─── AI Mistakes Analysis Logic ──────────────────────────────────────────────

  async _recordAILesson(botId, trade) {
    const bot = this.bots.get(botId);
    if (!bot) return;

    try {
      const prompt = `วิเคราะห์ความผิดพลาดจากการเทรด:
      เหรียญ: ${trade.symbol} | กลยุทธ์: ${trade.strategy}
      ราคาเข้า: ${trade.entryPrice} | ราคาออก: ${trade.exitPrice}
      เหตุผลที่เข้า: ${trade.entryReason}
      PnL: ${trade.pnl} USDT
      
      สรุปบทเรียนสั้นๆ 1 ประโยคว่าทำไมถึงแพ้ และควรระวังอะไรในสภาวะตลาดแบบนี้ในอนาคต?`;

      const aiResponse = await ReflectionAgent.analyze(
        [], 'MistakeAnalysis', prompt, 
        this.binanceConfig.openRouterKey, 
        this.binanceConfig.openRouterModel
      );

      saveMistake({
        botId,
        symbol: trade.symbol,
        strategy: trade.strategy,
        entryPrice: trade.entryPrice,
        exitPrice: trade.exitPrice,
        pnl: trade.pnl,
        marketContext: trade.entryReason,
        aiLesson: aiResponse || 'Unknown cause'
      });
      
      console.log(`🧠 [AI Lesson Learned] ${trade.symbol}: ${aiResponse}`);
    } catch (e) {
      console.error('[BotManager] _recordAILesson error:', e.message);
    }
  }
}
