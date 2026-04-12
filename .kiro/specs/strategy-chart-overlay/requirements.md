# Requirements Document

## Introduction

Feature นี้เพิ่มความสามารถให้ backtest chart แสดง indicator overlay บน candlestick chart ตามกลยุทธ์ที่เลือก เช่นเดียวกับ TradingView โดยระบบจะแสดงเส้น EMA, Bollinger Bands, entry/exit signals พร้อม label, TP/SL levels เป็นเส้นแนวนอน และ metrics panel ด้านข้าง ทั้งหมดนี้ถูก render บน lightweight-charts ที่มีอยู่แล้วใน Backtest.tsx

## Glossary

- **Chart_Overlay**: เลเยอร์ที่วาดทับบน candlestick chart หลัก เช่น เส้น EMA, Bollinger Bands
- **Indicator_Series**: ชุดข้อมูล time-series ที่คำนวณจาก indicator แต่ละตัว (EMA20, EMA50, BB Upper/Middle/Lower)
- **Overlay_Data**: ข้อมูล indicator ที่ backend คำนวณและส่งกลับมาพร้อมกับ backtest result
- **Entry_Signal_Marker**: marker บน chart ที่แสดงจุด entry พร้อม label เช่น "BUY 22", "SELL 18"
- **TP_Level_Line**: เส้นแนวนอนบน chart แสดง Take Profit level พร้อม label เช่น "TP1 / 82.68"
- **SL_Level_Line**: เส้นแนวนอนบน chart แสดง Stop Loss level พร้อม label เช่น "SL / 79.44"
- **Metrics_Panel**: panel ด้านขวาของ chart แสดง Win Rate, Avg R, Streak Win, All-Time W/L
- **Backtester**: backend module ที่รัน backtest simulation และคืนค่า trades[], equityCurve[], metrics
- **Strategy_Registry**: registry ใน SignalEngine.js ที่เก็บ strategy แต่ละตัว (EMA, RSI, BB, ฯลฯ)
- **Candle_Chart**: lightweight-charts CandlestickSeries ที่แสดงอยู่ใน Backtest.tsx
- **Overlay_Renderer**: frontend component ที่รับ Overlay_Data และ render เป็น series บน Candle_Chart

---

## Requirements

### Requirement 1: Backend คำนวณและส่ง Indicator Overlay Data

**User Story:** As a trader, I want the backtest API to return indicator values alongside trade results, so that I can see the indicators that drove each signal on the chart.

#### Acceptance Criteria

1. WHEN a backtest run completes, THE Backtester SHALL include an `overlayData` field in the response containing per-candle indicator values for the selected strategy
2. THE Backtester SHALL compute `overlayData` using the same closes/highs/lows arrays used during signal computation, with no look-ahead bias
3. WHEN the strategy is `EMA` or `EMA_CROSS`, THE Backtester SHALL return `overlayData.ema20[]` and `overlayData.ema50[]` as arrays of `{ time: string, value: number }`
4. WHEN the strategy is `BB` or `BB_RSI`, THE Backtester SHALL return `overlayData.bbUpper[]`, `overlayData.bbMiddle[]`, and `overlayData.bbLower[]` as arrays of `{ time: string, value: number }`
5. WHEN the strategy is `RSI` or `EMA_RSI`, THE Backtester SHALL return `overlayData.rsi[]` as an array of `{ time: string, value: number }`
6. WHEN the strategy is `EMA_BB_RSI`, THE Backtester SHALL return all of `overlayData.ema20[]`, `overlayData.ema50[]`, `overlayData.bbUpper[]`, `overlayData.bbMiddle[]`, `overlayData.bbLower[]`, and `overlayData.rsi[]`
7. WHEN the strategy has no defined overlay (e.g., `GRID`, `AI_SCOUTER`), THE Backtester SHALL return `overlayData` as an empty object `{}`
8. IF the indicator computation fails for any reason, THEN THE Backtester SHALL return `overlayData` as an empty object `{}` and SHALL NOT fail the entire backtest

---

### Requirement 2: Backend เพิ่ม TP/SL Levels ใน Trade Data

**User Story:** As a trader, I want each trade to include the exact TP and SL price levels, so that I can visualize them as horizontal lines on the chart.

#### Acceptance Criteria

1. WHEN a trade entry is recorded, THE Backtester SHALL include `tpPrice` and `slPrice` fields in each trade object
2. THE Backtester SHALL compute `tpPrice` as `entryPrice * (1 + tpPercent/100)` for LONG trades and `entryPrice * (1 - tpPercent/100)` for SHORT trades
3. THE Backtester SHALL compute `slPrice` as `entryPrice * (1 - slPercent/100)` for LONG trades and `entryPrice * (1 + slPercent/100)` for SHORT trades
4. WHEN multi-TP is configured (tpPercent is an array), THE Backtester SHALL include `tp1Price`, `tp2Price`, `tp3Price` fields corresponding to each TP level
5. THE Backtester SHALL include `tpPrice` and `slPrice` in the TypeScript `Trade` interface in `backtestUtils.ts`

---

### Requirement 3: Frontend แสดง Indicator Overlay บน Candle Chart

**User Story:** As a trader, I want to see indicator lines (EMA, Bollinger Bands) drawn directly on the candlestick chart, so that I can visually understand why signals were generated.

#### Acceptance Criteria

