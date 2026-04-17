# แผนการ Implementation: Strategy Management พร้อม Backtest

## ภาพรวม

แผนนี้แบ่งการพัฒนาออกเป็น 6 กลุ่มหลัก ได้แก่ Data Layer, Backend API, Backtest Services, Frontend Pages/Components, Sidebar Integration และ Integration Testing โดยแต่ละขั้นตอนต่อยอดจากขั้นก่อนหน้าและสิ้นสุดด้วยการเชื่อมต่อทุกส่วนเข้าด้วยกัน

## Tasks

- [x] 1. สร้าง Data Layer — ตารางและ Repository

  - [x] 1.1 สร้าง migration สำหรับตาราง `strategy_definitions` และ `strategy_backtest_results`
    - เพิ่ม SQL `CREATE TABLE IF NOT EXISTS` ทั้งสองตารางพร้อม indexes ใน `packages/data-layer/src/DatabaseManager.js`
    - ตาราง `strategy_definitions`: id (UUID PK), name (UNIQUE), description, engineType, defaultParams (JSON), tags (JSON), createdAt, updatedAt
    - ตาราง `strategy_backtest_results`: backtestId (UUID PK), strategyId (FK), backtestType, symbols (JSON), interval, config (JSON), summaryMetrics (JSON), assetResults (JSON), createdAt
    - _Requirements: 1.1, 6.2_

  - [x] 1.2 สร้าง `packages/data-layer/src/repositories/strategyRepository.js`
    - Implement functions: `createStrategy`, `getStrategyById`, `getAllStrategies`, `updateStrategy`, `deleteStrategy`, `strategyNameExists`
    - `getAllStrategies` รองรับ optional filter ตาม `engineType` หรือ `tags` และเรียงตาม `updatedAt DESC`
    - `updateStrategy` อัปเดตเฉพาะ fields ที่ส่งมาและ set `updatedAt` เป็นเวลาปัจจุบัน
    - _Requirements: 1.1, 1.4, 1.7, 1.8_

  - [x] 1.3 เพิ่ม backtest result functions ใน `strategyRepository.js`
    - Implement functions: `saveStrategyBacktestResult`, `getStrategyBacktestHistory`, `getStrategyBacktestById`
    - `getStrategyBacktestHistory` ส่งคืนสูงสุด 20 รายการล่าสุด ไม่รวม full `assetResults` array
    - `getStrategyBacktestById` ส่งคืน full detail รวม `assetResults`
    - _Requirements: 6.1, 6.2, 6.3, 6.6_

  - [x] 1.4 เขียน property test สำหรับ strategyRepository
    - **Property 1: Strategy Definition Round-Trip** — สร้าง strategy แล้วดึงกลับด้วย id เดิม ต้องได้ object เหมือนกันทุก field
    - **Validates: Requirements 1.1, 2.1**
    - **Property 2: Duplicate Name Rejection** — สร้าง strategy ด้วย name ซ้ำต้องถูก reject เสมอ
    - **Validates: Requirements 1.2**
    - **Property 3: Partial Update Preserves Unchanged Fields** — update บาง fields ต้องไม่เปลี่ยน fields ที่ไม่ได้ส่งมา และ `updatedAt` ต้องมากกว่าหรือเท่ากับค่าเดิม
    - **Validates: Requirements 1.4**
    - **Property 4: Strategy List Ordering** — รายการที่ดึงมาต้องเรียงตาม `updatedAt` descending เสมอ
    - **Validates: Requirements 1.7**
    - **Property 5: Filter Returns Only Matching Strategies** — filter ด้วย engineType หรือ tag ต้องได้เฉพาะ strategies ที่ตรงกัน
    - **Validates: Requirements 1.8**
    - **Property 6: Non-Existent Strategy Returns 404** — GET strategy ด้วย UUID ที่ไม่มีต้องได้ null/undefined
    - **Validates: Requirements 2.5**
    - ใช้ `fast-check` minimum 100 iterations ต่อ property
    - สร้างไฟล์ `packages/data-layer/src/tests/strategyRepository.property.test.js`

