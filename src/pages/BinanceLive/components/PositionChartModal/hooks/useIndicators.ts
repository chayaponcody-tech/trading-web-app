import { useMemo } from 'react';
import { EMA, BollingerBands, RSI } from 'technicalindicators';
import type { CandleData } from '../types';

export function useIndicators(data: CandleData[]) {
  return useMemo(() => {
    if (data.length === 0) return { ema20: [], ema50: [], bb: [], rsi: [] };

    const closes = data.map(d => d.close);
    const times = data.map(d => d.time);

    const ema20Val = EMA.calculate({ period: 20, values: closes });
    const ema50Val = EMA.calculate({ period: 50, values: closes });
    const bbVal = BollingerBands.calculate({ period: 20, stdDev: 2, values: closes });
    const rsiVal = RSI.calculate({ period: 14, values: closes });

    const format = (values: number[], offset: number) => 
      values.map((v, i) => ({ time: times[i + offset], value: v }));

    return {
      ema20: format(ema20Val, data.length - ema20Val.length),
      ema50: format(ema50Val, data.length - ema50Val.length),
      bb: bbVal.map((v, i) => ({
        time: times[i + (data.length - bbVal.length)],
        upper: v.upper,
        lower: v.lower
      })),
      rsi: format(rsiVal, data.length - rsiVal.length)
    };
  }, [data]);
}
