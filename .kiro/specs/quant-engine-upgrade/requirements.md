# Requirements Document

## Introduction

This document defines the requirements for upgrading the crypto trading system from a "Systematic Rule-based Bot" to a "Full Quantitative Trading Engine". The upgrade is delivered in four sequential phases:

- **Phase 1** — Vectorize the Backtester (eliminate the per-candle HTTP anti-pattern)
- **Phase 2** — Risk Management & Position Sizing Upgrades (slippage model + ATR-based sizing)
- **Phase 3** — Replace LLM Tuning with Bayesian Optimization & Walk-Forward Validation
- **Phase 4** — Prepare the Confidence Engine for Machine Learning
- **Phase 5** — UI Cleanup: unified strategy selector + ATR-based TP/SL multipliers

The system is a Node.js/Python monorepo. Execution logic lives in `packages/bot-engine` (Node.js). The math and strategy layer lives in `packages/strategy-ai` (Python FastAPI).

---

## Glossary

- **Backtester**: The module in `packages/bot-engine/src/Backtester.js` that simulates trading over historical kline data.
- **BotManager**: The module in `packages/bot-engine/src/BotManager.js` that manages live bot lifecycle and tick loops.
- **StrategyAI**: The Python FastAPI service in `packages/strategy-ai/` that computes signals and confidence scores.
- **BatchEndpoint**: The new `POST /strategy/analyze/batch` endpoint on the StrategyAI service.
- **SignalArray**: An ordered array of signal strings (`"LONG"`, `"SHORT"`, or `"NONE"`) with one entry per input candle.
- **ConfidenceArray**: An ordered array of float values in `[0.0, 1.0]` with one entry per input candle.
- **SlippageModel**: A deterministic price-adjustment function that applies a 0.05% penalty to fill prices.
- **ATR**: Average True Range — a volatility indicator computed over a rolling window of high, low, and close prices.
- **VolatilityPositionSizer**: The component that computes position size using the formula `(Capital × RiskPct) / ATR`.
- **TuningService**: The module in `packages/bot-engine/src/TuningService.js` that optimizes strategy parameters.
- **OptimizerAgent**: The LLM-based agent in `packages/ai-agents/src/OptimizerAgent.js` currently used by TuningService.
- **BayesianOptimizer**: The new Optuna-based optimization endpoint `POST /strategy/optimize` on the StrategyAI service.
- **WalkForwardValidator**: The component inside the Backtester that runs train/test window sliding.
- **ConfidenceEngine**: The class in `packages/strategy-ai/confidence_engine.py` that scores signal confidence.
- **MLModel**: A pre-trained scikit-learn compatible model (XGBoost or Random Forest) loaded from a `.pkl` file.
- **FeaturePipeline**: The component that transforms raw OHLCV arrays into a fixed-length feature vector for the MLModel.
- **ReflectionAgent**: The LLM agent in `packages/ai-agents/src/ReflectionAgent.js` used for post-trade analysis (retained as-is).
- **SharpeRatio**: A risk-adjusted return metric computed as `mean(returns) / std(returns) * sqrt(annualization_factor)`.
- **PythonStrategyClient**: The module in `packages/bot-engine/src/PythonStrategyClient.js` that calls the StrategyAI service.
- **ATRMultiplier**: A user-configurable multiplier applied to ATR to derive dynamic TP and SL distances (e.g., TP = entry ± ATR × tpMultiplier).
- **UnifiedStrategyRegistry**: A merged list of all available strategies (JS-native and Python-backed) exposed as a single dropdown in the UI, with no separate "Enable Python Strategy" toggle.

---

## Requirements

---

### Requirement 1: Batch Signal Analysis Endpoint

**User Story:** As a backend developer, I want a single HTTP call to return signals for an entire OHLCV dataset, so that the Backtester does not make one API call per candle.

#### Acceptance Criteria

1. THE StrategyAI SHALL expose a `POST /strategy/analyze/batch` endpoint that accepts a single request containing arrays of `closes`, `highs`, `lows`, `volumes`, a `strategy` key, `symbol`, and optional `params`.
2. WHEN the BatchEndpoint receives a valid request, THE StrategyAI SHALL return a `SignalArray` and a `ConfidenceArray`, each with the same length as the input `closes` array.
3. WHEN the BatchEndpoint receives a `closes` array with fewer than 50 elements, THE StrategyAI SHALL return an HTTP 422 error with a descriptive message.
4. WHEN the BatchEndpoint receives arrays of mismatched lengths (e.g., `closes` length ≠ `highs` length), THE StrategyAI SHALL return an HTTP 422 error.
5. THE BatchEndpoint SHALL compute all indicators using vectorized pandas and numpy operations over the full input arrays, without iterating candle-by-candle in Python.
6. FOR ALL valid input arrays of length N ≥ 50, the SignalArray returned by the BatchEndpoint SHALL be equivalent to calling `POST /strategy/analyze` N times with progressively longer slices of the same input (no-look-ahead equivalence property).

---

### Requirement 2: Backtester Batch Refactor

