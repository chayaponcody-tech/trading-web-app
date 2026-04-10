# Implementation Plan: Backtest System

## Overview

ต่อยอด `Backtester.js` ที่มีอยู่แล้ว โดยเพิ่ม KlineFetcher, PythonStrategyClient, backtestRepository, backtestRoutes และ AnalyticsUtils enhancements พร้อม property-based tests ด้วย fast-check (16 properties)

## Tasks

- [x] 1. เพิ่ม Analytics functions ใน AnalyticsUtils (ถ้ายังไม่มี)
  - ตรวจสอบว่า `calculateSharpe`, `calculateMaxDrawdown`, `calculateProfitFactor`, `generateEquityCurve` มีอยู่แล้วใน `packages/shared/AnalyticsUtils.js` — ทุก function มีอยู่แล้วครบ ไม่ต้องเพิ่ม
  - ตรวจสอบว่า `generateEquityCurve` รองรับ `initialCapital` parameter และ sort by `exitTime` — ปัจจุบันรองรับแล้ว
  - Export ทุก function ให้ถูกต้อง
  - _Requirements: 3.1, 3.2_

- [x] 2. สร้าง KlineFetcher.js
  - [x] 2.1 สร้างไฟล์ `packages/bot-engine/src/KlineFetcher.js`
    - Implement `fetchKlines(exchange, symbol, interval, options)` ที่รับ `{ startDate, endDate, maxKlines = 1500 }`
    - แปลง startDate/endDate เป็น Unix timestamps
    - วนลูปเรียก `exchange.getKlines()` ด้วย endTime pagination จนครบ range หรือถึง maxKlines
    - Deduplicate โดยใช้ open timestamp (index 0) เป็น key ผ่าน Map
    - ถ้าไม่มี startDate/endDate ให้ดึง 500 klines ล่าสุด
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 2.2 Write property test: Property 1 — Kline Pagination Coverage
    - // Feature: backtest-system, Property 1: Kline Pagination Coverage
    - Generate random (startDate, endDate) pairs ด้วย fast-check, mock BinanceAdapter
    - Verify earliest kline open timestamp ≤ startDate และ latest ≥ endDate (within one interval)
    - **Validates: Requirements 1.1, 1.2, 1.3**

  - [x] 2.3 Write property test: Property 2 — Kline Deduplication
    - // Feature: backtest-system, Property 2: Kline Deduplication
    - Generate klines arrays ที่มี duplicate open timestamps ด้วย fast-check
    - Verify ว่าหลัง deduplication ทุก open timestamp ปรากฏ exactly once
    - **Validates: Requirements 1.5**

- [x] 3. สร้าง PythonStrategyClient.js
  - [x] 3.1 สร้างไฟล์ `packages/bot-engine/src/PythonStrategyClient.js`
    - Implement `getPythonSignal(strategyKey, window)` ที่รับ `{ closes, highs, lows, volumes, params, symbol }`
    - POST ไปยัง `http://strategy-ai:8000/strategy/analyze` พร้อม payload ครบถ้วน
    - ใช้ `Map` เป็น in-memory cache keyed by hash ของ `closes.slice(-50)` (JSON.stringify)
    - ถ้า strategy-ai ไม่ตอบสนอง → throw Error เพื่อ abort backtest
    - Return `'LONG' | 'SHORT' | 'NONE'` จาก response
    - _Requirements: 6.2, 6.3, 6.4, 6.5_

  - [x] 3.2 Write property test: Property 12 — Python Strategy Payload Integrity
    - // Feature: backtest-system, Property 12: Python Strategy Payload Integrity
    - Mock HTTP, capture requests ที่ส่งไปยัง strategy-ai
    - Verify payload มีครบทุก field: `symbol`, `strategy`, `closes`, `highs`, `lows`, `volumes`, `params`
    - **Validates: Requirements 6.3**

  - [x] 3.3 Write property test: Property 13 — Python Strategy Response Caching
    - // Feature: backtest-system, Property 13: Python Strategy Response Caching (Idempotence)
    - Run backtest ที่มี repeated candle windows, verify HTTP call count == unique windows
    - **Validates: Requirements 6.5**

