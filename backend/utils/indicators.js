import { EMA, BollingerBands, RSI } from 'technicalindicators';

export function emaCalc(values, period) {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  let ema = [values.slice(0, period).reduce((a, b) => a + b, 0) / period];
  for (let i = period; i < values.length; i++) {
    ema.push(values[i] * k + ema[ema.length - 1] * (1 - k));
  }
  return ema;
}

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

export function computeSignal(closes, strategy, options = {}) {
  if (closes.length < 50) return 'NONE';
  const curr = closes[closes.length - 1];
  const lastIdx = closes.length - 1;

  if (strategy === 'EMA') {
    const e20 = EMA.calculate({ period: 20, values: closes });
    const e50 = EMA.calculate({ period: 50, values: closes });
    if (e20.length < 2 || e50.length < 2) return 'NONE';
    const pE20 = e20[e20.length - 2], cE20 = e20[e20.length - 1];
    const pE50 = e50[e50.length - 2], cE50 = e50[e50.length - 1];
    if (pE20 <= pE50 && cE20 > cE50) return 'LONG';
    if (pE20 >= pE50 && cE20 < cE50) return 'SHORT';
  } 
  else if (strategy === 'BB') {
    const bb = BollingerBands.calculate({ period: 20, stdDev: 2, values: closes });
    if (bb.length < 2) return 'NONE';
    const pB = bb[bb.length - 2], cB = bb[bb.length - 1];
    const pPrice = closes[lastIdx - 1];
    if (pPrice <= pB.lower && curr > cB.lower) return 'LONG';
    if (pPrice >= pB.upper && curr < cB.upper) return 'SHORT';
  } 
  else if (strategy === 'RSI') {
    const rsi = RSI.calculate({ period: 14, values: closes });
    if (rsi.length < 2) return 'NONE';
    const pR = rsi[rsi.length - 2], cR = rsi[rsi.length - 1];
    if (pR <= 30 && cR > 30) return 'LONG';
    if (pR >= 70 && cR < 70) return 'SHORT';
  } 
  else if (strategy === 'EMA_RSI' || strategy === 'BB_RSI' || strategy === 'EMA_BB_RSI') {
    const e20 = EMA.calculate({ period: 20, values: closes });
    const e50 = EMA.calculate({ period: 50, values: closes });
    const bb = BollingerBands.calculate({ period: 20, stdDev: 2, values: closes });
    const rsi = RSI.calculate({ period: 14, values: closes });

    if (rsi.length < 2) return 'NONE';
    const currRsi = rsi[rsi.length - 1];
    const prevRsi = rsi[rsi.length - 2];
    const pPrice = closes[lastIdx - 1];

    if (strategy === 'EMA_RSI') {
      if (e20.length < 2 || e50.length < 2) return 'NONE';
      const crossUp = e20[e20.length-2] <= e50[e50.length-2] && e20[e20.length-1] > e50[e50.length-1];
      const crossDown = e20[e20.length-2] >= e50[e50.length-2] && e20[e20.length-1] < e50[e50.length-1];
      if (crossUp && currRsi < 40) return 'LONG';
      if (crossDown && currRsi > 60) return 'SHORT';
    } 
    else if (strategy === 'BB_RSI') {
      if (bb.length < 2) return 'NONE';
      const pB = bb[bb.length - 2], cB = bb[bb.length - 1];
      if (pPrice <= pB.lower && curr > cB.lower && prevRsi <= 30) return 'LONG';
      if (pPrice >= pB.upper && curr < cB.upper && prevRsi >= 70) return 'SHORT';
    } 
    else if (strategy === 'EMA_BB_RSI') {
      if (e20.length < 1 || e50.length < 1 || bb.length < 2) return 'NONE';
      const emaBull = e20[e20.length-1] > e50[e50.length-1];
      const emaBear = e20[e20.length-1] < e50[e50.length-1];
      const pB = bb[bb.length - 2], cB = bb[bb.length - 1];
      const bbUp = pPrice <= pB.lower && curr > cB.lower;
      const bbDown = pPrice >= pB.upper && curr < cB.upper;
      if (emaBull && bbUp && currRsi < 40) return 'LONG';
      if (emaBear && bbDown && currRsi > 60) return 'SHORT';
    }
  } 
  else if (strategy === 'GRID' || strategy === 'AI_GRID') {
    const { gridUpper, gridLower } = options || {};
    if (gridUpper && gridLower) {
      if (curr <= gridLower) return 'LONG';
      if (curr >= gridUpper) return 'SHORT';
      return 'NONE';
    }
    const e20 = EMA.calculate({ period: 20, values: closes });
    if (e20.length < 1) return 'NONE';
    const basis = e20[e20.length-1];
    const dev = (curr - basis) / basis;
    if (dev <= -0.01) return 'LONG';
    if (dev >= 0.01) return 'SHORT';
  }
  else if (strategy === 'EMA_CROSS' || strategy === 'EMA_CROSS_V2') {
    return computeSignal(closes, 'EMA');
  }
  else if (strategy === 'RSI_TREND') {
    return computeSignal(closes, 'RSI');
  }
  else if (strategy === 'AI_SCOUTER') {
    const sma7 = closes.slice(-7).reduce((a, b) => a + b, 0) / 7;
    const sma14 = closes.slice(-14).reduce((a, b) => a + b, 0) / 14;
    const rsiValues = RSI.calculate({ period: 14, values: closes });
    const rsi = rsiValues.length > 0 ? rsiValues[rsiValues.length - 1] : 50;
    
    if (sma7 > sma14 && rsi < 55) return 'LONG';
    if (sma7 < sma14 && rsi > 45) return 'SHORT';
  }
  return 'NONE';
}
