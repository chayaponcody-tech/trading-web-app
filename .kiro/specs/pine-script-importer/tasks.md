# แผนการ Implementation: Pine Script Importer

## ภาพรวม

แปลง design เป็น task ที่ทำได้จริง โดยเริ่มจาก backend (strategy-ai → api-gateway) ก่อน แล้วจึงต่อด้วย frontend เพื่อให้แต่ละ task สามารถทดสอบได้ทันทีที่เสร็จ

## Tasks

- [x] 1. สร้าง pine_loader.py ใน strategy-ai
  - [x] 1.1 สร้างไฟล์ `packages/strategy-ai/pine_loader.py`
    - เขียนฟังก์ชัน `load_pine_strategies(registry, strategies_dir)` ที่สแกนไฟล์ `pine_*.py` ด้วย `os.listdir`
    - โหลดแต่ละไฟล์ด้วย `importlib.util.spec_from_file_location` และ `exec_module`
    - หา class ที่ extend `BaseStrategy` ใน module แล้ว register ด้วย key `PINE_{CLASSNAME.upper()}`
    - ถ้าโหลดไฟล์ไม่ได้ให้ log warning และข้ามไฟล์นั้น ไม่ crash
    - คืนค่า list ของ key ที่โหลดสำเร็จ
    - _Requirements: 7.4_

  - [x] 1.2 เขียน property test สำหรับ pine_loader (Property 14)
    - **Property 14: Auto-load all pine_ files on startup**
    - **Validates: Requirements 7.4**
    - สร้างไฟล์ `packages/strategy-ai/tests/test_pine_loader_properties.py`
    - ใช้ Hypothesis สร้างไฟล์ `pine_*.py` ชั่วคราวใน temp directory
    - ตรวจสอบว่าทุกไฟล์ที่มี class extend BaseStrategy ถูก register ครบ

- [x] 2. เพิ่ม endpoints ใหม่ใน strategy-ai main.py
  - [x] 2.1 เพิ่ม Pydantic schemas ใน `packages/strategy-ai/schemas.py`
    - เพิ่ม `RegisterDynamicRequest(key: str, python_code: str)`
    - เพิ่ม `UnregisterRequest(key: str)`
    - เพิ่ม `SavePineRequest(key: str, python_code: str, filename: str)`
    - _Requirements: 4.2, 4.6, 6.3_

  - [x] 2.2 เพิ่ม endpoint `POST /strategy/register-dynamic` ใน `packages/strategy-ai/main.py`
    - ใช้ `exec(req.python_code, namespace)` เพื่อ compile code ใน isolated namespace
    - หา class ที่ extend `BaseStrategy` ใน namespace
    - ถ้าไม่พบให้ raise `HTTPException(400)`
    - ถ้า syntax error ให้ raise `HTTPException(400, f"Python syntax error: {e}")`
    - register instance ใน registry แล้วคืนค่า `{"registered": True, "key": req.key}`
    - _Requirements: 4.2, 4.4_

  - [x] 2.3 เขียน property test สำหรับ register-dynamic (Property 8)
    - **Property 8: Temp key format invariant**
    - **Validates: Requirements 4.2**
    - สร้างไฟล์ `packages/strategy-ai/tests/test_pine_endpoints_properties.py`
    - ใช้ Hypothesis generate valid Python code ที่ extend BaseStrategy
    - ตรวจสอบว่า key ที่ได้มีรูปแบบ `PINE_TEMP_` และ strategy ถูก register จริง

  - [x] 2.4 เพิ่ม endpoint `DELETE /strategy/unregister` ใน `packages/strategy-ai/main.py`
    - รับ `UnregisterRequest` และลบ key ออกจาก `registry._strategies`
    - ถ้า key ไม่มีอยู่ให้คืนค่า `{"unregistered": False}` (ไม่ raise error)
    - คืนค่า `{"unregistered": True}` เมื่อสำเร็จ
    - _Requirements: 4.6_

  - [x] 2.5 เขียน property test สำหรับ temp key cleanup (Property 9)
    - **Property 9: Temp key cleanup after backtest**
    - **Validates: Requirements 4.6**
    - ใช้ Hypothesis generate valid Python code
    - register → unregister → ตรวจสอบว่า key ไม่ปรากฏใน `registry.list_keys()` อีกต่อไป

  - [x] 2.6 เพิ่ม endpoint `POST /strategy/save-pine` ใน `packages/strategy-ai/main.py`
    - ตรวจสอบว่า `req.key` ไม่ซ้ำใน registry ถ้าซ้ำให้ raise `HTTPException(409)`
    - เขียนไฟล์ `strategies/{req.filename}` ด้วย `open(..., 'w')`
    - exec code และ register instance ใน registry ด้วย `req.key`
    - คืนค่า `{"strategyKey": req.key, "message": "บันทึกสำเร็จ"}`
    - _Requirements: 6.3, 6.4, 6.5_

  - [x] 2.7 เขียน property test สำหรับ duplicate key detection (Property 11)
    - **Property 11: Duplicate key detection**
    - **Validates: Requirements 6.5, 8.5**
    - ใช้ Hypothesis generate valid Python code และ key
    - save ครั้งแรกสำเร็จ → save ซ้ำด้วย key เดิมต้องได้ HTTP 409

  - [x] 2.8 เรียก `load_pine_strategies` ใน `packages/strategy-ai/main.py` ตอน startup
    - import `pine_loader` และเรียก `load_pine_strategies(registry, "strategies/")` หลัง registry bootstrap
    - log จำนวน strategy ที่โหลดสำเร็จ
    - _Requirements: 7.4_