- [x] 4. สร้าง backtestRepository.js
  - [x] 4.1 สร้างไฟล์ `packages/data-layer/src/repositories/backtestRepository.js`
    - Import `db` จาก `DatabaseManager.js`
    - Implement `saveBacktestResult(result)` — INSERT into `backtest_results` + INSERT trades into `backtest_trades`
    - Implement `getBacktestHistory(limit = 50)` — SELECT summary (ไม่รวม trades) เรียงตาม createdAt DESC
    - Implement `getBacktestById(backtestId)` — SELECT full result + JOIN trades
    - สร้าง schema migration ใน `DatabaseManager.js` สำหรับ `backtest_results` และ `backtest_trades` tables
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 4.2 Write property test: Property 14 — Backtest Persistence Round-Trip
    - // Feature: backtest-system, Property 14: Backtest Persistence Round-Trip
    - Generate random BacktestResult objects ด้วย fast-check, save แล้ว fetch by ID
    - Verify `symbol`, `strategy`, `interval` และ metric values ตรงกัน
    - ใช้ in-memory SQLite สำหรับ test
    - **Validates: Requirements 7.1, 7.3, 7.4**

  - [x] 4.3 Write property test: Property 15 — History Summary Excludes Trades
    - // Feature: backtest-system, Property 15: History Summary Excludes Trades
    - Save หลาย results แล้วเรียก `getBacktestHistory()`
    - Verify ว่าไม่มี `trades` field ใน summary objects ใดๆ
    - **Validates: Requirements 7.5**

