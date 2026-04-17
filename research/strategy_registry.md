---
tags: [strategy, quant, registry]
---
# Strategy Registry

เอกสารรวบรวมกลยุทธ์ (Strategies) ทั้งหมดที่มีในระบบ CryptoSmartTrade ทั้งในฝั่ง JavaScript (Bot Engine) และ Python (Strategy AI)

## 1. JavaScript Native Strategies
กลยุทธ์พื้นฐานที่รันบน `bot-engine` โดยตรง เน้นความเร็วและใช้ทรัพยากรน้อย

| Key | Description | Parameters |
|---|---|---|
| `EMA_CROSS` | ตัดกันของ EMA Fast/Slow (Golden/Death Cross) | `emaFast`, `emaSlow` |
| `RSI` | เข้าซื้อเมื่อ RSI Oversold และขายเมื่อ Overbought | `rsiPeriod`, `oversold`, `overbought` |
| `BB` | Bollinger Bands Mean Reversion | `bbPeriod`, `bbStdDev` |
| `GRID` | วางไม้ Buy/Sell ในช่วงราคาที่กำหนด (Static Range) | `gridUpper`, `gridLower`, `gridLayers` |

## 2. Python Advanced Strategies
กลยุทธ์ที่รันบน `strategy-ai` (FastAPI) รองรับ vectorized calculation และ Deep Analysis

| Key | Description | Note |
|---|---|---|
| `SATS` | **Self-Aware Trend System**: ระบบตรวจจับเทรนด์อัจฉริยะ | แนะนำ |
| `EMA_SCALP` | กลยุทธ์ Scalping ระยะสั้น 5m/15m | |
| `STOCH_RSI` | ใช้ Stochastic RSI ในการหาจุดกลับตัวที่แม่นยำขึ้น | |
| `VWAP_SCALP` | ใช้ดัชนีราคาถ่วงน้ำหนักด้วยวอลุ่ม (VWAP) | |
| `OI_FUNDING_ALPHA`| วิเคราะห์สถานะคงค้าง (OI) และค่า Funding เพื่อขี่เทรนด์ใหญ่ | High Alpha |

## 3. Composite Strategies (Hybrid)
กลยุทธ์ที่รวมอินดิเคเตอร์หลายตัวเข้าด้วยกันเพื่อลด False Signals

| Key | Combo | logic |
|---|---|---|
| `EMA_RSI` | EMA + RSI | Trend Confirm + Momentum |
| `BB_RSI` | BB + RSI | Mean Reversion + OS/OB Confirm |
| `EMA_BB_RSI` | EMA + BB + RSI | Full Trend & Volatility Filter |

---
*อัปเดตล่าสุด: 2026-04-17*
