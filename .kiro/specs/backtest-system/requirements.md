# Requirements Document

## Introduction

ระบบ Backtest สำหรับ Trading Bot Platform ที่ช่วยให้ผู้ใช้สามารถทดสอบ strategy ต่างๆ กับข้อมูลราคาในอดีต (Historical Data) ก่อนนำไปใช้งานจริง โดยรองรับทั้ง JS strategies (BollingerBands, EMACross, RSI, Grid, Composite, Scouter) และ Python strategies ผ่าน strategy-ai service

ระบบนี้จะต่อยอดจาก `Backtester.js` ที่มีอยู่แล้ว โดยเพิ่มความสามารถด้าน:
- การดึงข้อมูลย้อนหลังในปริมาณมาก (Multi-batch Historical Data)
- การรายงานผลที่ครบถ้วน (Sharpe, Max Drawdown, Profit Factor, Equity Curve)
- การเปรียบเทียบหลาย strategy พร้อมกัน (Multi-Strategy Comparison)
- การแสดงผลผ่าน UI

---

## Glossary

- **Backtester**: โมดูลหลักใน `packages/bot-engine/src/Backtester.js` ที่จำลองการเทรดบน historical data
- **BacktestConfig**: ชุดพารามิเตอร์สำหรับรัน backtest (symbol, strategy, interval, tpPercent, slPercent, leverage, capital, startDate, endDate)
- **BacktestResult**: ผลลัพธ์จากการรัน backtest รวมถึง trades, metrics, equity curve
- **Kline**: ข้อมูล OHLCV (Open, High, Low, Close, Volume) ของแต่ละ candle
- **Strategy**: กลยุทธ์การเทรด เช่น EMA, BB, RSI, GRID, EMA_RSI, BB_RSI, EMA_BB_RSI, AI_SCOUTER
- **SignalEngine**: โมดูลที่คำนวณ signal (LONG/SHORT/NONE) จาก closes array
- **EquityCurve**: กราฟแสดงมูลค่า portfolio เปลี่ยนแปลงตามเวลา
- **Drawdown**: การลดลงของ equity จาก peak ไปยัง trough
- **SharpeRatio**: อัตราส่วนผลตอบแทนต่อความเสี่ยง (mean PnL / stdDev PnL × √365)
- **ProfitFactor**: อัตราส่วน gross profit / gross loss
- **WinRate**: สัดส่วนจำนวน trade ที่กำไร / trade ทั้งหมด
- **BinanceAdapter**: คลาสใน `packages/exchange-connector` สำหรับดึงข้อมูลจาก Binance
- **StrategyAI**: Python service ที่รันอยู่ที่ `http://strategy-ai:8000` สำหรับ Python-based strategies
- **MultiBacktest**: การรัน backtest หลาย strategy หรือหลาย parameter set พร้อมกัน

---

## Requirements

### Requirement 1: ดึงข้อมูล Historical Klines ในปริมาณมาก

**User Story:** As a trader, I want to fetch historical kline data spanning weeks or months, so that I can run meaningful backtests with sufficient data.

#### Acceptance Criteria

1. WHEN a backtest request specifies a `startDate` and `endDate`, THE Backtester SHALL fetch klines covering the full date range by making multiple paginated requests to BinanceAdapter
2. WHEN the requested date range requires more than 500 klines, THE Backtester SHALL automatically batch-fetch klines until the full range is covered
3. IF the BinanceAdapter returns fewer klines than requested due to API limits, THEN THE Backtester SHALL retry with adjusted pagination parameters until the target range is reached
4. THE Backtester SHALL support fetching up to 1,500 klines per backtest run (approximately 62 days on 1h interval)
5. WHEN klines are fetched, THE Backtester SHALL deduplicate candles by open timestamp before processing
6. IF `startDate` or `endDate` is not provided, THEN THE Backtester SHALL default to fetching the most recent 500 klines

---

### Requirement 2: จำลองการเทรดบน Historical Data

**User Story:** As a trader, I want the backtest engine to simulate trades accurately using the same signal logic as the live bot, so that backtest results reflect real trading behavior.

#### Acceptance Criteria

