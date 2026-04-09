# Requirements Document

## Introduction

Performance Analytics Dashboard คือระบบวิเคราะห์ประสิทธิภาพสำหรับ trading bot fleet
ที่ดึงข้อมูล trade history จาก SQLite DB มาประมวลผลเป็น metrics เชิงปริมาณ
และแสดงผลผ่าน API endpoints ที่ frontend สามารถนำไปแสดงเป็น dashboard ได้

ระบบจะเชื่อมต่อกับ `AnalyticsUtils.js` ที่มีอยู่แล้ว (Sharpe, MaxDrawdown, ProfitFactor, EquityCurve)
และขยายให้ครอบคลุม Sortino Ratio, Calmar Ratio, Win Rate แยกตาม dimension ต่างๆ,
AI Decision Accuracy, และ Portfolio-level aggregation

## Glossary

- **Analytics_Service**: Service layer ที่รับผิดชอบการคำนวณ performance metrics ทั้งหมด
- **Bot**: instance ของ trading bot หนึ่งตัว มี `botId` เป็น identifier เก็บใน `bots` table
- **Trade**: ข้อมูล closed trade หนึ่งรายการ เก็บใน `trades` table มีฟิลด์ `botId`, `symbol`, `type`, `pnl`, `strategy`, `entryTime`, `exitTime`, `reason`
- **Equity_Curve**: ลำดับค่า equity ตามเวลา เริ่มจาก initial capital บวกสะสม PnL ของแต่ละ trade
- **Drawdown_Timeline**: ลำดับค่า drawdown (%) ณ แต่ละจุดเวลาตลอด Equity_Curve
- **Sharpe_Ratio**: อัตราส่วน mean PnL ต่อ standard deviation ของ PnL คูณ sqrt(365) (risk-free rate = 0)
- **Sortino_Ratio**: คล้าย Sharpe แต่ใช้เฉพาะ downside deviation (PnL < 0) ในตัวหาร
- **Calmar_Ratio**: อัตราส่วน annualized return ต่อ Max Drawdown
- **Max_Drawdown**: ค่า drawdown สูงสุด (%) จาก peak ถึง trough ใน Equity_Curve
- **Profit_Factor**: อัตราส่วน gross profit ต่อ gross loss
- **Win_Rate**: สัดส่วน trades ที่มี PnL > 0 ต่อ total trades (0.0–1.0)
- **AI_Decision**: การตัดสินใจของ AI agent ที่บันทึกใน `aiHistory` ของ bot (LONG/SHORT/STAY/UPDATED)
- **AI_Accuracy**: สัดส่วน AI_Decision ที่ตรงกับผลลัพธ์ trade จริง (profitable = correct)
- **Market_Regime**: สภาวะตลาด ณ เวลาที่ trade เปิด ได้แก่ `trending`, `ranging`, `volatile`
- **Portfolio**: กลุ่ม bots ทั้งหมดที่อยู่ภายใต้ PortfolioManager เดียวกัน
- **Analytics_Repository**: Data access layer สำหรับ query ข้อมูล trade และ bot จาก SQLite
- **Period**: ช่วงเวลาที่ใช้กรองข้อมูล เช่น `7d`, `30d`, `90d`, `all`

---

## Requirements

### Requirement 1: Bot-Level Performance Metrics

**User Story:** As a trader, I want to see quantitative risk metrics per bot, so that I can evaluate each bot's risk-adjusted performance objectively.

#### Acceptance Criteria

1. WHEN a request is made for bot metrics with a valid `botId`, THE Analytics_Service SHALL return Sharpe_Ratio, Sortino_Ratio, Calmar_Ratio, Max_Drawdown, Profit_Factor, Win_Rate, total trades, gross profit, and gross loss for that bot.
2. WHEN a bot has fewer than 2 closed trades, THE Analytics_Service SHALL return `null` for ratio metrics (Sharpe, Sortino, Calmar) and return 0 for Win_Rate, Max_Drawdown, and Profit_Factor.
3. WHEN calculating Sortino_Ratio, THE Analytics_Service SHALL use only trades with PnL < 0 as the downside deviation; IF no losing trades exist, THE Analytics_Service SHALL return `null` for Sortino_Ratio.
4. WHEN calculating Calmar_Ratio, THE Analytics_Service SHALL use annualized return divided by Max_Drawdown; IF Max_Drawdown equals 0, THE Analytics_Service SHALL return `null` for Calmar_Ratio.
5. WHEN a `period` parameter is provided (`7d`, `30d`, `90d`, `all`), THE Analytics_Service SHALL filter trades by `exitTime` within that period before computing all metrics.

