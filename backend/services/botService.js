import { computeSignal } from '../utils/indicators.js';
import * as dbService from '../db/dbService.js';
import { callOpenRouter, getBotRecommendations } from './aiService.js';
import { TuningService } from './tuningService.js';
import fs from 'fs';
import path from 'path';

const TZ_OPTS = { timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'medium' };

export class BotService {
    constructor(binanceService, binanceConfig) {
        this.binanceService = binanceService;
        this.binanceConfig = binanceConfig;
        this.bots = new Map();
        this.botTimers = new Map();
        this.symbolRules = {};
        this.tuningService = new TuningService(binanceService, binanceConfig);
        this.tickCount = 0;
        
        // Initialize from file
        const loaded = dbService.loadBots();
        loaded.forEach(bot => {
            this.bots.set(bot.id, bot);
        });
        console.log(`[BotService] Loaded ${loaded.length} bots from database.`);
        
        // Auto-migrate legacy data on startup
        this.runLegacyMigration().catch(err => console.warn('Migration error:', err.message));
    }

    setBinanceService(service, config) {
        this.binanceService = service;
        this.binanceConfig = config;
    }

    setSymbolRules(rules) {
        this.symbolRules = rules;
    }

    async startBot(config) {
        const botId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
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
          lastAiCheck: new Date().toISOString(),
          aiReason: config.aiReason || '',
          lastAiModel: config.aiModel || null,
        };
        
        this.bots.set(botId, bot);
        
        if (config.exchange === 'binance_testnet') {
          if (!this.binanceService) throw new Error('Binance Service not initialized.');
          this.resumeBot(botId);
        } else {
          throw new Error('Unsupported exchange.');
        }
        
