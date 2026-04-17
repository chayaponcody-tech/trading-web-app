# เอกสารความต้องการ (Requirements Document)

## บทนำ

ระบบ Strategy Management พร้อม Backtest สำหรับ Trading Bot Platform ที่ช่วยให้ผู้ใช้สามารถจัดการกลยุทธ์การเทรด (เพิ่ม ลบ แก้ไข) และทดสอบย้อนหลังบนหลาย coin พร้อมกันได้ รวมถึงการสุ่มช่วงเวลาเพื่อทดสอบความทนทานของกลยุทธ์ในสภาวะตลาดที่หลากหลาย

ระบบนี้ต่อยอดจาก `Backtester.js` และ `STRATEGY_REGISTRY` ที่มีอยู่ใน `packages/bot-engine` โดยเพิ่มชั้น Strategy Management ที่ให้ผู้ใช้กำหนด metadata, พารามิเตอร์, และคำอธิบายของแต่ละกลยุทธ์ได้ พร้อมระบบ Multi-Asset Backtest และ Random Time Window Backtest

ระบบนี้ยังรวมถึง UI ใน frontend (React + TypeScript) ที่ให้ผู้ใช้จัดการ strategy, รัน backtest, และดูผลลัพธ์ได้โดยตรงผ่าน sidebar tab ใหม่ชื่อ "Strategy Management"

---

## อภิธานศัพท์ (Glossary)

- **Strategy_Manager**: โมดูลหลักสำหรับจัดการ CRUD ของ strategy definitions ใน database
- **StrategyDefinition**: ข้อมูลครบถ้วนของกลยุทธ์หนึ่งตัว ประกอบด้วย id, name, description, engineType, defaultParams, tags
- **Backtester**: โมดูลใน `packages/bot-engine/src/Backtester.js` ที่จำลองการเทรดบน historical data
- **MultiAssetBacktest**: การรัน backtest ของกลยุทธ์เดียวบนหลาย coin พร้อมกัน
- **RandomWindowBacktest**: การรัน backtest โดยสุ่มช่วงเวลาจากอดีต (ไม่นับจากปัจจุบัน) เพื่อทดสอบความทนทาน
- **BacktestConfig**: ชุดพารามิเตอร์สำหรับรัน backtest (symbol, strategy, interval, tpPercent, slPercent, leverage, capital, startDate, endDate)
- **BacktestResult**: ผลลัพธ์จากการรัน backtest รวมถึง trades, metrics, equity curve
- **Kline**: ข้อมูล OHLCV (Open, High, Low, Close, Volume) ของแต่ละ candle
- **EngineType**: ประเภทของ execution engine ได้แก่ `js` (JavaScript native) หรือ `python` (Python strategy-ai service)
- **TimeWindow**: ช่วงเวลาที่ใช้ในการ backtest กำหนดด้วย startDate และ endDate
- **RandomWindow**: TimeWindow ที่ถูกสุ่มจากช่วงเวลาในอดีต โดยมีขนาดคงที่ (เช่น 30 วัน) แต่จุดเริ่มต้นถูกสุ่ม
- **AssetResult**: ผลลัพธ์ backtest ของ coin หนึ่งตัวภายใน MultiAssetBacktest
- **SharpeRatio**: อัตราส่วนผลตอบแทนต่อความเสี่ยง (mean PnL / stdDev PnL × √365)
- **MaxDrawdown**: การลดลงสูงสุดของ equity จาก peak ไปยัง trough (%)
- **ProfitFactor**: อัตราส่วน gross profit / gross loss
- **WinRate**: สัดส่วนจำนวน trade ที่กำไร / trade ทั้งหมด (%)
- **API_Gateway**: Express server ใน `packages/api-gateway/src/server.js`
- **Data_Layer**: โมดูล database ใน `packages/data-layer`
- **Strategy_UI**: หน้า React ใหม่ที่ path `/strategy-management` สำหรับจัดการ strategy และรัน backtest
- **StrategyForm**: component สำหรับกรอกข้อมูล strategy (สร้าง/แก้ไข)
- **BacktestResultPanel**: component สำหรับแสดงผลลัพธ์ backtest ในรูปแบบตาราง, chart, และ summary cards
- **BacktestHistoryPanel**: component สำหรับแสดงประวัติ backtest ของ strategy แต่ละตัว
- **EquityChart**: chart แสดง equity curve ของ backtest โดยใช้ `lightweight-charts`
- **SummaryCard**: card component แสดง metric สำคัญ เช่น WinRate, SharpeRatio, MaxDrawdown, TotalPnl

