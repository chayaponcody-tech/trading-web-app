# Tasks

## Phase 1: Vectorize Backtester

- [x] 1.1 Add `BatchAnalyzeRequest` and `BatchAnalyzeResponse` Pydantic schemas to `packages/strategy-ai/schemas.py`
- [x] 1.2 Implement `POST /strategy/analyze/batch` endpoint in `packages/strategy-ai/main.py` using vectorized pandas/numpy operations (no per-candle Python loop)
- [x] 1.3 Add input validation to the batch endpoint: HTTP 422 when `closes` < 50 elements or array lengths are mismatched
- [x] 1.4 Add `getBatchSignals(strategyKey, payload)` function to `packages/bot-engine/src/PythonStrategyClient.js` that calls `POST /strategy/analyze/batch`
- [x] 1.5 Refactor `runBacktest()` in `packages/bot-engine/src/Backtester.js` to call `getBatchSignals()` once before the simulation loop and read from the pre-fetched `signals[]` / `confidences[]` arrays inside the loop
- [x] 1.6 Write property test (Hypothesis) for batch response length invariant — Property 2: for any valid request with closes of length N, assert `len(signals) == len(confidences) == N`
- [x] 1.7 Write property test (Hypothesis) for batch no-look-ahead equivalence — Property 1: for any valid OHLCV dataset, batch output matches sequential single-call output
- [x] 1.8 Write unit test asserting `runBacktest()` calls `getBatchSignals()` exactly once per Python-strategy backtest run

## Phase 2: Slippage Model + ATR-Based Position Sizing

- [x] 2.1 Implement `applySlippage(price, side, action)` pure function in `packages/bot-engine/src/Backtester.js` applying 0.05% penalty
- [x] 2.2 Implement `computeATR(highs, lows, closes, period)` and `computePositionSize(capital, highs, lows, closes, options)` pure functions in `packages/bot-engine/src/Backtester.js`
- [x] 2.3 Apply `applySlippage()` to entry and exit prices in the `runBacktest()` simulation loop
- [x] 2.4 Apply `computePositionSize()` to determine `positionSize` for each trade entry in `runBacktest()`
- [x] 2.5 Copy `applySlippage()` and `computePositionSize()` into `packages/bot-engine/src/BotManager.js` (or extract to a shared util) and apply them in `_openPosition()` and `_closePosition()`
- [x] 2.6 Write property test (fast-check) for slippage invariant — Property 3: for any price > 0, assert effective fill price is always worse for the trader across all four direction/action combinations
- [x] 2.7 Write property test (fast-check) for volatility-inverse sizing — Property 4: for any ATR > 0, Capital > 0, RiskPct > 0, assert position size is strictly positive and decreases as ATR increases
- [x] 2.8 Write unit test for ATR fallback: when fewer than 15 candles are provided, `computePositionSize()` returns `capital × leverage`

## Phase 3: Bayesian Optimization + Walk-Forward Validation

- [x] 3.1 Add `optuna` to `packages/strategy-ai/requirements.txt`
- [x] 3.2 Add `OptimizeRequest` and `OptimizeResponse` Pydantic schemas to `packages/strategy-ai/schemas.py`
- [x] 3.3 Implement `POST /strategy/optimize` endpoint in `packages/strategy-ai/main.py` using `optuna.create_study(direction="maximize")` with SharpeRatio as the objective; default `n_trials=50`
- [x] 3.4 Refactor `TuningService.tuneBot()` in `packages/bot-engine/src/TuningService.js` to call `POST /strategy/optimize` via `PythonStrategyClient` instead of `getTunedIndicatorParams()` from `OptimizerAgent`
- [x] 3.5 Handle optimization endpoint unavailability in `TuningService.tuneBot()`: log warning and retain current bot params unchanged
- [x] 3.6 Implement `runWalkForward(exchange, config)` in `packages/bot-engine/src/Backtester.js` that partitions klines into sequential train/test windows and returns `{ windows, avgSharpe, avgPnl }`
- [x] 3.7 Add error return `{ error: 'Insufficient data for walk-forward validation' }` when dataset is too short for at least one complete train+test window
- [x] 3.8 Write property test (fast-check) for walk-forward window count invariant — Property 5: for any `(total, train, test)` where `total >= train + test`, assert `windows.length == Math.floor((total - train) / test)`
- [x] 3.9 Write unit test asserting `TuningService.tuneBot()` makes no calls to any OpenRouter endpoint