- [x] 3. Checkpoint — ทดสอบ strategy-ai endpoints
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. สร้าง PineScriptConverter.js ใน api-gateway
  - [x] 4.1 สร้างไฟล์ `packages/api-gateway/src/PineScriptConverter.js`
    - เขียน class `PineScriptConverter` พร้อม method `convert(pineScript)`
    - เขียน `buildPrompt(pineScript)` ที่รวม Pine Script + BaseStrategy interface + ตัวอย่าง strategy
    - เขียน `extractPythonCode(response)` ที่ handle 3 รูปแบบ: markdown block, plain code block, raw text
    - เขียน `validatePythonStructure(code)` ที่ตรวจสอบ class extend BaseStrategy + compute_signal + get_metadata
    - เรียก OpenRouter API ด้วย `OPENROUTER_API_KEY` จาก env พร้อม timeout 30 วินาที
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 4.2 เขียน property tests สำหรับ PineScriptConverter ด้วย fast-check (Properties 5, 6, 7)
    - สร้างไฟล์ `packages/api-gateway/src/tests/pineScriptConverter.test.js`
    - **Property 5: Prompt contains all required components** — Validates: Requirements 2.2
    - **Property 6: Python code extraction from any response format** — Validates: Requirements 2.3
    - **Property 7: Python structure validation** — Validates: Requirements 2.4

- [x] 5. สร้าง pineScriptRoutes.js และ validation logic ใน api-gateway
  - [x] 5.1 สร้างไฟล์ `packages/api-gateway/src/routes/pineScriptRoutes.js`
    - เขียนฟังก์ชัน `validatePineScript(input)` ที่ตรวจสอบ length (10-50,000) และ keywords
    - เขียน `strategyNameToKey(name)` ที่แปลง name → `PINE_{UPPERCASE_NAME}` (space → underscore)
    - เขียน route `POST /convert` ที่เรียก `PineScriptConverter.convert()` และคืนค่า `{pythonCode, className}`
    - เขียน route `POST /backtest` ที่ register-dynamic → runBacktest → unregister (ทั้ง success และ error)
    - เขียน route `POST /save` ที่ validate name แล้ว forward ไปยัง strategy-ai `/strategy/save-pine`
    - เขียน route `GET /list` ที่ดึงจาก strategy-ai `/strategy/list` แล้ว filter เฉพาะ `PINE_` prefix
    - ถ้าไม่มี `pineScript` field ให้คืนค่า HTTP 400 `{error: "pineScript is required"}`
    - ถ้าชื่อมีอักขระพิเศษให้คืนค่า HTTP 400
    - _Requirements: 1.2, 1.3, 1.4, 4.2, 4.6, 6.2, 6.5, 6.6, 7.1, 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 5.2 เขียน property tests สำหรับ validation และ name transformation ด้วย fast-check (Properties 1, 2, 3, 4, 10, 12, 15)
    - สร้างไฟล์ `packages/api-gateway/src/tests/pineScriptRoutes.test.js`
    - **Property 1: Validation rejects short input** — Validates: Requirements 1.2
    - **Property 2: Validation rejects oversized input** — Validates: Requirements 1.3
    - **Property 3: Validation requires Pine Script keywords** — Validates: Requirements 1.4
    - **Property 10: Strategy name to key transformation** — Validates: Requirements 6.2
    - **Property 12: Invalid name character rejection** — Validates: Requirements 6.6
    - **Property 15: Missing pineScript field returns HTTP 400** — Validates: Requirements 8.4

  - [x] 5.3 Register routes ใน `packages/api-gateway/src/server.js`
    - import `createPineScriptRoutes` จาก `./routes/pineScriptRoutes.js`
    - เพิ่ม `app.use('/api/pine-script', createPineScriptRoutes(exchange))` หลัง backtest routes
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 6. Checkpoint — ทดสอบ api-gateway routes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. เพิ่ม route และ sidebar item ใน App.tsx
  - [x] 7.1 เพิ่ม `PineImport` route และ sidebar item ใน `src/App.tsx`
    - import `FileCode` จาก `lucide-react`
    - เพิ่ม `{ path: '/pine-import', name: 'Pine Import', icon: <FileCode size={20} color="#a78bfa" /> }` ใน `intelligenceItems`
    - import `PineImport` จาก `./pages/PineImport`
    - เพิ่ม `<Route path="/pine-import" element={<PineImport />} />` ใน Routes
    - _Requirements: 3.1, 3.3_

  - [x] 7.2 สร้าง placeholder `src/pages/PineImport.tsx`
    - สร้างหน้า placeholder ที่แสดงข้อความ "Pine Script Importer" เพื่อให้ route ทำงานได้ก่อน
    - _Requirements: 1.1_