---

## ความต้องการ (Requirements)

### ความต้องการที่ 1: จัดการ Strategy Definitions (CRUD)

**User Story:** ในฐานะ trader ฉันต้องการเพิ่ม ลบ และแก้ไขกลยุทธ์การเทรดได้ เพื่อให้สามารถบริหารจัดการกลยุทธ์ที่ใช้งานได้อย่างเป็นระบบ

#### Acceptance Criteria

1. THE Strategy_Manager SHALL จัดเก็บ StrategyDefinition แต่ละตัวด้วยฟิลด์ต่อไปนี้: `id` (UUID v4), `name` (string), `description` (string), `engineType` (`js` หรือ `python`), `defaultParams` (JSON object), `tags` (array of string), `createdAt` (ISO 8601), `updatedAt` (ISO 8601)
2. WHEN ผู้ใช้ส่ง request สร้าง strategy ใหม่, THE Strategy_Manager SHALL ตรวจสอบว่า `name` และ `engineType` มีค่าและไม่ซ้ำกับ strategy ที่มีอยู่แล้ว
3. IF `name` ซ้ำกับ strategy ที่มีอยู่แล้ว, THEN THE Strategy_Manager SHALL ส่งคืน error "ชื่อกลยุทธ์นี้มีอยู่แล้วในระบบ"
4. WHEN ผู้ใช้แก้ไข strategy, THE Strategy_Manager SHALL อัปเดตเฉพาะฟิลด์ที่ส่งมาและอัปเดต `updatedAt` เป็นเวลาปัจจุบัน
5. WHEN ผู้ใช้ลบ strategy, THE Strategy_Manager SHALL ตรวจสอบว่า strategy นั้นไม่มี bot ที่กำลังรันอยู่ใช้งานอยู่
6. IF strategy ที่ต้องการลบมี bot ที่กำลังรันอยู่ใช้งาน, THEN THE Strategy_Manager SHALL ส่งคืน error "ไม่สามารถลบกลยุทธ์ที่มี bot กำลังใช้งานอยู่"
7. THE Strategy_Manager SHALL รองรับการดึงรายการ strategy ทั้งหมด เรียงตาม `updatedAt` descending
8. THE Strategy_Manager SHALL รองรับการกรอง strategy ตาม `engineType` หรือ `tags`

---

### ความต้องการที่ 2: แสดงรายละเอียด Strategy

**User Story:** ในฐานะ trader ฉันต้องการดูรายละเอียดครบถ้วนของแต่ละกลยุทธ์ได้ เพื่อให้เข้าใจว่ากลยุทธ์นั้นทำงานอย่างไรและเหมาะกับสภาวะตลาดแบบใด

#### Acceptance Criteria

