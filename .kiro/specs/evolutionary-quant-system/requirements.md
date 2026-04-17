# Requirements Document

## Introduction

Evolutionary Quant System คือการ transform ระบบ trading bot monorepo (Node.js/Python) ปัจจุบันให้กลายเป็น Multi-Agent System ที่สามารถ research, code, test, และ deploy strategy ได้ด้วยตัวเอง ระบบประกอบด้วย 6 agent ที่ทำงานร่วมกันแบบ closed-loop: Sentiment Agent, Data Agent, Alpha Agent, Backtest Agent, และ Strategy Management Agent โดยมีเป้าหมายหลักคือ evolutionary loop ที่ strategy ที่ล้มเหลวจะถูก mutate และ improve อัตโนมัติ

## Glossary

- **Sentiment_Agent**: Agent ที่คำนวณ Sentiment Score จาก Funding Rate และ Open Interest
- **Data_Agent**: Agent ที่ทำ ETL pipeline สำหรับ OHLCV data แบบ scheduled
- **Alpha_Agent**: Agent ที่ใช้ LLM สร้าง Python strategy code จากงานวิจัย
- **Backtest_Agent**: Agent ที่ทดสอบ strategy ด้วย Walk-Forward Optimization และตัดสิน approve/reject
- **Strategy_Manager**: Agent ที่จัดการ portfolio ของ approved strategies และ capital allocation
- **Sentiment_Score**: ค่าตัวเลขในช่วง 0–100 แทนอารมณ์ตลาด (0 = bearish สุด, 100 = bullish สุด)
- **Alpha_Decay_Score**: ค่าตัวเลขที่วัดการเสื่อมประสิทธิภาพของ strategy จาก consecutive losses และ drawdown
- **Approved_Strategy_Registry**: ฐานข้อมูล persistent สำหรับเก็บ strategy ที่ผ่าน backtest approval gate
- **Walk_Forward_Optimization**: การทดสอบ strategy โดยแบ่งข้อมูลเป็น train/test windows ตามลำดับเวลา
- **Sandbox_Executor**: สภาพแวดล้อมที่จำกัดสำหรับ execute Python code ที่ LLM สร้างขึ้น
- **Volatility_Adjusted_Sizing**: การคำนวณ capital allocation ตาม inverse volatility ของแต่ละ strategy
- **Evolutionary_Loop**: กระบวนการที่ strategy ที่ถูก reject หรือ decay จะถูกส่งกลับ Alpha_Agent เพื่อ mutate
- **OHLCV**: Open, High, Low, Close, Volume ข้อมูลราคาแบบ candlestick
- **Sharpe_Ratio**: อัตราส่วน risk-adjusted return คำนวณจาก mean return หารด้วย standard deviation
- **BaseStrategy**: Python abstract class ที่ strategy ทุกตัวต้อง extend จาก `packages/strategy-ai/base_strategy.py`
- **BinanceAdapter**: JavaScript class ที่ wrap CCXT สำหรับเชื่อมต่อ Binance Futures API ใน `packages/exchange-connector/src/BinanceAdapter.js`
- **OpenRouterClient**: JavaScript HTTP client สำหรับเรียก LLM ผ่าน OpenRouter API ใน `packages/ai-agents/src/OpenRouterClient.js`

---

## Requirements

### Requirement 1: Sentiment Score Pipeline

**User Story:** As a quant trader, I want ระบบคำนวณ Sentiment Score จาก Funding Rate และ Open Interest อัตโนมัติ so that agent อื่นสามารถใช้ข้อมูล market sentiment ในการตัดสินใจได้โดยไม่ต้องรอ news

#### Acceptance Criteria

1. WHEN Sentiment_Agent ถูก trigger, THE Sentiment_Agent SHALL ดึง Funding Rate และ Open Interest จาก BinanceAdapter สำหรับ symbol ที่กำหนด
2. THE Sentiment_Agent SHALL คำนวณ Sentiment_Score ในช่วง 0–100 จาก Funding Rate และ OI change percentage โดยใช้ weighted formula ที่กำหนดไว้
3. WHEN Funding Rate มีค่าสูงกว่า 0.1% (bullish extreme), THE Sentiment_Agent SHALL ให้ Sentiment_Score ต่ำกว่า 40 (contrarian bearish signal)
4. WHEN Funding Rate มีค่าต่ำกว่า -0.1% (bearish extreme), THE Sentiment_Agent SHALL ให้ Sentiment_Score สูงกว่า 60 (contrarian bullish signal)
5. THE Sentiment_Agent SHALL เก็บ Sentiment_Score พร้อม timestamp ลงใน data store ที่ agent อื่นสามารถ query ได้
6. WHEN การดึงข้อมูลจาก BinanceAdapter ล้มเหลว, THEN THE Sentiment_Agent SHALL บันทึก error และ return Sentiment_Score เป็น 50 (neutral)
7. FOR ALL valid Funding Rate และ OI inputs, THE Sentiment_Agent SHALL คำนวณ Sentiment_Score ที่อยู่ในช่วง [0, 100] เสมอ (invariant property)