## Phase 4: ML-Ready Confidence Engine

- [x] 4.1 Add `joblib` to `packages/strategy-ai/requirements.txt`
- [x] 4.2 Implement `FeaturePipeline` class in `packages/strategy-ai/confidence_engine.py` with `extract(closes, highs, lows)` method returning a fixed 8-element numpy array: `[rsi_14, ema20, ema50, ema_cross, bb_position, volatility_20, momentum_10, atr_14]`
- [x] 4.3 Refactor `ConfidenceEngine.__init__()` to read `MODEL_PATH` env var and load the model via `joblib.load()` if the file exists; store as `self.model`
- [x] 4.4 Add `_ml_score(features)` method to `ConfidenceEngine` that calls `self.model.predict_proba(features.reshape(1, -1))[0][1]` and returns the positive class probability
- [x] 4.5 Update `ConfidenceEngine.score()` to delegate to `_ml_score()` when `self.model` is not None, falling back to `_rule_based()` on any exception (log the error)
- [x] 4.6 Update `POST /strategy/analyze` in `main.py` to pass `highs` and `lows` arrays through to `ConfidenceEngine.score()` so `FeaturePipeline` can compute `atr_14`
- [x] 4.7 Write property test (Hypothesis) for feature pipeline shape invariant — Property 6: for any valid OHLCV input with length >= 50, assert `len(features) == 8`
- [x] 4.8 Write property test (Hypothesis) for ML confidence probability bounds — Property 7: for any valid feature vector, assert `0.0 <= confidence <= 1.0`
- [x] 4.9 Write unit test for `ConfidenceEngine` fallback: when `MODEL_PATH` is not set, `score()` calls `_rule_based()` and does not raise
- [x] 4.10 Write unit test for `ConfidenceEngine` exception fallback: when `model.predict_proba()` raises, `score()` falls back to `_rule_based()` and logs the error

## Phase 5: UI Cleanup — Unified Strategy + ATR TP/SL

- [x] 5.1 Add `computeTPSL(entryPrice, side, atr, options)` pure function to `packages/bot-engine/src/Backtester.js` that returns `{ tp, sl }` using ATR multipliers; fall back to legacy pct-based TP/SL when ATR is zero
- [x] 5.2 Replace `tpPct`/`slPct` usage in `runBacktest()` simulation loop with `computeTPSL()` using `tpMultiplier`/`slMultiplier` from config
- [x] 5.3 Apply the same `computeTPSL()` in `BotManager._openPosition()` replacing fixed-% TP/SL calculation
- [x] 5.4 Implement `GET /strategy/list` endpoint in `packages/strategy-ai/main.py` that returns all registered Python strategy keys with `engine: "python"` tag
- [x] 5.5 Add a `STRATEGY_REGISTRY` map in `packages/bot-engine/src/Backtester.js` (or a shared config) that lists all JS-native strategies with `engine: "js"` tag
- [x] 5.6 Update `runBacktest()` routing logic to auto-detect `engine` from `STRATEGY_REGISTRY` instead of reading an `enablePythonStrategy` flag
- [x] 5.7 Update the Strategy Tester frontend: rename `TP%` → `TP (ATR×)` and `SL%` → `SL (ATR×)`, change input type to accept floats, update payload field names to `tpMultiplier`/`slMultiplier`
- [x] 5.8 Update the Strategy Tester frontend: remove "Enable Python Strategy" checkbox and secondary "Strategy Name" dropdown; replace with a single unified `Strategy` dropdown populated from both JS registry and `GET /strategy/list`
- [x] 5.9 Write property test (fast-check) for ATR TP/SL risk/reward invariant — for any ATR > 0 and tpMultiplier > slMultiplier > 0, assert TP distance is strictly greater than SL distance
- [x] 5.10 Write unit test: when ATR = 0, `computeTPSL()` returns `null` and Backtester falls back to legacy pct-based TP/SL
