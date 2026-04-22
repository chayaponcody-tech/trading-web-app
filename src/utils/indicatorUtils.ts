import type { OverlayZone } from './backtestUtils';

interface Candle {
  time: any;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/**
 * Detects Fair Value Gaps (FVG) in a series of candles.
 */
export function detectFVG(candles: Candle[], config?: any): OverlayZone[] {
  const zones: OverlayZone[] = [];
  if (candles.length < 3) return zones;

  const threshold = config?.params?.threshold || 0; // Usage of threshold could be added for min gap size

  for (let i = 2; i < candles.length; i++) {
    const prev2 = candles[i - 2];
    const curr = candles[i];

    // Bullish FVG
    if (curr.low > prev2.high) {
      zones.push({
        startTime: new Date((prev2.time as number) * 1000).toISOString(),
        top: curr.low,
        bottom: prev2.high,
        type: 'FVG_UP', 
        mid: (curr.low + prev2.high) / 2,
        styles: config?.styles
      });
    }
    // Bearish FVG
    else if (curr.high < prev2.low) {
      zones.push({
        startTime: new Date((prev2.time as number) * 1000).toISOString(),
        top: prev2.low,
        bottom: curr.high,
        type: 'FVG_DOWN', 
        mid: (prev2.low + curr.high) / 2,
        styles: config?.styles
      });
    }
  }

  return zones.slice(-20);
}

/**
 * Detects simple Orderblocks (OB) based on engulfing patterns.
 */
export function detectOB(candles: Candle[], config?: any): OverlayZone[] {
  const zones: OverlayZone[] = [];
  if (candles.length < 2) return zones;

  const easyEngulfing = config?.params?.easyEngulfing ?? true;

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];

    // Standard Engulfing
    let isEngulfingBull = curr.close > prev.high && curr.open < prev.low;
    let isEngulfingBear = curr.close < prev.low && curr.open > prev.high;

    // Easy Engulfing (if enabled)
    if (easyEngulfing) {
        if (!isEngulfingBull) isEngulfingBull = curr.close > prev.high;
        if (!isEngulfingBear) isEngulfingBear = curr.close < prev.low;
    }

    if (isEngulfingBull) {
      zones.push({
        startTime: new Date((prev.time as number) * 1000).toISOString(),
        top: prev.high,
        bottom: prev.low,
        type: 'OB_UP',
        mid: (prev.high + prev.low) / 2,
        styles: config?.styles
      });
    } else if (isEngulfingBear) {
      zones.push({
        startTime: new Date((prev.time as number) * 1000).toISOString(),
        top: prev.high,
        bottom: prev.low,
        type: 'OB_DOWN',
        mid: (prev.high + prev.low) / 2,
        styles: config?.styles
      });
    }
  }

  return zones.slice(-10);
}

/**
 * Calculates quantitative metrics for the current market state.
 * Includes TQI (Trend Quality Index), ER (Efficiency Ratio), and Vol Z-Score.
 */