1. THE Backtester SHALL use `computeSignal` from SignalEngine to generate signals — the same function used by the live BotManager
2. WHEN a signal is LONG or SHORT and no position is open, THE Backtester SHALL open a simulated position at the close price of the current candle
3. WHILE a position is open, THE Backtester SHALL check TP and SL conditions on every subsequent candle close price
4. WHEN the simulated price movement reaches `tpPercent` above entry (for LONG) or below entry (for SHORT), THE Backtester SHALL close the position and record a winning trade
5. WHEN the simulated price movement reaches `slPercent` below entry (for LONG) or above entry (for SHORT), THE Backtester SHALL close the position and record a losing trade
6. WHEN a new signal opposite to the current position is generated, THE Backtester SHALL close the current position with reason "Signal Flipped" before opening a new one
7. THE Backtester SHALL record each closed trade with: entryPrice, exitPrice, entryTime, exitTime, type (LONG/SHORT), pnl (USDT), pnlPct (%), exitReason
8. THE Backtester SHALL apply leverage to PnL calculation: `pnl = pnlPct/100 × positionSizeUSDT × leverage`

---

### Requirement 3: คำนวณ Performance Metrics

**User Story:** As a trader, I want comprehensive performance metrics after each backtest, so that I can objectively evaluate a strategy's quality.

#### Acceptance Criteria

1. THE Backtester SHALL calculate and return the following metrics for every completed backtest:
   - `totalTrades`: จำนวน trade ทั้งหมด
   - `winRate`: สัดส่วน winning trades (%)
   - `totalPnl`: กำไร/ขาดทุนสุทธิ (USDT)
   - `netPnlPct`: กำไร/ขาดทุนสุทธิ (%)
   - `sharpeRatio`: คำนวณจาก trade PnL list ผ่าน `calculateSharpe` ใน AnalyticsUtils
   - `maxDrawdown`: คำนวณจาก equity curve ผ่าน `calculateMaxDrawdown` ใน AnalyticsUtils
   - `profitFactor`: คำนวณผ่าน `calculateProfitFactor` ใน AnalyticsUtils
   - `avgWin`: กำไรเฉลี่ยต่อ winning trade (USDT)
   - `avgLoss`: ขาดทุนเฉลี่ยต่อ losing trade (USDT)
   - `maxConsecutiveLosses`: จำนวน losing trades ติดต่อกันสูงสุด
2. THE Backtester SHALL generate an `equityCurve` array ผ่าน `generateEquityCurve` ใน AnalyticsUtils โดยใช้ `capital` เป็น initial value
3. IF `totalTrades` is 0, THEN THE Backtester SHALL return all metrics as 0 and `equityCurve` as empty array

---

### Requirement 4: API Endpoint สำหรับ Backtest

**User Story:** As a frontend developer, I want a REST API endpoint to trigger backtests and retrieve results, so that I can build a backtest UI.

#### Acceptance Criteria

1. THE API_Gateway SHALL expose a `POST /api/backtest/run` endpoint ที่รับ BacktestConfig และคืน BacktestResult
2. WHEN a request to `POST /api/backtest/run` is received, THE API_Gateway SHALL validate that `symbol`, `strategy`, and `interval` fields are present
3. IF required fields are missing, THEN THE API_Gateway SHALL return HTTP 400 with a descriptive error message
4. THE `POST /api/backtest/run` endpoint SHALL accept the following parameters:
   - `symbol` (required): เช่น "BTCUSDT"
   - `strategy` (required): เช่น "EMA", "BB", "RSI", "EMA_RSI", "BB_RSI", "EMA_BB_RSI", "GRID", "AI_SCOUTER"
   - `interval` (required): เช่น "1m", "5m", "15m", "1h", "4h", "1d"
   - `tpPercent` (optional, default 2.0): Take Profit %
   - `slPercent` (optional, default 1.0): Stop Loss %
   - `leverage` (optional, default 10): Leverage multiplier
   - `capital` (optional, default 1000): Starting capital (USDT)
   - `startDate` (optional): ISO 8601 date string
   - `endDate` (optional): ISO 8601 date string
