/**
 * Analytics Utilities for Quantitative Trading
 * Calculates risk metrics from trade history.
 */

/**
 * Calculate Sharpe Ratio
 * Simplified for Crypto (Risk-Free Rate = 0)
 * @param {number[]} pnlList - Array of PnL values from closed trades
 */
export function calculateSharpe(pnlList) {
  if (!pnlList || pnlList.length < 2) return 0;
  const mean = pnlList.reduce((a, b) => a + b, 0) / pnlList.length;
  const variance = pnlList.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / pnlList.length;
  const stdDev = Math.sqrt(variance);
  return stdDev === 0 ? 0 : (mean / stdDev) * Math.sqrt(365); // Annualized (assuming daily-like frequency)
}

/**
 * Calculate Max Drawdown
 * @param {number[]} equityCurve - Array of equity values over time
 * @returns {number} Max drawdown as a ratio (0 to 1)
 */
export function calculateMaxDrawdown(equityCurve) {
  if (!equityCurve || equityCurve.length === 0) return 0;
  let peak = -Infinity;
  let maxDD = 0;
  for (const value of equityCurve) {
    if (value > peak) peak = value;
    if (peak > 0) {
      const dd = (peak - value) / peak;
      if (dd > maxDD) maxDD = dd;
    }
  }
  return maxDD;
}

/**
 * Calculate Profit Factor
 * @param {number[]} pnlList - Array of PnL values
 */
export function calculateProfitFactor(pnlList) {
  if (!pnlList || pnlList.length === 0) return 0;
  let profits = 0;
  let losses = 0;
  for (const pnl of pnlList) {
    if (pnl > 0) profits += pnl;
    else losses += Math.abs(pnl);
  }
  return losses === 0 ? profits : profits / losses;
}

/**
 * Generate Equity Curve
 * @param {object[]} trades - Array of trade objects { pnl, exitTime }
 * @param {number} initialCapital - Starting balance
 */
export function generateEquityCurve(trades, initialCapital = 1000) {
  if (!trades) return [];
  
  // Sort trades by exit time
  const sortedTrades = [...trades].sort((a, b) => new Date(a.exitTime) - new Date(b.exitTime));
  
  let currentEquity = initialCapital;
  const curve = [{ time: 'Initial', value: initialCapital }];
  
  for (const trade of sortedTrades) {
    currentEquity += parseFloat(trade.pnl || 0);
    curve.push({
      time: trade.exitTime,
      value: currentEquity
    });
  }
  
  return curve;
}