1. WHEN ผู้ใช้ขอดูรายละเอียด strategy, THE Strategy_Manager SHALL ส่งคืน StrategyDefinition ครบถ้วนรวมถึง `description`, `defaultParams`, `tags`, `engineType`
2. THE Strategy_Manager SHALL รองรับ `description` ที่เป็น markdown text เพื่อให้แสดงผลได้อย่างสวยงาม
3. WHEN strategy มี `engineType` เป็น `js`, THE Strategy_Manager SHALL ดึงข้อมูล indicator ที่ใช้จาก `STRATEGY_REGISTRY` ใน Backtester.js มาแสดงด้วย
4. THE Strategy_Manager SHALL แสดง `defaultParams` พร้อม type และ description ของแต่ละพารามิเตอร์
5. IF strategy id ไม่มีในระบบ, THEN THE Strategy_Manager SHALL ส่งคืน HTTP 404 พร้อม error "ไม่พบกลยุทธ์ที่ระบุ"

---

### ความต้องการที่ 3: Multi-Asset Backtest (หลาย Coin พร้อมกัน)

**User Story:** ในฐานะ trader ฉันต้องการรัน backtest ของกลยุทธ์เดียวบนหลาย coin พร้อมกันในช่วงเวลาเดียวกัน เพื่อดูว่ากลยุทธ์นี้เหมาะกับสินทรัพย์ไหนมากที่สุด

#### Acceptance Criteria

1. WHEN ผู้ใช้ส่ง request Multi-Asset Backtest พร้อม `strategyId`, `symbols` (array), `interval`, `startDate`, `endDate`, THE Backtester SHALL รัน backtest แต่ละ symbol แบบ parallel
2. THE Backtester SHALL รองรับ `symbols` array ที่มีได้สูงสุด 20 coin ต่อ request หนึ่งครั้ง
3. IF `symbols` array มีมากกว่า 20 รายการ, THEN THE API_Gateway SHALL ส่งคืน HTTP 400 พร้อม error "รองรับสูงสุด 20 coin ต่อการรัน backtest"
4. THE Backtester SHALL ส่งคืน array ของ AssetResult เรียงตาม `totalPnl` descending (coin ที่ทำกำไรได้มากที่สุดอยู่อันดับแรก)
5. WHEN backtest ของ coin ใด coin หนึ่งล้มเหลว, THE Backtester SHALL บันทึก error ของ coin นั้นและดำเนินการ coin ที่เหลือต่อไป โดยไม่หยุดทั้ง batch
6. THE Backtester SHALL รวม `rank` field (1 = ดีที่สุด) ใน AssetResult แต่ละตัว
7. WHEN Multi-Asset Backtest เสร็จสิ้น, THE Backtester SHALL คำนวณ summary metrics รวมทั้ง batch ได้แก่: `bestSymbol`, `worstSymbol`, `avgWinRate`, `avgSharpeRatio`, `avgTotalPnl`
8. THE API_Gateway SHALL ส่งคืน Multi-Asset Backtest result ภายใน 60 วินาที สำหรับ 20 coin บน interval 1h

---

### ความต้องการที่ 4: Random Time Window Backtest (สุ่มช่วงเวลา)

**User Story:** ในฐานะ trader ฉันต้องการทดสอบกลยุทธ์บนช่วงเวลาที่สุ่มมาจากอดีต เพื่อตรวจสอบว่ากลยุทธ์ยังใช้ได้ดีในสภาวะตลาดที่หลากหลาย ไม่ใช่แค่ช่วงเวลาที่เลือกเอง

#### Acceptance Criteria

