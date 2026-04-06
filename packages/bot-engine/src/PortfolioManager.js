import { huntBestSymbols, recommendBot } from '../../ai-agents/src/index.js';
import { loadBinanceConfig } from '../../data-layer/src/repositories/configRepository.js';
import { getSetting, saveSetting } from '../../data-layer/src/repositories/botRepository.js';

export class PortfolioManager {
  constructor(botManager, exchange, options = {}) {
    this.botManager = botManager;
    this.exchange = exchange;
    this.managerId = options.managerId || 'portfolio1'; // Unique identifier for this portfolio manager
    this.config = {
      isAutonomous: false,
      totalBudget: 1000,
      maxDailyLossPct: 5,
      targetBotCount: 3,
      riskMode: 'confident',
      lastScanTime: 0
    };
    this.isRunning = false;
    this.timer = null;
    this.currentAction = 'Idle';
    this.logs = [];
  }

  setExchange(exchange) {
    this.exchange = exchange;
  }

  log(message, type = 'info') {
    const entry = {
      timestamp: new Date().toISOString(),
      message,
      type
    };
    this.logs.unshift(entry);
    if (this.logs.length > 50) this.logs.pop();
    
    const prefix = `[PortfolioManager]`;
    if (type === 'warn') console.warn(`${prefix} ${message}`);
    else if (type === 'error') console.error(`${prefix} ${message}`);
    else console.log(`${prefix} ${message}`);
    
    // Optional: Persist logs
    saveSetting('portfolio_logs', this.logs);
  }

  async init() {
    const saved = getSetting('portfolio_config');
    if (saved) {
      this.config = { ...this.config, ...saved };
    }
    this.logs = getSetting('portfolio_logs') || [];
    this.log('Initialized and ready.');
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.log('Started Autonomous Monitoring...');
    this.timer = setInterval(() => this.tick(), 5 * 60_000); // Check every 5 mins
    this.tick(); // Immediate first tick
  }

  stop() {
    this.isRunning = false;
    if (this.timer) clearInterval(this.timer);
    this.log('Stopped.');
  }

  async updateConfig(newConfig) {
    const wasAutonomous = this.config.isAutonomous;
    this.config = { ...this.config, ...newConfig };
    saveSetting('portfolio_config', this.config);
    
    // If just enabled, trigger tick immediately
    if (!wasAutonomous && this.config.isAutonomous && this.isRunning) {
      console.log('[PortfolioManager] Auto-Pilot enabled: Triggering immediate scan...');
      this.tick(); 
    }
    
    return this.config;
  }

  async tick() {
    if (!this.isRunning || this.isScanning) return;
    this.isScanning = true;
    
    try {
      const bots = Array.from(this.botManager.bots.values());
      // count ONLY bots managed by this instance for fleet scaling
      const activeFleet = bots.filter(b => b.isRunning && b.config.managedBy === this.managerId);
      
      this.currentAction = '🛡️ Checking Risk...';
      const totalNetPnl = bots.reduce((sum, b) => sum + (b.netPnl || 0), 0);
      const budget = this.config.totalBudget;
      const currentLossPct = (totalNetPnl / budget) * 100;

      if (this.config.maxDailyLossPct > 0 && currentLossPct <= -this.config.maxDailyLossPct) {
        this.log(`ALERT: Portfolio Max Loss Hit (${currentLossPct.toFixed(2)}%). Shutting down fleet.`, 'warn');
        activeFleet.forEach(b => this.botManager.stopBot(b.id));
        this.config.isAutonomous = false; 
        this.currentAction = '⚠️ Shield Triggered';
        this.updateConfig(this.config);
        return;
      }

      if (!this.config.isAutonomous) {
        this.currentAction = 'Manual Mode';
        return;
      }

      // 2. Performance Review & Substitution
      this.currentAction = '📊 Reviewing Performance...';
      for (const bot of activeFleet) {
        const winRate = bot.totalTrades > 5 ? (bot.winCount / bot.totalTrades) : 1;
        if (bot.totalTrades > 5 && winRate < 0.3 && bot.netPnl < 0) {
          this.log(`Bot ${bot.id} (${bot.config.symbol}) performing poorly. Firing.`, 'warn');
          this.botManager.deleteBot(bot.id);
        }
      }

      // 3. Gap Filling (Day 0 & Beyond)
      const currentFleetCount = Array.from(this.botManager.bots.values()).filter(b => b.isRunning && b.config.managedBy === this.managerId).length;
      if (currentFleetCount < this.config.targetBotCount) {
        this.currentAction = `🔍 Scanning Gaps (${currentFleetCount}/${this.config.targetBotCount})...`;
        this.log(`Fleet Gap Detected (${currentFleetCount}/${this.config.targetBotCount}). Recruiting new bots...`);
        await this._recruitNewBots(this.config.targetBotCount - currentFleetCount);
      } else {
        this.currentAction = '💤 Monitoring Fleet';
      }

    } catch (err) {
      this.log(`Tick Error: ${err.message}`, 'error');
    } finally {
      this.isScanning = false;
    }
  }