- [x] 8. สร้าง PineImport.tsx หน้าเต็ม
  - [x] 8.1 สร้าง state machine และ input section ใน `src/pages/PineImport.tsx`
    - กำหนด interface `PineImportState` และ `BacktestConfig` ตาม design
    - สร้าง textarea รับ Pine Script ที่รองรับ 10,000+ ตัวอักษร
    - เรียก `validatePineScript` แบบ real-time และแสดง inline error
    - ปิดปุ่ม "แปลง" เมื่อ validation ไม่ผ่าน
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 8.2 เขียน property tests สำหรับ validation UI (Properties 3, 4)
    - สร้างไฟล์ `src/tests/PineImport.test.tsx` (หรือ `.test.ts`)
    - **Property 3: Validation requires Pine Script keywords** — Validates: Requirements 1.4
    - **Property 4: Convert button disabled when validation fails** — Validates: Requirements 1.5, 3.3

  - [x] 8.3 สร้าง convert phase และ preview section ใน `src/pages/PineImport.tsx`
    - เรียก `POST /api/pine-script/convert` เมื่อกดปุ่ม "แปลง"
    - แสดง loading indicator ระหว่างแปลง
    - แสดง Python code ใน `<pre>` หรือ `<textarea>` พร้อม syntax highlighting แบบ read-only
    - อนุญาตให้แก้ไข code ก่อนรัน backtest
    - แสดงปุ่ม "แปลงใหม่" และ "รัน Backtest"
    - _Requirements: 2.7, 3.1, 3.2, 3.3, 3.4_

  - [x] 8.4 สร้าง backtest config form และ results section ใน `src/pages/PineImport.tsx`
    - สร้าง form กำหนดค่า: symbol, interval, tpPercent, slPercent, leverage, capital, startDate, endDate
    - เรียก `POST /api/pine-script/backtest` เมื่อกดปุ่ม "รัน Backtest"
    - แสดง loading indicator ระหว่าง backtest
    - แสดง metrics: Net PnL%, Win Rate, Total Trades, Sharpe Ratio, Max Drawdown, Profit Factor
    - แสดง equity curve ด้วย line chart (ใช้ library ที่มีอยู่ในโปรเจกต์)
    - แสดงตาราง trades พร้อม columns ตาม design
    - แสดงข้อความ "กลยุทธ์นี้ไม่มีสัญญาณ..." เมื่อ totalTrades = 0
    - _Requirements: 4.1, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 8.5 สร้าง save section ใน `src/pages/PineImport.tsx`
    - แสดงปุ่ม "บันทึก Strategy" และ input ชื่อหลัง backtest เสร็จ
    - validate ชื่อ (ตัวอักษร ตัวเลข space เท่านั้น) ก่อนส่ง
    - เรียก `POST /api/pine-script/save` เมื่อกดบันทึก
    - แสดงข้อความยืนยัน "บันทึก strategy '{name}' สำเร็จ พร้อมใช้งานใน Live Bot แล้ว"
    - แสดง error เมื่อชื่อซ้ำหรือมีอักขระพิเศษ
    - _Requirements: 6.1, 6.2, 6.5, 6.6, 6.7_

  - [x] 8.6 สร้าง imported strategies list section ใน `src/pages/PineImport.tsx`
    - เรียก `GET /api/pine-script/list` เมื่อ component mount
    - แสดงรายการ SavedStrategy ที่มี prefix `PINE_` ในส่วน "Imported Strategies"
    - _Requirements: 7.1, 7.2_

- [x] 9. Final Checkpoint — ทดสอบ end-to-end workflow
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks ที่มี `*` เป็น optional สามารถข้ามได้เพื่อ MVP ที่เร็วขึ้น
- แต่ละ task อ้างอิง requirements เฉพาะเพื่อ traceability
- Checkpoint ช่วยให้ validate ได้ทีละ layer ก่อนไปต่อ
- Property tests ใช้ Hypothesis (Python) และ fast-check (Node.js) ตามที่มีอยู่ในโปรเจกต์