1. WHEN ผู้ใช้ส่ง request Random Window Backtest พร้อม `strategyId`, `symbols`, `interval`, `windowDays` (ขนาดช่วงเวลา), `lookbackYears` (ย้อนหลังกี่ปี), `numWindows` (จำนวนช่วงที่สุ่ม), THE Backtester SHALL สุ่ม `numWindows` ช่วงเวลาจากช่วง `lookbackYears` ปีที่ผ่านมา
2. THE Backtester SHALL สุ่ม startDate ของแต่ละ window โดยที่ endDate = startDate + windowDays และ endDate ต้องไม่เกินวันปัจจุบัน
3. THE Backtester SHALL รองรับ `lookbackYears` ได้สูงสุด 5 ปี และ `numWindows` ได้สูงสุด 10 windows
4. IF `numWindows` มากกว่า 10, THEN THE API_Gateway SHALL ส่งคืน HTTP 400 พร้อม error "รองรับสูงสุด 10 windows ต่อการรัน"
5. THE Backtester SHALL ตรวจสอบว่า windows ที่สุ่มมาไม่ซ้อนทับกัน (non-overlapping) เพื่อให้ผลการทดสอบเป็นอิสระต่อกัน
6. WHEN Random Window Backtest เสร็จสิ้น, THE Backtester SHALL ส่งคืน array ของผลลัพธ์แต่ละ window พร้อม `windowStart`, `windowEnd`, `totalPnl`, `winRate`, `sharpeRatio`, `maxDrawdown`
7. THE Backtester SHALL คำนวณ consistency score = สัดส่วนของ windows ที่มี `totalPnl` > 0 เทียบกับ `numWindows` ทั้งหมด
8. WHEN Random Window Backtest รัน Multi-Asset (หลาย coin), THE Backtester SHALL รัน backtest แต่ละ (symbol, window) combination แบบ parallel

---

### ความต้องการที่ 5: API Endpoints สำหรับ Strategy Management

**User Story:** ในฐานะ frontend developer ฉันต้องการ REST API ครบถ้วนสำหรับจัดการ strategy และรัน backtest เพื่อสร้าง UI ได้

#### Acceptance Criteria

1. THE API_Gateway SHALL expose endpoint ต่อไปนี้สำหรับ Strategy Management:
   - `GET /api/strategies` — ดึงรายการ strategy ทั้งหมด
   - `GET /api/strategies/:id` — ดึงรายละเอียด strategy ตาม id
   - `POST /api/strategies` — สร้าง strategy ใหม่
   - `PUT /api/strategies/:id` — แก้ไข strategy
   - `DELETE /api/strategies/:id` — ลบ strategy
2. THE API_Gateway SHALL expose endpoint ต่อไปนี้สำหรับ Backtest:
   - `POST /api/strategies/:id/backtest/multi-asset` — รัน Multi-Asset Backtest
   - `POST /api/strategies/:id/backtest/random-window` — รัน Random Window Backtest
   - `GET /api/strategies/:id/backtest/history` — ดึงประวัติ backtest ของ strategy นั้น
3. WHEN request ถึง `POST /api/strategies`, THE API_Gateway SHALL ตรวจสอบว่า `name` (string, ไม่ว่าง) และ `engineType` (`js` หรือ `python`) มีค่าครบถ้วน
4. IF required fields ขาดหาย, THEN THE API_Gateway SHALL ส่งคืน HTTP 400 พร้อม error message ระบุ field ที่ขาด
5. THE API_Gateway SHALL ส่งคืน HTTP 201 เมื่อสร้าง strategy สำเร็จ พร้อม StrategyDefinition ที่สร้างขึ้น
6. WHEN request ถึง `POST /api/strategies/:id/backtest/multi-asset`, THE API_Gateway SHALL ตรวจสอบว่า `symbols` (array ไม่ว่าง), `interval`, `startDate`, `endDate` มีค่าครบถ้วน
7. WHEN request ถึง `POST /api/strategies/:id/backtest/random-window`, THE API_Gateway SHALL ตรวจสอบว่า `symbols`, `interval`, `windowDays` (จำนวนเต็มบวก), `lookbackYears` (1-5), `numWindows` (1-10) มีค่าครบถ้วนและอยู่ในช่วงที่กำหนด

---

### ความต้องการที่ 6: บันทึกและดึงประวัติ Backtest ของแต่ละ Strategy

**User Story:** ในฐานะ trader ฉันต้องการดูประวัติการ backtest ของแต่ละกลยุทธ์ เพื่อเปรียบเทียบผลลัพธ์ข้ามช่วงเวลาและ coin ต่างๆ ได้