---

### Requirement 2: Scheduled OHLCV ETL Pipeline

**User Story:** As a quant system, I want ดึง OHLCV data จาก Binance แบบ scheduled อัตโนมัติ so that agent อื่นสามารถเข้าถึงข้อมูลที่สะอาดและพร้อมใช้งานได้ทันที

#### Acceptance Criteria

1. THE Data_Agent SHALL ดึง OHLCV data จาก BinanceAdapter ตาม schedule ที่กำหนด (ค่า default: ทุก 15 นาที) สำหรับ symbol list ที่ configure ไว้
2. WHEN ดึงข้อมูลสำเร็จ, THE Data_Agent SHALL ตรวจสอบ missing values และ fill ด้วย forward-fill method
3. WHEN พบ outlier ที่มีค่าเกิน 5 standard deviations จาก rolling mean 20 periods, THE Data_Agent SHALL replace ด้วยค่า rolling median แทน
4. THE Data_Agent SHALL บันทึก OHLCV data ในรูปแบบ Parquet หรือ CSV ที่รองรับ vectorized access
5. WHEN Data_Agent บันทึกข้อมูลแล้ว, THE Data_Agent SHALL อัปเดต metadata (symbol, interval, last_updated, row_count) ใน data store
6. IF การดึงข้อมูลล้มเหลวติดต่อกัน 3 ครั้ง, THEN THE Data_Agent SHALL ส่ง alert notification และหยุด retry จนกว่าจะถึง schedule รอบถัดไป
7. FOR ALL OHLCV datasets ที่บันทึกแล้ว, THE Data_Agent SHALL รับประกันว่า timestamp ของแต่ละ row เรียงลำดับ ascending และไม่มี duplicate (invariant property)
8. FOR ALL valid OHLCV data ที่เขียนลง Parquet/CSV, THE Data_Agent SHALL รับประกันว่าการอ่านกลับมาได้ข้อมูลที่เทียบเท่ากัน (round-trip property)

---

### Requirement 3: Alpha Generation Pipeline

**User Story:** As a quant researcher, I want ระบบใช้ LLM อ่านงานวิจัยและสร้าง Python strategy code อัตโนมัติ so that ระบบสามารถค้นพบ alpha ใหม่ได้โดยไม่ต้องมี human intervention

#### Acceptance Criteria

1. WHEN Alpha_Agent ได้รับ research topic หรือ mutation request, THE Alpha_Agent SHALL ส่ง prompt ไปยัง OpenRouterClient เพื่อขอ Python strategy code ที่ extend BaseStrategy
2. THE Alpha_Agent SHALL ตรวจสอบ syntax ของ code ที่ได้รับจาก LLM ด้วย Python `ast.parse()` ก่อน execute
3. THE Alpha_Agent SHALL ตรวจสอบว่า code มี class ที่ extend BaseStrategy อย่างน้อย 1 class
4. WHEN code ผ่าน syntax check, THE Alpha_Agent SHALL execute code ใน Sandbox_Executor ที่จำกัด imports เฉพาะ whitelist ที่กำหนด (numpy, pandas, vectorbt)
5. IF code มี syntax error หรือ runtime error, THEN THE Alpha_Agent SHALL ส่ง stack trace กลับไปยัง LLM พร้อม self-correction prompt และ retry
6. THE Alpha_Agent SHALL หยุด retry หลังจากพยายาม 5 ครั้ง และ mark strategy นั้นว่า "generation_failed"
7. WHEN code ผ่าน sandbox execution สำเร็จ, THE Alpha_Agent SHALL register strategy ใน FastAPI `/strategy/register-dynamic` endpoint
8. FOR ALL Python code ที่ LLM สร้างขึ้น, THE Sandbox_Executor SHALL ป้องกัน import ของ modules นอก whitelist เสมอ (security invariant)
9. FOR ALL retry attempts, THE Alpha_Agent SHALL รับประกันว่าจำนวน retry ไม่เกิน 5 ครั้งเสมอ (termination invariant)

