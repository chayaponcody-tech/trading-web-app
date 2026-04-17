# Implementation Plan: Evolutionary Quant System

## Overview

สร้าง `packages/quant-engine/` Python container ใหม่ที่ประกอบด้วย 5 agents ทำงานแบบ closed evolutionary loop พร้อม database migrations, Docker integration, และ property-based tests ด้วย Hypothesis

## Tasks

- [x] 1. Infrastructure: Package Scaffold และ Docker Setup
  - [x] 1.1 สร้าง package structure และ configuration files
    - สร้าง `packages/quant-engine/` directory structure ตาม design
    - สร้าง `requirements.txt` พร้อม dependencies: fastapi, uvicorn, apscheduler, httpx, pandas, numpy, pyarrow, hypothesis, pytest, pytest-asyncio
    - สร้าง `packages/quant-engine/Dockerfile` ตาม design spec
    - สร้าง `pytest.ini` พร้อม asyncio_mode=auto และ hypothesis settings
    - _Requirements: 10.1_

  - [x] 1.2 เพิ่ม quant-engine service ใน docker-compose.yml
    - เพิ่ม `quant-engine` service พร้อม environment variables: BACKEND_URL, STRATEGY_AI_URL, OPENROUTER_API_KEY, BINANCE_API_KEY, DATA_DIR, DB_PATH, ETL_SYMBOLS, ETL_INTERVAL, DECAY_THRESHOLD
    - เพิ่ม `quant_data` volume สำหรับ Parquet storage
    - ตั้ง depends_on: backend, strategy-ai
    - _Requirements: 10.1_

- [x] 2. Database Migrations: 5 New SQLite Tables
  - [x] 2.1 เพิ่ม migration สำหรับ quant-engine tables ใน `packages/data-layer/src/DatabaseManager.js`
    - เพิ่ม migration block ที่ตรวจสอบและสร้าง `approved_strategies` table พร้อม indexes
    - เพิ่ม migration สำหรับ `sentiment_scores` table พร้อม index บน (symbol, timestamp)
    - เพิ่ม migration สำหรับ `ohlcv_metadata` table พร้อม UNIQUE(symbol, interval)
    - เพิ่ม migration สำหรับ `alpha_decay_events` table
    - เพิ่ม migration สำหรับ `mutation_history` table พร้อม index บน lineage_id
    - _Requirements: 6.2, 6.4_

- [x] 3. Core: Registry Layer และ Pydantic Schemas
  - [x] 3.1 สร้าง `core/registry.py` — SQLite repository layer
    - implement `StrategyRegistry` class พร้อม `register()` (upsert), `lookup()`, `list_by_status()`, `list_by_sharpe()` methods
    - ใช้ SQLite connection ที่รับมาจาก constructor (shared database)
    - Idempotent upsert: INSERT OR REPLACE สำหรับ duplicate strategy_key
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6_

  - [x] 3.2 Write property test สำหรับ Strategy Registry Round-Trip
    - **Property 6: Strategy Registry Round-Trip**
    - **Validates: Requirements 6.5, 11.6**
    - ใช้ in-memory SQLite (`:memory:`) สำหรับ test isolation
    - Generate random strategy_key, python_code, sharpe ด้วย Hypothesis

  - [x] 3.3 สร้าง Pydantic schemas ใน `core/schemas.py`
    - define ทุก Pydantic models จาก design: SentimentResult, OHLCVMetadata, ETLResult, GenerationResult, ValidationResult, SandboxResult, RegimeResult, BacktestResult, ApprovedStrategy, StrategyAllocation, DecayMetrics, DecayEvent, AgentStatus, CycleResult
    - _Requirements: 10.1_

- [x] 4. Core: Sandbox Executor
  - [x] 4.1 สร้าง `core/sandbox_executor.py`
    - implement `IMPORT_WHITELIST` frozenset: numpy, pandas, vectorbt, math, statistics, collections, itertools
    - implement `RestrictedImporter` class เป็น sys.meta_path hook ที่ block non-whitelist imports
    - implement `_build_safe_builtins()` ที่ลบ open, exec, eval, compile, __import__, breakpoint
    - implement `SandboxExecutor.execute()` พร้อม threading.Thread timeout 30 วินาที และ isolated namespace
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 4.2 Write property test สำหรับ Sandbox Security Invariant
    - **Property 3: Sandbox Security Invariant**
    - **Validates: Requirements 3.8, 4.2, 4.6, 11.3**
    - Generate random module names นอก whitelist ด้วย Hypothesis st.text()
    - ตรวจสอบว่า result.success=False และ "ImportError" อยู่ใน result.error

  - [x] 4.3 Write unit tests สำหรับ SandboxExecutor
    - ทดสอบ whitelist imports ทำงานได้ปกติ (numpy, pandas)
    - ทดสอบ timeout behavior (code ที่ loop ไม่สิ้นสุด)
    - ทดสอบ blocked builtins (open, exec, eval)
    - _Requirements: 4.1, 4.3, 4.5_