#### Acceptance Criteria

1. WHEN backtest ใดๆ เสร็จสิ้น, THE Backtester SHALL บันทึกผลลัพธ์ลง database พร้อม `strategyId` เพื่อเชื่อมโยงกับ strategy
2. THE Data_Layer SHALL จัดเก็บ backtest result พร้อมฟิลด์: `backtestId` (UUID v4), `strategyId`, `backtestType` (`multi-asset` หรือ `random-window`), `symbols` (JSON array), `interval`, `config` (JSON), `summaryMetrics` (JSON), `createdAt`
3. WHEN ผู้ใช้ขอดูประวัติ backtest ของ strategy, THE API_Gateway SHALL ส่งคืน backtest results ล่าสุด 20 รายการ เรียงตาม `createdAt` descending
4. THE API_Gateway SHALL expose `GET /api/strategies/:id/backtest/history/:backtestId` เพื่อดูผลลัพธ์ backtest แบบ full detail รวมถึง AssetResult ของแต่ละ coin
5. IF `backtestId` ไม่มีในระบบ, THEN THE API_Gateway SHALL ส่งคืน HTTP 404 พร้อม error "ไม่พบผลลัพธ์ backtest ที่ระบุ"
6. THE Data_Layer SHALL ไม่จัดเก็บ full trades array ใน summary list — trades SHALL ถูกส่งคืนเฉพาะเมื่อดึง backtestId เฉพาะเจาะจง

---

### ความต้องการที่ 7: ความถูกต้องของการจำลอง (Simulation Integrity)

**User Story:** ในฐานะ trader ฉันต้องการให้ผลลัพธ์ backtest สะท้อนความเป็นจริงได้แม่นยำ เพื่อให้การตัดสินใจเลือกกลยุทธ์มีความน่าเชื่อถือ

#### Acceptance Criteria

1. WHEN คำนวณ signal ที่ candle index `i`, THE Backtester SHALL ใช้เฉพาะข้อมูล closes จาก index 0 ถึง `i-1` เท่านั้น (ห้ามใช้ข้อมูลอนาคต)
2. THE Backtester SHALL เริ่มคำนวณ signal หลังจาก index 50 เป็นต้นไป (minimum candles ที่ SignalEngine ต้องการ)
3. THE Backtester SHALL ใช้ราคา close ของ candle ปัจจุบันเป็นราคา entry/exit
4. THE Backtester SHALL คิดค่าธรรมเนียม 0.04% ต่อ trade (taker fee) สำหรับทั้ง entry และ exit หักออกจาก PnL
5. THE Backtester SHALL จำลอง slippage 0.05% ต่อ trade โดยปรับราคา entry/exit ตามทิศทาง position
6. WHEN รัน Multi-Asset Backtest, THE Backtester SHALL ใช้ `defaultParams` ของ StrategyDefinition เป็นค่าเริ่มต้น และอนุญาตให้ผู้ใช้ override ได้ผ่าน request body
7. FOR ALL backtest runs ที่ใช้ strategy และ symbol เดียวกันในช่วงเวลาเดียวกัน, THE Backtester SHALL ส่งคืนผลลัพธ์ที่เหมือนกันทุกครั้ง (deterministic)

---

### ความต้องการที่ 8: การแสดงผลสรุปเปรียบเทียบ

**User Story:** ในฐานะ trader ฉันต้องการเห็นผลสรุปเปรียบเทียบที่ชัดเจนหลังจาก backtest เสร็จ เพื่อตัดสินใจได้ว่ากลยุทธ์นี้เหมาะกับ coin ไหนและช่วงเวลาแบบใด

#### Acceptance Criteria

