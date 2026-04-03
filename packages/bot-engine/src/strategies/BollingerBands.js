import { BollingerBands } from 'technicalindicators';

export const BollingerBandsStrategy = {
  name: 'BB',
  description: 'Bollinger Bands (20, 2)',
  
  /**
   * Compute signal based on Bollinger Bands.
   * @param {number[]} closes 
   * @param {object} params 
   */
  compute: (closes, params = {}) => {
    const period = params.bbPeriod || 20;
    const stdDev = params.bbStdDev || 2;
    
    const bb = BollingerBands.calculate({ period, stdDev, values: closes });
    if (bb.length < 2) return 'NONE';
    
    const pB = bb.at(-2), cB = bb.at(-1);
    const prev = closes.at(-2), curr = closes.at(-1);
    
    if (prev <= pB.lower && curr > cB.lower) return 'LONG';
    if (prev >= pB.upper && curr < cB.upper) return 'SHORT';
    
    return 'NONE';
  },

  /**
   * Human readable reason for the entry.
   */
  describe: (signal) => {
    if (signal === 'LONG') return 'ราคาทะลุ Lower Band และกลับตัวเข้าหาค่าเฉลี่ย';
    if (signal === 'SHORT') return 'ราคาทะลุ Upper Band และกลับตัวเข้าหาค่าเฉลี่ย';
    return '';
  },

  /**
   * Diagnostic thought for BB
   */
  getDiagnostic: (closes, params = {}) => {
    const period = params.bbPeriod || 20;
    const stdDev = params.bbStdDev || 2;
    if (closes.length < period) return "กำลังสะสมข้อมูลราคา (BB)...";
    
    const bb = BollingerBands.calculate({ period, stdDev, values: closes });
    if (!bb.length) return "กำลังคำนวณ Bollinger Bands...";
    
    const cur = closes.at(-1);
    const { upper, lower, middle } = bb.at(-1);
    
    if (cur <= lower) return `ราคา $${cur.toFixed(4)} แตะขอบล่าง ($${lower.toFixed(4)}) - รอจังหวะสู้กลับ (LONG)`;
    if (cur >= upper) return `ราคา $${cur.toFixed(4)} แตะขอบบน ($${upper.toFixed(4)}) - รอแรงเทขาย (SHORT)`;
    
    const distMid = ((cur - middle) / middle * 100).toFixed(2);
    return `ราคา: $${cur.toFixed(4)} | ห่างจากเส้นกลาง: ${distMid}% - รอแตะขอบ BB`;
  }
};
