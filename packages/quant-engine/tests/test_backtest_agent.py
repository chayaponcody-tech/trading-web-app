"""
Tests for Backtest Agent (Req 5)

Validates: Requirements 5.7, 11.4
"""
import sqlite3
from unittest.mock import MagicMock

import pandas as pd
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from agents.backtest_agent import BacktestAgent, REGIMES


# ─── Helpers ─────────────────────────────────────────────────────────────────


def _make_agent() -> BacktestAgent:
    """Create a BacktestAgent with in-memory SQLite and a mock DataAgent."""
    db = sqlite3.connect(":memory:")
    mock_data_agent = MagicMock()
    mock_data_agent.read_ohlcv.return_value = pd.DataFrame()
    return BacktestAgent(
        data_agent=mock_data_agent,
        strategy_ai_url="http://localhost:8001",
        db=db,
    )


def _make_ohlcv(prices: list[float]) -> pd.DataFrame:
    """Build a minimal OHLCV DataFrame from a list of close prices."""
    n = len(prices)
    return pd.DataFrame(
        {
            "timestamp": list(range(n)),
            "open": prices,
            "high": prices,
            "low": prices,
            "close": prices,
            "volume": [1.0] * n,
        }
    )


# ─── Property 4: Backtest Approval Determinism ───────────────────────────────
# Validates: Requirements 5.7, 11.4


@given(sharpe=st.floats(allow_nan=False, allow_infinity=False))
@settings(max_examples=300)
def test_backtest_approval_determinism(sharpe: float) -> None:
    """
    **Property 4: Backtest Approval Determinism**
    **Validates: Requirements 5.7, 11.4**

    _make_approval_decision() is a pure function: calling it twice with the
    same sharpe value must return identical results, and the result must
    match the threshold rule (sharpe > 1.5 → True, else → False).
    """
    result_1 = BacktestAgent._make_approval_decision(sharpe)
    result_2 = BacktestAgent._make_approval_decision(sharpe)

    # Determinism: both calls must agree
    assert result_1 == result_2, (
        f"Non-deterministic result for sharpe={sharpe}: "
        f"first={result_1}, second={result_2}"
    )

    # Threshold correctness
    if sharpe > 1.5:
        assert result_1 is True, (
            f"Expected True for sharpe={sharpe} > 1.5, got {result_1}"
        )
    else:
        assert result_1 is False, (
            f"Expected False for sharpe={sharpe} <= 1.5, got {result_1}"
        )


# ─── Unit Tests ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_rejection_reason_contains_worst_regime() -> None:
    """
    When avg_sharpe <= 1.5, the rejection_reason must contain the name of
    the worst-performing regime (the one with the lowest sharpe).
    """
    agent = _make_agent()

    # Regime sharpes: bull=2.0, bear=-0.5 (worst), sideways=1.0
    # avg = (2.0 + -0.5 + 1.0) / 3 ≈ 0.833 → rejected
    regime_sharpes = {"bull": 2.0, "bear": -0.5, "sideways": 1.0}

    async def mock_walk_forward(strategy_key: str, ohlcv: pd.DataFrame) -> dict:
        # Identify which regime this call is for by inspecting the ohlcv
        # We encode the regime via the first timestamp value (0=bull,1=bear,2=sideways)
        regime_index = int(ohlcv["timestamp"].iloc[0]) if not ohlcv.empty else 0
        regime = REGIMES[regime_index]
        return {
            "sharpe": regime_sharpes[regime],
            "max_drawdown": 0.05,
            "win_rate": 0.5,
            "total_trades": 10,
        }

    # Provide distinct OHLCV frames so we can identify which regime is called
    def mock_read_ohlcv(symbol, interval, **kwargs):
        return _make_ohlcv([float(i)] * 20 for i in range(20))

    # Build per-regime DataFrames with a distinguishing timestamp offset
    bull_df = _make_ohlcv([1.0] * 20)
    bull_df["timestamp"] = 0  # index 0 → "bull"
    bear_df = _make_ohlcv([1.0] * 20)
    bear_df["timestamp"] = 1  # index 1 → "bear"
    sideways_df = _make_ohlcv([1.0] * 20)
    sideways_df["timestamp"] = 2  # index 2 → "sideways"

    # Patch _select_regime_data to return our labelled frames
    agent._select_regime_data = lambda symbol: {
        "bull": bull_df,
        "bear": bear_df,
        "sideways": sideways_df,
    }
    agent._run_walk_forward = mock_walk_forward
    # Prevent DB write from failing (table already created in __init__)
    async def _noop_save(result, symbol):
        return None

    agent._save_result = _noop_save  # type: ignore[assignment]

    result = await agent.evaluate("test_strategy", "# code", "BTCUSDT")

    assert result.approved is False
    assert result.rejection_reason is not None
    assert "bear" in result.rejection_reason, (
        f"Expected 'bear' in rejection_reason, got: {result.rejection_reason}"
    )


