# CryptoSmartTrade — Technical System Documentation

## Stack Overview

```
Frontend:     React 19 + TypeScript + Vite + lightweight-charts
Backend:      Node.js (ESM) — Express via API Gateway
AI Layer:     Python 3 — FastAPI (strategy-ai microservice)
Database:     SQLite (better-sqlite3 via data-layer)
Exchange:     Binance USDT-M Futures via CCXT (BinanceAdapter)
AI Provider:  OpenRouter (LLM calls — optional)
```

---

## Architecture: Monorepo (npm workspaces)

```
packages/
  api-gateway/        — Express HTTP server, routes, Swagger
  bot-engine/         — Core trading logic (Backtester, BotManager, SignalEngine)
  exchange-connector/ — BinanceAdapter (CCXT wrapper)
  data-layer/         — SQLite repositories
  ai-agents/          — LLM agents (OpenRouter)
  shared/             — AnalyticsUtils, config constants
  strategy-ai/        — Python FastAPI microservice (signal + confidence)
  research/           — Markdown knowledge base files
src/                  — React frontend
```

---

## Module 1: API Gateway (`packages/api-gateway/src/server.js`)

Express server รับ HTTP requests จาก frontend แล้วส่งต่อไปยัง bot-engine

**Routes:**
- `POST /api/backtest/run` → `runBacktest(exchange, config)`
- `POST /api/backtest/compare` → `runBacktestCompare(exchange, configs[])`
- `GET  /api/backtest/history` → `getBacktestHistory()`
- `GET  /api/backtest/history/:id` → `getBacktestById(id)`
- `GET  /api/backtest/strategies` → list registered strategies
- `POST /api/bots/start` → `botManager.startBot(config)`
- `POST /api/bots/:id/stop` → `botManager.stopBot(id)`
- `GET  /api/bots` → list all bots + state
- `GET  /api/config` → `loadBinanceConfig()`
- `PATCH /api/config` → `patchBinanceConfig(patch)`

---

## Module 2: Backtester (`packages/bot-engine/src/Backtester.js`)

### `runBacktest(exchange, config) → BacktestResult`

1. `fetchKlines(exchange, symbol, interval, { startDate, endDate, maxKlines: 1500 })`
2. Loop `i = 50 → klines.length`:
   - `closes.slice(0, i)` — no look-ahead
   - ถ้า `strategy.startsWith('PYTHON:')` → `getPythonSignal(key, { closes, highs, lows, volumes, params, symbol })` — HTTP POST ทุก candle
   - ถ้าไม่ใช่ → `computeSignal(closes, strategy, config)` — synchronous
   - Entry logic: signal LONG/SHORT + ไม่มี position → เปิด trade
   - Exit logic: `pnlPct >= tpPercent || pnlPct <= -slPercent || signalFlipped` → ปิด trade
   - บันทึก `equityCurvePerCandle` ทุก candle (realized + unrealized)
3. `computeOverlayData(closes, times, strategy)` — คำนวณ indicator สำหรับ chart
4. คำนวณ metrics: `calculateSharpe`, `calculateMaxDrawdown`, `calculateProfitFactor`
5. `saveBacktestResult(result)` → SQLite

**Position sizing:** `positionSize = capital * leverage` (fixed, ไม่มี Kelly)  
**Fee:** `totalFeePerTrade = 2 * positionSize * 0.0004` (taker fee round-trip)  
**tpPrice/slPrice per trade:**
- LONG: `tp = entry * (1 + tp%/100)`, `sl = entry * (1 - sl%/100)`
- SHORT: `tp = entry * (1 - tp%/100)`, `sl = entry * (1 + sl%/100)`

### `runBacktestCompare(exchange, configs[]) → CompareResult[]`
- `Promise.allSettled(configs.map(runBacktest))` — parallel
- Sort by `totalPnl` descending, assign rank

### `computeOverlayData(closes, times, strategy) → OverlayData`

Strategy → indicator mapping:

| Strategy | ema20 | ema50 | BB | RSI |
|---|---|---|---|---|
| EMA / EMA_CROSS / EMA_CROSS_V2 / EMA_RSI / EMA_BB_RSI | ✓ | ✓ | | |
| BB / BB_RSI / EMA_BB_RSI | | | ✓ | |
| RSI / RSI_TREND / EMA_RSI / BB_RSI / EMA_BB_RSI | | | | ✓ |
| GRID / AI_SCOUTER / others | (empty `{}`) | | | |

- ใช้ `emaCalc`, `rsiCalc`, `bbCalc` จาก `backend/utils/indicators.js`
- try/catch → return `{}` เมื่อ error

