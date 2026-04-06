import { computeSignal } from './SignalEngine.js';

/**
 * Historical Backtesting Simulation
 * Simulates trade execution over historical klines.
 */
export function runBacktest(klines, config) {
  if (!klines || klines.length < 50) {
    return { error: 'Insufficent data for backtesting (Need > 50 klines)' };
  }

  const closes = klines.map(k => parseFloat(k[4]));
  const { strategy, tpPercent = 1, slPercent = 0.5, leverage = 10, capital = 1000 } = config;

  let currentCapital = capital;
  let inPosition = false;
  let positionSide = null;
  let entryPrice = 0;
  const trades = [];

  // Start after enough data for technical indicators is available
  const startIdx = 50; 

  for (let i = startIdx; i < closes.length; i++) {
    const historicalCloses = closes.slice(0, i);
    const signal = computeSignal(historicalCloses, strategy, config);
    const currPrice = closes[i];

    if (!inPosition) {
      if (signal === 'LONG' || signal === 'SHORT') {
        inPosition = true;
        positionSide = signal;
        entryPrice = currPrice;
      }
    } else {
      // Check TP/SL Exit
      const pnlPct = (positionSide === 'LONG'
        ? (currPrice - entryPrice) / entryPrice
        : (entryPrice - currPrice) / entryPrice) * 100;

      // Signal flip check
      const signalFlipped = signal !== 'NONE' && signal !== positionSide;

      if (pnlPct >= tpPercent || pnlPct <= -slPercent || signalFlipped) {
        // Simple simulation: assume full capital used per trade
        const tradePnl = (pnlPct / 100) * (capital * leverage); // Fixed size per trade for consistency
        currentCapital += tradePnl;
        
        trades.push({
          symbol: config.symbol,
          type: positionSide,
          entryPrice,
          exitPrice: currPrice,
          pnl: tradePnl,
          exitTime: new Date(klines[i][0]).toISOString(), // index 0 is open time
          reason: signalFlipped ? 'Signal Flipped' : (pnlPct >= tpPercent ? 'TP' : 'SL')
        });
        
        inPosition = false;
        positionSide = null;
      }
    }
  }

  return {
    initialCapital: capital,
    finalCapital: currentCapital,
    totalPnl: currentCapital - capital,
    netPnlPct: ((currentCapital - capital) / capital) * 100,
    trades,
    totalTrades: trades.length,
    winRate: trades.length > 0 ? (trades.filter(t => t.pnl > 0).length / trades.length) * 100 : 0
  };
}
