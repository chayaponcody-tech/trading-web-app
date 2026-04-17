import type { OverlayZone } from './backtestUtils';

interface Candle {
  time: any;
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * Detects Fair Value Gaps (FVG) in a series of candles.
 */
export function detectFVG(candles: Candle[]): OverlayZone[] {
  const zones: OverlayZone[] = [];
  if (candles.length < 3) return zones;

  for (let i = 2; i < candles.length; i++) {
    const prev2 = candles[i - 2];
    const curr = candles[i];

    // Bullish FVG
    if (curr.low > prev2.high) {
      zones.push({
        startTime: new Date((prev2.time as number) * 1000).toISOString(),
        top: curr.low,
        bottom: prev2.high,
        type: 'OB', // Using OB type for now for visualization
        mid: (curr.low + prev2.high) / 2
      });
    }
    // Bearish FVG
    else if (curr.high < prev2.low) {
      zones.push({
        startTime: new Date((prev2.time as number) * 1000).toISOString(),
        top: prev2.low,
        bottom: curr.high,
        type: 'BB', // Using BB type for color coding
        mid: (prev2.low + curr.high) / 2
      });
    }
  }

  // Limit to most recent 20 zones for performance
  return zones.slice(-20);
}

/**
 * Detects simple Orderblocks (OB) based on engulfing patterns.
 */
export function detectOB(candles: Candle[]): OverlayZone[] {
  const zones: OverlayZone[] = [];
  if (candles.length < 2) return zones;

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];

    const isEngulfingBull = curr.close > prev.high && curr.open < prev.low;
    const isEngulfingBear = curr.close < prev.low && curr.open > prev.high;

    if (isEngulfingBull) {
      zones.push({
        startTime: new Date((prev.time as number) * 1000).toISOString(),
        top: prev.high,
        bottom: prev.low,
        type: 'HOB',
        mid: (prev.high + prev.low) / 2
      });
    } else if (isEngulfingBear) {
      zones.push({
        startTime: new Date((prev.time as number) * 1000).toISOString(),
        top: prev.high,
        bottom: prev.low,
        type: 'BB',
        mid: (prev.high + prev.low) / 2
      });
    }
  }

  return zones.slice(-10);
}
