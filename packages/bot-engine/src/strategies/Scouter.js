import { RSI } from 'technicalindicators';

export const ScouterStrategy = {
  name: 'AI_SCOUTER',
  description: '🏹 Scouter Scalping Strategy',
  
  /**
   * Compute signal based on SMA and RSI.
   * @param {number[]} closes 
   * @param {object} params 
   */
  compute: (closes, params = {}) => {
    const sma7 = closes.slice(-7).reduce((a, b) => a + b, 0) / 7;
    const sma14 = closes.slice(-14).reduce((a, b) => a + b, 0) / 14;
    
    const rsiValues = RSI.calculate({ period: 14, values: closes });
    const rsi = rsiValues.length > 0 ? rsiValues.at(-1) : 50;
    
    if (sma7 > sma14 && rsi < 55) return 'LONG';
    if (sma7 < sma14 && rsi > 45) return 'SHORT';
    
    return 'NONE';
  },

  /**
   * Human readable reason for the entry.
   */
  describe: (signal) => {
    return `🏹 สัญญาณ Scalping จาก AI_SCOUTER (${signal})`;
  },

  /**
   * Diagnostic thought for AI_SCOUTER
   */
  getDiagnostic: (closes) => {
    if (closes.length < 14) return "กำลังรวบรวมข้อมูลราคา (EMA/RSI)...";
    const sma7 = closes.slice(-7).reduce((a, b) => a + b, 0) / 7;
    const sma14 = closes.slice(-14).reduce((a, b) => a + b, 0) / 14;
    const rsiValues = RSI.calculate({ period: 14, values: closes });
    const rsi = rsiValues.length > 0 ? rsiValues.at(-1) : 50;

    const rsiText = rsi.toFixed(1);
    const trend = sma7 > sma14 ? "Bullish (SMA7 > SMA14)" : "Bearish (SMA7 < SMA14)";
    
    if (sma7 > sma14 && rsi >= 55) return `ตลาด: ขาขึ้น | RSI: ${rsiText} (> 55) - รอ RSI ย่อตัวเพื่อเข้า LONG`;
    if (sma7 < sma14 && rsi <= 45) return `ตลาด: ขาลง | RSI: ${rsiText} (< 45) - รอ RSI ดีดตัวเพื่อเข้า SHORT`;
    
    return `เทรนด์: ${trend} | RSI: ${rsiText} - กำลังสแกนหาจุด Scalping`;
  }
};
