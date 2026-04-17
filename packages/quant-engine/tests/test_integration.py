"""
Integration tests for the full Evolutionary Quant System pipeline.

Tests:
1. Full generation cycle: Alpha → Backtest → Strategy_Manager
   - Mock LLM returns valid strategy code
   - Mock strategy-ai returns sharpe > 1.5 (approved)
   - Strategy_Manager registers it as "active"
   - Verify strategy appears in registry as "active"

2. Decay detection → mutation pipeline:
   - Set up an active strategy in the registry
   - Simulate consecutive_losses >= 5 in trades table
   - Call check_alpha_decay()
   - Verify strategy is marked "decayed"
   - Verify mutation was triggered (alpha_agent.mutate_strategy was called)

Requirements: 10.1, 10.4, 9.3
"""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from agents.alpha_agent import AlphaAgent
from agents.backtest_agent import BacktestAgent
from agents.strategy_manager import StrategyManager
from core.evolutionary_loop import AgentRegistry, EvolutionaryLoop
from core.registry import StrategyRegistry
from core.sandbox_executor import SandboxExecutor
from core.schemas import GenerationResult


# ─── Minimal valid strategy code ──────────────────────────────────────────────

VALID_STRATEGY_CODE = """
class MyStrategy(BaseStrategy):
    def __init__(self, params: dict):
        self.params = params

    def generate_signals(self, ohlcv):
        import pandas as pd
        return pd.Series([1] * len(ohlcv))
"""


# ─── DB Setup ─────────────────────────────────────────────────────────────────

DDL = """
CREATE TABLE IF NOT EXISTS approved_strategies (
    strategy_key    TEXT PRIMARY KEY,
    python_code     TEXT NOT NULL,
    backtest_metrics TEXT NOT NULL,
    approved_at     TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'active',
    lineage_id      TEXT NOT NULL,
    mutation_count  INTEGER NOT NULL DEFAULT 0,
    bot_id          TEXT,
    updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS backtest_results (
    backtestId TEXT PRIMARY KEY,
    symbol     TEXT NOT NULL,
    strategy   TEXT NOT NULL,
    interval   TEXT NOT NULL,
    config     TEXT NOT NULL,
    metrics    TEXT NOT NULL,
    createdAt  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mutation_history (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    lineage_id     TEXT NOT NULL,
    parent_key     TEXT NOT NULL,
    child_key      TEXT NOT NULL,
    mutation_round INTEGER NOT NULL,
    failure_reason TEXT,
    decay_metrics  TEXT,
    created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alpha_decay_events (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    strategy_key        TEXT NOT NULL,
    decay_score         REAL NOT NULL,
    consecutive_losses  INTEGER NOT NULL,
    rolling_sharpe_30d  REAL NOT NULL,
    max_drawdown_7d     REAL NOT NULL,
    action              TEXT NOT NULL,
    timestamp           TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trades (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    strategy_key TEXT NOT NULL,
    pnl          REAL NOT NULL,
    created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sentiment_scores (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol        TEXT NOT NULL,
    score         REAL NOT NULL,
    funding_rate  REAL NOT NULL,
    oi_change_pct REAL NOT NULL,
    components    TEXT NOT NULL,
    timestamp     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ohlcv_metadata (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol       TEXT NOT NULL,
    interval     TEXT NOT NULL,
    last_updated TEXT NOT NULL,
    row_count    INTEGER NOT NULL,
    parquet_path TEXT NOT NULL,
    UNIQUE(symbol, interval)
);
"""


def _make_db() -> sqlite3.Connection:
    """Create an in-memory SQLite DB with all required tables."""
    conn = sqlite3.connect(":memory:")
    conn.executescript(DDL)
    conn.commit()
    return conn


# ─── Integration Test 1: Full Generation Cycle ────────────────────────────────