- [x] 2. Checkpoint — ตรวจสอบ Data Layer
  - ตรวจสอบว่า migration รันได้ไม่มี error และ repository functions ทำงานถูกต้อง
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. สร้าง Backend — Backtest Service

  - [x] 3.1 สร้าง `packages/api-gateway/src/services/multiAssetBacktestService.js`
    - Implement `generateNonOverlappingWindows(lookbackYears, windowDays, numWindows)` — สุ่ม startDate ที่ไม่ overlap กัน, endDate ต้องไม่เกินวันปัจจุบัน
    - Implement `runMultiAssetBacktest(exchange, strategyDef, config)` — ใช้ `Promise.allSettled()` รัน Backtester.js แต่ละ symbol แบบ parallel, เรียง AssetResult ตาม `totalPnl` descending, กำหนด `rank`, คำนวณ summary metrics
    - Implement `runRandomWindowBacktest(exchange, strategyDef, config)` — generate windows แล้วรัน backtest แต่ละ (symbol, window) combination แบบ parallel, คำนวณ `consistencyScore`
    - _Requirements: 3.1, 3.4, 3.6, 3.7, 4.1, 4.5, 4.7, 4.8, 8.1_

  - [x] 3.2 เขียน property test สำหรับ multiAssetBacktestService
    - **Property 7: Multi-Asset Results Cover All Symbols** — จำนวน AssetResult ต้องเท่ากับจำนวน symbols ที่ส่งเข้ามาเสมอ
    - **Validates: Requirements 3.1, 3.5**
    - **Property 8: Multi-Asset Results Sorted by PnL** — AssetResult ที่สำเร็จต้องเรียงตาม `totalPnl` descending และ `rank` ต้องสอดคล้องกัน
    - **Validates: Requirements 3.4, 3.6**
    - **Property 9: Summary Metrics Consistency** — `avgWinRate` ต้องเท่ากับค่าเฉลี่ยของ winRate ที่สำเร็จ, `bestSymbol`/`worstSymbol` ต้องถูกต้อง
    - **Validates: Requirements 3.7, 8.1**
    - **Property 10: Random Windows Are Non-Overlapping** — ทุก pair ของ windows ต้องไม่ overlap กัน
    - **Validates: Requirements 4.5**
    - **Property 11: Consistency Score Matches Window Results** — `consistencyScore` ต้องเท่ากับ `count(pnl > 0) / windows.length`
    - **Validates: Requirements 4.7**
    - สร้างไฟล์ `packages/api-gateway/src/tests/multiAssetBacktestService.property.test.js`

  - [x] 3.3 เขียน property test สำหรับ Backtester determinism และ fee
    - **Property 12: Backtest Determinism** — รัน backtest สองครั้งด้วย config เดียวกันต้องได้ผลลัพธ์เหมือนกัน
    - **Validates: Requirements 7.7**
    - **Property 13: Fee Deduction Correctness** — pnl ของแต่ละ trade ต้องถูกหักค่าธรรมเนียม `2 × positionSize × 0.0004`
    - **Validates: Requirements 7.4**
    - เพิ่มใน `packages/bot-engine/src/tests/backtester.property.test.js`

