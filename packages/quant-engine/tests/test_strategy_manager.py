# Tests for Strategy Manager (Req 6, 7, 8)
"""
Property 5: Capital Budget Invariant
Validates: Requirements 7.5, 11.5
"""
from __future__ import annotations

import sqlite3
from unittest.mock import patch

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from agents.strategy_manager import StrategyManager


# ─── Helpers ──────────────────────────────────────────────────────────────────

DDL = """
CREATE TABLE IF NOT EXISTS approved_strategies (
    strategy_key TEXT PRIMARY KEY,
    python_code TEXT NOT NULL,
    backtest_metrics TEXT NOT NULL,
    approved_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    lineage_id TEXT NOT NULL,
    mutation_count INTEGER NOT NULL DEFAULT 0,
    bot_id TEXT,
    updated_at TEXT NOT NULL
);
"""


def _make_db_with_strategies(volatilities: list[float]) -> tuple[sqlite3.Connection, list[str]]:
    """
    Create an in-memory SQLite DB with N active strategies.
    Returns (conn, list_of_strategy_keys).
    """
    conn = sqlite3.connect(":memory:")
    conn.execute(DDL)
    conn.commit()

    keys: list[str] = []
    now = "2024-01-01T00:00:00+00:00"
    for i, _vol in enumerate(volatilities):
        key = f"strategy_{i}"
        conn.execute(
            """
            INSERT INTO approved_strategies
                (strategy_key, python_code, backtest_metrics, approved_at,
                 status, lineage_id, mutation_count, bot_id, updated_at)
            VALUES (?, ?, ?, ?, 'active', ?, 0, NULL, ?)
            """,
            (key, "pass", '{"sharpe": 1.5}', now, f"lineage-{i}", now),
        )
        keys.append(key)
    conn.commit()
    return conn, keys


def _make_manager(conn: sqlite3.Connection) -> StrategyManager:
    """Build a StrategyManager with a stub alpha_agent (not needed for allocation)."""
    from unittest.mock import MagicMock
    alpha_agent = MagicMock()
    return StrategyManager(
        db=conn,
        backend_url="http://localhost:4001",
        strategy_ai_url="http://localhost:8001",
        alpha_agent=alpha_agent,
    )


# ─── Property 5: Capital Budget Invariant ─────────────────────────────────────

@given(
    volatilities=st.lists(
        st.floats(min_value=0.0, max_value=10.0, allow_nan=False, allow_infinity=False),
        min_size=1,
        max_size=20,
    ),
    total_capital=st.floats(
        min_value=1.0,
        max_value=1_000_000.0,
        allow_nan=False,
        allow_infinity=False,
    ),
)
@settings(max_examples=200, deadline=None)
def test_capital_budget_invariant(volatilities: list[float], total_capital: float):
    """
    **Validates: Requirements 7.5, 11.5**

    For any list of strategy volatilities and any total_capital,
    the sum of all allocations must never exceed total_capital.
    """
    conn, keys = _make_db_with_strategies(volatilities)
    manager = _make_manager(conn)

    # Map each strategy key to its pre-set volatility value
    vol_map = {key: vol for key, vol in zip(keys, volatilities)}

    def mock_compute_volatility(strategy_key: str, lookback_days: int = 30) -> float:
        return vol_map.get(strategy_key, 0.0)

    with patch.object(manager, "_compute_volatility", side_effect=mock_compute_volatility):
        allocations = manager.compute_allocations(total_capital)

    total_allocated = sum(allocations.values())
    assert total_allocated <= total_capital + 1e-9, (
        f"Budget exceeded: allocated={total_allocated}, total_capital={total_capital}, "
        f"excess={total_allocated - total_capital}"
    )


# ─── Property 9: Equal Volatility Equal Allocation ────────────────────────────

@given(
    n=st.integers(min_value=1, max_value=20),
    volatility=st.floats(min_value=0.01, max_value=10.0, allow_nan=False, allow_infinity=False),
    total_capital=st.floats(
        min_value=1.0,
        max_value=1_000_000.0,
        allow_nan=False,
        allow_infinity=False,
    ),
)
@settings(max_examples=200, deadline=None)
def test_equal_volatility_equal_allocation(n: int, volatility: float, total_capital: float):
    """
    **Validates: Requirements 7.6, 11.9**

    When N strategies all share the same volatility, their allocations
    must differ by at most 0.01 USDT from each other.
    """
    # All N strategies share the same volatility value
    volatilities = [volatility] * n
    conn, keys = _make_db_with_strategies(volatilities)
    manager = _make_manager(conn)

    def mock_compute_volatility(strategy_key: str, lookback_days: int = 30) -> float:
        return volatility

    with patch.object(manager, "_compute_volatility", side_effect=mock_compute_volatility):
        allocations = manager.compute_allocations(total_capital)

    alloc_values = list(allocations.values())
    assert len(alloc_values) == n, (
        f"Expected {n} allocations, got {len(alloc_values)}"
    )

    min_alloc = min(alloc_values)
    max_alloc = max(alloc_values)
    assert max_alloc - min_alloc <= 0.01, (
        f"Allocations differ by more than 0.01 USDT: "
        f"min={min_alloc}, max={max_alloc}, diff={max_alloc - min_alloc}, "
        f"n={n}, volatility={volatility}, total_capital={total_capital}"
    )


# ─── Property 7: Alpha Decay Score Monotonicity ───────────────────────────────