export function calculateTradeMetrics(candles: Candle[]) {
  if (candles.length < 20) return null;

  const len = candles.length;
  const recent = candles.slice(-14);
  const lookback = 10;
  
  // 1. Efficiency Ratio (ER) - Kaufman's Efficiency Ratio
  // ER = Directional Movement / Sum of absolute price changes
  const directionalMovement = Math.abs(candles[len - 1].close - candles[len - 1 - lookback].close);
  let volatility = 0;
  for (let i = len - lookback; i < len; i++) {
    volatility += Math.abs(candles[i].close - candles[i - 1].close);
  }
  const er = volatility === 0 ? 0 : directionalMovement / volatility;

  // 2. Volume Z-Score
  // Measuring how much the current volume deviates from the moving average.
  const volumes = candles.slice(-20).map(c => c.volume || 0);
  const avgVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const stdVol = Math.sqrt(volumes.map(v => Math.pow(v - avgVol, 2)).reduce((a, b) => a + b, 0) / volumes.length);
  const volZ = stdVol === 0 ? 0 : ((candles[len - 1].volume || 0) - avgVol) / stdVol;

  // 3. Simple RSI (14)
  let gains = 0, losses = 0;
  for (let i = 1; i < recent.length; i++) {
    const diff = recent[i].close - recent[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const rs = losses === 0 ? 100 : (gains / 14) / (losses / 14);
  const rsi = 100 - (100 / (1 + rs));

  // 4. Trend Quality Index (TQI) - Simplified
  // Based on ER + Trend Strength
  const tqi = er * (rsi > 50 ? (rsi - 50) / 50 : (50 - rsi) / 50) * 2;

  // 5. Dynamic Confluence Score (0 - 100)
  // Base is now lower, and we add weight continuously
  let score = 20; 
  
  // ER weight (up to 25 points)
  score += er * 25;
  
  // TQI weight (up to 25 points)
  score += Math.min(tqi * 50, 25);
  
  // Vol Z weight (up to 20 points)
  if (volZ > 0) score += Math.min(volZ * 8, 20);
  
  // RSI Extremes (up to 10 points)
  if (rsi > 65 || rsi < 35) score += 10;
  else if (rsi > 55 || rsi < 45) score += 5;

  // Trend Alignment (up to 20 points)
  if ((rsi > 50 && er > 0.4) || (rsi < 50 && er > 0.4)) score += 20;

  return {
    er: parseFloat(er.toFixed(2)),
    volZ: parseFloat(volZ.toFixed(2)),
    rsi: parseFloat(rsi.toFixed(1)),
    tqi: parseFloat(tqi.toFixed(2)),
    score: Math.min(Math.round(score), 100)
  };
}

/**
 * Detects EMA 20/50 Crossovers with a wider window.
 */
export function detectEMACross(candles: Candle[]): OverlayZone[] {
    const zones: OverlayZone[] = [];
    if (candles.length < 60) return zones;

    const getEMA = (data: number[], period: number) => {
        const k = 2 / (period + 1);
        let ema = data[0];
        for (let i = 1; i < data.length; i++) {
            ema = data[i] * k + ema * (1 - k);
        }
        return ema;
    };

    const prices = candles.map(c => c.close);
    
    // Look back up to 100 bars to find the most recent cross
    const lookback = Math.min(candles.length - 10, 100);
    for (let i = 2; i < lookback; i++) {
        const idx = candles.length - i;
        const prevIdx = idx - 1;
        
        const ema20_curr = getEMA(prices.slice(0, idx + 1), 20);
        const ema50_curr = getEMA(prices.slice(0, idx + 1), 50);
        const ema20_prev = getEMA(prices.slice(0, prevIdx + 1), 20);
        const ema50_prev = getEMA(prices.slice(0, prevIdx + 1), 50);

        const isCrossUp = ema20_prev <= ema50_prev && ema20_curr > ema50_curr;
        const isCrossDown = ema20_prev >= ema50_prev && ema20_curr < ema50_curr;

        if (isCrossUp || isCrossDown) {
            zones.push({
                startTime: new Date((candles[idx].time as number) * 1000).toISOString(),
                top: candles[idx].high,
                bottom: candles[idx].low,
                type: isCrossUp ? 'OB_UP' : 'OB_DOWN',
                mid: (ema20_curr + ema50_curr) / 2
            });
            break; 
        }
    }
    return zones;
}

/**
 * Strategy Setup Dispatcher
 */
export function detectStrategySetup(strategyId: string, candles: Candle[], indicatorConfigs: any[]): OverlayZone[] {
    const id = strategyId.toUpperCase();
    
    if (id.includes('EMA_CROSS') || id.includes('EMACROSS')) {
        return detectEMACross(candles);
    }
    
    if (id.includes('SATS')) {
        // SATS specific logic can be added here
        return detectOB(candles); // Fallback for now
    }

    const fvgConfig = indicatorConfigs.find(c => c.id === 'fvg');
    const obConfig = indicatorConfigs.find(c => c.id === 'hob');
    let allZones: OverlayZone[] = [];

    if (!fvgConfig || fvgConfig.enabled) allZones = [...allZones, ...detectFVG(candles, fvgConfig)];
    if (!obConfig || obConfig.enabled) allZones = [...allZones, ...detectOB(candles, obConfig)];
    
    return allZones;
}