---

### Requirement 2: Equity Curve และ Drawdown Timeline

**User Story:** As a trader, I want to visualize equity progression and drawdown over time per bot, so that I can identify periods of poor performance.

#### Acceptance Criteria

1. WHEN a request is made for equity curve data with a valid `botId`, THE Analytics_Service SHALL return an ordered array of `{ time: ISO8601_string, equity: number }` objects sorted ascending by `exitTime`.
2. THE Analytics_Service SHALL include an initial data point `{ time: "initial", equity: initialCapital }` as the first element of the Equity_Curve array.
3. WHEN a request is made for drawdown timeline with a valid `botId`, THE Analytics_Service SHALL return an ordered array of `{ time: ISO8601_string, drawdown: number }` where `drawdown` is expressed as a percentage (0–100).
4. WHEN a bot has no closed trades, THE Analytics_Service SHALL return an array containing only the initial data point for Equity_Curve and an empty array for Drawdown_Timeline.
5. THE Analytics_Service SHALL derive `initialCapital` from `bot.capital` or `bot.config.positionSizeUSDT`; IF both are absent, THE Analytics_Service SHALL use 1000 as the default initial capital.

---

### Requirement 3: Win Rate แยกตาม Dimension

**User Story:** As a trader, I want to see win rates broken down by strategy, market regime, and timeframe, so that I can identify which conditions each bot performs best in.

#### Acceptance Criteria

1. WHEN a request is made for win rate breakdown, THE Analytics_Service SHALL return Win_Rate grouped by `strategy` field from the `trades` table.
2. WHEN a request is made for win rate breakdown, THE Analytics_Service SHALL return Win_Rate grouped by `type` (LONG/SHORT) from the `trades` table.
3. WHEN a request is made for win rate breakdown by timeframe, THE Analytics_Service SHALL group trades by the `interval` field from the associated bot's config.
4. WHEN a dimension group contains fewer than 3 trades, THE Analytics_Service SHALL include the group in the response with a `lowSampleWarning: true` flag.
5. WHEN a `botId` is provided, THE Analytics_Service SHALL compute win rate breakdown for that specific bot only; WHEN no `botId` is provided, THE Analytics_Service SHALL compute across all bots.

---

### Requirement 4: AI Decision Accuracy

**User Story:** As a trader, I want to know how accurate each AI agent's decisions are, so that I can assess whether AI recommendations are adding value.

#### Acceptance Criteria

1. WHEN a request is made for AI accuracy metrics, THE Analytics_Service SHALL compute AI_Accuracy by comparing each AI_Decision in `bot.aiHistory` against the PnL outcome of the trade that followed within the same bot.
2. THE Analytics_Service SHALL classify an AI_Decision as correct WHEN the decision was `UPDATED` (strategy change) and the next trade after the update has PnL > 0, OR WHEN the decision was `STAY` and the next trade has PnL > 0.
3. THE Analytics_Service SHALL return AI_Accuracy as a ratio between 0.0 and 1.0, total decisions evaluated, correct decisions count, and incorrect decisions count per bot.
4. WHEN a bot has fewer than 3 AI decisions with subsequent trades, THE Analytics_Service SHALL return `null` for AI_Accuracy and include a `insufficientData: true` flag.
5. WHEN a request is made without a `botId`, THE Analytics_Service SHALL aggregate AI_Accuracy across all bots and return per-bot breakdown alongside the portfolio-level aggregate.

---

### Requirement 5: Portfolio-Level Aggregation

**User Story:** As a trader, I want to see combined performance metrics across all bots in a fleet, so that I can evaluate the overall portfolio health.

#### Acceptance Criteria