class TestFullGenerationCycle:
    """
    Integration test: Alpha → Backtest → Strategy_Manager full pipeline.

    Validates: Requirements 10.1, 10.4
    """

    @pytest.mark.asyncio
    async def test_approved_strategy_registered_as_active(self):
        """
        Full generation cycle with mock HTTP servers:
        1. Alpha_Agent generates strategy (mock LLM returns valid code)
        2. Backtest_Agent evaluates it (mock strategy-ai returns sharpe > 1.5)
        3. Strategy_Manager registers it as approved
        4. Verify strategy appears in registry as "active"

        Validates: Requirements 10.1, 10.4
        """
        db = _make_db()

        # ── Mock LLM client ───────────────────────────────────────────────
        mock_llm = AsyncMock()
        mock_llm.complete.return_value = VALID_STRATEGY_CODE

        # ── Mock sandbox (always succeeds) ────────────────────────────────
        mock_sandbox = MagicMock(spec=SandboxExecutor)
        mock_sandbox.execute.return_value = MagicMock(success=True, error=None)

        # ── Alpha Agent ───────────────────────────────────────────────────
        alpha_agent = AlphaAgent(
            llm_client=mock_llm,
            sandbox=mock_sandbox,
            strategy_ai_url="http://mock-strategy-ai:8001",
            db=db,
        )

        # ── Mock data_agent.read_ohlcv (returns empty DataFrame) ─────────
        import pandas as pd
        mock_data_agent = MagicMock()
        mock_data_agent.read_ohlcv.return_value = pd.DataFrame(
            {
                "timestamp": range(100),
                "open": [100.0] * 100,
                "high": [105.0] * 100,
                "low": [95.0] * 100,
                "close": [102.0] * 100,
                "volume": [1000.0] * 100,
            }
        )

        # ── Backtest Agent ────────────────────────────────────────────────
        backtest_agent = BacktestAgent(
            data_agent=mock_data_agent,
            strategy_ai_url="http://mock-strategy-ai:8001",
            db=db,
        )

        # ── Strategy Manager ──────────────────────────────────────────────
        strategy_manager = StrategyManager(
            db=db,
            backend_url="http://mock-backend:4001",
            strategy_ai_url="http://mock-strategy-ai:8001",
            alpha_agent=alpha_agent,
        )

        # ── Mock HTTP calls ───────────────────────────────────────────────
        # Mock strategy-ai /strategy/register-dynamic → 200 OK
        # Mock strategy-ai /strategy/optimize/vectorbt → sharpe=2.0 (approved)
        # Mock backend /api/bots → bot_id returned

        mock_register_response = MagicMock()
        mock_register_response.status_code = 200

        mock_vectorbt_response = MagicMock()
        mock_vectorbt_response.status_code = 200
        mock_vectorbt_response.raise_for_status = MagicMock()
        mock_vectorbt_response.json.return_value = {
            "sharpe": 2.0,
            "max_drawdown": 0.05,
            "win_rate": 0.6,
            "total_trades": 50,
        }

        mock_deploy_response = MagicMock()
        mock_deploy_response.status_code = 201
        mock_deploy_response.json.return_value = {"id": "bot-123"}

        async def mock_post(url, **kwargs):
            if "register-dynamic" in url:
                return mock_register_response
            if "optimize/vectorbt" in url:
                return mock_vectorbt_response
            if "/api/bots" in url:
                return mock_deploy_response
            return MagicMock(status_code=200)

        # ── Build EvolutionaryLoop ────────────────────────────────────────
        agents = AgentRegistry(
            alpha_agent=alpha_agent,
            backtest_agent=backtest_agent,
            strategy_manager=strategy_manager,
            sentiment_agent=MagicMock(),
            data_agent=mock_data_agent,
        )
        loop = EvolutionaryLoop(agents=agents, db=db)

        # ── Run the full pipeline with mocked HTTP ────────────────────────
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(side_effect=mock_post)
            mock_client_cls.return_value = mock_client

            result = await loop.run_generation_cycle("momentum strategy")

        # ── Assertions ────────────────────────────────────────────────────
        assert result.strategies_generated == 1, (
            f"Expected 1 strategy generated, got {result.strategies_generated}"
        )
        assert result.strategies_approved == 1, (
            f"Expected 1 strategy approved, got {result.strategies_approved}. "
            f"Errors: {result.errors}"
        )
        assert result.strategies_rejected == 0

        # Verify strategy is in registry as "active"
        registry = StrategyRegistry(db)
        active_strategies = registry.list_by_status("active")
        assert len(active_strategies) == 1, (
            f"Expected 1 active strategy in registry, got {len(active_strategies)}"
        )
        assert active_strategies[0].status == "active"

    @pytest.mark.asyncio
    async def test_rejected_strategy_triggers_mutation(self):
        """
        When backtest returns sharpe <= 1.5, strategy is rejected and
        Alpha_Agent.mutate_strategy is called.

        Validates: Requirements 9.3, 10.1
        """
        db = _make_db()

        mock_llm = AsyncMock()
        mock_llm.complete.return_value = VALID_STRATEGY_CODE

        mock_sandbox = MagicMock(spec=SandboxExecutor)
        mock_sandbox.execute.return_value = MagicMock(success=True, error=None)

        alpha_agent = AlphaAgent(
            llm_client=mock_llm,
            sandbox=mock_sandbox,
            strategy_ai_url="http://mock-strategy-ai:8001",
            db=db,
        )

        import pandas as pd
        mock_data_agent = MagicMock()
        mock_data_agent.read_ohlcv.return_value = pd.DataFrame(
            {
                "timestamp": range(100),
                "open": [100.0] * 100,
                "high": [105.0] * 100,
                "low": [95.0] * 100,
                "close": [102.0] * 100,
                "volume": [1000.0] * 100,
            }
        )

        backtest_agent = BacktestAgent(
            data_agent=mock_data_agent,
            strategy_ai_url="http://mock-strategy-ai:8001",
            db=db,
        )

        strategy_manager = StrategyManager(
            db=db,
            backend_url="http://mock-backend:4001",
            strategy_ai_url="http://mock-strategy-ai:8001",
            alpha_agent=alpha_agent,
        )

        # Mock vectorbt to return sharpe=0.5 (rejected)
        mock_register_response = MagicMock()
        mock_register_response.status_code = 200

        mock_vectorbt_response = MagicMock()
        mock_vectorbt_response.status_code = 200
        mock_vectorbt_response.raise_for_status = MagicMock()
        mock_vectorbt_response.json.return_value = {
            "sharpe": 0.5,
            "max_drawdown": 0.20,
            "win_rate": 0.3,
            "total_trades": 20,
        }

        async def mock_post(url, **kwargs):
            if "register-dynamic" in url:
                return mock_register_response
            if "optimize/vectorbt" in url:
                return mock_vectorbt_response
            return MagicMock(status_code=200)

        # Spy on mutate_strategy
        original_mutate = alpha_agent.mutate_strategy
        mutate_calls = []

        async def spy_mutate(*args, **kwargs):
            mutate_calls.append({"args": args, "kwargs": kwargs})
            return GenerationResult(
                strategy_key="mutated-key",
                python_code=VALID_STRATEGY_CODE,
                attempts=1,
                status="success",
                lineage_id="test-lineage",
            )

        alpha_agent.mutate_strategy = spy_mutate

        agents = AgentRegistry(
            alpha_agent=alpha_agent,
            backtest_agent=backtest_agent,
            strategy_manager=strategy_manager,
            sentiment_agent=MagicMock(),
            data_agent=mock_data_agent,
        )
        loop = EvolutionaryLoop(agents=agents, db=db)

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.post = AsyncMock(side_effect=mock_post)
            mock_client_cls.return_value = mock_client

            result = await loop.run_generation_cycle("momentum strategy")

        assert result.strategies_generated == 1
        assert result.strategies_rejected == 1
        assert result.strategies_approved == 0

        # Verify mutation was triggered
        assert len(mutate_calls) == 1, (
            f"Expected mutate_strategy to be called once, got {len(mutate_calls)}"
        )

        # Verify no strategy was registered as active
        registry = StrategyRegistry(db)
        active_strategies = registry.list_by_status("active")
        assert len(active_strategies) == 0


