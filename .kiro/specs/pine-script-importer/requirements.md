# Requirements Document

## Introduction

ฟีเจอร์ Pine Script Importer ช่วยให้ผู้ใช้สามารถนำโค้ด Pine Script จาก TradingView มาแปลงเป็น Python Strategy Class ที่ extend `BaseStrategy` โดยอัตโนมัติผ่าน AI (OpenRouter) จากนั้นสามารถ Backtest กลยุทธ์ที่แปลงแล้วได้ทันที และหากผลลัพธ์น่าพอใจ ผู้ใช้สามารถบันทึกกลยุทธ์นั้นเป็นชื่อที่กำหนดเองเพื่อใช้กับ Live Trading Bot ได้

## Glossary

- **PineScriptImporter**: ระบบหลักที่รับผิดชอบกระบวนการแปลง Pine Script ทั้งหมด
- **Converter**: โมดูล AI ที่ทำหน้าที่แปลง Pine Script เป็น Python BaseStrategy class
- **ConvertedStrategy**: Python class ที่ได้จากการแปลง ก่อนที่จะถูกบันทึกลงระบบ
- **SavedStrategy**: กลยุทธ์ที่ผู้ใช้บันทึกแล้ว มี strategy_key ที่ใช้งานได้จริงในระบบ
- **StrategyRegistry**: ระบบ registry ใน strategy-ai service สำหรับลงทะเบียนและเรียกใช้กลยุทธ์
- **Backtester**: ระบบ backtest ที่มีอยู่แล้วใน bot-engine ที่รองรับ `PYTHON:{strategy_key}`
- **PineScriptValidator**: โมดูลตรวจสอบความถูกต้องเบื้องต้นของ Pine Script ที่รับเข้ามา
- **StrategyPersistence**: ระบบจัดเก็บ Python strategy code ลงไฟล์และลงทะเบียนใน StrategyRegistry
- **UI_Importer**: หน้า UI ใน React/TypeScript สำหรับ workflow การ import Pine Script

---

## Requirements

### Requirement 1: รับ Pine Script จากผู้ใช้

**User Story:** ในฐานะ trader ฉันต้องการวาง Pine Script code ลงในช่อง input เพื่อเริ่มกระบวนการแปลง

#### Acceptance Criteria

1. THE UI_Importer SHALL แสดง textarea สำหรับรับ Pine Script code ที่มีความจุไม่น้อยกว่า 10,000 ตัวอักษร
2. WHEN ผู้ใช้วาง Pine Script code ที่มีความยาวน้อยกว่า 10 ตัวอักษร, THE PineScriptValidator SHALL แสดงข้อความแจ้งเตือนว่า "Pine Script ไม่ถูกต้องหรือสั้นเกินไป"
3. WHEN ผู้ใช้วาง Pine Script code ที่มีความยาวเกิน 50,000 ตัวอักษร, THE PineScriptValidator SHALL แสดงข้อความแจ้งเตือนว่า "Pine Script ยาวเกินขีดจำกัด (50,000 ตัวอักษร)"
4. THE PineScriptValidator SHALL ตรวจสอบว่า input มี keyword `//@version` หรือ `strategy(` หรือ `indicator(` อย่างน้อยหนึ่งรายการก่อนส่งไปแปลง
5. IF input ไม่ผ่านการตรวจสอบของ PineScriptValidator, THEN THE UI_Importer SHALL ปิดใช้งานปุ่ม "แปลง" และแสดงข้อความแจ้งเตือนที่ชัดเจน

---

### Requirement 2: แปลง Pine Script เป็น Python BaseStrategy ด้วย AI

**User Story:** ในฐานะ trader ฉันต้องการให้ระบบแปลง Pine Script ของฉันเป็น Python strategy class โดยอัตโนมัติ

#### Acceptance Criteria

1. WHEN ผู้ใช้กดปุ่ม "แปลง", THE Converter SHALL ส่ง Pine Script code ไปยัง OpenRouter API พร้อม system prompt ที่ระบุโครงสร้าง BaseStrategy
2. THE Converter SHALL ส่ง prompt ที่ประกอบด้วย: Pine Script code, โครงสร้าง BaseStrategy interface, และตัวอย่าง strategy ที่มีอยู่แล้วในระบบ
3. WHEN OpenRouter API ตอบกลับสำเร็จ, THE Converter SHALL แยก Python code block ออกจาก response และส่งกลับเป็น ConvertedStrategy
4. THE Converter SHALL ตรวจสอบว่า Python code ที่ได้มี class ที่ extend `BaseStrategy` และมี method `compute_signal` และ `get_metadata`
5. IF OpenRouter API ไม่ตอบสนองภายใน 30 วินาที, THEN THE Converter SHALL คืนค่า error พร้อมข้อความ "การแปลงหมดเวลา กรุณาลองใหม่"
6. IF OpenRouter API ตอบกลับแต่ Python code ที่ได้ไม่มีโครงสร้าง BaseStrategy ที่ถูกต้อง, THEN THE Converter SHALL คืนค่า error พร้อมข้อความ "ไม่สามารถแปลงได้ กรุณาตรวจสอบ Pine Script"
7. WHILE การแปลงกำลังดำเนินการ, THE UI_Importer SHALL แสดง loading indicator และปิดใช้งานปุ่ม "แปลง"

