import { EMA } from 'technicalindicators';

export const GridStrategy = {
  name: 'GRID',
  description: 'Grid Mean Reversion (Buy Low / Sell High)',
  
  /**
   * Compute signal based on grid levels or EMA deviation.
   * @param {number[]} closes 
   * @param {object} params 
   */
  compute: (closes, params = {}) => {
    const curr = closes.at(-1);
    const { gridUpper, gridLower } = params;
    
    if (gridUpper && gridLower) {
      if (curr <= gridLower) return 'LONG';
      if (curr >= gridUpper) return 'SHORT';
      return 'NONE';
    }
    
    // Fallback: EMA deviation
    const e20 = EMA.calculate({ period: 20, values: closes });
    if (!e20.length) return 'NONE';
    const dev = (curr - e20.at(-1)) / e20.at(-1);
    if (dev <= -0.01) return 'LONG';
    if (dev >= 0.01) return 'SHORT';
    
    return 'NONE';
  },

  /**
   * Human readable reason for the entry.
   */
  describe: (signal, params = {}) => {
    const { gridUpper, gridLower } = params;
    if (gridUpper && gridLower) {
        if (signal === 'LONG') return 'ราคาแตะขอบล่างของกรอบ Grid (Mean Reversion Buy)';
        if (signal === 'SHORT') return 'ราคาแตะขอบบนของกรอบ Grid (Mean Reversion Sell)';
    }
    return `เข้าตามกลยุทธ์ GRID (${signal})`;
  },

  /**
   * Diagnostic thought for GRID
   */
  getDiagnostic: (closes, params = {}) => {
    if (closes.length === 0) return "รอข้อมูลราคาล่าสุด...";
    const curr = closes.at(-1);
    const { gridUpper, gridLower, strategy } = params;
    
    const prefix = strategy === 'AI_GRID_SCALP' ? '⚡ [SCALP] ' 
                 : strategy === 'AI_GRID_SWING' ? '🏛️ [SWING] ' 
                 : '';

    if (gridUpper && gridLower) {
      const distLower = ((curr - gridLower) / gridLower * 100).toFixed(2);
      const distUpper = ((gridUpper - curr) / gridUpper * 100).toFixed(2);
      
      if (curr <= gridLower) return `${prefix}ราคา $${curr.toFixed(4)} แตะขอบล่าง ($${gridLower.toFixed(4)}) - รอจังหวะเด้งเพื่อเข้า LONG`;
      if (curr >= gridUpper) return `${prefix}ราคา $${curr.toFixed(4)} แตะขอบบน ($${gridUpper.toFixed(4)}) - รอจังหวะตบเพื่อเข้า SHORT`;
      
      return `${prefix}ราคา: $${curr.toFixed(4)} | ห่างขอบล่าง: ${distLower}% | ห่างขอบบน: ${distUpper}%`;
    }
    
    return `${prefix}กำลังคำนวณ Grid Baseline...`;
  }
};
