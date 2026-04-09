import { computeSignal, generateEntryReason, generateDiagnostic } from './SignalEngine.js';
import { reflect } from '../../ai-agents/src/ReflectionAgent.js';
import { reviewBot } from '../../ai-agents/src/ReviewerAgent.js';
import { assessTrailingAdjustment } from '../../ai-agents/src/TrailingAIAgent.js';
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

  /**
   * Resumes bots from persistent storage.
   * Called on startup by server.js.
   */
  loadBots(savedBots) {
    if (!savedBots || !Array.isArray(savedBots)) return;
    
    console.log(`[BotManager] Resuming ${savedBots.length} bots from storage...`);
    
    for (const b of savedBots) {
      // Re-initialize runtime state
      b.isRunning = true;
      b.openPositions = b.openPositions || [];
      b.trades = b.trades || [];
      
      this.bots.set(b.id, b);
      this._scheduleBot(b.id);
      
      console.log(`[BotManager] Resumed ${b.id}: ${b.config.symbol} (${b.config.strategy})`);
    }

    if (this.notificationService && savedBots.length > 0) {
      this.notificationService.send(`🕯️ *System Resumed:* กู้คืนบอทสำเร็จ \`${savedBots.length}\` ตัว เข้าสู่ระบบจัดการอัตโนมัติแล้วค่ะ`);
    }
  }

  /**
   * Resurrects active bots from the database.
   * Call this on system startup.
   */
  async loadActiveBots() {
    try {
      const { getActiveBots } = await import('../../data-layer/src/repositories/botRepository.js');
      const savedBots = getActiveBots();
      
      if (!savedBots || savedBots.length === 0) return;
      
      console.log(`[BotManager] Attempting to resurrect ${savedBots.length} active bots from DB...`);
      
      for (const b of savedBots) {
        // Essential runtime re-initialization
        b.isRunning = true;
        
        this.bots.set(b.id, b);
        this._scheduleBot(b.id);
        console.log(`[BotManager] Resurrected ${b.id}: ${b.config.symbol}`);
      }
      
      if (this.notificationService) {
        this.notificationService.send(`🕯️ *System Recovery:* กู้คืนบอทสำเร็จ \`${savedBots.length}\` ตัว เข้าสู่ระบบจัดการอัตโนมัติแล้วค่ะ`);
      }

      // Scan for orphan positions not managed by any bot
      setTimeout(() => this.reattachOrphanPositions(), 5000);
    } catch (e) {
      console.error('[BotManager] Failed to resurrect bots:', e.message);
    }
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

    const { symbol: rawSymbol, strategy, tpPercent, slPercent, leverage = 10,
            positionSizeUSDT = 100, aiCheckInterval = 30,
            trailingStopPct = 0, maxDrawdownPct = 0, cooldownMinutes = 0 } = bot.config;
    // Normalize symbol for Binance API (SWARMS/USDT:USDT → SWARMSUSDT)
    const symbol = rawSymbol.replace('/', '').replace(':USDT', '').replace(':USD', '').toUpperCase();
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
      const normalizedSymbol = symbol.toUpperCase().replace('/', '').replace(':USDT', '').replace(':USD', '');
      const remotePos = (accountInfo.positions || []).filter(
        (p) => (p.symbol === symbol.toUpperCase() || p.symbol === normalizedSymbol) && parseFloat(p.positionAmt) !== 0
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

        // Trailing Stop Logic — uses pos.trailingSl set by _handleTrailingStop()
        if (trailingStopPct > 0 && pos.trailingSl) {
          if (pos.type === 'LONG' && currPrice <= pos.trailingSl) {
            await this._closePosition(bot, pos, currPrice, `Trailing Stop Hit (${pnlPct.toFixed(2)}%)`);
            continue;
          } else if (pos.type === 'SHORT' && currPrice >= pos.trailingSl) {
            await this._closePosition(bot, pos, currPrice, `Trailing Stop Hit (${pnlPct.toFixed(2)}%)`);
            continue;
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
            // ── Microstructure Filter (OI + Funding) ──────────────────────
            const microOk = await this._checkMicrostructure(bot, symbol, signal);
            if (!microOk.pass) {
              bot.currentThought = `⚠️ [Microstructure Block] ${microOk.reason}`;
              bot.lastThoughtAt = new Date().toISOString();
              console.log(`[Bot ${botId}] Entry blocked by microstructure: ${microOk.reason}`);
            } else {
              if (microOk.note) {
                bot.currentThought = `✅ [Microstructure OK] ${microOk.note}`;
                bot.lastThoughtAt = new Date().toISOString();
              }
              // ── Strategy AI Filter (Python) ────────────────────────────
              const aiMode = this.config.strategyAiMode || 'off';
              if (aiMode !== 'off') {
                const aiResult = await this._strategyAiFilter(bot, signal, closes, currPrice);
                if (!aiResult.approved) {
                  bot.currentThought = `🤖 [Strategy AI Block] ${aiResult.reason}`;
                  bot.lastThoughtAt = new Date().toISOString();
                  console.log(`[Bot ${botId}] Entry blocked by Strategy AI: ${aiResult.reason}`);
                } else {
                  bot.currentThought = `🤖 [Strategy AI OK] confidence=${(aiResult.confidence * 100).toFixed(0)}% — ${aiResult.reason}`;
                  bot.lastThoughtAt = new Date().toISOString();
                  await this._openPosition(bot, signal, currPrice, closes);
                }
              } else {
                await this._openPosition(bot, signal, currPrice, closes);
              }
            }
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
      if (err.message.includes('-1121')) {
        console.warn(`[Bot ${botId}] AUTO-PAUSED: Invalid symbol ${bot.config.symbol}.`);
        bot.isRunning = false;
        bot.aiReason = `Stopped: Invalid symbol "${bot.config.symbol}" on Binance Futures.`;
        this._save();
      }
      if (err.message.includes('-4411')) {
        console.warn(`[Bot ${botId}] AUTO-PAUSED: TradFi-Perps agreement required for ${bot.config.symbol}.`);
        bot.isRunning = false;
        bot.aiReason = `Stopped: Symbol ${bot.config.symbol} requires signing TradFi-Perps agreement on Binance.`;
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
    const symbol = bot.config.symbol.replace('/', '').replace(':USDT', '').replace(':USD', '').toUpperCase();

    // Set leverage on exchange before placing any orders
    try {
      await this.exchange.setLeverage(symbol, leverage);
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

    // If strategy is GRID variant and manual range is set, dynamically generate layering steps
    const isGridStrategy = ['GRID', 'AI_GRID', 'AI_GRID_SCALP', 'AI_GRID_SWING'].includes(bot.config.strategy);
    if (isGridStrategy && bot.config.gridUpper && bot.config.gridLower) {
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
          symbol,
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
            symbol,
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
      const symbol = bot.config.symbol.replace('/', '').replace(':USDT', '').replace(':USD', '').toUpperCase();
      await this.exchange.closePosition(symbol, pos.type, pos.quantity);
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

    const preferredModel = bot.config.aiModel || this.config.openRouterModel;

    // ── AI TP/SL Adjustment (when position is open) ──────────────────────────
    if (bot.openPositions.length > 0 && this.config.openRouterKey) {
      for (const pos of bot.openPositions) {
        const currPrice = bot.currentPrice;
        const adjustment = await assessTrailingAdjustment(
          bot, pos, currPrice, closes,
          this.config.openRouterKey,
          preferredModel
        ).catch((e) => {
          console.error(`[Bot ${botId}] TrailingAI error:`, e.message);
          return null;
        });

        if (!adjustment || adjustment.action === 'HOLD') continue;

        if (adjustment.action === 'EXTEND_TP' && adjustment.newTpPercent) {
          const oldTp = bot.config.tpPercent;
          bot.config.tpPercent = adjustment.newTpPercent;
          console.log(`[Bot ${botId}] 🎯 AI Extended TP: ${oldTp}% → ${adjustment.newTpPercent}% — ${adjustment.reason}`);
          bot.aiHistory.push({
            time: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }),
            message: `[AI TP Extended] ${oldTp}% → ${adjustment.newTpPercent}% — ${adjustment.reason}`,
            decision: 'EXTEND_TP',
            model: preferredModel,
          });
        } else if (adjustment.action === 'TIGHTEN_TRAIL' && adjustment.newTrailingPct) {
          const oldTrail = bot.config.trailingStopPct;
          bot.config.trailingStopPct = adjustment.newTrailingPct;
          // Reset trailingSl so it recalculates with new tighter distance
          pos.trailingSl = null;
          console.log(`[Bot ${botId}] 🔒 AI Tightened Trail: ${oldTrail}% → ${adjustment.newTrailingPct}% — ${adjustment.reason}`);
          bot.aiHistory.push({
            time: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }),
            message: `[AI Trail Tightened] ${oldTrail}% → ${adjustment.newTrailingPct}% — ${adjustment.reason}`,
            decision: 'TIGHTEN_TRAIL',
            model: preferredModel,
          });
        }
      }
    }

    // ── Standard Bot Review ──────────────────────────────────────────────────
    const result = await reviewBot(
      bot, closes,
      this.config.openRouterKey,
      preferredModel
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
    bot.lastAiModel = preferredModel;

    // Record AI Review in history
    bot.aiHistory = bot.aiHistory || [];
    bot.aiHistory.push({
      time: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }), // Formats as YYYY-MM-DD HH:MM:SS in local BK time
      message: result.reason,
      decision: result.shouldUpdate ? 'UPDATED' : 'STAY',
      model: preferredModel
    });

    console.log(`[Bot ${botId}] AI Review: ${result.shouldUpdate ? '✅ Updated' : '⏸️ No change'} — ${result.reason?.slice(0, 80)}`);
    this._save();
  }

  _save() {
    saveBotMap(this.bots);
  }

  /**
   * Fetch OI + Funding Rate right before opening a position.
   * Returns { pass: bool, reason: string, note: string }
   *
   * Rules:
   *  - Funding > +0.05%  → block LONG  (over-leveraged longs, reversal risk)
   *  - Funding < -0.05%  → block SHORT (short squeeze risk)
   *  - OI dropped > 10% vs previous period → signal is weak, block entry
   */
  async _checkMicrostructure(bot, symbol, signal) {
    try {
      const [fundingData, oiHistory] = await Promise.all([
        this.exchange.getFundingRate(symbol).catch(() => null),
        this.exchange.getOpenInterestStatistics(symbol, '15m', 3).catch(() => []),
      ]);

      const funding = fundingData?.lastFundingRate ?? 0;
      const FUNDING_THRESHOLD = bot.config.fundingThreshold ?? 0.0005; // 0.05% default

      // Funding Rate check
      if (signal === 'LONG' && funding > FUNDING_THRESHOLD) {
        return {
          pass: false,
          reason: `Funding Rate สูง (+${(funding * 100).toFixed(4)}%) — Long squeeze risk สูง ข้ามรอบนี้`,
        };
      }
      if (signal === 'SHORT' && funding < -FUNDING_THRESHOLD) {
        return {
          pass: false,
          reason: `Funding Rate ติดลบมาก (${(funding * 100).toFixed(4)}%) — Short squeeze risk สูง ข้ามรอบนี้`,
        };
      }

      // OI trend check (ต้องมีอย่างน้อย 2 จุด)
      if (Array.isArray(oiHistory) && oiHistory.length >= 2) {
        const oiNow  = parseFloat(oiHistory.at(-1)?.sumOpenInterest ?? 0);
        const oiPrev = parseFloat(oiHistory.at(-2)?.sumOpenInterest ?? 0);
        if (oiPrev > 0) {
          const oiChangePct = (oiNow - oiPrev) / oiPrev * 100;
          if (oiChangePct < -10) {
            return {
              pass: false,
              reason: `OI ลดลง ${oiChangePct.toFixed(1)}% — แรงหนุนอ่อน signal ไม่น่าเชื่อถือ`,
            };
          }
          // OI confirms signal
          const oiNote = oiChangePct > 0
            ? `Funding ${(funding * 100).toFixed(4)}% | OI +${oiChangePct.toFixed(1)}% ยืนยันแรงซื้อ`
            : `Funding ${(funding * 100).toFixed(4)}% | OI ${oiChangePct.toFixed(1)}%`;
          return { pass: true, note: oiNote };
        }
      }

      return { pass: true, note: `Funding ${(funding * 100).toFixed(4)}% — ผ่าน` };
    } catch (e) {
      // ถ้าดึงข้อมูลไม่ได้ ให้ผ่านไปก่อน ไม่ block entry
      console.warn(`[Bot ${bot.id}] Microstructure check failed (non-blocking): ${e.message}`);
      return { pass: true, note: 'Microstructure data unavailable — skipped filter' };
    }
  }

  // ─── Strategy AI Filter (Python Container) ──────────────────────────────────
  // Calls the Python strategy-ai service to get ML-based signal confirmation.
  // Returns { approved: bool, confidence: float, reason: string }

  // Cache health status to avoid pinging every tick
  _strategyAiOnline = null;
  _strategyAiLastCheck = 0;
  _STRATEGY_AI_HEALTH_TTL = 60_000; // re-check every 60s

  async _checkStrategyAiHealth() {
    const now = Date.now();
    if (now - this._strategyAiLastCheck < this._STRATEGY_AI_HEALTH_TTL && this._strategyAiOnline !== null) {
      return this._strategyAiOnline;
    }
    const url = this.config.strategyAiUrl || 'http://strategy-ai:8000';
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${url}/health`, { signal: controller.signal });
      clearTimeout(timeout);
      this._strategyAiOnline = res.ok;
    } catch {
      this._strategyAiOnline = false;
    }
    this._strategyAiLastCheck = now;
    return this._strategyAiOnline;
  }

  async _strategyAiFilter(bot, signal, closes, currPrice) {
    // Check health first (cached, non-blocking)
    const isOnline = await this._checkStrategyAiHealth();
    if (!isOnline) {
      console.warn(`[Bot ${bot.id}] Strategy AI offline — skipping filter`);
      return { approved: true, confidence: 1.0, reason: 'Strategy AI offline — skipped filter' };
    }

    const url = this.config.strategyAiUrl || 'http://strategy-ai:8000';
    const threshold = this.config.strategyAiConfidenceThreshold ?? 0.70;
    const mode = this.config.strategyAiMode || 'ml';

    try {
      const payload = {
        symbol: bot.config.symbol,
        signal,
        mode,
        closes: closes.slice(-60),
        current_price: currPrice,
        strategy: bot.config.strategy,
        interval: bot.config.interval || '1h',
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(`${url}/analyze-signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`Strategy AI returned ${res.status}`);

      const data = await res.json();
      const confidence = data.confidence ?? 0;
      const approved = data.signal !== 'NONE' && confidence >= threshold;

      return {
        approved,
        confidence,
        reason: data.reason || `confidence=${(confidence * 100).toFixed(0)}%`,
      };
    } catch (e) {
      this._strategyAiOnline = false; // invalidate cache on error
      console.warn(`[Bot ${bot.id}] Strategy AI error (non-blocking): ${e.message}`);
      return { approved: true, confidence: 1.0, reason: 'Strategy AI error — skipped filter' };
    }
  }

  // Expose health status for API
  async getStrategyAiStatus() {
    const online = await this._checkStrategyAiHealth();
    return {
      online,
      url: this.config.strategyAiUrl || 'http://strategy-ai:8000',
      mode: this.config.strategyAiMode || 'off',
      lastCheck: new Date(this._strategyAiLastCheck).toISOString(),
    };
  }

  // ─── Auto Re-attach Orphan Positions ────────────────────────────────────────
  // Scans all open positions on Binance and attaches any unmanaged ones
  // to a running bot that matches symbol + side. If no bot matches,
  // creates a lightweight "guardian" bot to manage the position.

  async reattachOrphanPositions() {
    if (!this.exchange) return;

    let accountInfo;
    try {
      accountInfo = await this.exchange.getAccountInfo();
    } catch (e) {
      console.error('[BotManager] reattachOrphanPositions: getAccountInfo failed:', e.message);
      return;
    }

    const remotePositions = (accountInfo.positions || []).filter(
      (p) => parseFloat(p.positionAmt) !== 0
    );

    if (remotePositions.length === 0) return;

    for (const rp of remotePositions) {
      const symbol = rp.symbol.toUpperCase();
      const amt = parseFloat(rp.positionAmt);
      const side = amt > 0 ? 'LONG' : 'SHORT';
      const entryPrice = parseFloat(rp.entryPrice);

      // Check if any running bot already manages this symbol + side
      const managingBot = [...this.bots.values()].find(
        (b) =>
          b.isRunning &&
          b.config.symbol.toUpperCase() === symbol &&
          b.openPositions.some((p) => p.type === side)
      );

      if (managingBot) continue; // Already managed

      // Find a running bot for this symbol (any side) to attach to
      const candidateBot = [...this.bots.values()].find(
        (b) => b.isRunning && b.config.symbol.toUpperCase() === symbol
      );

      const posEntry = {
        id: `reattach_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        type: side,
        entryPrice,
        highestPrice: entryPrice,
        lowestPrice: entryPrice,
        entryTime: new Date().toISOString(),
        entryReason: 'Auto Re-attached (Manual/External Position)',
        quantity: Math.abs(amt),
        isReattached: true,
      };

      if (candidateBot) {
        // Attach to existing bot for this symbol
        candidateBot.openPositions.push(posEntry);
        console.log(`[BotManager] Re-attached ${side} ${symbol} position to bot ${candidateBot.id}`);
        if (this.notificationService) {
          this.notificationService.send(
            `🔗 *Auto Re-attach*\nSymbol: \`${symbol}\` | Side: \`${side}\`\nAttached to Bot: \`${candidateBot.id.slice(-6)}\`\nEntry: ${entryPrice}`
          );
        }
      } else {
        // No bot for this symbol — create a guardian bot
        const guardianId = makeBotId();
        const guardian = {
          id: guardianId,
          isRunning: true,
          config: {
            symbol,
            strategy: 'EMA_CROSS',
            tpPercent: 2,
            slPercent: 1,
            trailingStopPct: 1,
            trailingActivationPct: 0.5,
            leverage: 1,
            positionSizeUSDT: Math.abs(amt) * entryPrice,
            interval: '15m',
            aiCheckInterval: 30,
            isGuardian: true,
          },
          expiresAt: null,
          openPositions: [posEntry],
          capital: Math.abs(amt) * entryPrice,
          currentCash: 0,
          equity: Math.abs(amt) * entryPrice,
          grossProfit: 0,
          grossLoss: 0,
          winCount: 0,
          lossCount: 0,
          lastSignal: side,
          lastCandle: null,
          lastChecked: '',
          currentPrice: entryPrice,
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
          aiReason: `Guardian bot — re-attached ${side} position from external/manual trade`,
          lastAiModel: null,
        };

        this.bots.set(guardianId, guardian);
        this._scheduleBot(guardianId);
        this._save();

        console.log(`[BotManager] Created Guardian Bot ${guardianId} for orphan ${side} ${symbol}`);
        if (this.notificationService) {
          this.notificationService.send(
            `🛡️ *Guardian Bot Created*\nSymbol: \`${symbol}\` | Side: \`${side}\`\nBot ID: \`${guardianId.slice(-6)}\`\nEntry: ${entryPrice}\nReason: ไม่มีบอทดูแล — สร้าง Guardian อัตโนมัติ`
          );
        }
      }
    }

    this._save();
  }

  // ─── Adaptive Trailing Stop Logic ──────────────────────────────────────────
  // Uses bot.config.trailingStopPct (configurable) with a configurable
  // activation threshold (trailingActivationPct, default 1%).

  _handleTrailingStop(botId, currentPrice) {
    const bot = this.bots.get(botId);
    if (!bot || !bot.openPositions || bot.openPositions.length === 0) return;

    const trailingPct = parseFloat(bot.config.trailingStopPct || 0);
    const activationPct = parseFloat(bot.config.trailingActivationPct || 1.0);

    if (trailingPct <= 0) return;

    for (const pos of bot.openPositions) {
      const isLong = pos.type === 'LONG';
      const entryPrice = parseFloat(pos.entryPrice);
      const pnlPct = isLong
        ? ((currentPrice - entryPrice) / entryPrice) * 100
        : ((entryPrice - currentPrice) / entryPrice) * 100;

      if (pnlPct < activationPct) continue;

      if (isLong) {
        pos.highestPrice = Math.max(pos.highestPrice || entryPrice, currentPrice);
        const newSl = pos.highestPrice * (1 - trailingPct / 100);
        if (!pos.trailingSl || newSl > pos.trailingSl) {
          pos.trailingSl = newSl;
          console.log(`[Bot ${botId}] 📈 Trailing SL ↑ ${newSl.toFixed(4)} (peak: ${pos.highestPrice.toFixed(4)}, trail: ${trailingPct}%)`);
        }
      } else {
        pos.lowestPrice = Math.min(pos.lowestPrice || entryPrice, currentPrice);
        const newSl = pos.lowestPrice * (1 + trailingPct / 100);
        if (!pos.trailingSl || newSl < pos.trailingSl) {
          pos.trailingSl = newSl;
          console.log(`[Bot ${botId}] 📉 Trailing SL ↓ ${newSl.toFixed(4)} (trough: ${pos.lowestPrice.toFixed(4)}, trail: ${trailingPct}%)`);
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