**User Story:** As a developer, I want the Backtester to call the StrategyAI service exactly once per backtest run, so that backtest execution time scales with data size rather than with the number of candles.

#### Acceptance Criteria

1. WHEN `runBacktest` is called with a Python strategy, THE Backtester SHALL call the BatchEndpoint exactly once and receive the full SignalArray before beginning the simulation loop.
2. THE Backtester SHALL use a local JavaScript event-driven loop to simulate entries, exits, equity tracking, and trade recording using the pre-fetched SignalArray.
3. WHEN the BatchEndpoint is unavailable, THE Backtester SHALL return `{ error: 'Strategy AI service unavailable' }` without retrying.
4. THE Backtester SHALL produce identical `totalPnl`, `winRate`, `sharpeRatio`, and `maxDrawdown` values for the same input data regardless of whether signals were fetched per-candle or via the batch endpoint.
5. THE PythonStrategyClient SHALL expose a `getBatchSignals(strategyKey, payload)` function that calls `POST /strategy/analyze/batch` and returns `{ signals: SignalArray, confidences: ConfidenceArray }`.

---

### Requirement 3: Slippage Model

**User Story:** As a quant developer, I want all simulated and live order fills to include a realistic slippage penalty, so that backtest results reflect real-world execution costs.

#### Acceptance Criteria

1. THE SlippageModel SHALL apply a 0.05% price penalty to every position open and close operation.
2. WHEN a LONG position is opened, THE SlippageModel SHALL set the effective entry price to `entryPrice × 1.0005`.
3. WHEN a SHORT position is opened, THE SlippageModel SHALL set the effective entry price to `entryPrice × 0.9995`.
4. WHEN a LONG position is closed, THE SlippageModel SHALL set the effective exit price to `exitPrice × 0.9995`.
5. WHEN a SHORT position is closed, THE SlippageModel SHALL set the effective exit price to `exitPrice × 1.0005`.
6. THE Backtester SHALL apply the SlippageModel in `_openPosition` and `_closePosition` equivalent logic.
7. THE BotManager SHALL apply the SlippageModel in `_openPosition` and `_closePosition` for PnL calculation and trade recording.
8. FOR ALL valid price inputs greater than zero, the effective fill price produced by the SlippageModel SHALL always be worse for the trader than the raw market price (invariant: LONG entry effective > raw, SHORT entry effective < raw, LONG exit effective < raw, SHORT exit effective > raw).

---

### Requirement 4: Volatility-Adjusted Position Sizing

**User Story:** As a risk manager, I want position sizes to scale inversely with market volatility, so that the system risks a consistent dollar amount per trade regardless of asset volatility.

#### Acceptance Criteria

1. THE VolatilityPositionSizer SHALL compute ATR over a configurable rolling window (default: 14 candles) using the formula `ATR = mean(max(high-low, |high-prevClose|, |low-prevClose|) for last N candles)`.
2. WHEN ATR is available, THE VolatilityPositionSizer SHALL compute position size as `(Capital × RiskPct) / ATR`, where `RiskPct` is a configurable parameter (default: 1%).
3. WHEN ATR is zero or unavailable (fewer than 15 candles), THE VolatilityPositionSizer SHALL fall back to the legacy formula `Capital × Leverage`.
4. THE Backtester SHALL use the VolatilityPositionSizer to determine `positionSize` for each trade entry.
5. THE BotManager SHALL use the VolatilityPositionSizer to determine `tradeValue` in `_openPosition`.
6. FOR ALL valid inputs where ATR > 0 and Capital > 0 and RiskPct > 0, the computed position size SHALL be strictly positive and SHALL decrease monotonically as ATR increases (volatility-inverse invariant).

---

### Requirement 5: Bayesian Parameter Optimization

**User Story:** As a quant developer, I want strategy parameters to be optimized using Bayesian search rather than LLM guessing, so that parameter selection is reproducible, data-driven, and maximizes risk-adjusted returns.

#### Acceptance Criteria

1. THE TuningService SHALL NOT call the OptimizerAgent or any OpenRouter LLM endpoint during parameter optimization.
2. THE StrategyAI SHALL expose a `POST /strategy/optimize` endpoint that accepts a `strategy` key, OHLCV arrays, a parameter search space definition, and a `n_trials` integer.
3. WHEN the BayesianOptimizer receives a valid request, THE StrategyAI SHALL use Optuna to search the parameter space and return the parameter set that maximizes SharpeRatio over the provided data.
4. WHEN `n_trials` is not provided, THE BayesianOptimizer SHALL default to 50 trials.
5. WHEN the BayesianOptimizer completes, THE StrategyAI SHALL return the best parameters, the best SharpeRatio achieved, and the total number of trials completed.
6. THE TuningService SHALL call `POST /strategy/optimize` and apply the returned parameters to the bot configuration.
7. WHEN the optimization endpoint is unavailable, THE TuningService SHALL log a warning and retain the current bot parameters unchanged.

---

### Requirement 6: Walk-Forward Validation

**User Story:** As a quant developer, I want the Backtester to validate strategy parameters using walk-forward testing, so that parameter overfitting to a single historical window is detected and reported.