- [x] 4. สร้าง Backend — Strategy Routes

  - [x] 4.1 สร้าง `packages/api-gateway/src/routes/strategyRoutes.js`
    - Implement CRUD routes: `GET /api/strategies`, `GET /api/strategies/:id`, `POST /api/strategies`, `PUT /api/strategies/:id`, `DELETE /api/strategies/:id`
    - Validation middleware สำหรับ POST: ตรวจสอบ `name` (ไม่ว่าง) และ `engineType` (`js` หรือ `python`) ส่งคืน HTTP 400 ถ้าขาด
    - ส่งคืน HTTP 201 เมื่อสร้างสำเร็จ, HTTP 409 เมื่อ name ซ้ำหรือลบ strategy ที่มี active bot, HTTP 404 เมื่อ id ไม่พบ
    - _Requirements: 1.2, 1.3, 1.5, 1.6, 2.5, 5.1, 5.3, 5.4, 5.5_

  - [x] 4.2 เพิ่ม backtest routes ใน `strategyRoutes.js`
    - Implement: `POST /api/strategies/:id/backtest/multi-asset`, `POST /api/strategies/:id/backtest/random-window`
    - Implement: `GET /api/strategies/:id/backtest/history`, `GET /api/strategies/:id/backtest/history/:btId`
    - Validation: `symbols` ไม่เกิน 20 → HTTP 400, `numWindows` ไม่เกิน 10 → HTTP 400
    - เรียก `multiAssetBacktestService` และบันทึกผลลัพธ์ผ่าน `strategyRepository.saveStrategyBacktestResult`
    - Response รวม `strategyName`, `strategyId`, `executionTimeMs`
    - _Requirements: 3.2, 3.3, 4.3, 4.4, 5.2, 5.6, 5.7, 6.4, 6.5, 8.3, 8.5_

  - [x] 4.3 Register `strategyRoutes` ใน `packages/api-gateway/src/server.js`
    - เพิ่ม `app.use('/api/strategies', strategyRoutes)` ใน server.js
    - _Requirements: 5.1, 5.2_

  - [x] 4.4 เขียน unit test สำหรับ strategyRoutes validation
    - ทดสอบ: POST ขาด `name` → 400, POST ขาด `engineType` → 400, POST `engineType` ไม่ถูกต้อง → 400
    - ทดสอบ: multi-asset `symbols` เกิน 20 → 400, random-window `numWindows` เกิน 10 → 400
    - ทดสอบ: GET strategy id ไม่พบ → 404, DELETE strategy ที่มี active bot → 409
    - สร้างไฟล์ `packages/api-gateway/src/tests/strategyRoutes.test.js`
    - _Requirements: 1.3, 1.6, 2.5, 3.3, 4.4, 5.3, 5.4_

- [x] 5. Checkpoint — ตรวจสอบ Backend API
  - ตรวจสอบว่า routes ทั้งหมดทำงานถูกต้อง validation ครบ และ backtest service integrate กับ Backtester.js ได้
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. สร้าง Frontend — TypeScript Types และ API Client

  - [x] 6.1 สร้าง TypeScript interfaces ใน `src/types/strategy.ts`
    - Define: `StrategyDefinition`, `AssetResult`, `MultiAssetBacktestResult`, `WindowResult`, `RandomWindowBacktestResult`
    - _Requirements: 1.1, 3.7, 4.6, 8.1, 8.2_

  - [x] 6.2 สร้าง API client functions ใน `src/api/strategyApi.ts`
    - Implement functions สำหรับ CRUD: `getStrategies`, `getStrategy`, `createStrategy`, `updateStrategy`, `deleteStrategy`
    - Implement functions สำหรับ backtest: `runMultiAssetBacktest`, `runRandomWindowBacktest`, `getBacktestHistory`, `getBacktestDetail`
    - _Requirements: 5.1, 5.2_

- [x] 7. สร้าง Frontend — Components

  - [x] 7.1 สร้าง `src/pages/StrategyManagement/StrategyForm.tsx`
    - Modal/panel สำหรับสร้างและแก้ไข strategy
    - Input fields: `name` (text), `description` (textarea), `engineType` (dropdown: js/python), `defaultParams` (JSON textarea), `tags` (tag input)
    - รองรับ create mode และ edit mode (pre-fill ข้อมูลเดิม)
    - แสดง inline validation errors และ loading state ระหว่าง submit
    - ใช้ CSS class เดียวกับหน้าอื่น (`glass-panel`, `btn-outline` ฯลฯ)
    - _Requirements: 10.2, 10.3, 10.4, 10.5, 10.6, 10.8, 9.5_

  - [x] 7.2 สร้าง `src/pages/StrategyManagement/BacktestResultPanel.tsx`
    - แสดง SummaryCards: `totalPnl` (สีเขียว/แดง), `winRate`, `sharpeRatio`, `maxDrawdown`, `totalTrades`
    - แสดงตาราง AssetResult สำหรับ Multi-Asset (คอลัมน์: rank, symbol, totalPnl, winRate, sharpeRatio, maxDrawdown, totalTrades) รองรับ sort
    - แสดง EquityChart (lightweight-charts) ของ coin ที่เลือกจากตาราง
    - แสดงตาราง window results สำหรับ Random Window (คอลัมน์: windowStart, windowEnd, totalPnl, winRate, sharpeRatio, maxDrawdown)
    - แสดง summary section ด้านบน (bestSymbol/worstSymbol หรือ consistencyScore)
    - แสดง `executionTimeMs` ในรูปแบบ "ใช้เวลา X.X วินาที"
    - แสดง "ไม่มี trade เกิดขึ้น" เมื่อ `totalTrades` เป็น 0
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

  - [x] 7.3 สร้าง `src/pages/StrategyManagement/BacktestHistoryPanel.tsx`
    - เรียก `GET /api/strategies/:id/backtest/history` และแสดงรายการ 20 รายการล่าสุด
    - แต่ละ item แสดง: `backtestType`, `symbols` (สูงสุด 3 coin แล้ว +N), `createdAt` (relative time), `avgTotalPnl`
    - คลิก item เพื่อดู full detail ใน BacktestResultPanel
    - แสดง loading indicator ระหว่างโหลด
    - แสดง "ยังไม่มีประวัติ backtest สำหรับกลยุทธ์นี้" เมื่อ list ว่าง
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