1. WHEN a request is made for portfolio metrics, THE Analytics_Service SHALL aggregate all closed trades from all bots and compute portfolio-level Sharpe_Ratio, Max_Drawdown, Profit_Factor, Win_Rate, total PnL, and total trades.
2. THE Analytics_Service SHALL generate a portfolio Equity_Curve by merging all bot trades sorted by `exitTime` and accumulating PnL from a combined initial capital equal to the sum of all bot `capital` values.
3. WHEN a `fleetId` (managedBy) is provided, THE Analytics_Service SHALL filter bots to only those with `config.managedBy` matching the given `fleetId`.
4. THE Analytics_Service SHALL return per-bot summary (botId, symbol, strategy, Win_Rate, netPnl, totalTrades, Sharpe_Ratio) alongside the portfolio aggregate in a single response.
5. WHEN the portfolio has fewer than 2 bots with trade data, THE Analytics_Service SHALL still return available metrics and set `portfolioSharpe: null` with a `insufficientData: true` flag.

---

### Requirement 6: Bot Performance Comparison

**User Story:** As a trader, I want to compare performance metrics side-by-side across multiple bots, so that I can identify top performers and underperformers.

#### Acceptance Criteria

1. WHEN a request is made for bot comparison with a list of `botIds`, THE Analytics_Service SHALL return a ranked list of bots sorted by Sharpe_Ratio descending.
2. THE Analytics_Service SHALL include for each bot in the comparison: botId, symbol, strategy, Win_Rate, Sharpe_Ratio, Max_Drawdown, Profit_Factor, netPnl, and totalTrades.
3. WHEN a `botId` in the comparison list has no trade data, THE Analytics_Service SHALL include the bot in the response with all metric fields set to `null` and a `noData: true` flag.
4. WHEN no `botIds` list is provided, THE Analytics_Service SHALL include all bots that have at least 1 closed trade in the comparison.
5. THE Analytics_Service SHALL sort bots with `noData: true` to the end of the ranked list regardless of other sort criteria.

---

### Requirement 7: Analytics API Endpoints

**User Story:** As a frontend developer, I want RESTful API endpoints for all analytics data, so that I can build the dashboard UI without direct database access.

#### Acceptance Criteria

1. THE Analytics_Service SHALL expose a `GET /api/analytics/bot/:botId` endpoint that returns bot-level metrics as defined in Requirements 1 and 2.
2. THE Analytics_Service SHALL expose a `GET /api/analytics/portfolio` endpoint that returns portfolio-level metrics as defined in Requirement 5.
3. THE Analytics_Service SHALL expose a `GET /api/analytics/comparison` endpoint that accepts an optional `botIds` query parameter (comma-separated) and returns comparison data as defined in Requirement 6.
4. THE Analytics_Service SHALL expose a `GET /api/analytics/ai-accuracy` endpoint that accepts an optional `botId` query parameter and returns AI accuracy data as defined in Requirement 4.
5. WHEN any analytics endpoint receives an invalid `botId` that does not exist in the database, THE Analytics_Service SHALL return HTTP 404 with a JSON body `{ "error": "Bot not found" }`.
6. WHEN any analytics endpoint encounters a database error, THE Analytics_Service SHALL return HTTP 500 with a JSON body `{ "error": "Internal server error" }` and log the error details server-side.
7. ALL analytics endpoints SHALL accept an optional `period` query parameter (`7d`, `30d`, `90d`, `all`) defaulting to `all` WHEN not provided.

---

### Requirement 8: Analytics Data Persistence และ Caching

**User Story:** As a system operator, I want analytics computations to be efficient, so that repeated dashboard requests do not overload the database.

#### Acceptance Criteria

1. THE Analytics_Service SHALL compute metrics on-demand from the `trades` and `bots` tables in SQLite without requiring a separate pre-computed table.
2. WHEN the same analytics request is made within 60 seconds of a previous identical request, THE Analytics_Service SHALL return the cached result without re-querying the database.
3. WHEN a new trade is appended via `appendTrade()`, THE Analytics_Service SHALL invalidate the cache for the affected `botId` and the portfolio cache.
4. THE Analytics_Service SHALL support a `forceRefresh=true` query parameter that bypasses the cache and recomputes metrics from the database.
5. WHERE the deployment environment has available memory, THE Analytics_Service SHALL store cache entries in-process memory (Map) with a TTL of 60 seconds.