---

### Requirement 4: Sandbox Execution Environment

**User Story:** As a system administrator, I want sandbox ที่ปลอดภัยสำหรับ execute LLM-generated code so that ระบบไม่ถูก compromise จาก malicious หรือ buggy code

#### Acceptance Criteria

1. THE Sandbox_Executor SHALL อนุญาตเฉพาะ imports จาก whitelist: `numpy`, `pandas`, `vectorbt`, `math`, `statistics`, `collections`, `itertools`
2. WHEN code พยายาม import module นอก whitelist, THEN THE Sandbox_Executor SHALL raise `ImportError` และ block การ execute
3. THE Sandbox_Executor SHALL จำกัด execution time ไม่เกิน 30 วินาทีต่อ strategy
4. WHEN execution เกิน 30 วินาที, THEN THE Sandbox_Executor SHALL terminate process และ return timeout error
5. THE Sandbox_Executor SHALL execute code ใน isolated namespace ที่ไม่มี access ถึง file system หรือ network
6. FOR ALL arbitrary Python code inputs, THE Sandbox_Executor SHALL ไม่อนุญาต `os`, `sys`, `subprocess`, `socket`, `requests`, `open` เสมอ (security property)

---

### Requirement 5: Backtest Approval Gate

**User Story:** As a risk manager, I want ระบบทดสอบ strategy อัตโนมัติและ approve เฉพาะ strategy ที่มีคุณภาพสูงพอ so that มีเฉพาะ strategy ที่ผ่านเกณฑ์เท่านั้นที่ถูก deploy ใน live trading

#### Acceptance Criteria

1. WHEN Backtest_Agent ได้รับ strategy ใหม่จาก Alpha_Agent, THE Backtest_Agent SHALL รัน Walk_Forward_Optimization โดยใช้ `packages/bot-engine/src/Backtester.js` ที่มีอยู่แล้ว
2. THE Backtest_Agent SHALL ทดสอบ strategy ใน market regime อย่างน้อย 3 ประเภท: bull, bear, sideways โดยใช้ historical data ที่ Data_Agent จัดเตรียมไว้
3. WHEN Sharpe_Ratio เฉลี่ยจาก walk-forward windows ทั้งหมดมีค่ามากกว่า 1.5, THE Backtest_Agent SHALL mark strategy ว่า "approved" และส่งต่อไปยัง Strategy_Manager
4. WHEN Sharpe_Ratio เฉลี่ยมีค่าน้อยกว่าหรือเท่ากับ 1.5, THE Backtest_Agent SHALL mark strategy ว่า "rejected" พร้อม rejection reason และส่ง feedback กลับไปยัง Alpha_Agent
5. THE Backtest_Agent SHALL บันทึกผล backtest ทั้งหมด (Sharpe, max drawdown, win rate, regime performance) ลงใน data store
6. WHEN strategy ถูก reject, THE Backtest_Agent SHALL ระบุ regime ที่ strategy ทำงานได้แย่ที่สุดใน rejection reason
7. FOR ALL backtest runs, THE Backtest_Agent SHALL รับประกันว่า approval decision เป็น deterministic: strategy เดิมกับ data เดิมต้องได้ผลเดิมเสมอ (determinism property)

---

### Requirement 6: Approved Strategy Registry

**User Story:** As a portfolio manager, I want registry ที่เก็บ approved strategies แบบ persistent so that ระบบสามารถ restart ได้โดยไม่สูญเสีย strategy ที่ผ่านการทดสอบแล้ว

#### Acceptance Criteria

1. THE Approved_Strategy_Registry SHALL เก็บข้อมูลของแต่ละ strategy: strategy_key, python_code, backtest_metrics, approved_at, status (active/retired)
2. WHEN Strategy_Manager register strategy ใหม่, THE Approved_Strategy_Registry SHALL persist ข้อมูลลงใน SQLite database ที่มีอยู่แล้วใน `packages/data-layer/src/DatabaseManager.js`
3. THE Approved_Strategy_Registry SHALL expose API สำหรับ query strategies ตาม status, Sharpe_Ratio, และ approved_at
4. WHEN ระบบ restart, THE Approved_Strategy_Registry SHALL โหลด approved strategies กลับมาครบถ้วนโดยไม่สูญหาย
5. FOR ALL strategy registrations, THE Approved_Strategy_Registry SHALL รับประกันว่า register แล้ว query กลับมาได้ข้อมูลเดิม (round-trip property)
6. FOR ALL duplicate registrations ด้วย strategy_key เดิม, THE Approved_Strategy_Registry SHALL update ข้อมูลแทนการ insert ซ้ำ (idempotence property)

