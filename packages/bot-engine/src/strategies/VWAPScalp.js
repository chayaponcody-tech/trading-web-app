import { EMA, RSI } from 'technicalindicators';

/**
 * VWAP Scalp Strategy
 * เข้าเมื่อราคา retest VWAP พร้อม momentum confirm
 * ใช้ approximated VWAP จาก OHLCV (typical price * volume)
 * หากไม่มี volume ข้อมูล จะ fallback ใช้ EMA20 แทน
 */
export const VWAPScalpStrategy = {
  name: 'VWAP_SCALP',
  description: '📊 VWAP Scalp — Retest VWAP + Momentum',

  /**
   * @param {number[]} closes
   * @param {object} params
   * @param {number[]} [params.volumes] - volume array (optional)
   * @param {number[]} [params.highs]   - high array (optional)
   * @param {number[]} [params.lows]    - low array (optional)
   */
  compute: (closes, params = {}) => {
    const vwap = _calcVWAP(closes, params);
    const rsiValues = RSI.calculate({ period: params.rsiPeriod || 9, values: closes });

    if (!vwap || rsiValues.length < 2) return 'NONE';

    const price = closes.at(-1);
    const prevPrice = closes.at(-2);
    const rsi = rsiValues.at(-1);
    const prevRsi = rsiValues.at(-2);

    const touchedBelow = prevPrice < vwap && price >= vwap;  // retest จากล่าง
    const touchedAbove = prevPrice > vwap && price <= vwap;  // retest จากบน

    // เข้า LONG: ราคากลับขึ้นเหนือ VWAP + RSI momentum ขาขึ้น
    if (touchedBelow && rsi > prevRsi && rsi < 65) return 'LONG';
    // เข้า SHORT: ราคาหลุดใต้ VWAP + RSI momentum ขาลง
    if (touchedAbove && rsi < prevRsi && rsi > 35) return 'SHORT';

    return 'NONE';
  },

  describe: (signal, params = {}, closes = []) => {
    const vwap = _calcVWAP(closes, params);
    const v = vwap?.toFixed(4) ?? '?';
    if (signal === 'LONG') return `📊 ราคา Retest VWAP (${v}) จากด้านล่าง + RSI momentum ขาขึ้น`;
    if (signal === 'SHORT') return `📊 ราคา Retest VWAP (${v}) จากด้านบน + RSI momentum ขาลง`;
    return '';
  },

  getDiagnostic: (closes, params = {}) => {
    const vwap = _calcVWAP(closes, params);
    if (!vwap) return 'กำลังคำนวณ VWAP...';

    const price = closes.at(-1);
    const diff = ((price - vwap) / vwap * 100).toFixed(3);
    const pos = price > vwap ? 'เหนือ VWAP' : 'ใต้ VWAP';

    return `ราคา: ${price?.toFixed(4)} | VWAP: ${vwap?.toFixed(4)} | ${pos} (${diff}%) — รอ Retest`;
  }
};

// ─── Internal VWAP Calculator ─────────────────────────────────────────────────

function _calcVWAP(closes, params = {}) {
  const { volumes, highs, lows } = params;

  // Full VWAP ถ้ามี volume + high + low
  if (volumes?.length && highs?.length && lows?.length) {
    const len = Math.min(closes.length, volumes.length, highs.length, lows.length);
    let cumPV = 0, cumV = 0;
    for (let i = 0; i < len; i++) {
      const typical = (highs[i] + lows[i] + closes[i]) / 3;
      cumPV += typical * volumes[i];
      cumV += volumes[i];
    }
    return cumV > 0 ? cumPV / cumV : null;
  }

  // Fallback: EMA20 เป็น proxy ของ VWAP
  const ema = EMA.calculate({ period: params.emaPeriod || 20, values: closes });
  return ema.length ? ema.at(-1) : null;
}