- [x] 8. สร้าง Frontend — หน้าหลัก StrategyManagement

  - [x] 8.1 สร้าง `src/pages/StrategyManagement/index.tsx`
    - แสดง strategy card list: แต่ละ card มี `name`, `engineType`, `tags`, `updatedAt` พร้อมปุ่ม "แก้ไข" และ "ลบ"
    - ปุ่ม "เพิ่ม Strategy" เปิด StrategyForm modal
    - คลิก strategy card เพื่อแสดง BacktestHistoryPanel
    - แสดง loading indicator ระหว่างโหลด
    - แสดง confirmation dialog ก่อนลบ
    - แสดง error message ที่อ่านเข้าใจได้เมื่อ API error
    - _Requirements: 10.1, 10.2, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9_

  - [x] 8.2 เพิ่ม Multi-Asset Backtest section ใน `index.tsx`
    - Form: `strategyId` (dropdown), `symbols` (tag input), `interval` (dropdown), `startDate`, `endDate` (date picker)
    - Validate `symbols` 1-20 รายการก่อน submit
    - แสดง loading state "กำลังรัน backtest..." และปิดปุ่มระหว่างรัน
    - แสดงผลลัพธ์ใน BacktestResultPanel เมื่อเสร็จ
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [x] 8.3 เพิ่ม Random Window Backtest section ใน `index.tsx`
    - Form: `strategyId`, `symbols`, `interval`, `windowDays` (1-365), `lookbackYears` (1-5), `numWindows` (1-10)
    - Inline validation errors ทันทีเมื่อค่าไม่อยู่ในช่วงที่กำหนด (ไม่ต้องรอ submit)
    - แสดง loading state และปิดปุ่มระหว่างรัน
    - แสดงผลลัพธ์ใน BacktestResultPanel พร้อม consistency score ที่เด่นชัด
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 9. เพิ่ม Sidebar Navigation และ Route

  - [x] 9.1 Register route `/strategy-management` ใน `src/App.tsx`
    - เพิ่ม `<Route path="/strategy-management" element={<StrategyManagement />} />`
    - _Requirements: 9.1_

  - [x] 9.2 เพิ่ม nav link "Strategy Management" ใน Sidebar component
    - เพิ่ม link พร้อม icon ที่เหมาะสมในหมวด `── CRYPTO ──`
    - แสดง active state (highlight) เมื่อ pathname ตรงกับ `/strategy-management`
    - _Requirements: 9.2, 9.3, 9.4_

- [x] 10. Final Checkpoint — ตรวจสอบ Integration ทั้งระบบ
  - ตรวจสอบว่า frontend เชื่อมต่อกับ backend ได้ครบทุก endpoint
  - ตรวจสอบว่า sidebar navigation ทำงานถูกต้อง
  - Ensure all tests pass, ask the user if questions arise.

## หมายเหตุ

- Tasks ที่มีเครื่องหมาย `*` เป็น optional สามารถข้ามได้เพื่อให้ได้ MVP เร็วขึ้น
- แต่ละ task อ้างอิง requirements เฉพาะเพื่อ traceability
- Property tests ใช้ `fast-check` minimum 100 iterations ต่อ property
- Backtester.js และ SignalEngine.js ที่มีอยู่ใช้งานโดยตรง ไม่แก้ไข
