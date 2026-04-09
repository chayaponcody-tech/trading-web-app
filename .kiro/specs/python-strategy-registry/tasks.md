# Implementation Plan: Python Strategy Registry

## Overview

Refactor `packages/strategy-ai/main.py` into a Registry Pattern with separated concerns. Python becomes the single source of truth for signal generation and risk management. Node.js BotManager sends raw OHLCV data and uses the Python-computed stoploss.

## Tasks

- [ ] 1. Create file structure and core interfaces
  - Create `packages/strategy-ai/base_strategy.py` with `BaseStrategy` abstract class
  - Create `packages/strategy-ai/schemas.py` with Pydantic models (`AnalyzeRequest`, `AnalyzeResponse`, `StrategyListResponse`)
  - Create `packages/strategy-ai/strategies/__init__.py` (empty)
  - `BaseStrategy` must define `compute_signal(closes, highs, lows, volumes, params)` returning `{"signal", "stoploss", "metadata"}` and `get_metadata()` returning `{"name", "description", "version"}`
  - `BaseStrategy` must raise `NotImplementedError` when subclass does not implement `compute_signal`
  - `AnalyzeRequest` must include `field_validator` that rejects `closes` with fewer than 2 elements (HTTP 422)
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 4.4_

- [ ] 2. Implement StrategyRegistry
  - Create `packages/strategy-ai/registry.py` with `StrategyRegistry` class
  - Implement `register(key, strategy)`, `get(key)`, and `list_keys()` methods
  - `get()` must raise `KeyError` with a message that includes the requested key and the list of available keys when key is not found
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 2.1 Write property test for registry round-trip (Property 1)
    - **Property 1: Registry round-trip** — `register(key, s)` then `get(key)` returns the same instance
    - **Validates: Requirements 1.1, 1.3**

  - [ ]* 2.2 Write property test for registry list completeness (Property 2)
    - **Property 2: Registry lists all registered keys** — `list_keys()` returns exactly the set of registered keys
    - **Validates: Requirements 1.5**

  - [ ]* 2.3 Write property test for unregistered key error (Property 3)
    - **Property 3: Unregistered key raises descriptive error** — `get(unregistered_key)` raises `KeyError` whose message contains the key
    - **Validates: Requirements 1.4**

- [ ] 3. Implement BollingerBreakout strategy
  - Create `packages/strategy-ai/strategies/bollinger_breakout.py`
  - Implement `_ema(data, period)` helper using exponential smoothing formula `k = 2/(period+1)`
  - Implement `_atr(highs, lows, closes, period)` using true range over last `period` bars
  - `compute_signal`: EMA(30) as basis, `std = np.std(closes[-30:])`, `upper = ema + 1.0 * std`, `lower = ema - 1.0 * std`
  - Signal: `closes[-1] > upper` → `"LONG"`, otherwise `"NONE"`
  - Stoploss: `closes[-1] - 1.5 * ATR(14)` — only set when signal is `"LONG"`
  - Guard: if `len(closes) < 30` return `{"signal": "NONE", "stoploss": None, "metadata": {}}`
  - Metadata keys: `ema_basis`, `upper_band`, `lower_band`, `atr`, `stoploss_price`
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ]* 3.1 Write property test for compute_signal output shape (Property 4)
    - **Property 4: compute_signal always returns correct shape** — for any OHLCV arrays of length >= 30, result contains `signal`, `stoploss`, `metadata` with all required keys
    - **Validates: Requirements 2.1, 3.6**

  - [ ]* 3.2 Write property test for breakout signal correctness (Property 5)
    - **Property 5: Breakout signal correctness** — when `close[-1] > EMA(30) + 1×SD`, signal is `"LONG"`; otherwise `"NONE"`
    - **Validates: Requirements 3.2, 3.3**

  - [ ]* 3.3 Write property test for ATR stoploss invariant (Property 6)
    - **Property 6: ATR stoploss invariant** — for any LONG signal, `stoploss == close[-1] - 1.5 * ATR(14)` and `stoploss < close[-1]`
    - **Validates: Requirements 3.4**

- [ ] 4. Extract and refactor ConfidenceEngine
  - Create `packages/strategy-ai/confidence_engine.py`
  - Move `compute_confidence()` logic from `main.py` into `ConfidenceEngine._rule_based(signal, features, regime)`
  - Move `llm_analyze()` logic from `main.py` into `ConfidenceEngine._llm_analyze(signal, features, regime, strategy_metadata)`
  - `ConfidenceEngine.__init__` accepts `mode`, `openrouter_key`, `openrouter_model`
  - `score(signal, features, regime, strategy_metadata)` returns `(confidence: float, reason: str)` clamped to `[0.0, 1.0]`
  - LLM blend only when `mode == "full"` and `0.50 <= confidence <= 0.70` and key is set
  - _Requirements: 5.1, 5.2, 5.4, 5.5_

  - [ ]* 4.1 Write property test for ConfidenceEngine output bounds (Property 7)
    - **Property 7: ConfidenceEngine output is bounded** — for any inputs, `score()` returns `confidence` in `[0.0, 1.0]` and a non-empty `reason` string
    - **Validates: Requirements 5.2**