---

## Module 3: SignalEngine (`packages/bot-engine/src/SignalEngine.js`)

### `computeSignal(closes, strategy, options) → 'LONG'|'SHORT'|'NONE'`
- Lookup `STRATEGY_REGISTRY[strategy]` → เรียก `strat.compute(closes, options)`
- Guard: `closes.length < 50` → return `'NONE'`

### `generateEntryReason(signal, strategy, closes, options) → string`
- เรียก `strat.describe(signal, options, closes)` → Thai text

### `generateDiagnostic(strategy, closes, options) → string`
- เรียก `strat.getDiagnostic(closes, options)` → Thai diagnostic thought

**Strategy Registry:**

```
EMA / EMA_CROSS / EMA_CROSS_V2  →  EMACross
RSI / RSI_TREND                 →  RSIStrategy
BB                              →  BollingerBandsStrategy
GRID / AI_GRID*                 →  GridStrategy
AI_SCOUTER                      →  ScouterStrategy
EMA_RSI                         →  EMA_RSI (Composite)
BB_RSI                          →  BB_RSI (Composite)
EMA_BB_RSI                      →  EMA_BB_RSI (Composite)
EMA_SCALP                       →  EMAScalpStrategy
STOCH_RSI                       →  StochRSIStrategy
VWAP_SCALP                      →  VWAPScalpStrategy
```

---

## Module 4: Strategies

### `EMACross.compute(closes, params)`
- EMA(20) vs EMA(50) crossover detection
- `pFast <= pSlow && cFast > cSlow` → LONG (Golden Cross)
- `pFast >= pSlow && cFast < cSlow` → SHORT (Death Cross)

### `Composite.EMA_RSI.compute(closes, params)`
- EMA cross UP + RSI < 70 → LONG
- EMA cross DOWN + RSI > 30 → SHORT

### `Composite.BB_RSI.compute(closes, params)`
- Price < BB lower + RSI < 30 → LONG (mean reversion)
- Price > BB upper + RSI > 70 → SHORT

### `Composite.EMA_BB_RSI.compute(closes, params)`
- EMA bull + (BB bounce OR RSI < 40) → LONG
- EMA bear + (BB bounce OR RSI > 60) → SHORT

---

## Module 5: BotManager (`packages/bot-engine/src/BotManager.js`)

Live trading engine — tick loop ทุก 30 วินาที

### `startBot(botConfig) → botId`
- สร้าง bot state object, `_scheduleBot(botId)` → `setInterval(_tick, 30000)`

### `_tick(botId)` — core loop
1. `Promise.all([getKlines, getTickerPrice, getAccountInfo])` — parallel fetch
2. `_handleTrailingStop(botId, currPrice)` — update trailing SL
3. Sync open positions กับ Binance (auto-recover orphan positions)
4. `_syncStats(bot)` — คำนวณ equity, PnL
5. Check expiry, max drawdown
6. Periodic AI Review (`_aiReview`) ทุก `aiCheckInterval` นาที
7. TP/SL/Trailing check สำหรับทุก open position
8. Signal on new candle (`bot.lastCandle !== lastCloseTime`):
   - `computeSignal` หรือ `getPythonSignal`
   - Signal flip → `_closePosition`
   - New entry → `_strategyAiFilter` (ถ้า mode ≠ off) หรือ `_checkMicrostructure` → `_openPosition`

### `_openPosition(bot, signal, currPrice, closes)`
- Optional: `ReflectionAgent.reflect()` — LLM pre-trade validation
- Position sizing: `posValue = bot.config.positionSizeUSDT`
- Safety lock: ถ้า equity < 5 USDT → stop bot
- Grid strategy → auto-generate layered entry steps
- Place MARKET/LIMIT orders ผ่าน `BinanceAdapter.placeOrder()`

### `_closePosition(bot, pos, currPrice, reason)`
- `BinanceAdapter.closePosition(symbol, side, qty)` — reduceOnly market order
- บันทึก trade, `appendTrade(trade)` → SQLite
- ถ้า loss → `_recordAILesson()` → บันทึก mistake
- 3 consecutive losses → quarantine (stop bot)

### `_syncStats(bot)`
- คำนวณ `grossProfit`, `grossLoss`, `winCount`, `lossCount`, `realizedPnl`, `netPnl`, `equity`

### `_aiReview(botId, closes)`
- `assessTrailingAdjustment()` → TrailingAIAgent — ปรับ TP/trailing SL ด้วย LLM
- ทุก 50 ticks: `TuningService.tuneBot()` → OptimizerAgent — ปรับ indicator params

---