---

### Requirement 3: แสดง Preview Python Code ที่แปลงแล้ว

**User Story:** ในฐานะ trader ฉันต้องการดู Python code ที่ถูกแปลงก่อนที่จะ backtest เพื่อตรวจสอบความถูกต้อง

#### Acceptance Criteria

1. WHEN การแปลงสำเร็จ, THE UI_Importer SHALL แสดง Python code ใน code editor แบบ read-only พร้อม syntax highlighting
2. THE UI_Importer SHALL แสดงปุ่ม "แปลงใหม่" เพื่อให้ผู้ใช้สามารถส่ง Pine Script ไปแปลงซ้ำได้
3. THE UI_Importer SHALL แสดงปุ่ม "รัน Backtest" ที่ active เฉพาะเมื่อมี ConvertedStrategy พร้อมใช้งาน
4. WHERE ผู้ใช้ต้องการแก้ไข Python code ด้วยตนเอง, THE UI_Importer SHALL อนุญาตให้แก้ไข code ใน editor ก่อนรัน backtest

---

### Requirement 4: รัน Backtest กับ ConvertedStrategy

**User Story:** ในฐานะ trader ฉันต้องการทดสอบกลยุทธ์ที่แปลงแล้วกับข้อมูลราคาจริงก่อนตัดสินใจบันทึก

#### Acceptance Criteria

1. THE UI_Importer SHALL แสดง form สำหรับกำหนดค่า backtest ประกอบด้วย: symbol, interval, tpPercent, slPercent, leverage, capital, startDate, endDate
2. WHEN ผู้ใช้กดปุ่ม "รัน Backtest", THE PineScriptImporter SHALL ลงทะเบียน ConvertedStrategy ใน StrategyRegistry ชั่วคราวด้วย key รูปแบบ `PINE_TEMP_{uuid}`
3. WHEN ConvertedStrategy ถูกลงทะเบียนชั่วคราวแล้ว, THE Backtester SHALL รัน backtest โดยใช้ strategy key `PYTHON:PINE_TEMP_{uuid}` ตามกระบวนการ backtest ที่มีอยู่
4. IF ConvertedStrategy มี Python syntax error, THEN THE PineScriptImporter SHALL คืนค่า error พร้อมข้อความ "Python code ไม่ถูกต้อง: {error_detail}" โดยไม่รัน backtest
5. WHILE backtest กำลังดำเนินการ, THE UI_Importer SHALL แสดง loading indicator
6. THE PineScriptImporter SHALL ลบ temporary strategy key ออกจาก StrategyRegistry หลังจาก backtest เสร็จสิ้นหรือเกิด error

---

### Requirement 5: แสดงผลลัพธ์ Backtest

**User Story:** ในฐานะ trader ฉันต้องการดูผลลัพธ์ backtest พร้อม equity curve และรายการ trade เพื่อประเมินกลยุทธ์

#### Acceptance Criteria

1. WHEN backtest เสร็จสิ้น, THE UI_Importer SHALL แสดง metrics หลัก ได้แก่: Net PnL%, Win Rate, Total Trades, Sharpe Ratio, Max Drawdown, Profit Factor
2. THE UI_Importer SHALL แสดง equity curve chart แบบ line chart ตามข้อมูล equityCurve จาก backtest result
3. THE UI_Importer SHALL แสดงรายการ trades ในตาราง ประกอบด้วย: type, entryPrice, exitPrice, entryTime, exitTime, pnl, exitReason
4. IF backtest คืนค่า error, THEN THE UI_Importer SHALL แสดงข้อความ error ที่ชัดเจนและปุ่ม "ลองใหม่"
5. IF totalTrades เท่ากับ 0, THEN THE UI_Importer SHALL แสดงข้อความ "กลยุทธ์นี้ไม่มีสัญญาณในช่วงเวลาที่เลือก กรุณาปรับพารามิเตอร์"