  async _recruitNewBots(count) {
    const binanceCfg = loadBinanceConfig();
    if (!binanceCfg.openRouterKey) return;

    // A. AI Scan for best symbols
    const tickers = await this.exchange.get24hTickers();
    const topByVol = tickers
      .filter((t) => t.symbol.endsWith('USDT'))
      .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .slice(0, 50);

    // Filter out symbols that already have an ACTIVE bot (autonomous or manual)
    const activeSymbols = Array.from(this.botManager.bots.values())
      .filter(b => b.isRunning)
      .map(b => b.config.symbol);
      
    const huntGoal = `Find ${count} best coins for my ${this.config.riskMode} fleet strategy. Avoid: ${activeSymbols.join(', ')}`;
    const recommendations = await huntBestSymbols(topByVol, huntGoal, binanceCfg.openRouterKey, binanceCfg.openRouterModel);
    
    // B. Deploy recommended symbols
    const toStart = recommendations.slice(0, count);
    const totalScore = toStart.reduce((sum, r) => sum + (r.score || 70), 0);
    const averageBudget = this.config.totalBudget / this.config.targetBotCount;

    for (const item of toStart) {
      // Re-verify symbol hasn't been started in THIS loop instance
      const currentBots = Array.from(this.botManager.bots.values());
      if (currentBots.some(b => b.config.symbol === item.symbol && b.isRunning)) continue;

      this.log(`Analyzing ${item.symbol} for deployment...`);
      
      const klines = await this.exchange.getKlines(item.symbol, '1h', 100);
      const closes = klines.map(k => parseFloat(k[4]));
      const recommendedStrategy = await recommendBot(
        closes, this.config.riskMode, 
        binanceCfg.openRouterKey, binanceCfg.openRouterModel, 
        item.symbol
      );

      const weight = (item.score || 70) / totalScore;
      const allocatedBudget = (averageBudget * count) * weight;
      
      const botConfig = {
        symbol: item.symbol,
        strategy: recommendedStrategy.strategy,
        interval: recommendedStrategy.interval || '15m',
        leverage: recommendedStrategy.leverage || 10,
        positionSizeUSDT: allocatedBudget,
        maxLossUSDT: allocatedBudget * 0.05, 
        tpPercent: recommendedStrategy.tp || 1.5,
        slPercent: recommendedStrategy.sl || 1.0,
        aiReason: `[Portfolio Fleet] ${recommendedStrategy.reason || 'Autonomous Recruitment'}`, // Force marker
        aiModel: binanceCfg.openRouterModel,
        aiType: this.config.riskMode,
        exchange: 'binance_testnet',
        managedBy: this.managerId // CRITICAL: Tag as autonomous for UI and scaling logic
      };

      try {
        await this.botManager.startBot(botConfig);
        this.log(`Successfully recruited ${item.symbol} (${recommendedStrategy.strategy})`, 'info');
      } catch (e) {
        this.log(`Failed to start bot for ${item.symbol}: ${e.message}`, 'warn');
      }
    }
  }
}