1. WHEN Multi-Asset Backtest เสร็จสิ้น, THE API_Gateway SHALL ส่งคืน response ที่มี `results` (array ของ AssetResult) และ `summary` object ที่มี: `bestSymbol`, `worstSymbol`, `avgWinRate`, `avgSharpeRatio`, `avgTotalPnl`, `totalSymbolsTested`, `successfulSymbols`, `failedSymbols`
2. WHEN Random Window Backtest เสร็จสิ้น, THE API_Gateway SHALL ส่งคืน response ที่มี `windows` (array ของผลลัพธ์แต่ละ window) และ `summary` object ที่มี: `consistencyScore`, `avgWinRate`, `avgSharpeRatio`, `avgTotalPnl`, `bestWindow`, `worstWindow`
3. THE API_Gateway SHALL รวม `strategyName` และ `strategyId` ใน response ของทุก backtest เพื่อให้ frontend แสดงผลได้ถูกต้อง
4. WHEN backtest ใดๆ มี `totalTrades` เป็น 0, THE Backtester SHALL ส่งคืน metrics ทั้งหมดเป็น 0 และ `equityCurve` เป็น empty array พร้อม note "ไม่มี trade เกิดขึ้นในช่วงเวลานี้"
5. THE API_Gateway SHALL รวม `executionTimeMs` (เวลาที่ใช้รัน backtest ทั้งหมด) ใน response ของทุก backtest


---

### ความต้องการที่ 9: Sidebar Tab ใหม่สำหรับ Strategy Management

**User Story:** ในฐานะ trader ฉันต้องการเข้าถึงหน้า Strategy Management ได้จาก sidebar เหมือนกับหน้าอื่นๆ ในระบบ เพื่อให้การนำทางสะดวกและสอดคล้องกับ UX ที่มีอยู่

#### Acceptance Criteria

1. THE Strategy_UI SHALL ถูก register เป็น route `/strategy-management` ใน `App.tsx`
2. THE Sidebar SHALL แสดง nav link "Strategy Management" พร้อม icon ที่เหมาะสมในหมวด `── CRYPTO ──`
3. WHEN ผู้ใช้คลิก nav link "Strategy Management", THE Strategy_UI SHALL แสดงหน้า Strategy Management แทนที่ content เดิม
4. THE Sidebar SHALL แสดง active state (highlight) บน "Strategy Management" link เมื่อ pathname ตรงกับ `/strategy-management`
5. THE Strategy_UI SHALL ใช้ CSS class และ design token เดียวกับหน้าอื่นๆ (เช่น `glass-panel`, `text-profit`, `btn-outline`) เพื่อให้ UI สอดคล้องกัน

---

### ความต้องการที่ 10: UI จัดการ Strategy (CRUD แบบ Visual)

**User Story:** ในฐานะ trader ฉันต้องการเพิ่ม ลบ และแก้ไขกลยุทธ์ผ่าน UI ที่ใช้งานง่าย โดยไม่ต้องเรียก API โดยตรง

#### Acceptance Criteria

1. THE Strategy_UI SHALL แสดงรายการ strategy ทั้งหมดในรูปแบบ card list โดยแต่ละ card แสดง `name`, `engineType`, `tags`, และ `updatedAt`
2. WHEN ผู้ใช้คลิกปุ่ม "เพิ่ม Strategy", THE Strategy_UI SHALL แสดง StrategyForm ในรูปแบบ modal หรือ panel สำหรับกรอกข้อมูล strategy ใหม่
3. THE StrategyForm SHALL มี input fields สำหรับ: `name` (text), `description` (textarea รองรับ markdown), `engineType` (dropdown: `js` / `python`), `defaultParams` (JSON editor), `tags` (tag input)
4. WHEN ผู้ใช้กด submit ใน StrategyForm, THE Strategy_UI SHALL เรียก `POST /api/strategies` และแสดง success/error message ตาม response
5. WHEN ผู้ใช้คลิกปุ่ม "แก้ไข" บน strategy card, THE Strategy_UI SHALL เปิด StrategyForm พร้อมข้อมูลเดิมของ strategy นั้น
6. WHEN ผู้ใช้กด submit แก้ไข, THE Strategy_UI SHALL เรียก `PUT /api/strategies/:id` และอัปเดต card ใน list ทันที
7. WHEN ผู้ใช้คลิกปุ่ม "ลบ" บน strategy card, THE Strategy_UI SHALL แสดง confirmation dialog ก่อนเรียก `DELETE /api/strategies/:id`
8. IF API ส่งคืน error, THE Strategy_UI SHALL แสดง error message ที่อ่านเข้าใจได้ใน UI โดยไม่ให้หน้าพัง (crash)
9. WHILE Strategy_UI กำลังโหลดข้อมูลจาก API, THE Strategy_UI SHALL แสดง loading indicator แทน content