def test_three_regime_selection_returns_all_regimes() -> None:
    """
    _select_regime_data() must return a dict containing all 3 regime keys:
    'bull', 'bear', and 'sideways'.
    """
    db = sqlite3.connect(":memory:")

    # Build a mock DataAgent that returns a realistic OHLCV DataFrame
    # with enough rows to produce chunks for all 3 regimes.
    # We craft prices so chunks fall into different regimes:
    #   chunk 0 (rows 0-19):   flat → sideways
    #   chunk 1 (rows 20-39):  rising → bull
    #   chunk 2 (rows 40-59):  falling → bear
    #   chunk 3 (rows 60-79):  flat → sideways
    #   chunk 4 (rows 80-99):  rising → bull
    prices = (
        [100.0] * 20          # sideways
        + [100.0 + i for i in range(20)]   # bull (rises > 5%)
        + [120.0 - i for i in range(20)]   # bear (falls > 5%)
        + [100.0] * 20        # sideways
        + [100.0 + i for i in range(20)]   # bull
    )
    full_df = _make_ohlcv(prices)

    mock_data_agent = MagicMock()
    mock_data_agent.read_ohlcv.return_value = full_df

    agent = BacktestAgent(
        data_agent=mock_data_agent,
        strategy_ai_url="http://localhost:8001",
        db=db,
    )

    regime_data = agent._select_regime_data("BTCUSDT")

    assert set(regime_data.keys()) == {"bull", "bear", "sideways"}, (
        f"Expected all 3 regime keys, got: {set(regime_data.keys())}"
    )
    for regime, df in regime_data.items():
        assert isinstance(df, pd.DataFrame), (
            f"Expected DataFrame for regime '{regime}', got {type(df)}"
        )


# ─── Additional Unit Tests ────────────────────────────────────────────────────


def test_approval_threshold_boundary() -> None:
    """
    Sharpe exactly at 1.5 should return False (not approved).
    Sharpe at 1.501 should return True.
    """
    assert BacktestAgent._make_approval_decision(1.5) is False
    assert BacktestAgent._make_approval_decision(1.501) is True


def test_classify_regime_bull() -> None:
    """Rising prices (last 20% avg > first 20% avg * 1.05) → 'bull'."""
    agent = _make_agent()
    # 20 rows: starts at 100, ends at 119 — last avg ~117, first avg ~101 → bull
    prices = [100.0 + i for i in range(20)]
    df = _make_ohlcv(prices)
    assert agent._classify_regime(df) == "bull"


def test_classify_regime_bear() -> None:
    """Falling prices (last 20% avg < first 20% avg * 0.95) → 'bear'."""
    agent = _make_agent()
    # 20 rows: starts at 120, ends at 101 — last avg ~103, first avg ~119 → bear
    prices = [120.0 - i for i in range(20)]
    df = _make_ohlcv(prices)
    assert agent._classify_regime(df) == "bear"


def test_classify_regime_sideways() -> None:
    """Flat prices (no significant trend) → 'sideways'."""
    agent = _make_agent()
    prices = [100.0] * 20
    df = _make_ohlcv(prices)
    assert agent._classify_regime(df) == "sideways"
