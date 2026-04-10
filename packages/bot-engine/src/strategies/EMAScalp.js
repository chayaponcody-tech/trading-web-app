import { EMA } from 'technicalindicators';

/**
 * EMA Scalp Strategy — EMA 3/8 Cross
 * เข้าเร็วมาก ตอบสนองทุก candle เหมาะกับ 1m-5m
 */
export const EMAScalpStrategy = {
  name: 'EMA_SCALP',
  description: '⚡ EMA 3/8 Scalping — เข้าเร็ว ออกเร็ว',

  compute: (closes, params = {}) => {
    const fast = params.fastPeriod || 3;
    const slow = params.slowPeriod || 8;

    const emaFast = EMA.calculate({ period: fast, values: closes });
    const emaSlow = EMA.calculate({ period: slow, values: closes });

    if (emaFast.length < 2 || emaSlow.length < 2) return 'NONE';

    const [pF, cF] = [emaFast.at(-2), emaFast.at(-1)];
    const [pS, cS] = [emaSlow.at(-2), emaSlow.at(-1)];

    if (pF <= pS && cF > cS) return 'LONG';
    if (pF >= pS && cF < cS) return 'SHORT';

    return 'NONE';
  },

  describe: (signal, params = {}) => {
    const fast = params.fastPeriod || 3;
    const slow = params.slowPeriod || 8;
    if (signal === 'LONG') return `⚡ EMA ${fast} ตัดขึ้นเหนือ EMA ${slow} — Scalp LONG`;
    if (signal === 'SHORT') return `⚡ EMA ${fast} ตัดลงใต้ EMA ${slow} — Scalp SHORT`;
    return '';
  },

  getDiagnostic: (closes, params = {}) => {
    const fast = params.fastPeriod || 3;
    const slow = params.slowPeriod || 8;
    if (closes.length < slow) return `กำลังรวบรวมข้อมูล EMA (${fast}/${slow})...`;

    const emaFast = EMA.calculate({ period: fast, values: closes });
    const emaSlow = EMA.calculate({ period: slow, values: closes });

    const cF = emaFast.at(-1);
    const cS = emaSlow.at(-1);
    const gap = (cF - cS).toFixed(4);
    const trend = cF > cS ? 'ขาขึ้น' : 'ขาลง';

    return `EMA ${fast}: ${cF?.toFixed(4)} | EMA ${slow}: ${cS?.toFixed(4)} | ช่องว่าง: ${gap} (${trend}) — รอ Cross`;
  }
};