---

### Requirement 7: Volatility-Adjusted Capital Allocation

**User Story:** As a portfolio manager, I want ระบบจัดสรร capital ตาม volatility ของแต่ละ strategy so that strategy ที่มี volatility สูงได้รับ capital น้อยกว่าเพื่อ equalize risk

#### Acceptance Criteria

1. THE Strategy_Manager SHALL คำนวณ volatility ของแต่ละ active strategy จาก standard deviation ของ daily returns ใน 30 วันล่าสุด
2. THE Strategy_Manager SHALL คำนวณ capital allocation ด้วย inverse volatility weighting: `weight_i = (1/vol_i) / sum(1/vol_j for all j)`
3. THE Strategy_Manager SHALL อัปเดต capital allocation ทุกครั้งที่มี strategy เพิ่มหรือลดออกจาก active pool
4. WHEN strategy ใดมี volatility เป็น 0 หรือ undefined, THE Strategy_Manager SHALL assign minimum allocation เท่ากับ 1% ของ total capital
5. FOR ALL capital allocation calculations, THE Strategy_Manager SHALL รับประกันว่า sum ของ allocations ทั้งหมดไม่เกิน total capital (budget invariant)
6. FOR ALL sets of strategies ที่มี volatility เท่ากัน, THE Strategy_Manager SHALL assign capital เท่ากันทุก strategy (equal treatment property)

---

### Requirement 8: Alpha Decay Detection และ Retirement

**User Story:** As a risk manager, I want ระบบตรวจจับ strategy ที่เสื่อมประสิทธิภาพและถอดออกอัตโนมัติ so that capital ไม่ถูกสูญเสียกับ strategy ที่หมดอายุ

#### Acceptance Criteria

1. THE Strategy_Manager SHALL คำนวณ Alpha_Decay_Score สำหรับแต่ละ active strategy โดยพิจารณา: จำนวน consecutive losses, rolling Sharpe_Ratio 30 วัน, และ max drawdown ใน 7 วันล่าสุด
2. WHEN Alpha_Decay_Score ของ strategy ใดเกิน threshold ที่กำหนด (default: 70/100), THE Strategy_Manager SHALL mark strategy นั้นว่า "decayed" และหยุด capital allocation ทันที
3. WHEN strategy ถูก mark ว่า "decayed", THE Strategy_Manager SHALL ส่ง strategy นั้นกลับไปยัง Alpha_Agent พร้อม decay metrics เพื่อ mutate
4. THE Strategy_Manager SHALL บันทึก decay event พร้อม timestamp และ metrics ลงใน data store
5. WHEN consecutive losses ของ strategy มีค่ามากกว่าหรือเท่ากับ 5 ครั้ง, THE Strategy_Manager SHALL trigger decay check ทันทีโดยไม่รอ scheduled review
6. FOR ALL Alpha_Decay_Score calculations, THE Strategy_Manager SHALL รับประกันว่า score อยู่ในช่วง [0, 100] เสมอ (invariant property)
7. FOR ALL strategies ที่มี consecutive losses เพิ่มขึ้น, THE Strategy_Manager SHALL รับประกันว่า Alpha_Decay_Score เพิ่มขึ้นหรือคงที่ (monotonic property)

---

### Requirement 9: Evolutionary Mutation Loop

**User Story:** As a quant system, I want ระบบ mutate strategy ที่ล้มเหลวอัตโนมัติ so that ระบบสามารถ improve ตัวเองได้โดยไม่ต้องมี human intervention

#### Acceptance Criteria

1. WHEN Alpha_Agent ได้รับ mutation request จาก Strategy_Manager, THE Alpha_Agent SHALL ส่ง prompt ไปยัง LLM พร้อม original strategy code, backtest metrics, และ failure reason
2. THE Alpha_Agent SHALL สร้าง mutated strategy ที่แตกต่างจาก original อย่างน้อย 1 parameter หรือ logic component
3. WHEN mutated strategy ถูกสร้างขึ้น, THE Alpha_Agent SHALL ส่งต่อไปยัง Backtest_Agent ผ่าน pipeline เดิม
4. THE Evolutionary_Loop SHALL รับประกันว่า strategy เดิมที่ถูก reject จะไม่ถูก register ซ้ำโดยไม่มีการ mutate
5. WHEN mutation ล้มเหลวติดต่อกัน 3 รอบสำหรับ strategy เดิม, THE Alpha_Agent SHALL archive strategy นั้นและหยุด mutation loop
6. THE Strategy_Manager SHALL maintain mutation history สำหรับแต่ละ strategy lineage เพื่อ track evolution
7. FOR ALL mutation cycles, THE Evolutionary_Loop SHALL รับประกันว่าจำนวน mutation attempts ต่อ strategy lineage ไม่เกิน 10 ครั้ง (termination invariant)