- [x] 5. Checkpoint — ทดสอบ KlineFetcher, PythonStrategyClient, backtestRepository
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. ต่อยอด Backtester.js
  - [x] 6.1 Refactor `packages/bot-engine/src/Backtester.js` ให้รองรับ async และ exchange parameter
    - เปลี่ยน `runBacktest(klines, config)` เป็น `async runBacktest(exchange, config)`
    - เรียก `fetchKlines` จาก KlineFetcher แทนการรับ klines โดยตรง
    - เพิ่ม `entryTime` (ISO 8601) ในแต่ละ trade โดยใช้ `klines[i][0]` ของ candle ที่เปิด position
    - เพิ่ม `pnlPct` ในแต่ละ trade
    - เพิ่มการหัก trading fee 0.04% ต่อ entry และ exit: `fee = positionSize × 0.0004`
    - เพิ่ม `exitReason` field (เปลี่ยนจาก `reason`)
    - _Requirements: 2.1, 2.2, 2.3, 2.7, 2.8, 8.1, 8.2, 8.3, 8.5_

  - [x] 6.2 เพิ่ม PYTHON: strategy support ใน Backtester.js
    - ตรวจสอบ strategy prefix "PYTHON:" — ถ้าใช่ เรียก `getPythonSignal` จาก PythonStrategyClient
    - ส่ง `{ closes, highs, lows, volumes, params, symbol }` ไปยัง PythonStrategyClient
    - ถ้า strategy-ai unavailable → return `{ error: "Strategy AI service unavailable" }`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 6.3 เพิ่ม comprehensive metrics calculation ใน Backtester.js
    - คำนวณ `sharpeRatio` ผ่าน `calculateSharpe(pnlList)`
    - คำนวณ `maxDrawdown` ผ่าน `calculateMaxDrawdown(equityValues)`
    - คำนวณ `profitFactor` ผ่าน `calculateProfitFactor(pnlList)`
    - คำนวณ `equityCurve` ผ่าน `generateEquityCurve(trades, capital)`
    - คำนวณ `avgWin`, `avgLoss`, `maxConsecutiveLosses`
    - เพิ่ม `backtestId` (UUID v4 ด้วย `crypto.randomUUID()`)
    - เพิ่ม `createdAt` (ISO 8601)
    - ถ้า totalTrades == 0 → return metrics ทั้งหมดเป็น 0, equityCurve เป็น []
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 6.4 Implement `runBacktestCompare(exchange, configs)`
    - รัน `runBacktest` แต่ละ config แบบ parallel (Promise.allSettled)
    - เพิ่ม `configLabel` format: `{strategy}-{interval}-{tpPercent}/{slPercent}`
    - Sort results by `totalPnl` descending, เพิ่ม `rank` field (1-based)
    - ถ้า config ใดล้มเหลว → ใส่ `error` field แต่ยังคืน results ที่เหลือ
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 6.5 เพิ่ม persistence ใน Backtester.js
    - เรียก `saveBacktestResult(result)` จาก backtestRepository หลัง backtest สำเร็จ
    - ถ้า DB write ล้มเหลว → log warning แต่ยังคืน BacktestResult (ไม่ block response)
    - _Requirements: 7.1, 7.4_

  - [x] 6.6 Write property test: Property 3 — Trade Record Completeness
    - // Feature: backtest-system, Property 3: Trade Record Completeness
    - Generate random configs ด้วย fast-check, run simulation ด้วย synthetic klines
    - Verify ทุก trade มีครบ: `entryPrice`, `exitPrice`, `entryTime`, `exitTime`, `type`, `pnl`, `pnlPct`, `exitReason`
    - **Validates: Requirements 2.7**

  - [x] 6.7 Write property test: Property 4 — TP/SL Exit Correctness
    - // Feature: backtest-system, Property 4: TP/SL Exit Correctness
    - Generate random entry/tp/sl values, construct synthetic klines ที่ trigger TP หรือ SL
    - Verify `exitReason` ถูกต้อง และ `pnl` สอดคล้องกับ formula `pnlPct/100 × capital × leverage - fees`
    - **Validates: Requirements 2.4, 2.5, 2.8, 8.5**

  - [x] 6.8 Write property test: Property 5 — Signal Flip Exit
    - // Feature: backtest-system, Property 5: Signal Flip Exit
    - Construct klines ที่ trigger signal flip (LONG → SHORT หรือ SHORT → LONG)
    - Verify `exitReason == "Signal Flipped"` และ position ถูกปิดก่อนเปิดใหม่
    - **Validates: Requirements 2.6**

  - [x] 6.9 Write property test: Property 6 — No Overlapping Positions
    - // Feature: backtest-system, Property 6: No Overlapping Positions
    - Run backtest ด้วย random configs, verify ว่า entryTime ของ trade N+1 >= exitTime ของ trade N
    - **Validates: Requirements 8.4**

  - [x] 6.10 Write property test: Property 7 — No Look-Ahead Bias
    - // Feature: backtest-system, Property 7: No Look-Ahead Bias
    - Instrument `computeSignal` ด้วย spy, verify closes.length == i สำหรับทุก call ที่ candle index i
    - **Validates: Requirements 8.1**

  - [x] 6.11 Write property test: Property 8 — Metrics Completeness
    - // Feature: backtest-system, Property 8: Metrics Completeness
    - Generate random configs ด้วย fast-check, verify result มีครบทุก metric field และเป็น numeric
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [x] 6.12 Write property test: Property 9 — Equity Curve Consistency
    - // Feature: backtest-system, Property 9: Equity Curve Consistency
    - Verify `equityCurve[0].value == initialCapital` และ last value ≈ finalCapital (floating-point tolerance)
    - **Validates: Requirements 3.2**

  - [x] 6.13 Write property test: Property 10 — Compare Sort Order
    - // Feature: backtest-system, Property 10: Compare Sort Order
    - Generate random result sets ด้วย fast-check, verify sort by totalPnl DESC และ rank field ถูกต้อง
    - **Validates: Requirements 5.2, 5.3**

  - [x] 6.14 Write property test: Property 11 — ConfigLabel Format
    - // Feature: backtest-system, Property 11: ConfigLabel Format
    - Generate random BacktestConfigs, verify configLabel matches `{strategy}-{interval}-{tpPercent}/{slPercent}`
    - **Validates: Requirements 5.4**

