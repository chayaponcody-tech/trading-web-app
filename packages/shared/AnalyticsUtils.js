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

  // Use the first trade's entryTime as the initial point so the time is a valid ISO string
  const initialTime = sortedTrades.length > 0 ? sortedTrades[0].entryTime : new Date().toISOString();
  const curve = [{ time: initialTime, value: initialCapital }];
  
  for (const trade of sortedTrades) {
    currentEquity += parseFloat(trade.pnl || 0);
    curve.push({
      time: trade.exitTime,
      value: currentEquity
    });
  }
  
  return curve;
}

/**
 * Rule-based confidence score for JS strategies (mirrors Python confidence_engine).
 * Uses RSI, EMA cross, and momentum from close prices.
 * @param {'LONG'|'SHORT'} signal
 * @param {number[]} closes - close prices (oldest → newest)
 * @returns {number} confidence 0.0–1.0
 */
export function computeSignalConfidence(signal, closes) {
  if (!closes || closes.length < 20) return 0.5;

  // RSI (14)
  const deltas = closes.slice(-15).map((v, i, a) => i === 0 ? 0 : v - a[i - 1]).slice(1);
  const gains = deltas.map(d => d > 0 ? d : 0);
  const losses = deltas.map(d => d < 0 ? -d : 0);
  const avgGain = gains.reduce((a, b) => a + b, 0) / gains.length || 1e-9;
  const avgLoss = losses.reduce((a, b) => a + b, 0) / losses.length || 1e-9;
  const rsi = 100 - (100 / (1 + avgGain / avgLoss));

  // EMA 20 / 50
  const ema = (data, period) => {
    const k = 2 / (period + 1);
    return data.reduce((prev, curr) => curr * k + prev * (1 - k));
  };
  const ema20 = ema(closes.slice(-20), 20);
  const ema50 = closes.length >= 50 ? ema(closes.slice(-50), 50) : ema20;
  const emaCross = ema20 - ema50;

  // Momentum (last 10 candles)
  const momentum = closes.length >= 10
    ? (closes.at(-1) - closes.at(-10)) / closes.at(-10)
    : 0;

  let score = 0.5;

  if (signal === 'LONG') {
    if (rsi < 35) score += 0.15;
    else if (rsi < 50) score += 0.05;
    else if (rsi > 70) score -= 0.20;
    if (emaCross > 0) score += 0.10;
    else score -= 0.10;
    if (momentum > 0.01) score += 0.05;
  } else if (signal === 'SHORT') {
    if (rsi > 65) score += 0.15;
    else if (rsi > 50) score += 0.05;
    else if (rsi < 30) score -= 0.20;
    if (emaCross < 0) score += 0.10;
    else score -= 0.10;
    if (momentum < -0.01) score += 0.05;
  }

  return Math.max(0, Math.min(1, Math.round(score * 100) / 100));
}

/**
 * Calculate Value at Risk (VaR)
 * 95% Confidence Level Historical VaR. Returns absolute USDT value.
 * @param {number[]} pnlList - Array of PnL values
 */
export function calculateVaR(pnlList) {
  if (!pnlList || pnlList.length < 10) return 0;
  const sorted = [...pnlList].sort((a, b) => a - b);
  // 5th percentile for 95% confidence
  const index = Math.floor(sorted.length * 0.05);
  return Math.abs(sorted[index]);
}

/**
 * Calculate Sortino Ratio
 * Penalizes only downside volatility.
 * @param {number[]} pnlList
 */
export function calculateSortino(pnlList) {
  if (!pnlList || pnlList.length < 2) return 0;
  const mean = pnlList.reduce((a, b) => a + b, 0) / pnlList.length;
  const downsidePnLs = pnlList.filter(p => p < 0);
  if (downsidePnLs.length < 1) return mean > 0 ? 100 : 0; 
  
  const downsideVariance = downsidePnLs.map(x => Math.pow(x, 2)).reduce((a, b) => a + b, 0) / pnlList.length;
  const downsideStdDev = Math.sqrt(downsideVariance);
  
  return downsideStdDev === 0 ? 0 : (mean / downsideStdDev) * Math.sqrt(365);
}