        dbService.saveBots(Array.from(this.bots.values()));
        console.log(`[Bot ${botId}] Started: ${config.symbol} ${config.strategy}`);
        return botId;
    }

    stopBot(botId) {
        const timer = this.botTimers.get(botId);
        if (timer) { clearInterval(timer); this.botTimers.delete(botId); }
        const bot = this.bots.get(botId);
        if (bot) { bot.isRunning = false; }
        dbService.saveBots(Array.from(this.bots.values()));
        console.log(`[Bot ${botId}] Stopped`);
    }

    deleteBot(botId) {
        this.stopBot(botId);
        this.bots.delete(botId);
        dbService.saveBots(Array.from(this.bots.values()));
        console.log(`[Bot ${botId}] Deleted`);
    }

    resumeBot(botId) {
        const bot = this.bots.get(botId);
        if (!bot) return;
        
        // Clear existing timer if any to avoid duplicates
        const oldTimer = this.botTimers.get(botId);
        if (oldTimer) clearInterval(oldTimer);

        // Auto-extend expiration if it's already expired
        if (bot.expiresAt && new Date() > new Date(bot.expiresAt)) {
            if (bot.config.durationMinutes) {
                const newExpiry = new Date();
                newExpiry.setMinutes(newExpiry.getMinutes() + bot.config.durationMinutes);
                bot.expiresAt = newExpiry.toISOString();
                console.log(`[Bot ${botId}] Auto-extended expiration to ${bot.expiresAt}`);
            } else {
                bot.expiresAt = null;
                console.log(`[Bot ${botId}] Expiration cleared for resume`);
            }
        }

        bot.isRunning = true;
        // Immediate tick then interval
        this.binanceTick(botId);
        const timer = setInterval(() => this.binanceTick(botId), 30000);
        this.botTimers.set(botId, timer);
    }

    async binanceTick(botId) {
        const bot = this.bots.get(botId);
        if (!bot || !bot.isRunning || !this.binanceService) return;
        
        const { symbol, strategy, tpPercent, slPercent, leverage = 10 } = bot.config;
        const interval = bot.config.interval ? bot.config.interval.toLowerCase() : '1h';
        const posValue = bot.config.positionSizeUSDT || 100;

        try {
            const klines = await this.binanceService.getKlines(symbol, interval, 250);
            const ticker = await this.binanceService.getTickerPrice(symbol);
            if (!Array.isArray(klines)) return;

            const closed = klines.slice(0, -1);
            const closes = closed.map(k => parseFloat(k[4]));
            const lastK = closed[closed.length - 1];
            const lastCloseTime = lastK ? lastK[6] : null; 
            const currPrice = parseFloat(ticker.price);
            bot.currentPrice = currPrice;

            const accountInfo = await this.binanceService.getAccountInfo();
            const usdtAsset = accountInfo.assets.find(a => a.asset === 'USDT');
            bot.currentCash = parseFloat(usdtAsset.availableBalance);
            bot.equity = parseFloat(usdtAsset.marginBalance);

            // Calculate Unrealized PnL from Binance positions
            const symbolPositions = (accountInfo.positions || []).filter(p => p.symbol === symbol.toUpperCase());
            bot.unrealizedPnl = symbolPositions.reduce((sum, p) => sum + parseFloat(p.unrealizedProfit || p.unRealizedProfit || 0), 0);
            
            const remotePositions = (accountInfo.positions || []).filter(p => p.symbol === symbol.toUpperCase() && parseFloat(p.positionAmt) !== 0);

            // Sync stats immediately so Unrealized PnL is reflected
            this.syncBotStats(bot);

            // DIAGNOSTIC LOGGING
            if (signal !== 'NONE') {
                console.log(`[Diagnostic] Bot ${botId} (${symbol}) Signal: ${signal} | Current Price: ${currPrice}`);
            }

            // AUTO-SYNC: If Binance has a position but our bot thinks it's empty, recover it.
            if (remotePositions.length > 0 && bot.openPositions.length === 0) {
              remotePositions.forEach(rp => {
                const amt = parseFloat(rp.positionAmt);
                bot.openPositions.push({
                  id: `recov_${Date.now()}`,
                  type: amt > 0 ? 'LONG' : 'SHORT',
                  entryPrice: parseFloat(rp.entryPrice),
                  entryTime: new Date().toISOString(),
                  entryReason: 'Auto-Recovered from Binance',
                  quantity: Math.abs(amt)
                });
              });
              console.log(`[Bot ${botId}] Recovered ${remotePositions.length} position(s) from Binance.`);
            }
            // If Binance is empty but we have positions, clear them (external close)
            if (remotePositions.length === 0 && bot.openPositions.length > 0) {
                bot.openPositions = [];
                console.log(`[Bot ${botId}] Position cleared (closed externally).`);
            }

            // 1. Check Expiration
            if (bot.expiresAt && new Date() > new Date(bot.expiresAt)) {
              this.stopBot(botId); return;
            }

            // 2. Strategic AI Review
            const aiInterval = bot.config.aiCheckInterval || 30;
            if (aiInterval > 0 && this.binanceConfig.openRouterKey) {
                const lastCheck = bot.lastAiCheck ? new Date(bot.lastAiCheck).getTime() : 0;
                if (Date.now() - lastCheck >= aiInterval * 60000) {
                    this.performAiBotReview(botId);
                }
            }

            // 3. Real-time TP/SL
            const { tpPercent, slPercent } = bot.config;
            for (const pos of bot.openPositions) {
                const pnlPct = (pos.type === 'LONG' ? (currPrice - pos.entryPrice) / pos.entryPrice : (pos.entryPrice - currPrice) / pos.entryPrice) * 100;
                if ((tpPercent > 0 && pnlPct >= tpPercent) || (slPercent > 0 && pnlPct <= -slPercent)) {
                    const reason = pnlPct >= tpPercent ? `TP Hit (+${pnlPct.toFixed(2)}%)` : `SL Hit (${pnlPct.toFixed(2)}%)`;
                    await this.closePosition(bot, pos, currPrice, reason);
                }
            }

            // 4. Signal Logic & Dynamic Tuning
            this.tickCount++;
            if (this.tickCount % 50 === 0) {
                console.log(`[AI Tuner] Triggering periodic tuning for ${symbol}...`);
                this.tuningService.tuneBotParameters(bot).catch(e => console.error(e.message));
            }

            // Always compute signal for diagnostics
            const signal = computeSignal(closes, strategy, { ...bot.config, dynamicParams: bot.config.dynamicParams });
            bot.lastSignal = signal;

            // DIAGNOSTIC LOGGING (Every tick)
            const currentRsiLower = bot.config.dynamicParams?.rsiLower || 40;
            if (this.tickCount % 10 === 0) {
                console.log(`[Diagnostic] Bot ${botId} (${symbol}) Signal: ${signal} | Target RSI < ${currentRsiLower}`);
            }

            // Execution on Candle Close
            if (bot.lastCandle !== lastCloseTime) {
                bot.lastCandle = lastCloseTime;

                // Exit on Signal Flip
                for (const pos of bot.openPositions) {
                    if (signal !== 'NONE' && signal !== pos.type) {
                        await this.closePosition(bot, pos, currPrice, 'Signal Flipped');
                    }
                }

                // Open New Position
                if ((signal === 'LONG' || signal === 'SHORT') && bot.openPositions.length === 0) {
                    await this.openPosition(bot, signal, currPrice);
                }
            }

            dbService.saveBots(this.bots);
        } catch (err) {
            console.error(`[Bot ${botId}] Tick error:`, err.message);
        }
    }

    async openPosition(bot, signal, currPrice) {
        if (bot.config.useReflection) {
            const critique = await this.performAiReflection(bot, signal, currPrice);
            if (!critique.approved) {
                bot.lastEntryReason = `[REJECTED] ${critique.reason}`;
                return;
            }
        }

        const rule = this.symbolRules[bot.config.symbol.toUpperCase()] || { stepSize: 0.001, minQty: 0.001, precision: 3, tickSize: 0.0001, pricePrecision: 4 };
        const posValue = bot.config.positionSizeUSDT || 100;
        const leverage = bot.config.leverage || 10;
        const rawTotalQty = (posValue * leverage) / currPrice;
        
        // Support for AI Entry Steps (Layering)
        let steps = bot.config.entry_steps || [{ type: 'MARKET', weightPct: 100, offsetPct: 0 }];

        // GRID Strategy layering logic
        if (bot.config.strategy === 'GRID' && bot.config.gridUpper && bot.config.gridLower) {
            const layers = bot.config.gridLayers || 10;
            const targetPrice = signal === 'LONG' ? bot.config.gridLower : bot.config.gridUpper;
            const totalOffset = ((targetPrice - currPrice) / currPrice) * 100;
            
            steps = [];
            const weightPerLayer = 100 / layers;
            const offsetPerLayer = totalOffset / layers;
            for (let i = 0; i < layers; i++) {
                steps.push({
                    type: i === 0 ? 'MARKET' : 'LIMIT',
                    weightPct: weightPerLayer,
                    offsetPct: offsetPerLayer * i
                });
            }
            bot.config.entry_steps = steps;
        }

        for (const s of steps) {
            const stepQty = Math.floor((rawTotalQty * (s.weightPct / 100)) / rule.stepSize) * rule.stepSize;
            if (stepQty < rule.minQty) continue;

            const qtyStr = stepQty.toFixed(rule.precision || 3);

            if (s.type === 'MARKET') {
                await this.binanceService.placeOrder(bot.config.symbol, signal === 'LONG' ? 'BUY' : 'SELL', 'MARKET', qtyStr);
                bot.openPositions.push({
                    id: `pos_mkt_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
                    type: signal,
                    entryPrice: currPrice,
                    entryTime: new Date().toISOString(),
                    entryReason: `${bot.config.strategy} - AI Step (Market ${s.weightPct}%)`,
                    quantity: parseFloat(qtyStr)
                });
            } else {
                // LIMIT with Tick Size Rounding
                let rawLimitPrice = signal === 'LONG' ? currPrice * (1 + s.offsetPct/100) : currPrice * (1 - s.offsetPct/100);
                const tickSize = rule.tickSize || 0.0001;
                const pricePrecision = rule.pricePrecision || 4;
                const roundedLimitPrice = Number((Math.round(rawLimitPrice / tickSize) * tickSize).toFixed(pricePrecision));
                const limitPriceStr = roundedLimitPrice.toFixed(pricePrecision);

                try {
                    await this.binanceService.placeOrder(bot.config.symbol, signal === 'LONG' ? 'BUY' : 'SELL', 'LIMIT', qtyStr, limitPriceStr);
                    console.log(`[Bot ${bot.id}] AI Step (Limit ${s.weightPct}%) Placed at ${limitPriceStr}`);
                } catch (e) {
                    console.error(`[Bot ${bot.id}] AI Limit Step Error:`, e.message);
                }
            }
        }

        bot.lastEntryReason = `AI/Grid Entry initialized (${steps.length} steps)`;
    }

    async closePosition(bot, pos, currPrice, reason) {
        try {
            await this.binanceService.closePosition(bot.config.symbol, pos.type, pos.quantity);
            
            // Remove from open positions
            bot.openPositions = bot.openPositions.filter(p => p.id !== pos.id);
            
            // Calculate Realized PnL: (Exit - Entry) * Qty for Long, (Entry - Exit) * Qty for Short
            const pnl = (pos.type === 'LONG' ? (currPrice - pos.entryPrice) : (pos.entryPrice - currPrice)) * (pos.quantity || 0);

            const tradeData = {
                type: pos.type, 
                symbol: bot.config.symbol, 
                entryPrice: pos.entryPrice, 
                exitPrice: currPrice,
                pnl: pnl, 
                reason, 
                exitTime: new Date().toISOString(),
                entryReason: pos.entryReason || 'Technical Entry',
                strategy: bot.config.strategy
            };
            
            if (!bot.trades) bot.trades = [];
            bot.trades.push(tradeData);
            dbService.saveTradeMemory(tradeData);
            console.log(`[Bot ${bot.id}] ${reason}: ${pnl.toFixed(4)} USDT`);
        } catch (e) {
            console.error(`[Bot ${bot.id}] Close position error:`, e.message);
            // Even if binance fails (e.g. already closed manually), we should sync if it is actually closed
            if (e.message.includes('No open position found')) {
                bot.openPositions = bot.openPositions.filter(p => p.id !== pos.id);
            }
        }
    }

    syncBotStats(bot) {
        bot.grossProfit = 0; bot.grossLoss = 0; bot.winCount = 0; bot.lossCount = 0;
        bot.totalTrades = (bot.trades || []).length;
        (bot.trades || []).forEach(t => {
          const pnlValue = parseFloat(t.pnl || 0);
          if (pnlValue >= 0) { bot.grossProfit += pnlValue; bot.winCount++; }
          else { bot.grossLoss += Math.abs(pnlValue); bot.lossCount++; }
        });
        bot.netPnl = (bot.unrealizedPnl || 0) + (bot.grossProfit - bot.grossLoss);
    }

    async performAiBotReview(botId) {
        const bot = this.bots.get(botId);
        if (!bot || !this.binanceService) return;

        console.log(`[Bot ${botId}] Running AI Periodic Review...`);
        try {
            const klines = await this.binanceService.getKlines(bot.config.symbol, bot.config.interval || '1h', 50);
            const context = klines.map(k => ({
              time: new Date(k[0]).toLocaleString('th-TH', TZ_OPTS),
              close: parseFloat(k[4]),
              high: parseFloat(k[2]),
              low: parseFloat(k[3])
            }));

            const rec = await getBotRecommendations(
                context, 
                1, 
                bot.config.aiType || 'confident', 
                this.binanceConfig.openRouterKey, 
                this.binanceConfig.openRouterModel, 
                bot.config.symbol
            );

            if (rec) {
                console.log(`[Bot ${botId}] AI Update Received:`, rec.reason);
                
                // Adaptive adjustment for Grid
                if (bot.config.strategy === 'AI_GRID' && rec.grid_upper) {
                    bot.config.gridUpper = rec.grid_upper;
                    bot.config.gridLower = rec.grid_lower;
                }

                // Fine-tune risk parameters
                if (rec.tp) bot.config.tpPercent = rec.tp;
                if (rec.sl) bot.config.slPercent = rec.sl;
                if (rec.leverage) bot.config.leverage = rec.leverage;
                
                bot.aiReason = rec.reason;
                bot.lastAiCheck = new Date().toISOString();
                bot.lastAiModel = this.binanceConfig.openRouterModel;
                
                dbService.saveBots(Array.from(this.bots.values()));
            }
        } catch (e) {
            console.error(`[Bot ${botId}] AI Review Error:`, e.message);
        }
    }

    async performAiReflection(bot, signal, currPrice) {
        // Implementation of AI trade validation logic
        return { approved: true, reason: 'Auto-approved' };
    }

    async runLegacyMigration() {
        try {
            const root = process.cwd();
            const legacyPath = require('path').join(root, 'forward-bots-db.json');
            
            if (fs.existsSync(legacyPath)) {
                console.log('🔍 AUTO-MIGRATION: Legacy backup found! Starting data recovery...');
                const legacyBots = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
                const currentBots = dbService.loadBots();
                let migratedCount = 0;

                for (const legacy of legacyBots) {
                    const existing = currentBots.find(b => b.id === legacy.id);
                    if (existing) {
                        // Merge Trades and History
                        const legacyTrades = legacy.trades || [];
                        const currentTrades = existing.trades || [];
                        
                        // Merge and avoid basic duplicates based on time
                        const allTrades = [...legacyTrades];
                        currentTrades.forEach(ct => {
                            if (!allTrades.find(lt => lt.exitTime === ct.exitTime)) {
                                allTrades.push(ct);
                            }
                        });

                        existing.trades = allTrades;
                        existing.aiHistory = legacy.aiHistory || existing.aiHistory || [];
                        existing.reflectionHistory = legacy.reflectionHistory || existing.reflectionHistory || [];
                        existing.netPnl = legacy.netPnl || existing.netPnl || 0;
                        existing.totalTrades = allTrades.length;

                        dbService.sqlite.saveBot(existing);
                        migratedCount++;
                    }
                }
                
                if (migratedCount > 0) {
                    console.log(`✅ AUTO-MIGRATION COMPLETE: Restored history for ${migratedCount} bots.`);
                    // Optionally rename it so we don't re-run every time
                    // fs.renameSync(legacyPath, legacyPath + '.migrated');
                }
            }
        } catch (e) {
            console.warn('⚠️ Auto-Migration Error:', e.message);
        }
    }
}
