---
tags: [architecture, overview, documentation, quant-engine]
---
# CryptoSmartTrade — Technical System Documentation

## Stack Overview

```
Frontend:     React 19 + TypeScript + Vite + lightweight-charts
Backend:      Node.js (ESM) — Express via API Gateway (Monolith-Lite)
AI Layer:     Python 3 — FastAPI (strategy-ai & quant-engine microservices)
Database:     SQLite (better-sqlite3 via data-layer repositories)
Exchange:     Binance USDT-M Futures via CCXT (BinanceAdapter)
AI Provider:  OpenRouter (LLM calls for Reflection, Review, and Evolution)
```

---

## Architecture: Monorepo (npm workspaces)

```
packages/
  api-gateway/        — Express HTTP server, routes, Swagger
  bot-engine/         — Core trading logic (Backtester, BotManager, SignalEngine, CircuitBreaker)
  data-layer/         — SQLite repositories (Trade, Bot, Config, MarketFeatures)
  quant-engine/       — Evolutionary strategy generator + Decay monitor (Python)
  strategy-ai/        — Standard/Batch Signal Engine + VBT Optimizer (Python)
  exchange-connector/ — BinanceAdapter (CCXT wrapper)
  ai-agents/          — LLM agents (Reflection, Trailing, Optimizer, Reviewer)
  shared/             — AnalyticsUtils, Indicators, config constants
research/             — Markdown knowledge base (Secondary Brain)
src/                  — React 19 frontend
```

---

## 📚 System Registries (รายละเอียดทางเทคนิค)
*เพื่อความระเบียบและรองรับการขยายตัว ข้อมูลรายละเอียดถูกแยกออกเป็นไฟล์ดังนี้:*

