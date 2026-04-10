# Implementation Plan: Backtest UI → API Integration

## Overview

Migrate `src/pages/Backtest.tsx` from client-side signal/trade/metrics computation to calling existing backend API endpoints. Remove all `technicalindicators` usage and simulation loops, add new UI features (Leverage, History tab, Compare Mode, Python strategy support), and render results directly from API responses.

## Tasks

- [x] 1. Remove client-side computation and define new TypeScript interfaces
  - Delete all imports from `technicalindicators` in `Backtest.tsx`
  - Remove `calculateAndDrawIndicators` function and all its call sites
  - Remove the GRID simulation loop and directional strategy simulation loop from `runBacktest`
  - Remove EMA/BB/RSI chart series refs (`ema20SeriesRef`, `ema50SeriesRef`, `bbUpperSeriesRef`, `bbLowerSeriesRef`, `bbMidSeriesRef`) and their creation in the chart `useEffect`
  - Remove the RSI panel chart (`rsiChartRef`, `rsiSeriesRef`, `rsi30Ref`, `rsi70Ref`) and its container ref
  - Remove `equityDataMapRef` and the hover unrealized state
  - Add new TypeScript interfaces: `Trade`, `EquityCurvePoint`, `BacktestResult`, `BacktestConfig`, `BacktestSummary`, `CompareResult`
  - Replace old `BacktestResults` / `BacktestTrade` interfaces with the new ones
  - _Requirements: 1.1, 1.3, 2.2, 10.2_

- [x] 2. Implement utility functions for chart data conversion
  - [x] 2.1 Implement `convertEquityCurve(curve: EquityCurvePoint[])`
    - Convert each ISO 8601 `time` string to Unix seconds via `Math.floor(new Date(t).getTime() / 1000)`
    - Return `{ time: Time; value: number }[]` compatible with lightweight-charts
    - _Requirements: 3.1, 3.2_

  - [x] 2.2 Write property test for `convertEquityCurve`
    - **Property 3: Equity curve ISO-to-Unix conversion**
    - **Validates: Requirements 3.1, 3.2**
    - Use fast-check to generate random valid ISO 8601 timestamps, verify round-trip within 1 second
    - Minimum 100 iterations; add comment tag `// Feature: backtest-ui-api-integration, Property 3`

  - [x] 2.3 Implement `buildMarkersFromTrades(trades: Trade[])`
    - Produce exactly 2 markers per trade (entry + exit)
    - Entry marker: `time = Math.floor(new Date(trade.entryTime).getTime() / 1000)`, LONG → `belowBar` + `#0ecb81`, SHORT → `aboveBar` + `#f6465d`
    - Exit marker: `time = Math.floor(new Date(trade.exitTime).getTime() / 1000)`, text = `trade.exitReason`
    - Sort output by time ascending
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 2.4 Write property test for `buildMarkersFromTrades`
    - **Property 4: Trade marker completeness and correctness**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
    - Use fast-check to generate random `Trade[]`, verify marker count = `2 × trades.length`, entry/exit times, colors, positions, and `exitReason` text
    - Minimum 100 iterations; add comment tag `// Feature: backtest-ui-api-integration, Property 4`

- [x] 3. Update state and parameter panel
  - Replace old state (`results`, `tradeLog`, `storedMarkers`) with new state: `backtestResult`, `errorMessage`, `leverage`, `isPythonMode`, `pythonStrategyName`, `compareMode`, `compareConfigs`, `compareResults`, `historyList`, `historyLoading`, `historyError`
  - Add `'history'` and `'compare'` to the `activeTab` union type
  - Update strategy `<select>` to include all 11 JS strategies: `EMA`, `RSI`, `BB`, `EMA_RSI`, `BB_RSI`, `EMA_BB_RSI`, `GRID`, `AI_SCOUTER`, `EMA_SCALP`, `STOCH_RSI`, `VWAP_SCALP`
  - Add Leverage `<input type="number">` (default 10) hidden when `strategy === 'GRID'`
  - Add Python Strategy section: toggle checkbox + strategy name text input (shown when `isPythonMode`) with note about strategy-ai dependency
  - Add Compare Mode toggle checkbox
  - _Requirements: 6.1, 6.2, 6.3, 10.1, 10.3, 11.1, 11.2, 11.5_

  - [x] 3.1 Write property test for leverage visibility
    - **Property 9: Leverage visibility by strategy**
    - **Validates: Requirements 6.3**
    - For each strategy value, verify leverage input is visible iff `strategy !== 'GRID'`
    - Minimum 100 iterations; add comment tag `// Feature: backtest-ui-api-integration, Property 9`