---

### ความต้องการที่ 11: UI สำหรับรัน Multi-Asset Backtest

**User Story:** ในฐานะ trader ฉันต้องการรัน Multi-Asset Backtest ผ่าน UI โดยเลือก strategy, coin, และช่วงเวลาได้สะดวก

#### Acceptance Criteria

1. THE Strategy_UI SHALL มี section "Multi-Asset Backtest" ที่เข้าถึงได้จากหน้า Strategy Management
2. THE Strategy_UI SHALL มี form สำหรับกรอก: `strategyId` (dropdown เลือกจาก strategy ที่มีอยู่), `symbols` (multi-select หรือ tag input สำหรับใส่ coin เช่น BTCUSDT), `interval` (dropdown: 1m, 5m, 15m, 1h, 4h, 1d), `startDate`, `endDate` (date picker)
3. WHEN ผู้ใช้กดปุ่ม "รัน Backtest", THE Strategy_UI SHALL ตรวจสอบว่า `symbols` มีอย่างน้อย 1 รายการและไม่เกิน 20 รายการก่อนส่ง request
4. WHILE backtest กำลังรัน, THE Strategy_UI SHALL แสดง loading state พร้อมข้อความ "กำลังรัน backtest..." และปิดการใช้งานปุ่ม "รัน Backtest"
5. WHEN backtest เสร็จสิ้น, THE Strategy_UI SHALL แสดงผลลัพธ์ใน BacktestResultPanel ทันทีโดยไม่ต้อง reload หน้า
6. IF API ส่งคืน error ระหว่างรัน backtest, THE Strategy_UI SHALL แสดง error message และ restore ปุ่ม "รัน Backtest" ให้ใช้งานได้

---

### ความต้องการที่ 12: UI สำหรับรัน Random Window Backtest

**User Story:** ในฐานะ trader ฉันต้องการรัน Random Window Backtest ผ่าน UI โดยกำหนดขนาด window และจำนวนการสุ่มได้

#### Acceptance Criteria

1. THE Strategy_UI SHALL มี section "Random Window Backtest" แยกจาก Multi-Asset Backtest
2. THE Strategy_UI SHALL มี form สำหรับกรอก: `strategyId` (dropdown), `symbols` (multi-select), `interval` (dropdown), `windowDays` (number input, 1-365), `lookbackYears` (number input, 1-5), `numWindows` (number input, 1-10)
3. WHEN ผู้ใช้กรอก `windowDays`, `lookbackYears`, หรือ `numWindows` ที่ไม่อยู่ในช่วงที่กำหนด, THE Strategy_UI SHALL แสดง inline validation error ทันทีโดยไม่ต้องรอ submit
4. WHILE Random Window Backtest กำลังรัน, THE Strategy_UI SHALL แสดง loading state และปิดการใช้งานปุ่ม submit
5. WHEN backtest เสร็จสิ้น, THE Strategy_UI SHALL แสดงผลลัพธ์ใน BacktestResultPanel พร้อม consistency score ที่เด่นชัด

---

### ความต้องการที่ 13: แสดงผลลัพธ์ Backtest ในรูปแบบที่อ่านง่าย