- [x] 7. Checkpoint — ทดสอบ Backtester ทั้งหมด
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. สร้าง backtestRoutes.js และ wire เข้า server
  - [x] 8.1 สร้างไฟล์ `packages/api-gateway/src/routes/backtestRoutes.js`
    - Implement `createBacktestRoutes(exchange)` ที่ return Express Router
    - `POST /run` — validate required fields (symbol, strategy, interval) → เรียก `runBacktest` → return result
    - `POST /compare` — validate max 10 configs → เรียก `runBacktestCompare` → return results
    - `GET /history` — เรียก `getBacktestHistory()` → return array
    - `GET /history/:backtestId` — เรียก `getBacktestById()` → return full result หรือ 404
    - Error handling: 400 สำหรับ missing fields, 503 สำหรับ exchange unavailable
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 4.7, 7.2, 7.3, 7.6_

  - [x] 8.2 Register backtestRoutes ใน `packages/api-gateway/src/server.js`
    - Import `createBacktestRoutes` และ mount ที่ `/api/backtest`
    - ลบ legacy `app.get('/api/backtest', ...)` proxy endpoint ออก (แทนที่ด้วย routes ใหม่)
    - _Requirements: 4.1, 4.6_

  - [x] 8.3 Write property test: Property 16 — API Validation Rejects Incomplete Requests
    - // Feature: backtest-system, Property 16: API Validation Rejects Incomplete Requests
    - Generate POST requests ที่ขาด field ใดๆ จาก `symbol`, `strategy`, `interval` ด้วย fast-check
    - Verify response เป็น HTTP 400 พร้อม descriptive error message
    - **Validates: Requirements 4.2, 4.3**

- [x] 9. Integration Tests
  - [x] 9.1 Write integration test: POST /api/backtest/run end-to-end
    - Mock BinanceAdapter ด้วย synthetic klines
    - POST /api/backtest/run พร้อม valid config → verify response shape ครบถ้วน (BacktestResult)
    - Verify result ถูก save ลง DB และ GET /api/backtest/history คืน entry นั้น
    - _Requirements: 4.1, 7.1, 7.2_

  - [x] 9.2 Write integration test: POST /api/backtest/compare
    - ส่ง 3 configs ที่แตกต่างกัน → verify results sorted by totalPnl, rank field ถูกต้อง
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 9.3 Write integration test: PYTHON: strategy flow
    - Mock strategy-ai HTTP endpoint
    - Run backtest ด้วย "PYTHON:bollinger_breakout" → verify PythonStrategyClient ถูกเรียก
    - Verify caching: same window ไม่ถูก call ซ้ำ
    - _Requirements: 6.1, 6.2, 6.5_

- [x] 10. Final Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks ที่มี `*` เป็น optional สามารถข้ามได้สำหรับ MVP
- Property tests ทุกตัวต้องมี comment tag: `// Feature: backtest-system, Property N: <property_text>`
- Property tests ใช้ fast-check minimum 100 iterations per property
- `BinanceAdapter.getKlines()` ปัจจุบันไม่รองรับ `since`/`endTime` parameter — KlineFetcher ต้องใช้ CCXT `fetchOHLCV` ที่รองรับ `since` parameter โดยตรง หรือ extend BinanceAdapter
- UUID v4 ใช้ `crypto.randomUUID()` (Node.js built-in, ไม่ต้อง install package เพิ่ม)
- ไฟล์ test ควรอยู่ใน `packages/bot-engine/src/tests/` สำหรับ Backtester/KlineFetcher/PythonStrategyClient และ `packages/data-layer/src/tests/` สำหรับ repository tests