- [x] 4. Implement `handleRunBacktest` — call `POST /api/backtest/run`
  - Build `BacktestConfig` from current UI state; prefix strategy with `PYTHON:` when `isPythonMode` is true
  - Clear previous `backtestResult`, `errorMessage`, markers, and equity curve before fetch
  - Set `isRunning = true`, disable "Start Backtest" button during request
  - On success: call `convertEquityCurve` → set equity series; call `buildMarkersFromTrades` → set markers; update `backtestResult` state
  - On API error (`response.ok === false` or `{ error: "..." }` body): set `errorMessage`; handle `"Strategy AI service unavailable"` with specific message
  - On network failure (fetch throws): set `errorMessage = "Network error — please check your connection"`
  - Set `isRunning = false` in finally block
  - _Requirements: 1.1, 1.2, 1.4, 9.1, 9.2, 9.3, 9.4, 11.3, 11.4_

  - [x] 4.1 Write property test for request body completeness
    - **Property 1: Request body completeness**
    - **Validates: Requirements 1.1, 1.2**
    - Use fast-check to generate random `BacktestConfig` values, mock `fetch`, verify all required fields present in request body with matching values
    - Minimum 100 iterations; add comment tag `// Feature: backtest-ui-api-integration, Property 1`

  - [x] 4.2 Write property test for API error message passthrough
    - **Property 2: API error message passthrough**
    - **Validates: Requirements 1.4, 9.2**
    - Use fast-check to generate random error strings, mock API response, verify `errorMessage` state equals the returned string exactly
    - Minimum 100 iterations; add comment tag `// Feature: backtest-ui-api-integration, Property 2`

  - [x] 4.3 Write property test for Python strategy PYTHON: prefix
    - **Property 7: Python strategy PYTHON: prefix**
    - **Validates: Requirements 11.3**
    - Use fast-check to generate random non-empty strategy name strings, verify request body `strategy === "PYTHON:" + name`
    - Minimum 100 iterations; add comment tag `// Feature: backtest-ui-api-integration, Property 7`

  - [x] 4.4 Write property test for JS strategy key passthrough
    - **Property 8: Strategy key passthrough (no transformation)**
    - **Validates: Requirements 10.3**
    - For each of the 11 JS strategy keys, verify request body `strategy` equals the key exactly
    - Add comment tag `// Feature: backtest-ui-api-integration, Property 8`

  - [x] 4.5 Write property test for state cleared on new run
    - **Property 13: State cleared on new run**
    - **Validates: Requirements 9.4**
    - Set up component with existing `backtestResult`, markers, and equity data; trigger new run; verify all are cleared before new response is processed
    - Minimum 100 iterations; add comment tag `// Feature: backtest-ui-api-integration, Property 13`

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Update Metrics Bar display
  - Replace old metrics (`netPnl`, `winRate`, `winCount`, `lossCount`, `maxDrawdown`, `profitFactor`, `totalTrades`, `worstFloatingLoss`, `openPositions`) with new fields from `BacktestResult`
  - Display: `totalPnl` + `netPnlPct`, `winRate` + `totalTrades`, `maxDrawdown`, `profitFactor`, `sharpeRatio`, `avgWin` / `avgLoss`, `maxConsecutiveLosses`
  - Remove "Peak Float Loss" and "Open Positions" metric cards
  - When `totalTrades === 0`, display `"--"` for all metrics without errors
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 7. Update Trade Log tab
  - Render `backtestResult.trades` (reversed by `exitTime`) in the trade log table
  - Display columns: `entryTime`, `exitTime`, `type`, `entryPrice`, `exitPrice`, `pnl` (USDT), `pnlPct` (%), `exitReason`
  - Show "Run backtest to see trade log." when `trades` is empty or `backtestResult` is null
  - Update tab label to show trade count: `Trade Log (N)`
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 7.1 Write property test for trade log field completeness
    - **Property 5: Trade log field completeness**
    - **Validates: Requirements 5.1, 5.2, 5.3**
    - Use fast-check to generate random `Trade` objects, render trade log rows, verify all required fields are present in the rendered output
    - Minimum 100 iterations; add comment tag `// Feature: backtest-ui-api-integration, Property 5`

  - [x] 7.2 Write property test for trade log reverse chronological order
    - **Property 6: Trade log reverse chronological order**
    - **Validates: Requirements 5.4**
    - Use fast-check to generate random `Trade[]` with varying `exitTime` values, verify displayed rows are sorted descending by `exitTime`
    - Minimum 100 iterations; add comment tag `// Feature: backtest-ui-api-integration, Property 6`