1.  **[Strategy Registry](file:///d:/Crypto/trading-web-app/research/strategy_registry.md)**: รายชื่อกลยุทธ์ทั้งหมด (JS & Python)
2.  **[Indicator Registry](file:///d:/Crypto/trading-web-app/research/indicator_registry.md)**: สูตรการคำนวณและดัชนีชี้วัดทางเทคนิค
3.  **[Market Features Registry](file:///d:/Crypto/trading-web-app/research/market_features_registry.md)**: รายละเอียด Alpha Factors และตัวกรองเชิงปริมาณ (Quant)
4.  **[AI Quant Lab Roadmap](file:///d:/Crypto/trading-web-app/research/AI_DRIVEN_QUANT_LAB.md)**: แผนการพัฒนา AI อัตโนมัติ (Alpha Factory & Auto Tuning)

---

## Module 1: API Endpoint Map (By Page)

แผนผังการเรียกใช้ API ในแต่ละหน้าหลักของระบบ:

| Page | Endpoint | Method | Purpose |
|---|---|---|---|
| **Market Analysis** | `/api/binance/klines` | GET | ดึงข้อมูลกราฟแท่งเทียน |
| | `/api/market/features` | GET | ดึงค่า TQI, OI, Funding Rate มาแสดงบนกราฟ |
| | `/api/strategy/list` | GET | ดึงรายชื่อกลยุทธ์มาใช้เลือกดู Overlay |
| **Strategy Mgmt** | `/api/bots` | GET | แสดงรายการบอททั้งหมดและสถานะ Live |
| | `/api/bots/start` | POST | สร้างและเริ่มรันบอทใหม่ |
| | `/api/bots/:id/stop` | POST | หยุดการทำงานของบอท |
| | `/api/strategy/optimize/vectorbt` | POST | สั่ง Optimize หาค่าที่ดีที่สุดก่อนเริ่มรัน |
| **Indicator Mgmt**| `/api/config/binance` | GET | อ่านค่า Config พื้นฐาน (Keys, Intervals) |
| | `/api/config/strategies` | GET/PATCH | อ่าน/แก้ไข Parameter เริ่มต้นของแต่ละ Indicator |
| **Market Features**| `/api/market/definitions` | GET | ดึงคำอธิบายและสูตรคำวณของแต่ละ Factor |
| | `/api/market/features` | GET | ดึงข้อมูล Real-time Microstructure Dashboard |

---

## Module 2: System Workflow (การทำงานเชิงลึก)

### 2.1 The Tick Loop (วงจรการทำงานของบอท)
บอทแต่ละตัวทำงานบน `setInterval` ทุก 30 วินาที ผ่าน `BotManager`:

1.  **Health Check**: ตรวจสอบ **Circuit Breaker**; หาก API ล่มหรือ Error บ่อย ระบบจะ Skip Tick นี้ทันที
2.  **State Sync**:
    *   ดึง `Klines` (ราคา), `Ticker` (ราคาปัจจุบัน), และ `AccountInfo` (Margin/Positions) แบบขนาน (Parallel)
    *   ตรวจสอบว่ามี Position ที่ "หลุด" (Orphan) ใน Binance หรือไม่ หากพบจะดึงเข้าสู่การจัดการของบอทโดยอัตโนมัติ
3.  **Signal Generation**:
    *   หากแท่งเทียนปิดใหม่ (New Candle): ส่งข้อมูล OHLCV ไปยัง `SignalEngine` หรือ `strategy-ai` (Python)
    *   **Alpha Decay Check**: หากมี Position อยู่แต่สัญญาณเปลี่ยน (Flip) บอทจะสั่งปิดไม้ทันที (Requirement 4.4)
4.  **Risk Management Filter**:
    *   หากได้สัญญาณใหม่ (Entry Signal): ทำการกรองผ่าน **Strategy AI Filter**
    *   ตรวจสอบ **Market Features** (OI Delta, Funding Rate) หากสภาวะตลาดมีความเสี่ยงสูง จะสั่ง Block เข้าออเดอร์
5.  **Execution**:
    *   **Position Sizing**: คำนวนขนาดไม้ตาม ATR (Volatility Sizing) เสมอ
    *   **Layered Entry**: หากตั้งค่า Grid ไว้ จะทำการวางคำสั่งแบบแบ่งไม้ (Market 1st layer, Limit 2nd+ layers)

### 2.2 Order Exit Workflow
การปิดออเดอร์เกิดขึ้นได้จาก 4 กรณี:
1.  **Technical Exit**: สัญญาณกลยุทธ์สั่งปิด (Alpha Decay)
2.  **Dynamic TP/SL**: ราคาแตะโดน SL หรือ TP ที่คำนวณจาก ATR (คำนวณใหม่ทุกครั้งที่เข้าไม้)
3.  **Trailing Stop**: AI ปรับปรุงค่า trailing SL ตามการเคลื่อนไหวของราคา (Assess ทุก 30s)
4.  **Resilience Exit**: บอทถูกระงับ (Quarantine) เนื่องจากแพ้ติดต่อกัน 3 ครั้ง

---

## Module 3: Monorepo Components & Responsibilities

- **api-gateway**: จัดการ HTTP Traffic, Swagger Docs และการเชื่อมโยงระบบ (Orchestrator)
- **bot-engine**: หัวใจหลักของการเทรด (Logic, Simulation, Execution Monitoring)
- **data-layer**: จัดการ SQLite Database และ Shared Repositories เพื่อลดภาระการเรียก API ซ้ำซ้อน
- **strategy-ai**: วิเคราะห์ทางสถิติและ AI (Python) รองรับการประมวลผลข้อมูลปริมาณมาก (Batch)
- **quant-engine**: ระบบวิวัฒนาการกลยุทธ์ (Evolutionary Loop) ค้นหา Alpha ใหม่ๆ ในพื้นหลัง

---

## Module 4: Advanced Validation (Walk-Forward Analysis)

เพื่อป้องกันปัญหา Overfitting และยืนยันความทนทานของกลยุทธ์ ระบบรองรับการทดสอบขั้นสูง:

*   **[Walk-Forward Analysis (WFA)](file:///d:/Crypto/trading-web-app/research/walk_forward_analysis.md)**: การทดสอบแบบ Rolling Window โดยแบ่งข้อมูลเป็น In-Sample (สำหรับ Optimize) และ Out-of-Sample (สำหรับ Validate)
*   **Robustness Index (RI)**: การวัดประสิทธิภาพของกลยุทธ์ในสภาวะตลาดที่ไม่เคยเห็นมาก่อน
*   **WFE (Walk-Forward Efficiency)**: อัตราส่วนกำไรระหว่างช่วงทดสอบจริงเทียบกับช่วงหาค่าพารามิเตอร์ เพื่อคัดกรองระบบที่ "โชคดี" ออกจากระบบที่ "ใช้งานได้จริง"

---

## Module 5: Evolutionary Quant Engine (The Alpha Factory)

ระบบประมวลผลกลยุทธ์อัตโนมัติที่ทำงานในรูปแบบ **Autonomous R&D Lab** เพื่อลดการพึ่งพามนุษย์ในการเขียนโค้ด

### 5.1 Concept: Autonomous Alpha Generation
หัวใจของหน้า `/quant-engine` คือการสร้างวงจรวิวัฒนาการ (Evolutionary Loop) ของกลยุทธ์เทรด โดยมีกระบวนการดังนี้:
1.  **Innovation**: AI Agents เสนอไอเดียเงื่อนไขการเข้า/ออกไม้แบบใหม่
2.  **Selection**: ทดสอบไอเดียผ่าน Backtest (OOS) เพื่อคัดเฉพาะตัวที่ทำกำไรได้จริง
3.  **Deployment**: ส่งกลยุทธ์ที่ผ่านเกณฑ์ไปรันในกระเป๋า Sandbox (Paper Trade)
4.  **Retirement**: เมื่อ Alpha เริ่มเสื่อมสภาพ (Performance Decay) ระบบจะสั่งปิดบอทนั้นอัตโนมัติ

### 5.2 The Agentic Team (บทบาทของ AI)
*   **AlphaAgent**: นักวิจัยผู้คิดค้นกลยุทธ์ ใช้โมเดลภาษาขนาดใหญ่ (LLM) ในการ Generate Python code ของกลยุทธ์ใหม่ๆ
*   **BacktestAgent**: ผู้ตรวจสอบคุณภาพ ทำหน้าที่รัน Vectorized Backtest และคำนวณค่า Sharpe/Sortino เพื่อคัดกรองเบื้องต้น
*   **SentimentAgent**: นักวิเคราะห์สภาวะตลาด ป้อนข้อมูลโชเชียลและข่าวสารเป็นบริบทให้ AlphaAgent เข้าใจว่า "ตอนนี้ตลาดเปลี่ยนไปอย่างไร" (Fear & Greed Index, Funding Rate Context)
*   **Decay Monitor**: ผู้ดูแลความเสี่ยง คอยเฝ้าดูความแม่นยำของกลยุทธ์ที่รันอยู่ หากพบค่าน้ำหนักความน่าจะเป็น (Probability) ลดลงต่ำกว่าจุดวิกฤต จะสั่งหยุดรันเพื่อรักษาเงินต้น

### 5.3 Alpha Decay & Resilience
ระบบถูกออกแบบมาให้ยอมรับความจริงว่า **"ไม่มีกลยุทธ์ใดชนะตลาดได้ตลอดไป"** หน้าจอนี้จึงเป็นพื้นหลังที่สำคัญที่สุดที่ทำให้พอร์ตเทรดของคุณมีการปรับตัว (Adaptive) อยู่เสมอตาม Market Regime ที่เปลี่ยนไป

---

## Data Flow Summary

### Backtest Flow (Vectorized Optimization)
```
Browser → API Gateway → Backtester → strategy-ai (/batch) → pandas-ta
                                        ↓
                         Simulation (Slippage + ATR TPSL) → SQLite
```

### Live Trading Flow (Resilient & Filtered)
```
BotManager (Tick Interval: 30s)
  → CircuitBreaker (Fail-Safe)
  → Market Data Ingestion
  → Strategy AI (Signal + Infrastructure Check)
  → LLM Reflection (Manual Mistake Learning)
  → Execution (Layered Market/Limit Orders)
  → SQLite Audit Lag
```
