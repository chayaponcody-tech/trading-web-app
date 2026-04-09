# Requirements Document

## Introduction

Refactor ระบบ Python Strategy AI (`packages/strategy-ai/main.py`) จากโครงสร้างไฟล์เดียวที่รวม logic ทุกอย่างไว้ด้วยกัน ให้กลายเป็นระบบ Registry Pattern ที่รองรับ strategy หลายตัวแบบ scalable

ปัจจุบัน Node.js ส่ง signal ที่คำนวณแล้วมาให้ Python validate เท่านั้น ระบบใหม่จะให้ Node.js ส่งข้อมูลดิบ (OHLCV) มา แล้ว Python เป็นผู้คำนวณ signal, stoploss, และ confidence เอง โดยเลือก strategy ตาม parameter ที่ส่งมา

strategy แรกที่ต้องการคือ `BollingerBreakout` ซึ่ง implement ตาม TradingView script "Bollinger Band Breakout With Volatility Stoploss" (EMA-based, 1x SD, period 30, long-only breakout)

## Glossary

- **StrategyRegistry**: ระบบกลางที่เก็บและจัดการ strategy ทั้งหมด รองรับการลงทะเบียนและค้นหา strategy ด้วย key string
- **BaseStrategy**: interface มาตรฐานที่ strategy ทุกตัวต้อง implement ประกอบด้วย `compute_signal()` และ `get_metadata()`
- **BollingerBreakout**: strategy แรกที่ implement ตาม TradingView "Bollinger Band Breakout With Volatility Stoploss" — EMA-based Bollinger Bands, 1x SD, period 30, long-only
- **ConfidenceEngine**: module ที่ validate signal จาก strategy และคำนวณ confidence score (0.0–1.0) โดยใช้ rule-based หรือ LLM
- **OHLCV**: ข้อมูลราคา Open, High, Low, Close, Volume ที่ Node.js ส่งมาเป็น array
- **Signal**: ผลลัพธ์จาก strategy — `"LONG"`, `"SHORT"`, หรือ `"NONE"`
- **Stoploss**: ราคา stoploss ที่คำนวณโดย strategy (absolute price value)
- **Confidence**: ค่า 0.0–1.0 ที่ ConfidenceEngine ประเมินความน่าเชื่อถือของ signal
- **Node.js**: ระบบ backend หลัก (`packages/bot-engine`) ที่เรียกใช้ Python ผ่าน HTTP
- **Strategy AI Service**: Python FastAPI service ที่รัน strategy และ confidence engine

---

## Requirements

### Requirement 1: Strategy Registry

**User Story:** As a developer, I want a central registry for strategies, so that I can add new strategies without modifying existing code or Node.js integration.

#### Acceptance Criteria

1. THE StrategyRegistry SHALL store strategy instances indexed by a unique string key (เช่น `"bb_breakout"`)
2. THE StrategyRegistry SHALL provide a `register(key, strategy)` method สำหรับลงทะเบียน strategy
3. WHEN a strategy key is requested, THE StrategyRegistry SHALL return the corresponding strategy instance
4. IF a requested strategy key does not exist in the registry, THEN THE StrategyRegistry SHALL raise a descriptive error ระบุ key ที่ไม่พบ
5. THE StrategyRegistry SHALL list all registered strategy keys เมื่อถูกเรียก

---

### Requirement 2: BaseStrategy Interface

**User Story:** As a developer, I want a standard interface for all strategies, so that the registry and confidence engine can interact with any strategy uniformly.

#### Acceptance Criteria

1. THE BaseStrategy SHALL define a `compute_signal(closes, highs, lows, volumes, params)` method ที่ return `{"signal": str, "stoploss": float | None, "metadata": dict}`
2. THE BaseStrategy SHALL define a `get_metadata()` method ที่ return `{"name": str, "description": str, "version": str}`
3. WHEN a concrete strategy does not implement `compute_signal`, THEN THE BaseStrategy SHALL raise `NotImplementedError`
4. THE BaseStrategy SHALL accept `closes`, `highs`, `lows`, `volumes` เป็น `list[float]` และ `params` เป็น `dict`

---

### Requirement 3: BollingerBreakout Strategy

**User Story:** As a trader, I want a Bollinger Band Breakout strategy with volatility-based stoploss, so that I can trade long-only breakouts with defined risk.

#### Acceptance Criteria

1. THE BollingerBreakout SHALL compute Bollinger Bands โดยใช้ EMA (ไม่ใช่ SMA) เป็น basis, standard deviation 1x, และ period 30
2. WHEN ราคาปิดล่าสุดทะลุเหนือ upper band, THE BollingerBreakout SHALL return `signal = "LONG"`
3. WHILE ไม่มี breakout เกิดขึ้น, THE BollingerBreakout SHALL return `signal = "NONE"`
4. THE BollingerBreakout SHALL คำนวณ stoploss โดยใช้ ATR-based volatility stoploss (ATR period 14, multiplier 1.5) ต่ำกว่าราคาปิดล่าสุด
5. IF ข้อมูล closes มีน้อยกว่า 30 แท่ง, THEN THE BollingerBreakout SHALL return `signal = "NONE"` และ `stoploss = None`
6. THE BollingerBreakout SHALL return metadata ประกอบด้วย `ema_basis`, `upper_band`, `lower_band`, `atr`, `stoploss_price`
7. THE BollingerBreakout SHALL implement BaseStrategy interface ครบถ้วน

