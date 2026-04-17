/**
 * Shared Technical Indicators - Standardized Source of Truth
 * 
 * Used across:
 * - Backtester (for overlay & manual JS signals)
 * - SignalEngine (for live bot signals)
 * - Analytics (for advanced metrics)
 */

/**
 * Exponential Moving Average
 */
export function emaCalc(values, period) {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  let ema = [values.slice(0, period).reduce((a, b) => a + b, 0) / period];
  for (let i = period; i < values.length; i++) {
    const val = typeof values[i] === 'object' ? values[i].close : values[i];
    ema.push(val * k + ema[ema.length - 1] * (1 - k));
  }
  return ema;
}

/**
 * Relative Strength Index (Wilder's Smoothing)
 */
export function rsiCalc(values, period = 14) {
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

/**
 * Bollinger Bands
 */
export function bbCalc(values, period = 20, stdDev = 2) {
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

/**
 * Average True Range
 */
export function computeATR(highs, lows, closes, period = 14) {
  if (closes.length < period + 1) return 0;
  const trueRanges = [];
  for (let i = 1; i < closes.length; i++) {
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    trueRanges.push(Math.max(hl, hc, lc));
  }
  const recent = trueRanges.slice(-period);
  return recent.reduce((a, b) => a + b, 0) / recent.length;
}

/**
 * Money Flow Index (Optional, for advanced strategies)
 */
export function mfiCalc(highs, lows, closes, volumes, period = 14) {
  if (closes.length <= period) return [];
  const typicalPrices = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
  const rawMoneyFlow = typicalPrices.map((tp, i) => tp * volumes[i]);
  
  const mfi = [];
  for (let i = period; i < typicalPrices.length; i++) {
    let posFlow = 0, negFlow = 0;
    for (let j = i - period + 1; j <= i; j++) {
      if (typicalPrices[j] > typicalPrices[j - 1]) posFlow += rawMoneyFlow[j];
      else if (typicalPrices[j] < typicalPrices[j - 1]) negFlow += rawMoneyFlow[j];
    }
    const moneyRatio = negFlow === 0 ? 100 : posFlow / negFlow;
    mfi.push(100 - (100 / (1 + moneyRatio)));
  }
  return mfi;
}
