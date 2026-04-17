"""
Property-Based Tests for Strategy Registry Round-Trip.

Property 6: Strategy Registry Round-Trip
Validates: Requirements 6.5, 11.6

For ALL strategy registrations in Approved_Strategy_Registry,
register(s) then lookup(s.strategy_key) must return data equal to s.
Also verifies idempotence: registering the same strategy_key twice
returns the updated (latest) version.
"""
import sqlite3
from datetime import datetime, timezone

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from core.registry import StrategyRegistry
from core.schemas import ApprovedStrategy

# ─── DDL ──────────────────────────────────────────────────────────────────────

_CREATE_TABLE_SQL = """
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


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _make_conn() -> sqlite3.Connection:
    """Return a fresh in-memory SQLite connection with the required schema."""
    conn = sqlite3.connect(":memory:")
    conn.execute(_CREATE_TABLE_SQL)
    conn.commit()
    return conn


def _make_strategy(
    strategy_key: str,
    python_code: str,
    sharpe: float,
) -> ApprovedStrategy:
    """Build an ApprovedStrategy with the given fields and sensible defaults."""
    now = datetime.now(timezone.utc).isoformat()
    return ApprovedStrategy(
        strategy_key=strategy_key,
        python_code=python_code,
        backtest_metrics={"sharpe": sharpe},
        approved_at=now,
        status="active",
        lineage_id="test-lineage-id",
        mutation_count=0,
        bot_id=None,
        updated_at=now,
    )


# ─── Generators ───────────────────────────────────────────────────────────────

# strategy_key: non-empty text (TEXT PRIMARY KEY)
_strategy_key_st = st.text(min_size=1, max_size=200)

# python_code: arbitrary text (stored as-is)
_python_code_st = st.text(max_size=500)

# sharpe: finite floats (stored in JSON; NaN/Inf would survive JSON round-trip
# only as strings, so we restrict to finite values)
_sharpe_st = st.floats(allow_nan=False, allow_infinity=False)


# ─── Property 6: Round-Trip ───────────────────────────────────────────────────

@settings(max_examples=200)
@given(
    strategy_key=_strategy_key_st,
    python_code=_python_code_st,
    sharpe=_sharpe_st,
)
def test_registry_round_trip(strategy_key: str, python_code: str, sharpe: float):
    """
    **Validates: Requirements 6.5, 11.6**

    Property: register(s) → lookup(s.strategy_key) returns an object
    whose fields match the original strategy.
    """
    conn = _make_conn()
    registry = StrategyRegistry(conn)

    original = _make_strategy(strategy_key, python_code, sharpe)
    registry.register(original)

    result = registry.lookup(strategy_key)

    assert result is not None, "lookup() returned None after register()"
    assert result.strategy_key == original.strategy_key
    assert result.python_code == original.python_code
    assert result.backtest_metrics == original.backtest_metrics
    assert result.approved_at == original.approved_at
    assert result.status == original.status
    assert result.lineage_id == original.lineage_id
    assert result.mutation_count == original.mutation_count
    assert result.bot_id == original.bot_id
    assert result.updated_at == original.updated_at


# ─── Property 6 (idempotence): duplicate register returns updated version ─────

@settings(max_examples=200)
@given(
    strategy_key=_strategy_key_st,
    python_code_v1=_python_code_st,
    python_code_v2=_python_code_st,
    sharpe_v1=_sharpe_st,
    sharpe_v2=_sharpe_st,
)
def test_registry_idempotence(
    strategy_key: str,
    python_code_v1: str,
    python_code_v2: str,
    sharpe_v1: float,
    sharpe_v2: float,
):
    """
    **Validates: Requirements 6.6, 11.6**

    Property: registering the same strategy_key twice (with different data)
    must not raise an error, and lookup() must return the *second* (updated)
    version — not the first.
    """
    conn = _make_conn()
    registry = StrategyRegistry(conn)

    v1 = _make_strategy(strategy_key, python_code_v1, sharpe_v1)
    v2 = _make_strategy(strategy_key, python_code_v2, sharpe_v2)

    registry.register(v1)
    registry.register(v2)  # should upsert, not raise

    result = registry.lookup(strategy_key)

    assert result is not None
    assert result.strategy_key == strategy_key
    assert result.python_code == python_code_v2
    assert result.backtest_metrics == {"sharpe": sharpe_v2}


# ─── Unit test: lookup of unknown key returns None ────────────────────────────

def test_lookup_missing_key_returns_none():
    conn = _make_conn()
    registry = StrategyRegistry(conn)
    assert registry.lookup("nonexistent-key") is None
