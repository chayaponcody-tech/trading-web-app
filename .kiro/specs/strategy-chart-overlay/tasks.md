# Implementation Plan: Strategy Chart Overlay

## Overview

เพิ่ม indicator overlay layer บน backtest chart โดยแบ่งงานออกเป็น 4 ส่วนหลัก: (1) backend คำนวณ overlayData และ tpPrice/slPrice, (2) frontend utility functions และ types, (3) OverlayRenderer + MetricsPanel components, (4) RSI sub-panel และ integration ใน Backtest.tsx

## Tasks

- [x] 1. Backend: เพิ่ม `computeOverlayData` และ tpPrice/slPrice ใน Backtester.js
  - [x] 1.1 เพิ่ม function `computeOverlayData(closes, times, strategy)` ใน `packages/bot-engine/src/Backtester.js`
    - Import `emaCalc`, `rsiCalc`, `bbCalc` จาก `backend/utils/indicators.js`
    - Map strategy → indicators ตาม strategy mapping table ในเอกสาร design
    - EMA/EMA_CROSS/EMA_CROSS_V2 → ema20, ema50
    - BB/BB_RSI → bbUpper, bbMiddle, bbLower
    - RSI/RSI_TREND/EMA_RSI → rsi
    - EMA_BB_RSI → ema20, ema50, bbUpper, bbMiddle, bbLower, rsi
    - GRID/AI_SCOUTER/others → return `{}`
    - Wrap ทั้งหมดใน try/catch → return `{}` เมื่อ error
    - แต่ละ data point มี shape `{ time: string (ISO 8601), value: number }`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [x] 1.2 เพิ่ม `tpPrice` และ `slPrice` ใน trade objects ภายใน `runBacktest`
    - LONG: `tpPrice = entryPrice * (1 + tpPercent/100)`, `slPrice = entryPrice * (1 - slPercent/100)`
    - SHORT: `tpPrice = entryPrice * (1 - tpPercent/100)`, `slPrice = entryPrice * (1 + slPercent/100)`
    - เพิ่มใน `trades.push({...})` block ทั้งสองที่ (in-position exit)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 1.3 เรียก `computeOverlayData` และเพิ่ม `overlayData` ใน backtest result
    - เรียก `computeOverlayData(closes, klines.map(k => new Date(k[0]).toISOString()), strategy)` หลัง simulation loop
    - เพิ่ม `overlayData` ใน result object ทั้ง zero-trade case และ normal case
    - _Requirements: 1.1_

  - [x] 1.4 Write property tests สำหรับ `computeOverlayData` และ tpPrice/slPrice
    - **Property 1: overlayData always present in backtest result**
    - **Validates: Requirements 1.1, 1.7, 1.8**
    - **Property 2: Strategy-to-overlay mapping correctness**
    - **Validates: Requirements 1.3, 1.4, 1.5, 1.6**
    - **Property 3: TP/SL price formula correctness**
    - **Validates: Requirements 2.1, 2.2, 2.3**
    - **Property 4: All trades have tpPrice and slPrice**
    - **Validates: Requirements 2.1**
    - ใช้ fast-check, สร้าง `arbBacktestConfig()` และ `arbTrade()` generators
    - เพิ่มใน `packages/bot-engine/src/tests/backtester.test.js`