---

### Requirement 10: Agent Orchestration และ Inter-Agent Communication

**User Story:** As a system architect, I want agents ทั้งหมดสื่อสารกันผ่าน interface ที่ชัดเจน so that ระบบสามารถ scale และ debug ได้ง่าย

#### Acceptance Criteria

1. THE Evolutionary_Loop SHALL orchestrate การทำงานของ agents ตาม pipeline: Alpha_Agent → Backtest_Agent → Strategy_Manager → (decay) → Alpha_Agent
2. WHEN agent ใดใน pipeline ล้มเหลว, THE Evolutionary_Loop SHALL บันทึก error พร้อม agent name, timestamp, และ input payload
3. THE Evolutionary_Loop SHALL expose status endpoint ที่แสดงสถานะปัจจุบันของแต่ละ agent (idle, running, error)
4. WHEN Backtest_Agent ส่ง approved strategy ไปยัง Strategy_Manager, THE Strategy_Manager SHALL register strategy ใน Approved_Strategy_Registry ภายใน 5 วินาที
5. THE Data_Agent SHALL expose interface สำหรับ query OHLCV data ที่ agent อื่นสามารถเรียกใช้ได้โดยระบุ symbol, interval, และ date range
6. THE Sentiment_Agent SHALL expose interface สำหรับ query Sentiment_Score ล่าสุดและ historical scores ตาม symbol และ time range
7. IF agent ใดไม่ตอบสนองภายใน 60 วินาที, THEN THE Evolutionary_Loop SHALL mark agent นั้นว่า "timeout" และ skip ไปยัง step ถัดไปใน pipeline

---

### Requirement 11: Correctness Properties สำหรับ Property-Based Testing

**User Story:** As a QA engineer, I want correctness properties ที่ครอบคลุม core logic ของระบบ so that สามารถ detect regression bugs ได้อัตโนมัติ

#### Acceptance Criteria

1. FOR ALL valid (funding_rate, oi_change_pct) inputs, THE Sentiment_Agent SHALL คำนวณ Sentiment_Score ที่อยู่ในช่วง [0, 100] เสมอ — **Invariant Property**
2. FOR ALL OHLCV datasets ที่เขียนลง Parquet/CSV แล้วอ่านกลับมา, THE Data_Agent SHALL ได้ข้อมูลที่มี row count, column names, และ values เทียบเท่ากัน — **Round-Trip Property**
3. FOR ALL Python code inputs ที่มี import นอก whitelist, THE Sandbox_Executor SHALL raise ImportError เสมอ — **Security Invariant**
4. FOR ALL backtest runs ด้วย strategy เดิมและ data เดิม, THE Backtest_Agent SHALL ได้ Sharpe_Ratio เดิม (tolerance ±0.001) — **Determinism Property**
5. FOR ALL capital allocation calculations ที่มี N active strategies, THE Strategy_Manager SHALL รับประกันว่า sum(allocations) ≤ total_capital เสมอ — **Budget Invariant**
6. FOR ALL strategy registrations ใน Approved_Strategy_Registry, THE Approved_Strategy_Registry SHALL รับประกันว่า register(s) แล้ว lookup(s.key) ได้ข้อมูลเดิม — **Round-Trip Property**
7. FOR ALL strategies ที่มี consecutive_losses เพิ่มขึ้น, THE Strategy_Manager SHALL รับประกันว่า Alpha_Decay_Score(n+1) ≥ Alpha_Decay_Score(n) — **Monotonic Property**
8. FOR ALL mutation cycles, THE Alpha_Agent SHALL รับประกันว่า retry_count ≤ 5 เสมอ — **Termination Invariant**
9. FOR ALL sets of N strategies ที่มี volatility เท่ากัน, THE Strategy_Manager SHALL assign allocation เท่ากันทุก strategy — **Symmetry Property**
10. FOR ALL Sentiment_Score calculations ที่ใช้ input เดิม, THE Sentiment_Agent SHALL ได้ผลลัพธ์เดิมเสมอ — **Idempotence Property**
