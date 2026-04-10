import { RSI, Stochastic } from 'technicalindicators';

/**
 * Stochastic RSI Strategy
 * จับ micro-cycle ได้ดีกว่า RSI ธรรมดา เหมาะกับ scalping รอบสั้น
 */
export const StochRSIStrategy = {
  name: 'STOCH_RSI',
  description: '🎯 Stochastic RSI — จับ micro-cycle เข้าเร็ว',

  compute: (closes, params = {}) => {
    const rsiPeriod = params.rsiPeriod || 14;
    const stochPeriod = params.stochPeriod || 14;
    const overbought = params.overbought || 80;
    const oversold = params.oversold || 20;

    const rsiValues = RSI.calculate({ period: rsiPeriod, values: closes });
    if (rsiValues.length < stochPeriod + 1) return 'NONE';

    const stoch = Stochastic.calculate({
      high: rsiValues,
      low: rsiValues,
      close: rsiValues,
      period: stochPeriod,
      signalPeriod: params.signalPeriod || 3,
    });

    if (stoch.length < 2) return 'NONE';

    const prev = stoch.at(-2);
    const curr = stoch.at(-1);

    // K line ตัดขึ้นจากโซน oversold
    if (prev.k <= oversold && curr.k > oversold) return 'LONG';
    // K line ตัดลงจากโซน overbought
    if (prev.k >= overbought && curr.k < overbought) return 'SHORT';

    return 'NONE';
  },

  describe: (signal, params = {}, closes = []) => {
    const rsiPeriod = params.rsiPeriod || 14;
    const rsiValues = RSI.calculate({ period: rsiPeriod, values: closes });
    const stoch = Stochastic.calculate({
      high: rsiValues, low: rsiValues, close: rsiValues,
      period: params.stochPeriod || 14,
      signalPeriod: params.signalPeriod || 3,
    });
    const k = stoch.at(-1)?.k?.toFixed(1) ?? '?';

    if (signal === 'LONG') return `🎯 StochRSI K(${k}) ฟื้นตัวจากโซน Oversold — Scalp LONG`;
    if (signal === 'SHORT') return `🎯 StochRSI K(${k}) ร่วงจากโซน Overbought — Scalp SHORT`;
    return '';
  },

  getDiagnostic: (closes, params = {}) => {
    const rsiPeriod = params.rsiPeriod || 14;
    const overbought = params.overbought || 80;
    const oversold = params.oversold || 20;

    const rsiValues = RSI.calculate({ period: rsiPeriod, values: closes });
    if (rsiValues.length < (params.stochPeriod || 14)) return 'กำลังรวบรวมข้อมูล StochRSI...';

    const stoch = Stochastic.calculate({
      high: rsiValues, low: rsiValues, close: rsiValues,
      period: params.stochPeriod || 14,
      signalPeriod: params.signalPeriod || 3,
    });

    if (!stoch.length) return 'กำลังคำนวณ Stochastic RSI...';

    const { k, d } = stoch.at(-1);
    if (k <= oversold) return `StochRSI K: ${k?.toFixed(1)} (Oversold < ${oversold}) — รอ K ตัดขึ้น`;
    if (k >= overbought) return `StochRSI K: ${k?.toFixed(1)} (Overbought > ${overbought}) — รอ K ตัดลง`;

    return `StochRSI K: ${k?.toFixed(1)} | D: ${d?.toFixed(1)} — รอเข้าโซน Oversold/Overbought`;
  }
};