1. WHEN `overlayData` is received from the API, THE Overlay_Renderer SHALL render each indicator series as a `LineSeries` on the Candle_Chart
2. THE Overlay_Renderer SHALL render `ema20` as a green line (`#0ecb81`) and `ema50` as an orange line (`#f6a609`) on the Candle_Chart
3. THE Overlay_Renderer SHALL render `bbUpper` and `bbLower` as dashed blue lines (`#2196f3`) and `bbMiddle` as a solid blue line on the Candle_Chart
4. WHEN the strategy changes or a new backtest runs, THE Overlay_Renderer SHALL remove all previous overlay series before rendering new ones
5. THE Overlay_Renderer SHALL apply the same UTC+7 time offset (`TZ_OFFSET = 7 * 3600`) used by the candlestick series to all overlay series data points
6. WHERE the user toggles the "Show Overlay" button, THE Overlay_Renderer SHALL show or hide all overlay series without removing them from the chart
7. WHEN `overlayData` is an empty object, THE Overlay_Renderer SHALL render no overlay series and SHALL NOT throw an error

---

### Requirement 4: Frontend แสดง Entry Signal Labels บน Chart

**User Story:** As a trader, I want to see entry signals labeled with trade number and direction on the chart, so that I can quickly identify each trade's entry point.

#### Acceptance Criteria

1. WHEN backtest trades are available, THE Overlay_Renderer SHALL render entry markers on the Candle_Chart with label text in the format `"BUY {n}"` for LONG trades and `"SELL {n}"` for SHORT trades, where `{n}` is the sequential trade number
2. THE Overlay_Renderer SHALL render BUY markers below the candle bar in green (`#0ecb81`) and SELL markers above the candle bar in red (`#f6465d`)
3. THE Overlay_Renderer SHALL render exit markers with label text matching the exit reason (`"TP"`, `"SL"`, or `"Flip"`)
4. WHEN `showMarkers` is false, THE Overlay_Renderer SHALL hide all entry/exit markers without clearing the stored marker data

---

### Requirement 5: Frontend แสดง TP/SL Level Lines บน Chart

**User Story:** As a trader, I want to see TP and SL price levels drawn as horizontal lines on the chart for the most recent trade, so that I can understand the risk/reward setup.

#### Acceptance Criteria

1. WHEN a backtest result is loaded, THE Overlay_Renderer SHALL render TP level(s) as horizontal price lines on the Candle_Chart with label text in the format `"TP / {price}"` (or `"TP1 / {price}"`, `"TP2 / {price}"`, `"TP3 / {price}"` for multi-TP)
2. THE Overlay_Renderer SHALL render the SL level as a horizontal price line with label text in the format `"SL / {price}"`
3. THE Overlay_Renderer SHALL render TP lines in green (`#0ecb81`) and SL lines in red (`#f6465d`)
4. THE Overlay_Renderer SHALL display TP/SL lines only for the last active or most recently closed trade
5. WHEN a new backtest runs, THE Overlay_Renderer SHALL remove all previous TP/SL lines before rendering new ones

---

### Requirement 6: Frontend แสดง Metrics Panel

**User Story:** As a trader, I want to see a summary metrics panel alongside the chart, so that I can quickly assess strategy performance without scrolling.

#### Acceptance Criteria

1. WHEN a backtest result is available, THE Metrics_Panel SHALL display Win Rate as a percentage with 1 decimal place
2. THE Metrics_Panel SHALL display Avg R (average reward-to-risk ratio) computed as `|avgWin / avgLoss|` rounded to 2 decimal places
3. THE Metrics_Panel SHALL display the current winning streak (consecutive winning trades from the most recent trade backwards)
4. THE Metrics_Panel SHALL display All-Time W/L as `"{winCount} / {lossCount}"`
5. WHEN no backtest result is available, THE Metrics_Panel SHALL display `"--"` for all metric values
6. THE Metrics_Panel SHALL update immediately after each backtest run completes

---

### Requirement 7: RSI แสดงใน Sub-Panel แยกต่างหาก

**User Story:** As a trader, I want RSI to be displayed in a separate sub-panel below the main chart, so that it doesn't clutter the price scale.

#### Acceptance Criteria

1. WHEN `overlayData.rsi` is present, THE Overlay_Renderer SHALL render RSI values in a separate `LineSeries` chart panel below the Candle_Chart
2. THE Overlay_Renderer SHALL render RSI overbought level (70) and oversold level (30) as horizontal reference lines in the RSI panel
3. THE Overlay_Renderer SHALL render the RSI line in purple (`#9c27b0`)
4. WHEN the strategy does not produce RSI data, THE Overlay_Renderer SHALL hide the RSI sub-panel
5. THE Overlay_Renderer SHALL synchronize the RSI panel's time scale with the Candle_Chart time scale

---

### Requirement 8: Overlay Toggle Controls

**User Story:** As a trader, I want to be able to toggle individual overlay elements on and off, so that I can focus on specific indicators without visual clutter.

#### Acceptance Criteria

1. THE Overlay_Renderer SHALL provide a toggle control for each active indicator overlay (EMA20, EMA50, BB, RSI)
2. WHEN a toggle is switched off, THE Overlay_Renderer SHALL hide the corresponding series without removing it from the chart
3. WHEN a toggle is switched on, THE Overlay_Renderer SHALL make the corresponding series visible again
4. THE Overlay_Renderer SHALL persist toggle states within the current browser session using component state
5. WHEN a new backtest runs with a different strategy, THE Overlay_Renderer SHALL reset all toggles to the "on" state