- [x] 5. Agent: Sentiment Agent
  - [x] 5.1 สร้าง `agents/sentiment_agent.py`
    - implement `SentimentAgent.__init__()` รับ httpx.AsyncClient และ sqlite3.Connection
    - implement `_calculate_score(funding_rate, oi_change_pct) -> float` เป็น pure function ตาม weighted formula: funding_component = clamp((-fr/0.002)*50+50, 0, 100), oi_component = clamp((oi/10.0)*50+50, 0, 100), score = 0.6*funding + 0.4*oi
    - implement `compute_score(symbol)` ที่ดึง FundingRate + OI จาก Binance API ผ่าน httpx พร้อม fallback score=50 เมื่อ API ล้มเหลว
    - implement `save_score()`, `get_latest()`, `get_history()` สำหรับ sentiment_scores table
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 5.2 Write property test สำหรับ Sentiment Score Invariant
    - **Property 1: Sentiment Score Invariant**
    - **Validates: Requirements 1.2, 1.7, 11.1**
    - Generate (funding_rate, oi_change_pct) ด้วย st.floats() ช่วง [-0.01, 0.01] และ [-50, 50]
    - ตรวจสอบ 0.0 <= score <= 100.0

  - [x] 5.3 Write property test สำหรับ Sentiment Score Idempotence
    - **Property 10: Sentiment Score Idempotence**
    - **Validates: Requirements 11.10**
    - เรียก _calculate_score() ด้วย input เดิม 2 ครั้ง ตรวจสอบว่าได้ผลเดิม

  - [x] 5.4 Write unit tests สำหรับ SentimentAgent
    - ทดสอบ boundary conditions: FR > +0.1% → score < 40, FR < -0.1% → score > 60
    - ทดสอบ Binance API failure → fallback score=50
    - _Requirements: 1.3, 1.4, 1.6_

- [x] 6. Agent: Data Agent
  - [x] 6.1 สร้าง `agents/data_agent.py`
    - implement `DataAgent.__init__()` รับ httpx.AsyncClient, data_dir Path, sqlite3.Connection
    - implement `_fetch_ohlcv(symbol, interval, limit)` ดึงข้อมูลจาก Binance API ผ่าน httpx
    - implement `_clean_data(df)`: forward-fill missing values, replace outliers (>5 std จาก rolling mean 20) ด้วย rolling median, sort ascending, drop duplicates
    - implement `_save_parquet(df, symbol, interval)` บันทึก DataFrame ลง Parquet
    - implement `read_ohlcv(symbol, interval, from_ts, to_ts)` อ่านจาก Parquet
    - implement `run_etl(symbol, interval, limit)` เป็น main pipeline พร้อม retry 3 ครั้ง + exponential backoff + alert
    - implement `_update_metadata()` อัปเดต ohlcv_metadata table
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [x] 6.2 Write property test สำหรับ OHLCV Round-Trip Preservation
    - **Property 2: OHLCV Round-Trip Preservation**
    - **Validates: Requirements 2.8, 11.2**
    - Generate random OHLCV DataFrame ด้วย Hypothesis (10-500 rows, unique sorted timestamps)
    - ตรวจสอบ shape, columns, values เทียบเท่ากัน (atol=1e-9)

  - [x] 6.3 Write unit tests สำหรับ DataAgent
    - ทดสอบ forward-fill logic กับ DataFrame ที่มี NaN
    - ทดสอบ outlier replacement (>5 std)
    - ทดสอบ retry 3 ครั้งเมื่อ API ล้มเหลว
    - _Requirements: 2.2, 2.3, 2.6_

