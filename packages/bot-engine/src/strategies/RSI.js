import { RSI } from 'technicalindicators';

export const RSIStrategy = {
  name: 'RSI',
  description: 'RSI Overbought/Oversold (30/70)',
  
  /**
   * Compute signal based on RSI thresholds.
   * @param {number[]} closes 
   * @param {object} params 
   */
  compute: (closes, params = {}) => {
    const period = params.rsiPeriod || 14;
    
    // Support AI-driven dynamic overrides
    const overbought = params.dynamicParams?.rsiOverbought ?? (params.rsiOverbought || 70);
    const oversold = params.dynamicParams?.rsiOversold ?? (params.rsiOversold || 30);
    
    const rsi = RSI.calculate({ period, values: closes });
    if (rsi.length < 2) return 'NONE';
    
    const [pR, cR] = [rsi.at(-2), rsi.at(-1)];
    
    if (pR <= oversold && cR > oversold) return 'LONG';
    if (pR >= overbought && cR < overbought) return 'SHORT';
    
    return 'NONE';
  },

  /**
   * Human readable reason for the entry.
   */
  describe: (signal, params = {}, closes = []) => {
    const period = params.rsiPeriod || 14;
    const rsi = RSI.calculate({ period, values: closes });
    const v = rsi.at(-1)?.toFixed(1);
    
    const overbought = params.dynamicParams?.rsiOverbought ?? (params.rsiOverbought || 70);
    const oversold = params.dynamicParams?.rsiOversold ?? (params.rsiOversold || 30);
    const isDynamic = !!params.dynamicParams;

    if (signal === 'LONG') return `RSI (${v}) ฟื้นตัวจากโซน Oversold (<${oversold})${isDynamic ? ' [AI Tuned]' : ''}`;
    if (signal === 'SHORT') return `RSI (${v}) ปรับตัวลงจากโซน Overbought (>${overbought})${isDynamic ? ' [AI Tuned]' : ''}`;
    return '';
  },

  /**
   * Current diagnostic state (Why no trade?)
   */
  getDiagnostic: (closes, params = {}) => {
    const period = params.rsiPeriod || 14;
    const overbought = params.dynamicParams?.rsiOverbought ?? (params.rsiOverbought || 70);
    const oversold = params.dynamicParams?.rsiOversold ?? (params.rsiOversold || 30);
    const rsi = RSI.calculate({ period, values: closes });
    
    if (rsi.length === 0) return "กำลังรอดึงข้อมูล Indicators...";
    const cur = rsi.at(-1).toFixed(1);
    
    if (cur <= oversold) return `RSI: ${cur} (อยู่ในโซนซื้อ < ${oversold}) - รอจังหวะกราฟวกตัวขึ้น`;
    if (cur >= overbought) return `RSI: ${cur} (อยู่ในโซนขาย > ${overbought}) - รอจังหวะกราฟวกตัวลง`;
    
    return `RSI: ${cur} (ปกติ) - รอให้ต่ำกว่า ${oversold} หรือสูงกว่า ${overbought}`;
  }
};