- [ ] 5. Add new FastAPI endpoints and bootstrap registry in main.py
  - Import and instantiate `StrategyRegistry`, register `BollingerBreakout` as `"bb_breakout"`
  - Instantiate `ConfidenceEngine` using env vars `AI_MODE`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`
  - Add `POST /strategy/analyze` endpoint using `AnalyzeRequest` / `AnalyzeResponse` schemas
    - Lookup strategy from registry; raise HTTP 400 with descriptive message if not found
    - Call `strategy.compute_signal(closes, highs, lows, volumes, params)`
    - Call `compute_features(closes)` and `detect_regime(features)` (reuse existing functions)
    - Call `confidence_engine.score(signal, features, regime, metadata)`
    - Apply threshold: set `signal = "NONE"` if `confidence < CONFIDENCE_THRESHOLD` (0.60)
    - Return `AnalyzeResponse` with `stoploss=None` when `signal == "NONE"`
  - Add `GET /strategy/list` endpoint returning `StrategyListResponse`
  - Keep existing `POST /analyze-signal` endpoint unchanged
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 7.1, 7.2, 7.3, 8.1, 8.2_

  - [ ]* 5.1 Write property test for low confidence suppresses signal (Property 8)
    - **Property 8: Low confidence suppresses signal** — when computed confidence < 0.60, response `signal` is `"NONE"` regardless of strategy output
    - **Validates: Requirements 5.3**

  - [ ]* 5.2 Write property test for analyze response shape (Property 9)
    - **Property 9: Analyze response always has required fields** — for any valid request, response contains `signal`, `confidence`, `stoploss`, `reason`, `metadata`, `strategy` with `signal` in `{"LONG", "SHORT", "NONE"}`
    - **Validates: Requirements 4.2**

- [ ] 6. Checkpoint — Ensure all Python tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Update Node.js BotManager to use new endpoint
  - In `packages/bot-engine/src/BotManager.js`, update `_strategyAiFilter()`:
    - Store `bot._lastKlines = klines` in `_tick()` after fetching klines
    - When `strategyAiMode !== "off"` and `bot.config.strategyName` is set, call `POST /strategy/analyze` instead of `POST /analyze-signal`
    - Build payload with `symbol`, `strategy: bot.config.strategyName`, and `closes/highs/lows/volumes` from `klines.slice(-100)`
    - Keep legacy `POST /analyze-signal` path for bots without `strategyName`
    - Log `strategy`, `signal`, `confidence`, and `stoploss` on every response
  - In `_openPosition()`, after `aiResult.approved`:
    - Store `bot._pendingPythonStoploss = aiResult.stoploss` before calling `_openPosition`
    - Inside `_openPosition`, attach `pos.pythonStoploss` and append `SL=...` to `pos.entryReason`
    - Delete `bot._pendingPythonStoploss` after attaching
  - Fallback to SignalEngine on timeout (5 s) or HTTP error; set `this._strategyAiOnline = false`
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 7.1 Write property test for BotManager payload slicing (Property 10)
    - **Property 10: BotManager sends last 100 bars** — for any klines array of length N, payload arrays have length `min(N, 100)` corresponding to the most recent bars
    - **Validates: Requirements 6.2**

- [ ] 8. Write integration tests
  - Create `packages/strategy-ai/tests/test_integration.py`
  - Test `POST /strategy/analyze` end-to-end with real `BollingerBreakout` data using FastAPI `TestClient`
  - Test `POST /analyze-signal` returns same response shape as before (backward compat)
  - Test `GET /strategy/list` returns `["bb_breakout"]`
  - Test HTTP 400 when unknown strategy key is sent
  - Test HTTP 422 when `closes` has fewer than 2 elements
  - _Requirements: 4.3, 4.4, 4.6, 7.1, 7.2, 7.3_

- [ ] 9. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Property tests use [Hypothesis](https://hypothesis.readthedocs.io/) with `@settings(max_examples=100)`
- Each property test file should include a comment: `# Feature: python-strategy-registry, Property N: <property_text>`
- `ConfidenceEngine` internal logic (`_rule_based`, `_llm_analyze`) is moved verbatim from `main.py` — no logic changes
- The existing `compute_features()` and `detect_regime()` functions in `main.py` are reused as-is
- `CONFIDENCE_THRESHOLD = 0.60` matches the existing behavior in `/analyze-signal`
