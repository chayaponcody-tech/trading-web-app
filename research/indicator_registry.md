---
tags: [technical, indicator, registry]
---
# Technical Indicator Registry

ศูนย์กลางการจัดเก็บสูตรและการคำนวณทางเทคนิคที่แชร์กันทั่วทั้งระบบ ผ่าน `packages/shared/indicators.js`

## 1. Trend Indicators (ดัชนีวัดแนวโน้ม)

### EMA (Exponential Moving Average)
- **ID**: `emaCalc`
- **Purpose**: ให้ค่าเฉลี่ยราคาที่ให้น้ำหนักกับราคาปัจจุบันมากกว่าแบบปกติ
- **Formula**: `EMA = Price(t) * k + EMA(y) * (1 – k)` โดยที่ `k = 2 / (n + 1)`

### VWAP (Volume Weighted Average Price)
- **Purpose**: ราคาเฉลี่ยที่ถ่วงน้ำหนักด้วยวอลุ่ม เพื่อหาต้นทุนเฉลี่ยของตลาด

## 2. Momentum Indicators (ดัชนีวัดแรงส่ง)

### RSI (Relative Strength Index)
- **ID**: `rsiCalc`
- **Purpose**: วัดความเร็วและการเปลี่ยนแปลงของการเคลื่อนที่ของราคา
- **Standard**: Wilder's Smoothing (14 periods)

### StochRSI
- **ID**: `stochRSI` (via Python)
- **Purpose**: นำ RSI มาคำนวณ Stochastic อีกชั้นเพื่อเพิ่มความไว

## 3. Volatility Indicators (ดัชนีวัดความผันผวน)

### Bollinger Bands
- **ID**: `bbCalc`
- **Purpose**: วัดกรอบการเคลื่อนที่ของราคา
- **Formula**: `Middle(SMA), Upper(SMA + 2SD), Lower(SMA - 2SD)`

### ATR (Average True Range)
- **ID**: `computeATR`
- **Purpose**: วัดความผันผวนเป็นค่าเงินจริง (Volatility in Price Units)
- **Usage**: ใช้ในการคำนวณ Dynamic TP/SL และ Volatility-based Position Sizing

## 4. Volume Indicators

### MFI (Money Flow Index)
- **ID**: `mfiCalc`
- **Purpose**: "Volume-weighted RSI" เพื่อดูแรงซื้อขายที่แท้จริง

---
*อัปเดตล่าสุด: 2026-04-17*