- [x] 7. Checkpoint — Core และ Data Layer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Agent: Alpha Agent
  - [x] 8.1 สร้าง `agents/alpha_agent.py`
    - implement `AlphaAgent.__init__()` รับ llm_client, sandbox, strategy_ai_url, db
    - implement `_validate_code(code)` ด้วย ast.parse() syntax check และตรวจสอบ class ที่ extend BaseStrategy
    - implement `_build_generation_prompt(topic, context)` และ `_build_mutation_prompt(original_code, metrics, failure_reason)`
    - implement `generate_strategy(topic, context)` พร้อม retry loop ≤ 5 ครั้ง, self-correction prompt เมื่อ error, mark "generation_failed" เมื่อครบ 5 ครั้ง
    - implement `mutate_strategy(original_code, metrics, failure_reason, lineage_id)` พร้อม termination check (mutation_count ≤ 10)
    - implement `_register_strategy(key, code)` POST ไปยัง strategy-ai /strategy/register-dynamic
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 8.2 Write property test สำหรับ Alpha Generation Termination
    - **Property 8: Alpha Generation Termination**
    - **Validates: Requirements 3.6, 3.9, 11.8**
    - Mock LLM ให้ return invalid code ทุกครั้ง
    - ตรวจสอบ result.attempts <= 5 และ result.status == "generation_failed"

  - [x] 8.3 Write unit tests สำหรับ AlphaAgent
    - ทดสอบ self-correction prompt มี stack trace
    - ทดสอบ mutation prompt มี failure_reason และ original metrics
    - ทดสอบ code ที่ไม่มี BaseStrategy subclass ถูก reject
    - _Requirements: 3.2, 3.3, 3.5, 9.1_

- [x] 9. Agent: Backtest Agent
  - [x] 9.1 สร้าง `agents/backtest_agent.py`
    - implement `BacktestAgent.__init__()` รับ data_agent, strategy_ai_url, db
    - implement `_classify_regime(ohlcv)` จำแนก bull/bear/sideways จาก price trend
    - implement `_select_regime_data(symbol)` เลือก historical data สำหรับ 3 regimes
    - implement `_make_approval_decision(avg_sharpe) -> bool` pure function: sharpe > 1.5 → True
    - implement `_run_walk_forward(strategy_key, ohlcv)` POST ไปยัง strategy-ai /strategy/optimize/vectorbt
    - implement `evaluate(strategy_key, python_code)` รัน walk-forward ใน 3 regimes, คำนวณ avg_sharpe, ระบุ worst_regime ใน rejection_reason
    - implement `_save_result()` บันทึกลง backtest_results table (SQLite)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 9.2 Write property test สำหรับ Backtest Approval Determinism
    - **Property 4: Backtest Approval Determinism**
    - **Validates: Requirements 5.7, 11.4**
    - Generate random sharpe values ด้วย st.floats()
    - เรียก _make_approval_decision() 2 ครั้ง ตรวจสอบผลเดิม และ threshold correctness

  - [x] 9.3 Write unit tests สำหรับ BacktestAgent
    - ทดสอบ rejection reason ระบุ worst regime
    - ทดสอบ 3-regime selection ครบถ้วน
    - _Requirements: 5.2, 5.6_

- [x] 10. Agent: Strategy Manager
  - [x] 10.1 สร้าง `agents/strategy_manager.py`
    - implement `StrategyManager.__init__()` รับ db, backend_url, strategy_ai_url, alpha_agent
    - implement `_compute_volatility(strategy_key, lookback_days)` คำนวณ std ของ daily returns
    - implement `compute_allocations(total_capital)` ด้วย inverse volatility weighting: weight_i = (1/vol_i) / sum(1/vol_j), minimum 1% สำหรับ vol=0
    - implement `compute_decay_score(consecutive_losses, rolling_sharpe_30d, max_drawdown_7d)` ตาม formula: loss_score + sharpe_score + drawdown_score ∈ [0, 100]
    - implement `check_alpha_decay()` คำนวณ decay score ทุก active strategy, trigger ทันทีเมื่อ consecutive_losses >= 5
    - implement `register_approved(strategy_key, python_code, metrics)` idempotent upsert ผ่าน StrategyRegistry
    - implement `retire_strategy(strategy_key, decay_metrics)` mark decayed, POST /api/bots/:id/stop, ส่งไป Alpha_Agent
    - implement `get_active_strategies()` query จาก approved_strategies table
    - _Requirements: 6.1, 6.2, 6.3, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [x] 10.2 Write property test สำหรับ Capital Budget Invariant
    - **Property 5: Capital Budget Invariant**
    - **Validates: Requirements 7.5, 11.5**
    - Generate random volatility list (1-20 strategies) และ total_capital
    - ตรวจสอบ sum(allocations.values()) <= total_capital + 1e-9

  - [x] 10.3 Write property test สำหรับ Equal Volatility Equal Allocation
    - **Property 9: Equal Volatility Equal Allocation**
    - **Validates: Requirements 7.6, 11.9**
    - Generate N strategies ที่มี volatility เท่ากัน
    - ตรวจสอบ allocation ต่างกันไม่เกิน 0.01 USDT

  - [x] 10.4 Write property test สำหรับ Alpha Decay Score Monotonicity
    - **Property 7: Alpha Decay Score Monotonicity**
    - **Validates: Requirements 8.7, 11.7**
    - Generate (consecutive_losses, rolling_sharpe, max_drawdown) แล้วเพิ่ม consecutive_losses +1
    - ตรวจสอบ score(n+1) >= score(n) - 1e-9

  - [x] 10.5 Write unit tests สำหรับ StrategyManager
    - ทดสอบ zero volatility → minimum 1% allocation
    - ทดสอบ decay threshold trigger เมื่อ score > 70
    - ทดสอบ consecutive_losses >= 5 → immediate decay check
    - _Requirements: 7.4, 8.2, 8.5_