5. THE API_Gateway SHALL complete a backtest request within 30 seconds for up to 1,500 klines
6. THE API_Gateway SHALL expose a `POST /api/backtest/compare` endpoint ที่รับ array ของ BacktestConfig และคืน array ของ BacktestResult พร้อม `configLabel` สำหรับแต่ละ result
7. WHEN a `POST /api/backtest/compare` request contains more than 10 configs, THE API_Gateway SHALL return HTTP 400 with error "Maximum 10 configs per comparison"

---

### Requirement 5: Multi-Strategy Comparison

**User Story:** As a trader, I want to compare multiple strategies or parameter sets side-by-side on the same symbol and date range, so that I can choose the best configuration.

#### Acceptance Criteria

1. WHEN a `POST /api/backtest/compare` request is received with multiple BacktestConfigs, THE Backtester SHALL run each config independently on the same kline data
2. THE Backtester SHALL return results sorted by `totalPnl` descending (best performing first)
3. WHEN comparing configs, THE Backtester SHALL include a `rank` field (1 = best) in each result
4. THE Backtester SHALL include a `configLabel` in each result derived from `strategy-interval-tpPercent/slPercent` (เช่น "EMA-1h-2.0/1.0")
5. IF any single config in a comparison run fails, THEN THE Backtester SHALL include that config's result with `error` field and continue processing remaining configs

---

### Requirement 6: รองรับ Python Strategy ผ่าน Strategy-AI Service

**User Story:** As a trader, I want to backtest Python-based strategies from the strategy-ai service, so that I can evaluate AI-powered strategies before deploying them live.

#### Acceptance Criteria

1. WHERE `strategyAiMode` is not "off" in the system config, THE Backtester SHALL support strategy names prefixed with "PYTHON:" (เช่น "PYTHON:bollinger_breakout")
2. WHEN a PYTHON: strategy is used, THE Backtester SHALL call the strategy-ai service's `/signal` endpoint for each candle window instead of using SignalEngine
3. THE Backtester SHALL pass `closes`, `highs`, `lows`, `volumes`, and `params` to the strategy-ai `/signal` endpoint in the same format as the live BotManager
4. IF the strategy-ai service is unavailable during a backtest, THEN THE Backtester SHALL return an error "Strategy AI service unavailable" and abort the backtest
5. THE Backtester SHALL cache strategy-ai responses per candle window hash to avoid redundant HTTP calls during the same backtest run

---

### Requirement 7: บันทึกและดึงผล Backtest ที่ผ่านมา

**User Story:** As a trader, I want to save and retrieve past backtest results, so that I can compare current results with historical runs.

#### Acceptance Criteria

1. WHEN a backtest completes successfully, THE Backtester SHALL save the result to the database with a unique `backtestId` (UUID v4)
2. THE API_Gateway SHALL expose a `GET /api/backtest/history` endpoint ที่คืน array ของ backtest results ล่าสุด 50 รายการ เรียงตาม `createdAt` descending
3. THE API_Gateway SHALL expose a `GET /api/backtest/history/:backtestId` endpoint ที่คืน full BacktestResult รวมถึง trades array
4. WHEN saving a backtest result, THE Backtester SHALL store: `backtestId`, `symbol`, `strategy`, `interval`, `config` (JSON), `metrics` (JSON), `createdAt`
5. THE Backtester SHALL NOT store the full `trades` array in the summary list — trades SHALL only be returned when fetching a specific `backtestId`
6. IF a `backtestId` does not exist, THEN THE API_Gateway SHALL return HTTP 404 with error "Backtest result not found"

---

### Requirement 8: ความถูกต้องของการจำลอง (Simulation Integrity)

**User Story:** As a trader, I want the backtest simulation to avoid look-ahead bias, so that results are realistic and not artificially inflated.

#### Acceptance Criteria

1. WHEN computing a signal at candle index `i`, THE Backtester SHALL only use closes from index 0 to `i-1` (exclusive of current candle) — ห้ามใช้ข้อมูลอนาคต
2. THE Backtester SHALL use the close price of candle `i` as the entry/exit price — ไม่ใช้ open price ของ candle ถัดไป
3. THE Backtester SHALL start signal computation only after index 50 (minimum candles required by SignalEngine)
4. WHEN a position is open, THE Backtester SHALL NOT re-enter a new position in the same direction until the current position is closed
5. THE Backtester SHALL apply a simulated trading fee of 0.04% per trade (taker fee) to each entry and exit, deducted from PnL