## Module 6: KlineFetcher (`packages/bot-engine/src/KlineFetcher.js`)

### `fetchKlines(exchange, symbol, interval, options) → klines[]`
- ไม่มี date range → `fetchOHLCV(symbol, interval, undefined, 500)` — 500 candles ล่าสุด
- มี date range → batch pagination ทีละ 500 จนครบ `maxKlines` (default 1500)
- Dedup ด้วย `Map<openTime, kline>`, sort ascending, filter by endDate

---

## Module 7: BinanceAdapter (`packages/exchange-connector/src/BinanceAdapter.js`)

CCXT wrapper สำหรับ Binance USDT-M Futures

**Mode:** Testnet (`demo-fapi.binance.com`) หรือ Live (`fapi.binance.com`) ตาม `BINANCE_USE_TESTNET`  
**Public endpoints** → production server เสมอ (stability)  
**Private endpoints** → demo server (testnet mode)

**Methods:**

| Method | Description |
|---|---|
| `getAccountInfo()` | fapiPrivateV2GetAccount |
| `getKlines(symbol, interval, limit)` | fetchOHLCV |
| `placeOrder(symbol, side, type, qty, price?)` | createOrder (MARKET/LIMIT) |
| `closePosition(symbol, side, qty)` | market reduceOnly |
| `setLeverage(symbol, leverage)` | setLeverage (clamp 1–125) |
| `getFundingRate(symbol)` | fetchFundingRate |
| `getOpenInterest(symbol)` | fetchOpenInterest |
| `getOpenInterestStatistics(symbol, period, limit)` | futures/data/openInterestHist |
| `getSymbolRules()` | loadMarkets → stepSize, minQty, tickSize, precision |

---

## Module 8: Python Strategy AI (`packages/strategy-ai/`)

FastAPI microservice — default port **8001**

### `POST /strategy/analyze → AnalyzeResponse`

**Input:**
```json
{
  "symbol": "BTCUSDT",
  "strategy": "EMA",
  "closes": [...],
  "highs": [...],
  "lows": [...],
  "volumes": [...],
  "params": {},
  "funding_rate": 0.0001,
  "oi_change_pct": -3.5
}
```

**Pipeline:**
1. `registry.get(strategy).compute_signal(closes, highs, lows, volumes, params)` → `{ signal, stoploss, metadata }`
2. `microstructure_check(signal, funding_rate, oi_change_pct, funding_threshold)` → block/pass
3. `compute_features(closes)` → `{ rsi, ema20, ema50, ema_cross, bb_position, volatility, momentum, body_ratio, price }`
4. `detect_regime(features)` → `trending_up | trending_down | ranging | volatile`
5. `confidence_engine.score(signal, features, regime, metadata)` → `(confidence, reason)`
6. Apply microstructure penalty ถ้า OI soft warning
7. `final_signal = signal if confidence >= 0.60 else 'NONE'`

### `ConfidenceEngine.score()` (`confidence_engine.py`)
- `_rule_based()` — if/else scoring จาก RSI, BB position, EMA cross, momentum, volatility, regime
- ถ้า mode=`full` และ confidence อยู่ใน 0.50–0.70 → `_llm_analyze()` → OpenRouter → blend `(ML+LLM)/2`

### `microstructure_check()` (`microstructure_filter.py`)

| Rule | Condition | Action |
|---|---|---|
| 1 | Funding > +threshold + LONG | Block |
| 2 | Funding < -threshold + SHORT | Block |
| 3 | OI drop > 10% | Block |
| 4 | OI drop 5–10% | Pass + penalty -0.10 |

### Registered Strategies (Python)
```
bb_breakout, EMA, EMA_CROSS, EMA_CROSS_V2, RSI, RSI_TREND,
BB, EMA_RSI, BB_RSI, EMA_BB_RSI, EMA_SCALP, STOCH_RSI,
VWAP_SCALP, AI_SCOUTER, GRID
```

---

## Module 9: AI Agents (`packages/ai-agents/`)

### `ReflectionAgent.reflect(bot, signal, price, apiKey, model, pastMistakes)`
- LLM prompt: approve/reject signal โดยดูจาก past mistakes
- Return: `{ approved: boolean, reason: string }`

### `OptimizerAgent.analyzeMistakes(bot, apiKey, model)`
- วิเคราะห์ losing trades 10 รายการล่าสุด → Markdown report (Thai)

### `OptimizerAgent.getTunedIndicatorParams(bot, closes, apiKey, model)`
- ปรับ RSI thresholds หรือ Grid range ตาม market condition
- Return: `{ rsiOversold, rsiOverbought, marketCondition, reasoning }` หรือ `{ gridUpper, gridLower, gridLayers }`

