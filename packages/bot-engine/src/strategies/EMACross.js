import { emaCalc } from '../../../shared/indicators.js';

export const EMACross = {
  name: 'EMA_CROSS',
  description: 'EMA 20 ตัดกับ EMA 50 (Golden/Death Cross)',
  
  /**
   * Compute signal based on EMA comparison.
   * @param {number[]} closes 
   * @param {object} params 
   */
  compute: (closes, params = {}) => {
    const p1 = params.fastPeriod || 20;
    const p2 = params.slowPeriod || 50;
    
    const fast = emaCalc(closes, p1);
    const slow = emaCalc(closes, p2);
    
    if (fast.length < 2 || slow.length < 2) return 'NONE';
    
    const [pFast, cFast] = [fast.at(-2), fast.at(-1)];
    const [pSlow, cSlow] = [slow.at(-2), slow.at(-1)];
    
    if (pFast <= pSlow && cFast > cSlow) return 'LONG';
    if (pFast >= pSlow && cFast < cSlow) return 'SHORT';
    
    return 'NONE';
  },

  /**
   * Human readable reason for the entry.
   */
  describe: (signal, params = {}) => {
    const p1 = params.fastPeriod || 20;
    const p2 = params.slowPeriod || 50;
    if (signal === 'LONG') return `EMA ${p1} ตัดขึ้นเหนือ EMA ${p2} (Golden Cross)`;
    if (signal === 'SHORT') return `EMA ${p1} ตัดลงใต้ EMA ${p2} (Death Cross)`;
    return '';
  },

  /**
   * Diagnostic thought for EMA_CROSS
   */
  getDiagnostic: (closes, params = {}) => {
    const p1 = params.fastPeriod || 20;
    const p2 = params.slowPeriod || 50;
    if (closes.length < p2) return `กำลังรวบรวมข้อมูล EMA (${p1}/${p2})...`;
    
    const fast = emaCalc(closes, p1);
    const slow = emaCalc(closes, p2);
    
    if (!fast.length || !slow.length) return "กำลังคำนวณเส้นความถี่ EMA...";
    
    const curFast = fast.at(-1);
    const curSlow = slow.at(-1);
    const diff = (curFast - curSlow).toFixed(4);
    const trend = curFast > curSlow ? "ขาขึ้น (20 > 50)" : "ขาลง (20 < 50)";
    
    return `สรุปเทรนด์: ${trend} | ช่องว่าง EMA: ${diff} - รอจังหวะ Golden/Death Cross`;
  }
};