- [x] 2. Frontend: อัปเดต types และ utility functions ใน `src/utils/backtestUtils.ts`
  - [x] 2.1 เพิ่ม types และ interfaces ใหม่
    - เพิ่ม `tpPrice: number` และ `slPrice: number` ใน `Trade` interface
    - เพิ่ม `OverlayDataPoint`, `OverlayData`, `OverlayToggleState` interfaces
    - เพิ่ม `overlayData: OverlayData` ใน `BacktestResult` interface
    - เพิ่ม `OVERLAY_COLORS` constant object
    - _Requirements: 2.5, 3.1_

  - [x] 2.2 อัปเดต `buildMarkersFromTrades` ให้ใช้ sequential labels และ TZ_OFFSET
    - เปลี่ยน entry marker text จาก `trade.type` เป็น `"BUY {n}"` / `"SELL {n}"` (1-based index)
    - เพิ่ม TZ_OFFSET ให้ทั้ง entryTs และ exitTs (เหมือน `convertEquityCurve`)
    - BUY markers: `position: 'belowBar'`, color `#0ecb81`
    - SELL markers: `position: 'aboveBar'`, color `#f6465d`
    - Exit marker text = `trade.exitReason`
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 2.3 เพิ่ม utility functions ใหม่
    - `computeWinStreak(trades: Trade[]): number` — นับ consecutive wins จาก trade ล่าสุดย้อนหลัง
    - `computeAvgR(avgWin: number, avgLoss: number): number` — return `Math.abs(avgWin / avgLoss)` หรือ `0` เมื่อ avgLoss === 0
    - `formatWL(trades: Trade[]): string` — return `"{winCount} / {lossCount}"`
    - `formatWinRate(winRate: number): string` — return `"{winRate.toFixed(1)}%"`
    - `convertOverlayData(points: OverlayDataPoint[]): { time: Time; value: number }[]` — แปลง ISO time + TZ_OFFSET
    - _Requirements: 6.2, 6.3, 6.4_

  - [x] 2.4 Write property tests สำหรับ utility functions ใน `src/utils/backtestUtils.test.ts`
    - **Property 5: Overlay time offset correctness**
    - **Validates: Requirements 3.5**
    - **Property 6: Entry marker label format**
    - **Validates: Requirements 4.1, 4.2**
    - **Property 7: Exit marker label matches exit reason**
    - **Validates: Requirements 4.3**
    - **Property 8: TP/SL line label format**
    - **Validates: Requirements 5.1, 5.2**
    - **Property 9: Metrics computation correctness**
    - **Validates: Requirements 6.2, 6.3, 6.4**
    - ใช้ fast-check, สร้าง `arbTrade()`, `arbTradeArray()`, `arbOverlayDataPoint()` generators

- [x] 3. Checkpoint — ตรวจสอบ backend และ utility layer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Frontend: สร้าง `OverlayRenderer` component
  - [x] 4.1 สร้างไฟล์ `src/components/OverlayRenderer.tsx`
    - Non-rendering component (returns null)
    - รับ props: `chart`, `candleSeries`, `overlayData`, `trades`, `strategy`, `showMarkers`, `toggleStates`, `onToggleChange`
    - เก็บ series refs ใน `useRef` map (`ema20SeriesRef`, `ema50SeriesRef`, `bbUpperRef`, `bbMiddleRef`, `bbLowerRef`)
    - เก็บ price line refs สำหรับ TP/SL
    - _Requirements: 3.1, 3.4_

  - [x] 4.2 Implement indicator series lifecycle (EMA และ BB lines)
    - `useEffect` ที่ depend on `overlayData`, `strategy`, `chart`
    - Cleanup series เก่าก่อน render ใหม่ทุกครั้ง (guard: `if (!chart) return`)
    - `chart.addSeries(LineSeries, { color, lineWidth: 2 })` สำหรับ ema20, ema50
    - `chart.addSeries(LineSeries, { color, lineStyle: LineStyle.Dashed })` สำหรับ bbUpper, bbLower
    - ใช้ `convertOverlayData` จาก backtestUtils สำหรับ time conversion
    - Apply `series.applyOptions({ visible: toggleStates[key] })` ตาม toggle state
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6, 3.7_

  - [x] 4.3 Implement TP/SL price lines
    - `useEffect` ที่ depend on `trades`, `candleSeries`
    - Remove price lines เก่าก่อน render ใหม่
    - แสดงเฉพาะ trade ล่าสุด (`trades[trades.length - 1]`)
    - `candleSeries.createPriceLine({ price: tpPrice, color: '#0ecb81', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'TP / {tpPrice.toFixed(2)}' })`
    - `candleSeries.createPriceLine({ price: slPrice, color: '#f6465d', ... title: 'SL / {slPrice.toFixed(2)}' })`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 4.4 Implement toggle controls rendering
    - Export `OverlayToggleControls` component แยกจาก `OverlayRenderer.tsx`
    - แสดง toggle button สำหรับแต่ละ indicator ที่มีข้อมูลใน `overlayData`
    - Toggle off → `series.applyOptions({ visible: false })`
    - Toggle on → `series.applyOptions({ visible: true })`
    - Reset toggles เป็น `true` ทั้งหมดเมื่อ strategy เปลี่ยน
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 5. Frontend: สร้าง `MetricsPanel` component
  - [x] 5.1 สร้างไฟล์ `src/components/MetricsPanel.tsx`
    - รับ props: `trades: Trade[]`, `avgWin: number`, `avgLoss: number`
    - แสดง Win Rate (`formatWinRate`), Avg R (`computeAvgR`), Streak Win (`computeWinStreak`), All-Time W/L (`formatWL`)
    - แสดง `"--"` สำหรับทุก metric เมื่อ `trades.length === 0`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 6. Frontend: RSI Sub-Panel
  - [x] 6.1 เพิ่ม RSI chart container ใน `Backtest.tsx`
    - เพิ่ม `rsiChartContainerRef` และ `rsiChartRef` refs
    - สร้าง RSI chart instance ใน `useEffect` เดียวกับ candle chart
    - RSI chart มี height 120px, แสดงเฉพาะเมื่อ `overlayData?.rsi` มีข้อมูล (`display: overlayData?.rsi ? 'block' : 'none'`)
    - _Requirements: 7.1, 7.4_

  - [x] 6.2 Implement RSI series และ reference lines ใน `OverlayRenderer`
    - เพิ่ม `rsiChartRef` prop ใน `OverlayRendererProps`
    - `rsiChartRef.current.addSeries(LineSeries, { color: '#9c27b0', lineWidth: 1 })` สำหรับ RSI line
    - เพิ่ม horizontal reference lines ที่ 70 (overbought) และ 30 (oversold) ด้วย `createPriceLine`
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 6.3 Sync RSI time scale กับ candle chart
    - ใช้ `subscribeVisibleTimeRangeChange` pattern เดิมที่มีอยู่ใน Backtest.tsx
    - Sync สองทิศทาง: candle → RSI และ RSI → candle
    - _Requirements: 7.5_

