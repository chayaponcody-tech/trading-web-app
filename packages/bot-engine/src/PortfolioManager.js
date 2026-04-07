import { huntBestSymbols, recommendBot } from '../../ai-agents/src/index.js';
import { loadBinanceConfig } from '../../data-layer/src/repositories/configRepository.js';
import { 
  getFleetById, upsertFleet, addFleetLog, getFleetLogs 
} from '../../data-layer/src/index.js';

export class PortfolioManager {
  constructor(botManager, exchange, options = {}) {
    this.botManager = botManager;
    this.exchange = exchange;
    this.managerId = options.managerId || 'portfolio1'; 
    this.name = options.name || 'Autonomous Portfolio';
    this.config = {
      isAutonomous: false,
      totalBudget: 1000,
      maxDailyLossPct: 5,
      targetBotCount: 3,
      riskMode: 'confident',
      lastScanTime: 0,
      ...(options.config || {})
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
      timestamp: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }),
      message,
      type
    };
    this.logs.unshift(entry);
    if (this.logs.length > 50) this.logs.pop();
    
    const prefix = `[PortfolioManager:${this.name}]`;
    if (type === 'warn') console.warn(`${prefix} ${message}`);
    else if (type === 'error') console.error(`${prefix} ${message}`);
    else console.log(`${prefix} ${message}`);
    
    // Persist log to fleet-specific table
    addFleetLog(this.managerId, message, type);
  }

  async init() {
    const fleet = getFleetById(this.managerId);
    if (fleet) {
      this.name = fleet.name;
      this.config = { ...this.config, ...fleet.config };
      this.isRunning = fleet.isRunning;
    }
    
    // Load recent logs from DB
    const savedLogs = getFleetLogs(this.managerId, 50);
    this.logs = savedLogs.map(l => ({
      timestamp: l.timestamp,
      message: l.message,
      type: l.type
    }));

    this.log(`Fleet "${this.name}" initialized and ready.`);
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
    
    // Support updating Name if provided
    if (newConfig.name) {
      this.name = newConfig.name;
      delete newConfig.name;
    }

    this.config = { ...this.config, ...newConfig };
    
    // Persist to fleets table
    upsertFleet({
      id: this.managerId,
      name: this.name,
      config: this.config,
      isRunning: this.isRunning
    });
    
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

      // 2.5 Orphaned Bot Cleanup (Ghost Bot Prevention)
      this._cleanupOrphanedBots();

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

    // A. AI Scan for best symbols + Quantitative Data
    const tickers = await this.exchange.get24hTickers();
    let topByVol = tickers
      .filter((t) => t.symbol.endsWith('USDT'))
      .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .slice(0, 40);

    // FETCH OI for top candidates (Batch fetch is better but we'll do controlled parallel)
    this.log(`Fetching Mikrostructure for top 40 candidates...`);
    const enhancedTickers = await Promise.all(topByVol.map(async (t) => {
      try {
        const oiData = await this.exchange.getOpenInterest(t.symbol);
        const oiStats = await this.exchange.getOpenInterestStatistics(t.symbol, '15m', 96); // ~24h
        
        // Calculate 24h OI Delta
        const startOi = oiStats.length > 0 ? parseFloat(oiStats[0].sumOpenInterest) : parseFloat(oiData.openInterest);
        const deltaPct = ((parseFloat(oiData.openInterest) - startOi) / startOi) * 100;
        
        return { 
          ...t, 
          oi: parseFloat(oiData.openInterest), 
          oiValue: parseFloat(oiData.openInterest) * parseFloat(t.lastPrice),
          oi24hDelta: deltaPct 
        };
      } catch (e) {
        return { ...t, oi: 0, oi24hDelta: 0 };
      }
    }));

    // Filter out active bots
    const activeSymbols = Array.from(this.botManager.bots.values())
      .filter(b => b.isRunning)
      .map(b => b.config.symbol);
      
    const huntGoal = `Find ${count} best coins for my ${this.config.riskMode} fleet strategy. Prioritize high OI growth + price action alignment. Avoid: ${activeSymbols.join(', ')}`;
    const preferredModel = this.config.aiModel || binanceCfg.openRouterModel;
    const recommendations = await huntBestSymbols(enhancedTickers, huntGoal, binanceCfg.openRouterKey, preferredModel);
    
    const item = recommendations[0]; // Take best choice for now to be safe
    if (!item) {
      this.log('AI could not find suitable coins matching strategy criteria.');
      return;
    }

    const totalScore = recommendations.slice(0, count).reduce((sum, r) => sum + (r.score || 70), 0);
    const averageBudget = this.config.totalBudget / this.config.targetBotCount;

    for (const item of recommendations.slice(0, count)) {
      // 🕵️ Double Check: Is this symbol actually free?
      const existing = Array.from(this.botManager.bots.values()).find(b => b.config.symbol === item.symbol && b.isRunning);
      if (existing) {
        if (!existing.config.managedBy) {
          this.log(`Adopting orphaned bot for ${item.symbol}...`);
          existing.config.managedBy = this.managerId;
        }
        continue;
      }

      this.log(`Recruiting ${item.symbol}: AI Score ${item.score || 'N/A'}. Reasoning: ${item.reason || 'Technical breakout'}`);
      this.currentAction = `🚀 Deploying ${item.symbol}...`;
      
      try {
        const klines = await this.exchange.getKlines(item.symbol, '1h', 100);
        const closes = klines.map(k => parseFloat(k[4]));
        const fr = await this.exchange.getFundingRate(item.symbol);
        const oi = await this.exchange.getOpenInterest(item.symbol);
        
        const microstructure = {
          fundingRate: (parseFloat(fr.lastFundingRate) * 100).toFixed(4) + '%',
          markPrice: fr.markPrice,
          openInterestUSDT: (parseFloat(oi.openInterest) * parseFloat(fr.markPrice)).toLocaleString() + ' USDT',
          nextFundingTime: (fr.nextFundingTime && !isNaN(new Date(fr.nextFundingTime))) ? new Date(fr.nextFundingTime).toISOString() : 'N/A'
        };

        const preferredModel = this.config.aiModel || binanceCfg.openRouterModel;
        const recommendedStrategy = await recommendBot(
          closes, this.config.riskMode, 
          binanceCfg.openRouterKey, preferredModel, 
          item.symbol,
          microstructure
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
          // Use detailed entry reason if provided, fallback to summary
          aiReason: `[Quant Fleet] ${recommendedStrategy.entry_reason || recommendedStrategy.reason || 'Microstructure analysis'}`,
          aiModel: this.config.aiModel || binanceCfg.openRouterModel,
          aiType: this.config.riskMode,
          exchange: 'binance_testnet',
          managedBy: this.managerId 
        };

        await this.botManager.startBot(botConfig);
        this.log(`Successfully recruited ${item.symbol} (${recommendedStrategy.strategy})`, 'info');
      } catch (e) {
        this.log(`Failed deep analysis/start for ${item.symbol}: ${e.message}`, 'warn');
      }
    }
  }

  _cleanupOrphanedBots() {
    const allBots = Array.from(this.botManager.bots.values());
    // Find running bots with no managedBy but that should probably be under us or are ghosts
    const orphans = allBots.filter(b => b.isRunning && !b.config.managedBy);
    
    for (const bot of orphans) {
       // If we already have a bot for this symbol, this one is a ghost
       const ourBot = allBots.find(b => b.isRunning && b.config.managedBy === this.managerId && b.config.symbol === bot.config.symbol);
       if (ourBot && ourBot.id !== bot.id) {
         this.log(`Cleaning up ghost bot ${bot.id} for ${bot.config.symbol}`, 'warn');
         this.botManager.stopBot(bot.id);
       }
    }
  }
}