# ─── Integration Test 2: Decay Detection → Mutation Pipeline ──────────────────

class TestDecayDetectionMutationPipeline:
    """
    Integration test: decay detection → mutation request pipeline.

    Validates: Requirements 10.1, 9.3
    """

    def _insert_active_strategy(
        self, db: sqlite3.Connection, strategy_key: str, lineage_id: str
    ) -> None:
        """Insert an active strategy into approved_strategies."""
        now = datetime.now(timezone.utc).isoformat()
        db.execute(
            """
            INSERT INTO approved_strategies
                (strategy_key, python_code, backtest_metrics, approved_at,
                 status, lineage_id, mutation_count, bot_id, updated_at)
            VALUES (?, ?, ?, ?, 'active', ?, 0, 'bot-001', ?)
            """,
            (
                strategy_key,
                VALID_STRATEGY_CODE,
                json.dumps({"sharpe": 1.8, "max_drawdown": 0.05}),
                now,
                lineage_id,
                now,
            ),
        )
        db.commit()

    def _insert_consecutive_losses(
        self, db: sqlite3.Connection, strategy_key: str, n_losses: int
    ) -> None:
        """Insert n_losses consecutive losing trades for a strategy."""
        now = datetime.now(timezone.utc).isoformat()
        for i in range(n_losses):
            db.execute(
                "INSERT INTO trades (strategy_key, pnl, created_at) VALUES (?, ?, ?)",
                (strategy_key, -10.0, now),
            )
        db.commit()

    @pytest.mark.asyncio
    async def test_consecutive_losses_triggers_decay_and_mutation(self):
        """
        When a strategy has consecutive_losses >= 5:
        1. check_alpha_decay() marks it as "decayed"
        2. alpha_agent.mutate_strategy is called with the strategy's code

        Validates: Requirements 10.1, 9.3
        """
        db = _make_db()
        strategy_key = "test-strategy-decay"
        lineage_id = "test-lineage-001"

        # Set up active strategy
        self._insert_active_strategy(db, strategy_key, lineage_id)

        # Simulate 5 consecutive losses
        self._insert_consecutive_losses(db, strategy_key, 5)

        # ── Mock alpha_agent.mutate_strategy ──────────────────────────────
        mock_alpha = AsyncMock()
        mock_alpha.mutate_strategy = AsyncMock(
            return_value=GenerationResult(
                strategy_key="mutated-key",
                python_code=VALID_STRATEGY_CODE,
                attempts=1,
                status="success",
                lineage_id=lineage_id,
            )
        )

        strategy_manager = StrategyManager(
            db=db,
            backend_url="http://mock-backend:4001",
            strategy_ai_url="http://mock-strategy-ai:8001",
            alpha_agent=mock_alpha,
        )

        # Mock the backend stop call (non-fatal)
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.put = AsyncMock(return_value=MagicMock(status_code=200))
            mock_client_cls.return_value = mock_client

            decayed_keys = await strategy_manager.check_alpha_decay()

        # ── Verify strategy is marked "decayed" ───────────────────────────
        assert strategy_key in decayed_keys, (
            f"Expected {strategy_key} in decayed_keys, got {decayed_keys}"
        )

        registry = StrategyRegistry(db)
        strategy = registry.lookup(strategy_key)
        assert strategy is not None
        assert strategy.status == "decayed", (
            f"Expected status='decayed', got '{strategy.status}'"
        )

        # ── Verify mutation was triggered ─────────────────────────────────
        mock_alpha.mutate_strategy.assert_called_once()
        call_kwargs = mock_alpha.mutate_strategy.call_args
        # mutate_strategy(original_code, metrics, failure_reason, lineage_id)
        assert call_kwargs is not None, "mutate_strategy was not called"

    @pytest.mark.asyncio
    async def test_decay_event_saved_to_db(self):
        """
        When a strategy decays, a decay event is persisted to alpha_decay_events.

        Validates: Requirements 10.1
        """
        db = _make_db()
        strategy_key = "test-strategy-event"
        lineage_id = "test-lineage-002"

        self._insert_active_strategy(db, strategy_key, lineage_id)
        self._insert_consecutive_losses(db, strategy_key, 5)

        mock_alpha = AsyncMock()
        mock_alpha.mutate_strategy = AsyncMock(
            return_value=GenerationResult(
                strategy_key="mutated-key",
                python_code=VALID_STRATEGY_CODE,
                attempts=1,
                status="success",
                lineage_id=lineage_id,
            )
        )

        strategy_manager = StrategyManager(
            db=db,
            backend_url="http://mock-backend:4001",
            strategy_ai_url="http://mock-strategy-ai:8001",
            alpha_agent=mock_alpha,
        )

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.put = AsyncMock(return_value=MagicMock(status_code=200))
            mock_client_cls.return_value = mock_client

            await strategy_manager.check_alpha_decay()

        # Verify decay event was saved
        rows = db.execute(
            "SELECT * FROM alpha_decay_events WHERE strategy_key = ?",
            (strategy_key,),
        ).fetchall()

        assert len(rows) == 1, (
            f"Expected 1 decay event in alpha_decay_events, got {len(rows)}"
        )
        assert rows[0][1] == strategy_key  # strategy_key column

    @pytest.mark.asyncio
    async def test_no_decay_when_no_losses(self):
        """
        A strategy with no trades should not be decayed.

        Validates: Requirements 10.1
        """
        db = _make_db()
        strategy_key = "test-strategy-healthy"
        lineage_id = "test-lineage-003"

        self._insert_active_strategy(db, strategy_key, lineage_id)
        # No trades inserted → consecutive_losses = 0, decay_score = ~26.7 (sharpe_score only)

        mock_alpha = AsyncMock()
        mock_alpha.mutate_strategy = AsyncMock()

        strategy_manager = StrategyManager(
            db=db,
            backend_url="http://mock-backend:4001",
            strategy_ai_url="http://mock-strategy-ai:8001",
            alpha_agent=mock_alpha,
        )

        decayed_keys = await strategy_manager.check_alpha_decay()

        # With no trades: consecutive_losses=0, rolling_sharpe=0, max_drawdown=0
        # decay_score = 0 + clamp((1.5-0)/3.0, 0,1)*40 + 0 = 0.5*40 = 20 < 70
        assert strategy_key not in decayed_keys, (
            f"Healthy strategy should not be decayed, got decayed_keys={decayed_keys}"
        )
        mock_alpha.mutate_strategy.assert_not_called()

    @pytest.mark.asyncio
    async def test_decay_pipeline_via_evolutionary_loop(self):
        """
        Full decay pipeline via EvolutionaryLoop.run_decay_check():
        - Active strategy with 5 consecutive losses
        - run_decay_check() triggers decay and mutation

        Validates: Requirements 10.1, 9.3
        """
        db = _make_db()
        strategy_key = "test-strategy-loop-decay"
        lineage_id = "test-lineage-004"

        self._insert_active_strategy(db, strategy_key, lineage_id)
        self._insert_consecutive_losses(db, strategy_key, 5)

        mock_alpha = AsyncMock()
        mock_alpha.mutate_strategy = AsyncMock(
            return_value=GenerationResult(
                strategy_key="mutated-key",
                python_code=VALID_STRATEGY_CODE,
                attempts=1,
                status="success",
                lineage_id=lineage_id,
            )
        )

        strategy_manager = StrategyManager(
            db=db,
            backend_url="http://mock-backend:4001",
            strategy_ai_url="http://mock-strategy-ai:8001",
            alpha_agent=mock_alpha,
        )

        agents = AgentRegistry(
            alpha_agent=mock_alpha,
            backtest_agent=MagicMock(),
            strategy_manager=strategy_manager,
            sentiment_agent=MagicMock(),
            data_agent=MagicMock(),
        )
        loop = EvolutionaryLoop(agents=agents, db=db)

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.put = AsyncMock(return_value=MagicMock(status_code=200))
            mock_client_cls.return_value = mock_client

            decayed_keys = await loop.run_decay_check()

        assert strategy_key in decayed_keys

        # Verify strategy is decayed in registry
        registry = StrategyRegistry(db)
        strategy = registry.lookup(strategy_key)
        assert strategy is not None
        assert strategy.status == "decayed"

        # Verify mutation was triggered
        mock_alpha.mutate_strategy.assert_called_once()