- [x] 7. Integration: เชื่อม components เข้ากับ `Backtest.tsx`
  - [x] 7.1 เพิ่ม state และ refs ที่จำเป็น
    - เพิ่ม `overlayData` state (`useState<OverlayData>({})`)
    - เพิ่ม `toggleStates` state (`useState<OverlayToggleState>({ ema20: true, ema50: true, bb: true, rsi: true })`)
    - เพิ่ม `showOverlay` state
    - Reset `overlayData` และ `toggleStates` ใน `runBacktest` ก่อน fetch
    - Set `overlayData` จาก `result.overlayData` หลัง fetch สำเร็จ
    - _Requirements: 3.4, 8.5_

  - [x] 7.2 Mount `OverlayRenderer` และ `OverlayToggleControls` ใน JSX
    - เพิ่ม `<OverlayRenderer>` ใน charts tab โดยส่ง `chart={candleChartRef.current}`, `candleSeries={candleSeriesRef.current}`, `overlayData`, `trades`, `strategy`, `showMarkers`, `toggleStates`, `onToggleChange`, `rsiChartRef`
    - เพิ่ม `<OverlayToggleControls>` ใน Market panel header (ข้างปุ่ม Hide Markers)
    - _Requirements: 3.1, 8.1_

  - [x] 7.3 Mount `MetricsPanel` ใน stats section
    - เพิ่ม `<MetricsPanel trades={backtestResult?.trades ?? []} avgWin={backtestResult?.avgWin ?? 0} avgLoss={backtestResult?.avgLoss ?? 0} />` ใน stats grid
    - _Requirements: 6.1, 6.5, 6.6_

  - [x] 7.4 Mount RSI sub-panel container ใน charts tab
    - เพิ่ม RSI chart container div ใต้ Market panel
    - ใช้ `rsiChartContainerRef` และ conditional display
    - _Requirements: 7.1, 7.4_

- [x] 8. Final Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Property tests ใช้ fast-check (JavaScript PBT library), minimum 100 iterations ต่อ property
- `OverlayRenderer` เป็น non-rendering component (returns null) — ไม่มี JSX output
- `OverlayToggleControls` เป็น separate export จากไฟล์เดียวกัน
- TZ_OFFSET = 7 * 3600 ต้องใช้กับทุก time conversion ใน overlay data
- Cleanup series เก่าก่อน render ใหม่ทุกครั้งเพื่อป้องกัน memory leak
