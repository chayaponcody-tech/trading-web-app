import { getSetting } from './packages/data-layer/src/repositories/botRepository.js';
import { getAllBots } from './packages/data-layer/src/repositories/botRepository.js';

async function diagnose() {
  try {
    const config = getSetting('portfolio_config');
    const bots = getAllBots();
    const activeBots = bots.filter(b => b.isRunning);
    
    console.log('--- Portfolio Diagnosis Report ---');
    console.log('Config:', JSON.stringify(config, null, 2));
    console.log('Total Bots in DB:', bots.length);
    console.log('Active Bots now:', activeBots.length);
    
    const totalNetPnl = bots.reduce((sum, b) => sum + (b.netPnl || 0), 0);
    console.log('Total Portfolio PnL:', totalNetPnl);
    
    if (config && config.maxDailyLossPct > 0) {
      const budget = config.totalBudget || 1000;
      const currentLossPct = (totalNetPnl / budget) * 100;
      console.log('Current Loss %:', currentLossPct.toFixed(2) + '%');
      
      if (currentLossPct <= -config.maxDailyLossPct) {
        console.log('>>> [SHIELD TRIGGERED]: Portfolio hit max loss limit. <<<');
      }
    }
  } catch (err) {
    console.error('Diagnosis Failed:', err.message);
  }
}

diagnose();