- [x] 8. Implement History tab
  - Add "History" tab button to the tab bar
  - Implement `loadHistory()`: call `GET /api/backtest/history`, set `historyList` / `historyLoading` / `historyError`
  - Call `loadHistory()` when the History tab is first activated
  - Render history table with columns: `symbol`, `strategy`, `interval`, `totalPnl`, `winRate`, `totalTrades`, `createdAt`
  - On row click: call `GET /api/backtest/history/:backtestId`, load full `BacktestResult` into `backtestResult` state (populating charts, metrics, trade log), switch to Charts tab
  - Show "No backtest history yet." when list is empty; show error message when fetch fails
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 8.1 Write property test for history summary field completeness
    - **Property 12: History summary field completeness**
    - **Validates: Requirements 7.2, 7.3**
    - Use fast-check to generate random `BacktestSummary[]`, render History tab, verify each row contains all required fields
    - Minimum 100 iterations; add comment tag `// Feature: backtest-ui-api-integration, Property 12`

- [x] 9. Implement Compare Mode
  - When `compareMode` is true, show "Add Current Config" button and a list of added configs (with remove buttons, max 10)
  - Implement `handleRunCompare()`: build `configs` array from `compareConfigs`, send `POST /api/backtest/compare`, set `compareResults`
  - Add "Compare" tab; render ranked table with columns: `rank`, `configLabel`, `totalPnl`, `winRate`, `sharpeRatio`, `maxDrawdown`, `profitFactor`; display `error` inline for failed configs
  - Sort table by `rank` ascending
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 9.1 Write property test for compare request body completeness
    - **Property 10: Compare request body completeness**
    - **Validates: Requirements 8.2, 8.3**
    - Use fast-check to generate random `BacktestConfig[]` (1–10 items), mock fetch, verify `configs` array in request body matches added configs in order
    - Minimum 100 iterations; add comment tag `// Feature: backtest-ui-api-integration, Property 10`

  - [x] 9.2 Write property test for compare results display completeness
    - **Property 11: Compare results display completeness**
    - **Validates: Requirements 8.4, 8.6**
    - Use fast-check to generate random `CompareResult[]`, render Compare tab, verify all required fields rendered and `error` field shown inline when present
    - Minimum 100 iterations; add comment tag `// Feature: backtest-ui-api-integration, Property 11`

- [x] 10. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Property tests use [fast-check](https://github.com/dubzzz/fast-check) with minimum 100 iterations each
- Each property test must include the comment tag `// Feature: backtest-ui-api-integration, Property N`
- The klines preview (`GET /api/backtest`) call remains unchanged — only the simulation is moved to the backend
- Indicator overlays (EMA, BB, RSI series) are removed along with the `technicalindicators` dependency