---

### Requirement 4: New Analyze Endpoint รับ OHLCV

**User Story:** As a Node.js developer, I want a new endpoint that accepts raw OHLCV data and a strategy name, so that Python handles all signal computation independently.

#### Acceptance Criteria

1. THE Strategy_AI_Service SHALL expose endpoint `POST /strategy/analyze` ที่รับ `{ symbol, strategy, closes, highs, lows, volumes, params? }`
2. WHEN a valid request is received, THE Strategy_AI_Service SHALL look up the strategy from StrategyRegistry, compute signal, run ConfidenceEngine, และ return `{ signal, confidence, stoploss, reason, metadata }`
3. IF `strategy` field ไม่ตรงกับ key ใดใน registry, THEN THE Strategy_AI_Service SHALL return HTTP 400 พร้อม error message ระบุ strategy ที่ไม่พบ
4. IF `closes` array มีน้อยกว่า 2 elements, THEN THE Strategy_AI_Service SHALL return HTTP 422 พร้อม validation error
5. THE Strategy_AI_Service SHALL return response ภายใน 3 วินาที สำหรับ request ที่มี closes ไม่เกิน 500 แท่ง
6. THE Strategy_AI_Service SHALL expose endpoint `GET /strategy/list` ที่ return รายชื่อ strategy ทั้งหมดที่ลงทะเบียนไว้

---

### Requirement 5: ConfidenceEngine Integration

**User Story:** As a trader, I want the confidence engine to validate signals from any strategy, so that low-quality signals are filtered out before reaching Node.js.

#### Acceptance Criteria

1. THE ConfidenceEngine SHALL accept `signal`, `features`, `regime`, และ `strategy_metadata` เป็น input
2. THE ConfidenceEngine SHALL return `confidence` (float 0.0–1.0) และ `reason` (string)
3. WHEN `confidence` ต่ำกว่า threshold (default 0.60), THE ConfidenceEngine SHALL set `signal = "NONE"` ใน response
4. WHERE `mode = "full"` และ confidence อยู่ในช่วง 0.50–0.70, THE ConfidenceEngine SHALL call LLM เพื่อ blend confidence score
5. IF OPENROUTER_API_KEY ไม่ได้ตั้งค่า, THEN THE ConfidenceEngine SHALL skip LLM call และใช้ rule-based confidence เท่านั้น

---

### Requirement 6: Node.js Integration

**User Story:** As a Node.js developer, I want BotManager to call the new endpoint with OHLCV data, so that Python handles strategy computation end-to-end.

#### Acceptance Criteria

1. WHEN `strategyAiMode` ไม่ใช่ `"off"` และ bot config มี `strategyName` field, THE BotManager SHALL call `POST /strategy/analyze` แทน `POST /analyze-signal`
2. THE BotManager SHALL ส่ง `closes`, `highs`, `lows`, `volumes` จาก klines data ล่าสุด 100 แท่งไปกับ request
3. WHEN Python returns `signal = "LONG"` และ `confidence >= threshold`, THE BotManager SHALL use `stoploss` จาก Python response เป็น initial stoploss ของ position
4. IF Python service ไม่ตอบสนองภายใน 5 วินาที, THEN THE BotManager SHALL fallback ไปใช้ signal จาก Node.js SignalEngine เดิม และ log warning
5. THE BotManager SHALL log `strategy`, `signal`, `confidence`, และ `stoploss` ทุกครั้งที่ได้รับ response จาก Python

---

### Requirement 7: Backward Compatibility

**User Story:** As a developer, I want the existing `/analyze-signal` endpoint to remain functional, so that bots using the old workflow are not broken.

#### Acceptance Criteria

1. THE Strategy_AI_Service SHALL keep endpoint `POST /analyze-signal` ทำงานได้ตามเดิม
2. WHEN request ส่งมาที่ `/analyze-signal`, THE Strategy_AI_Service SHALL process ด้วย logic เดิม (feature engineering + confidence scoring) โดยไม่ผ่าน StrategyRegistry
3. THE Strategy_AI_Service SHALL return response format เดิมจาก `/analyze-signal` โดยไม่เปลี่ยนแปลง field ใด

---

### Requirement 8: Strategy Extensibility

**User Story:** As a developer, I want to add new strategies by creating a new file and registering it, so that the system scales without modifying core logic.

#### Acceptance Criteria

1. THE StrategyRegistry SHALL allow registration of new strategies โดยการ import และเรียก `register()` ใน entry point เท่านั้น
2. WHEN a new strategy file is added ใน `strategies/` directory และลงทะเบียนใน registry, THE Strategy_AI_Service SHALL serve it ผ่าน `/strategy/analyze` โดยไม่ต้องแก้ไข endpoint code
3. THE BaseStrategy SHALL support optional `use_llm: bool` flag ใน params เพื่อให้ strategy สามารถ request LLM analysis ได้