#### Acceptance Criteria

1. THE WalkForwardValidator SHALL partition the full kline dataset into sequential train/test windows using a configurable train period (default: 3 months of candles) and test period (default: 1 month of candles).
2. WHEN walk-forward mode is enabled, THE Backtester SHALL run a full backtest simulation on each test window using parameters optimized on the preceding train window.
3. THE WalkForwardValidator SHALL return an array of per-window results, each containing `trainStart`, `trainEnd`, `testStart`, `testEnd`, `sharpeRatio`, `totalPnl`, and `winRate`.
4. FOR ALL valid datasets where `total_candles >= train_candles + test_candles`, the number of walk-forward windows SHALL equal `floor((total_candles - train_candles) / test_candles)` (window count invariant).
5. WHEN the dataset is too short to form at least one complete train+test window, THE WalkForwardValidator SHALL return `{ error: 'Insufficient data for walk-forward validation' }`.
6. THE Backtester SHALL expose a `runWalkForward(exchange, config)` function that returns the array of per-window results alongside an aggregate `avgSharpe` and `avgPnl`.

---

### Requirement 7: ML-Ready Confidence Engine

**User Story:** As a data scientist, I want the ConfidenceEngine to accept a pre-trained ML model, so that confidence scores are derived from statistical probabilities rather than hand-coded if/else rules.

#### Acceptance Criteria

1. WHEN a `.pkl` model file path is provided at startup via the `MODEL_PATH` environment variable, THE ConfidenceEngine SHALL load the model using `joblib.load` and use it for scoring.
2. WHEN an MLModel is loaded, THE ConfidenceEngine SHALL pass the feature vector produced by the FeaturePipeline into `model.predict_proba()` and return the class probability for the positive class as the confidence score.
3. WHEN no MLModel is loaded (MODEL_PATH is not set or file is missing), THE ConfidenceEngine SHALL fall back to the existing rule-based `_rule_based()` scoring method without raising an error.
4. THE FeaturePipeline SHALL extract the following features from raw OHLCV arrays: `rsi_14`, `ema20`, `ema50`, `ema_cross`, `bb_position`, `volatility_20`, `momentum_10`, `atr_14`.
5. FOR ALL valid OHLCV inputs with length ≥ 50, the FeaturePipeline SHALL always produce a feature vector of exactly 8 elements (shape invariant).
6. FOR ALL valid feature vectors, `model.predict_proba()` SHALL return a value in `[0.0, 1.0]` (probability bounds invariant).
7. WHEN the MLModel raises an exception during inference, THE ConfidenceEngine SHALL log the error and fall back to the rule-based score for that call.

---

### Requirement 8: ATR-Based TP/SL Multipliers

**User Story:** As a trader, I want TP and SL distances to be expressed as ATR multipliers rather than fixed percentages, so that exits automatically adapt to current market volatility.

#### Acceptance Criteria

1. THE Backtester and BotManager SHALL replace the fixed `tpPct` and `slPct` parameters with `tpMultiplier` and `slMultiplier` (float, default: `2.0` and `1.0` respectively).
2. WHEN a position is opened, THE system SHALL compute dynamic TP and SL prices as:
   - LONG TP: `entryPrice + (ATR × tpMultiplier)`
   - LONG SL: `entryPrice - (ATR × slMultiplier)`
   - SHORT TP: `entryPrice - (ATR × tpMultiplier)`
   - SHORT SL: `entryPrice + (ATR × slMultiplier)`
3. WHEN ATR is zero or unavailable, THE system SHALL fall back to the legacy fixed-percentage TP/SL behaviour.
4. THE Strategy Tester UI SHALL rename the `TP%` and `SL%` input fields to `TP (ATR×)` and `SL (ATR×)` and accept float values.
5. FOR ALL valid inputs where ATR > 0 and tpMultiplier > slMultiplier > 0, the TP distance SHALL always be strictly greater than the SL distance (risk/reward invariant).

---

### Requirement 9: Unified Strategy Selector

**User Story:** As a trader, I want a single strategy dropdown that lists all available strategies (JS-native and Python-backed) without a separate "Enable Python Strategy" checkbox, so that the UI is simpler and strategy selection is unambiguous.

#### Acceptance Criteria

1. THE Strategy Tester UI SHALL expose a single `Strategy` dropdown that lists all registered strategies from both the JS engine and the Python StrategyAI service.
2. THE "Enable Python Strategy" checkbox and the secondary "Strategy Name" dropdown SHALL be removed from the UI.
3. WHEN a strategy backed by the Python service is selected, THE Backtester SHALL automatically route the request through `getBatchSignals()` without requiring any additional user action.
4. WHEN a JS-native strategy is selected, THE Backtester SHALL execute it locally without calling the Python service.
5. THE backend SHALL expose a `GET /strategy/list` endpoint (or equivalent) that returns the combined list of available strategy keys so the frontend can populate the unified dropdown.
6. THE UnifiedStrategyRegistry SHALL tag each strategy entry with its execution engine (`"js"` or `"python"`) so the Backtester can route correctly.