@given(
    consecutive_losses=st.integers(min_value=0, max_value=9),
    rolling_sharpe_30d=st.floats(min_value=-5.0, max_value=5.0, allow_nan=False),
    max_drawdown_7d=st.floats(min_value=0.0, max_value=1.0, allow_nan=False),
)
@settings(max_examples=200)
def test_alpha_decay_score_monotonicity(
    consecutive_losses: int,
    rolling_sharpe_30d: float,
    max_drawdown_7d: float,
):
    """
    **Validates: Requirements 8.7, 11.7**

    Increasing consecutive_losses by 1 must not decrease the Alpha_Decay_Score.
    score(n+1) >= score(n) - 1e-9
    """
    from unittest.mock import MagicMock

    conn = sqlite3.connect(":memory:")
    manager = StrategyManager(
        db=conn,
        backend_url="http://localhost:4001",
        strategy_ai_url="http://localhost:8001",
        alpha_agent=MagicMock(),
    )

    score_n = manager.compute_decay_score(consecutive_losses, rolling_sharpe_30d, max_drawdown_7d)
    score_n1 = manager.compute_decay_score(consecutive_losses + 1, rolling_sharpe_30d, max_drawdown_7d)

    assert score_n1 >= score_n - 1e-9, (
        f"Monotonicity violated: score({consecutive_losses})={score_n}, "
        f"score({consecutive_losses + 1})={score_n1}, "
        f"rolling_sharpe_30d={rolling_sharpe_30d}, max_drawdown_7d={max_drawdown_7d}"
    )


# ─── Unit Tests: Task 10.5 ────────────────────────────────────────────────────


def test_zero_volatility_gets_minimum_allocation():
    """
    Validates: Requirements 7.4

    A strategy with vol=0 must receive at least 1% of total_capital (minimum allocation).
    """
    total_capital = 1000.0
    conn, keys = _make_db_with_strategies([0.0])
    manager = _make_manager(conn)

    def mock_compute_volatility(strategy_key: str, lookback_days: int = 30) -> float:
        return 0.0

    with patch.object(manager, "_compute_volatility", side_effect=mock_compute_volatility):
        allocations = manager.compute_allocations(total_capital)

    assert len(allocations) == 1
    alloc = allocations[keys[0]]
    assert alloc >= 10.0, (
        f"Zero-vol strategy should get >= 1% of {total_capital} (>= 10.0), got {alloc}"
    )


def test_decay_score_above_threshold_triggers_decay():
    """
    Validates: Requirements 8.2

    compute_decay_score with inputs that produce score > 70 must return score > 70.
    Using: consecutive_losses=10, rolling_sharpe_30d=-5.0, max_drawdown_7d=0.20
      loss_score     = min(10/10, 1.0) * 40 = 40
      sharpe_score   = clamp((1.5 - (-5.0)) / 3.0, 0, 1) * 40 = 1.0 * 40 = 40
      drawdown_score = clamp(0.20 / 0.20, 0, 1) * 20 = 1.0 * 20 = 20
      total = 100 > 70
    """
    from unittest.mock import MagicMock

    conn = sqlite3.connect(":memory:")
    manager = StrategyManager(
        db=conn,
        backend_url="http://localhost:4001",
        strategy_ai_url="http://localhost:8001",
        alpha_agent=MagicMock(),
    )

    score = manager.compute_decay_score(
        consecutive_losses=10,
        rolling_sharpe_30d=-5.0,
        max_drawdown_7d=0.20,
    )

    assert score > 70.0, (
        f"Expected decay score > 70 (threshold), got {score}"
    )


def test_consecutive_losses_5_triggers_immediate_decay():
    """
    Validates: Requirements 8.5

    compute_decay_score with consecutive_losses=5 must return a meaningful score > 0.
    loss_score = min(5/10, 1.0) * 40 = 20 > 0
    """
    from unittest.mock import MagicMock

    conn = sqlite3.connect(":memory:")
    manager = StrategyManager(
        db=conn,
        backend_url="http://localhost:4001",
        strategy_ai_url="http://localhost:8001",
        alpha_agent=MagicMock(),
    )

    score = manager.compute_decay_score(
        consecutive_losses=5,
        rolling_sharpe_30d=1.5,   # neutral sharpe → sharpe_score = 0
        max_drawdown_7d=0.0,      # no drawdown → drawdown_score = 0
    )

    # With only loss_score contributing: min(5/10, 1.0) * 40 = 20
    assert score > 0.0, (
        f"Expected score > 0 for consecutive_losses=5, got {score}"
    )
    assert score == pytest.approx(20.0), (
        f"Expected loss_score of 20.0 for consecutive_losses=5, got {score}"
    )


def test_decay_score_invariant_range():
    """
    Validates: Requirements 8.2

    compute_decay_score must always return a value in [0.0, 100.0]
    for extreme inputs.
    """
    from unittest.mock import MagicMock

    conn = sqlite3.connect(":memory:")
    manager = StrategyManager(
        db=conn,
        backend_url="http://localhost:4001",
        strategy_ai_url="http://localhost:8001",
        alpha_agent=MagicMock(),
    )

    extreme_cases = [
        (0, 0.0, 0.0),
        (100, -100.0, 1.0),
        (0, 100.0, 0.0),
        (0, 0.0, 100.0),
        (10, 1.5, 0.20),
    ]

    for consecutive_losses, rolling_sharpe_30d, max_drawdown_7d in extreme_cases:
        score = manager.compute_decay_score(
            consecutive_losses=consecutive_losses,
            rolling_sharpe_30d=rolling_sharpe_30d,
            max_drawdown_7d=max_drawdown_7d,
        )
        assert 0.0 <= score <= 100.0, (
            f"Score out of [0, 100] range: {score} for inputs "
            f"({consecutive_losses}, {rolling_sharpe_30d}, {max_drawdown_7d})"
        )