---

### Requirement 6: บันทึก Strategy

**User Story:** ในฐานะ trader ฉันต้องการบันทึกกลยุทธ์ที่ผ่าน backtest แล้วด้วยชื่อที่กำหนดเองเพื่อใช้งานต่อ

#### Acceptance Criteria

1. WHEN backtest เสร็จสิ้นโดยไม่มี error, THE UI_Importer SHALL แสดงปุ่ม "บันทึก Strategy" พร้อม input สำหรับกรอกชื่อ
2. THE PineScriptImporter SHALL รับชื่อ strategy จากผู้ใช้และแปลงเป็น strategy_key ในรูปแบบ `PINE_{UPPERCASE_NAME}` (เช่น "My EMA" → `PINE_MY_EMA`)
3. WHEN ผู้ใช้กดบันทึก, THE StrategyPersistence SHALL บันทึก Python code ลงไฟล์ที่ `packages/strategy-ai/strategies/pine_{snake_case_name}.py`
4. WHEN ไฟล์ถูกบันทึกแล้ว, THE StrategyPersistence SHALL ลงทะเบียน strategy ใน StrategyRegistry ด้วย key `PINE_{UPPERCASE_NAME}` แบบถาวร
5. IF strategy_key ซ้ำกับที่มีอยู่แล้วใน StrategyRegistry, THEN THE PineScriptImporter SHALL แจ้งเตือนผู้ใช้และขอให้เปลี่ยนชื่อ
6. IF ชื่อ strategy มีอักขระพิเศษนอกจาก ตัวอักษร ตัวเลข และ space, THEN THE PineScriptImporter SHALL แสดงข้อความ "ชื่อ strategy ใช้ได้เฉพาะตัวอักษร ตัวเลข และ space"
7. WHEN บันทึกสำเร็จ, THE UI_Importer SHALL แสดงข้อความยืนยัน "บันทึก strategy '{name}' สำเร็จ พร้อมใช้งานใน Live Bot แล้ว"

---

### Requirement 7: Strategy ที่บันทึกแล้วปรากฏใน Strategy Selector

**User Story:** ในฐานะ trader ฉันต้องการเห็น strategy ที่ import มาปรากฏในรายการ strategy selector สำหรับ live bot

#### Acceptance Criteria

1. WHEN SavedStrategy ถูกลงทะเบียนใน StrategyRegistry แล้ว, THE StrategyRegistry SHALL คืนค่า key ของ SavedStrategy ใน endpoint `GET /strategy/list`
2. THE UI_Importer SHALL แสดงรายการ SavedStrategy ทั้งหมดที่มี prefix `PINE_` แยกออกมาในส่วน "Imported Strategies"
3. WHEN ผู้ใช้เลือก SavedStrategy ใน bot configuration, THE Backtester SHALL รัน backtest ด้วย strategy key `PYTHON:PINE_{NAME}` ได้สำเร็จ
4. THE StrategyPersistence SHALL โหลด SavedStrategy ทั้งหมดจากไฟล์ใน `packages/strategy-ai/strategies/` ที่มี prefix `pine_` โดยอัตโนมัติเมื่อ strategy-ai service เริ่มต้น

---

### Requirement 8: API Endpoint สำหรับ Pine Script Conversion

**User Story:** ในฐานะ developer ฉันต้องการ API endpoint ที่ชัดเจนสำหรับ workflow การแปลง Pine Script

#### Acceptance Criteria

1. THE PineScriptImporter SHALL เปิดใช้งาน endpoint `POST /pine-script/convert` ที่รับ `{ pineScript: string }` และคืนค่า `{ pythonCode: string, className: string }`
2. THE PineScriptImporter SHALL เปิดใช้งาน endpoint `POST /pine-script/save` ที่รับ `{ pythonCode: string, name: string }` และคืนค่า `{ strategyKey: string, message: string }`
3. THE PineScriptImporter SHALL เปิดใช้งาน endpoint `GET /pine-script/list` ที่คืนค่ารายการ SavedStrategy ทั้งหมดที่มี prefix `PINE_`
4. IF request ไปยัง `POST /pine-script/convert` ไม่มี field `pineScript`, THEN THE PineScriptImporter SHALL คืนค่า HTTP 400 พร้อม `{ error: "pineScript is required" }`
5. IF request ไปยัง `POST /pine-script/save` มี `name` ที่ซ้ำกับ strategy ที่มีอยู่, THEN THE PineScriptImporter SHALL คืนค่า HTTP 409 พร้อม `{ error: "Strategy name already exists" }`