**User Story:** ในฐานะ trader ฉันต้องการเห็นผลลัพธ์ backtest ในรูปแบบที่เข้าใจง่าย ทั้งตาราง, chart, และ summary cards เพื่อตัดสินใจได้รวดเร็ว

#### Acceptance Criteria

1. THE BacktestResultPanel SHALL แสดง SummaryCard สำหรับ metric หลักแต่ละตัว ได้แก่: `totalPnl` (แสดงสีเขียวถ้า > 0, แดงถ้า < 0), `winRate` (%), `sharpeRatio`, `maxDrawdown` (%), `totalTrades`
2. THE BacktestResultPanel SHALL แสดงตาราง AssetResult สำหรับ Multi-Asset Backtest โดยมีคอลัมน์: `rank`, `symbol`, `totalPnl`, `winRate`, `sharpeRatio`, `maxDrawdown`, `totalTrades` และรองรับการ sort ตามคอลัมน์
3. THE BacktestResultPanel SHALL แสดง EquityChart (line chart) ของ coin ที่ผู้ใช้เลือกจากตาราง โดยใช้ `lightweight-charts` library ที่มีอยู่ใน dependencies
4. THE BacktestResultPanel SHALL แสดงตาราง window results สำหรับ Random Window Backtest โดยมีคอลัมน์: `windowStart`, `windowEnd`, `totalPnl`, `winRate`, `sharpeRatio`, `maxDrawdown`
5. WHEN `totalTrades` เป็น 0 สำหรับ coin ใด, THE BacktestResultPanel SHALL แสดง note "ไม่มี trade เกิดขึ้น" ใน row นั้นแทนค่า metric
6. THE BacktestResultPanel SHALL แสดง `executionTimeMs` ในรูปแบบที่อ่านง่าย เช่น "ใช้เวลา 3.2 วินาที" ที่ด้านล่างของผลลัพธ์
7. THE BacktestResultPanel SHALL แสดง summary section ที่ด้านบนสุดก่อนตาราง โดยระบุ `bestSymbol` และ `worstSymbol` สำหรับ Multi-Asset หรือ `consistencyScore` สำหรับ Random Window

---

### ความต้องการที่ 14: UI สำหรับดูประวัติ Backtest ของแต่ละ Strategy

**User Story:** ในฐานะ trader ฉันต้องการดูประวัติการ backtest ของแต่ละกลยุทธ์ เพื่อเปรียบเทียบผลลัพธ์ข้ามช่วงเวลาได้

#### Acceptance Criteria

1. WHEN ผู้ใช้คลิก strategy card ใดๆ, THE Strategy_UI SHALL แสดง BacktestHistoryPanel ที่แสดงประวัติ backtest ของ strategy นั้น
2. THE BacktestHistoryPanel SHALL เรียก `GET /api/strategies/:id/backtest/history` และแสดงรายการ backtest ล่าสุด 20 รายการในรูปแบบ list
3. THE BacktestHistoryPanel SHALL แสดงข้อมูลสรุปของแต่ละ backtest ใน list ได้แก่: `backtestType`, `symbols` (แสดงสูงสุด 3 coin แล้ว +N), `createdAt` (relative time เช่น "2 ชั่วโมงที่แล้ว"), `avgTotalPnl`
4. WHEN ผู้ใช้คลิก backtest item ใน list, THE BacktestHistoryPanel SHALL เรียก `GET /api/strategies/:id/backtest/history/:backtestId` และแสดงผลลัพธ์ full detail ใน BacktestResultPanel
5. WHILE BacktestHistoryPanel กำลังโหลด, THE BacktestHistoryPanel SHALL แสดง loading indicator
6. IF strategy ยังไม่เคยรัน backtest, THE BacktestHistoryPanel SHALL แสดงข้อความ "ยังไม่มีประวัติ backtest สำหรับกลยุทธ์นี้" แทน list ว่าง