- [x] 11. Checkpoint — Agents
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Core: Evolutionary Loop Orchestration
  - [x] 12.1 สร้าง `core/evolutionary_loop.py`
    - implement `EvolutionaryLoop.__init__()` รับ agents registry และ db
    - implement `_call_with_timeout(agent_name, coro, timeout=60)` wrapper ที่ mark agent "timeout" หากไม่ตอบสนองภายใน 60 วินาที
    - implement `run_generation_cycle(topic)` pipeline: Alpha → Backtest → Strategy_Manager พร้อม error logging format ตาม design (agent_name, timestamp, input_payload, error_type, cycle_id)
    - implement `run_decay_check()` ตรวจสอบ alpha decay สำหรับทุก active strategy
    - implement `get_status()` return สถานะปัจจุบันของแต่ละ agent
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.7, 9.4, 9.5, 9.7_

  - [x] 12.2 Write unit tests สำหรับ EvolutionaryLoop
    - ทดสอบ agent timeout handling → mark "timeout" และ skip
    - ทดสอบ pipeline order: Alpha → Backtest → Strategy_Manager
    - ทดสอบ error logging format มีครบทุก fields
    - _Requirements: 10.2, 10.3, 10.7_

- [x] 13. FastAPI Main Application
  - [x] 13.1 สร้าง `main.py` — FastAPI app bootstrap
    - สร้าง FastAPI app พร้อม title และ lifespan context manager
    - initialize SQLite connection, httpx.AsyncClient, และ agent instances
    - configure APScheduler jobs: ETL ทุก 15 นาที, sentiment ทุก 15 นาที, generation cycle ทุก 6 ชั่วโมง, decay check ทุก 1 ชั่วโมง
    - mount routers: /sentiment, /data, /alpha, /backtest, /strategies, /loop
    - implement GET /health และ GET /status endpoints
    - _Requirements: 10.1, 10.3, 2.1, 1.1_

  - [x] 13.2 สร้าง API routers สำหรับแต่ละ agent
    - สร้าง router สำหรับ SentimentAgent: GET /sentiment/{symbol}, GET /sentiment/{symbol}/history
    - สร้าง router สำหรับ DataAgent: GET /data/ohlcv/{symbol}, GET /data/metadata, POST /data/etl/trigger
    - สร้าง router สำหรับ AlphaAgent: POST /alpha/generate, POST /alpha/mutate, GET /alpha/status
    - สร้าง router สำหรับ BacktestAgent: POST /backtest/evaluate, GET /backtest/results/{strategy_key}
    - สร้าง router สำหรับ StrategyManager: GET /strategies, GET /strategies/{key}, POST /strategies/{key}/retire, GET /allocations
    - สร้าง router สำหรับ EvolutionaryLoop: GET /status, POST /loop/trigger, GET /loop/history
    - _Requirements: 10.3, 10.5, 10.6_

- [x] 14. Integration: Wire Everything Together
  - [x] 14.1 ตรวจสอบ integration points ทั้งหมด
    - ทดสอบ POST /strategy/register-dynamic ไปยัง strategy-ai:8001 ทำงานได้
    - ทดสอบ POST /strategy/optimize/vectorbt ไปยัง strategy-ai:8001 ทำงานได้
    - ทดสอบ POST /api/bots ไปยัง backend:4001 ทำงานได้
    - ทดสอบ PUT /api/bots/:id/stop ไปยัง backend:4001 ทำงานได้
    - _Requirements: 10.4, 10.5, 10.6_

  - [x] 14.2 Write integration tests สำหรับ full pipeline
    - ทดสอบ full generation cycle: Alpha → Backtest → Strategy_Manager ด้วย mock HTTP servers
    - ทดสอบ decay detection → mutation request pipeline
    - _Requirements: 10.1, 10.4, 9.3_

- [x] 15. Final Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks ที่มี `*` เป็น optional สามารถ skip ได้สำหรับ MVP ที่เร็วขึ้น
- แต่ละ task อ้างอิง requirements เฉพาะเพื่อ traceability
- Property tests ใช้ Hypothesis library พร้อม max_examples=200
- Checkpoints ช่วย validate incremental progress ก่อนไปขั้นตอนถัดไป
- ลำดับ implementation: Infrastructure → DB → Core → Sandbox → Agents (Data ก่อน เพราะเป็น dependency) → Loop → Main
