import { EMA, RSI, BollingerBands } from 'technicalindicators';

/**
 * Helper to get EMA crossover signal.
 */
function getEMACross(closes, params = {}) {
  const p1 = params.fastPeriod || 20;
  const p2 = params.slowPeriod || 50;
  const fast = EMA.calculate({ period: p1, values: closes });
  const slow = EMA.calculate({ period: p2, values: closes });
  if (fast.length < 2 || slow.length < 2) return 'NONE';
  const [pFast, cFast] = [fast.at(-2), fast.at(-1)];
  const [pSlow, cSlow] = [slow.at(-2), slow.at(-1)];
  if (pFast <= pSlow && cFast > cSlow) return 'LONG';
  if (pFast >= pSlow && cFast < cSlow) return 'SHORT';
  return 'NONE';
}

/**
 * Helper to get RSI levels.
 */
function getRSIsignal(closes, params = {}) {
  const p = params.rsiPeriod || 14;
  const rsi = RSI.calculate({ period: p, values: closes });
  if (rsi.length < 1) return { val: 50, signal: 'NONE' };
  const val = rsi.at(-1);
  if (val < (params.rsiBuy || 30)) return { val, signal: 'LONG' };
  if (val > (params.rsiSell || 70)) return { val, signal: 'SHORT' };
  return { val, signal: 'NONE' };
}

/**
 * Helper for Bollinger Bands.
 */
function getBBsignal(closes, params = {}) {
  const bb = BollingerBands.calculate({ period: params.bbPeriod || 20, stdDev: params.bbStd || 2, values: closes });
  if (bb.length < 1) return 'NONE';
  const last = bb.at(-1);
  const cur = closes.at(-1);
  if (cur < last.lower) return 'LONG';
  if (cur > last.upper) return 'SHORT';
  return 'NONE';
}

/**
 * EMA_RSI Strategy: EMA Crossover confirmed by RSI not being overbought/oversold.
 */
export const EMA_RSI = {
  compute: (closes, params = {}) => {
    const ema = getEMACross(closes, params);
    const rsi = getRSIsignal(closes, params);
    // Only LONG if EMA crosses UP and RSI is not overbought (>70)
    if (ema === 'LONG' && rsi.val < 70) return 'LONG';
    // Only SHORT if EMA crosses DOWN and RSI is not oversold (<30)
    if (ema === 'SHORT' && rsi.val > 30) return 'SHORT';
    return 'NONE';
  },
  describe: (signal, params, closes) => {
    const rsi = getRSIsignal(closes, params);
    if (signal === 'LONG') return `EMA ตัดขึ้น (Golden Cross) และ RSI อยู่ที่ ${rsi.val.toFixed(1)} (ยังไม่ Overbought)`;
    if (signal === 'SHORT') return `EMA ตัดลง (Death Cross) และ RSI อยู่ที่ ${rsi.val.toFixed(1)} (ยังไม่ Oversold)`;
    return '';
  }
};

/**
 * BB_RSI Strategy: Mean reversion with RSI confirmation.
 */
export const BB_RSI = {
  compute: (closes, params = {}) => {
    const bb = getBBsignal(closes, params);
    const rsi = getRSIsignal(closes, params);
    if (bb === 'LONG' && rsi.signal === 'LONG') return 'LONG';
    if (bb === 'SHORT' && rsi.signal === 'SHORT') return 'SHORT';
    return 'NONE';
  },
  describe: (signal, params, closes) => {
    const rsi = getRSIsignal(closes, params);
    if (signal === 'LONG') return `ราคาต่ำกว่าเส้นล่าง BB และ RSI ต่ำกว่า 30 (Oversold)`;
    if (signal === 'SHORT') return `ราคาสูงกว่าเส้นบน BB และ RSI สูงกว่า 70 (Overbought)`;
    return '';
  }
};

/**
 * EMA_BB_RSI: Triple confirmation strategy.
 */
export const EMA_BB_RSI = {
  compute: (closes, params = {}) => {
    const ema = getEMACross(closes, params);
    const bb = getBBsignal(closes, params);
    const rsi = getRSIsignal(closes, params);
    // Strategic entries
    if (ema === 'LONG' && (bb === 'LONG' || rsi.val < 40)) return 'LONG';
    if (ema === 'SHORT' && (bb === 'SHORT' || rsi.val > 60)) return 'SHORT';
    return 'NONE';
  },
  describe: (signal, params, closes) => {
    const rsi = getRSIsignal(closes, params);
    if (signal === 'LONG') return `3-Signal Match: ทิศทางขาขึ้นพร้อมสัญญาณ Buy จาก RSI/BB (RSI: ${rsi.val.toFixed(1)})`;
    if (signal === 'SHORT') return `3-Signal Match: ทิศทางขาลงพร้อมสัญญาณ Sell จาก RSI/BB (RSI: ${rsi.val.toFixed(1)})`;
    return '';
  }
};