### `TuningService.tuneBot(bot, closes)`
- เรียก `getTunedIndicatorParams()` ทุก 50 ticks
- Apply ผลลัพธ์ไปที่ `bot.config` live, บันทึก log → SQLite

---

## Module 10: AnalyticsUtils (`packages/shared/AnalyticsUtils.js`)

| Function | Formula |
|---|---|
| `calculateSharpe(pnlList)` | `(mean/stdDev) * sqrt(365)` — annualized, risk-free = 0 |
| `calculateMaxDrawdown(equityCurve)` | `(peak - trough) / peak` |
| `calculateProfitFactor(pnlList)` | `grossProfit / grossLoss` |
| `generateEquityCurve(trades, capital)` | cumulative equity array sorted by exitTime |
| `computeSignalConfidence(signal, closes)` | rule-based score 0.0–1.0 (mirrors Python) |

---

## Module 11: Indicators (`backend/utils/indicators.js`)

Custom implementations (ไม่ใช้ technicalindicators library):

| Function | Description |
|---|---|
| `emaCalc(values, period)` | EMA ด้วย smoothing factor `k = 2/(period+1)` |
| `rsiCalc(values, period=14)` | Wilder's smoothing RSI |
| `bbCalc(values, period=20, stdDev=2)` | Bollinger Bands `{ upper, middle, lower }` |

---

## Module 12: Market Features Engine (`packages/data-layer/src/repositories/marketFeaturesRepo.js`)

Centralized system for technical and microstructure factor calculation.

- **TQI (Trend Quality Index)**: Multi-timeframe trend verification.
- **Microstructure**: Real-time OI (Open Interest) Delta and Funding Rate monitoring.
- **Indicators**: High-performance indicator calculations for the dashboard.

---

## Module 13: Research Brain (`packages/api-gateway/src/routes/researchRoutes.js`)

Modular knowledge management system for the "Secondary Brain".

- **Storage**: Local `.md` files in the `/research` directory.
- **API**: CRUD operations for markdown notes.
- **UI**: Integrated Markdown viewer and editor in the `Research` tab.
- **Integration**: AI agents can leverage these notes as long-term memory or strategy guides.

---

## Data Flow Summary

### Backtest Flow
```
Browser
  → POST /api/backtest/run
  → Backtester.runBacktest()
      → KlineFetcher.fetchKlines() → Binance Public API
      → loop per candle:
            JS path:     SignalEngine.computeSignal() [sync]
            Python path: PythonStrategyClient.getPythonSignal()
                           → POST /strategy/analyze (×N candles)
      → computeOverlayData()
      → calculateSharpe / MaxDD / ProfitFactor
      → saveBacktestResult() → SQLite
  ← BacktestResult { trades[], overlayData, equityCurve, metrics }

Browser renders:
  OverlayRenderer  — EMA/BB/RSI lines on chart
  MetricsPanel     — Win Rate, Avg R, Streak, W/L
  RSI sub-panel    — separate chart synced to candle timescale
  TP/SL lines      — price lines on last trade
```

### Live Bot Flow
```
BotManager._tick() every 30s
  → BinanceAdapter: getKlines + getTickerPrice + getAccountInfo [parallel]
  → SignalEngine.computeSignal() or getPythonSignal()
  → _strategyAiFilter()
      → POST /strategy/analyze (Python)
          → microstructure_check() [funding + OI]
          → confidence_engine.score() [rule-based + optional LLM]
  → _openPosition()  → BinanceAdapter.placeOrder()
  → _closePosition() → BinanceAdapter.closePosition()
  → appendTrade()    → SQLite

every 50 ticks:
  → TuningService → OptimizerAgent → OpenRouter LLM → update bot.config
```

---

## Known Architectural Issues

| # | Issue | Impact |
|---|---|---|
| 1 | Backtest Python path: ~1,450 HTTP calls per backtest | ช้ามาก, ไม่ scalable |
| 2 | Confidence scoring เป็น rule-based ไม่ใช่ ML จริง | ไม่มี trained model, ไม่มี out-of-sample validation |
| 3 | Fixed position sizing (`capital * leverage`) | ไม่มี Kelly Criterion หรือ volatility-based sizing |
| 4 | ไม่มี slippage model | fill price = close price เสมอ, unrealistic |
| 5 | ไม่มี walk-forward testing | ใช้ข้อมูลทั้งหมดเป็น in-sample → overfit risk |
| 6 | Duplicate `computeSignal` logic | มีทั้งใน `backend/utils/indicators.js` และ `SignalEngine.js` (logic ต่างกัน) |
