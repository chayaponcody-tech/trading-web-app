"""
Tests for Data Agent (Req 2)

Property 2: OHLCV Round-Trip Preservation
Validates: Requirements 2.8, 11.2
"""
import random
import sqlite3
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from hypothesis import assume, given, settings
from hypothesis import strategies as st
from hypothesis.extra.pandas import column, data_frames, range_indexes

from agents.data_agent import DataAgent


# ---------------------------------------------------------------------------
# Property 2: OHLCV Round-Trip Preservation
# Validates: Requirements 2.8, 11.2
# ---------------------------------------------------------------------------

@given(
    df=data_frames(
        columns=[
            column("timestamp", dtype=int),
            column(
                "open",
                dtype=float,
                elements=st.floats(
                    min_value=0.01, max_value=1e6, allow_nan=False, allow_infinity=False
                ),
            ),
            column(
                "high",
                dtype=float,
                elements=st.floats(
                    min_value=0.01, max_value=1e6, allow_nan=False, allow_infinity=False
                ),
            ),
            column(
                "low",
                dtype=float,
                elements=st.floats(
                    min_value=0.01, max_value=1e6, allow_nan=False, allow_infinity=False
                ),
            ),
            column(
                "close",
                dtype=float,
                elements=st.floats(
                    min_value=0.01, max_value=1e6, allow_nan=False, allow_infinity=False
                ),
            ),
            column(
                "volume",
                dtype=float,
                elements=st.floats(
                    min_value=0.0, max_value=1e9, allow_nan=False, allow_infinity=False
                ),
            ),
        ],
        index=range_indexes(min_size=10, max_size=500),
    )
)
@settings(max_examples=200, deadline=None)
def test_ohlcv_round_trip_preservation(df: pd.DataFrame) -> None:
    """
    **Validates: Requirements 2.8, 11.2**

    Property: for any valid OHLCV DataFrame, saving to Parquet and reading back
    produces an identical DataFrame (same shape, columns, and values within atol=1e-9).
    """
    assume(len(df) >= 10)

    # Make timestamps unique and sorted
    n = len(df)
    timestamps = sorted(random.sample(range(1_000_000_000_000, 2_000_000_000_000), n))
    df["timestamp"] = timestamps
    df = df.astype({"timestamp": "int64"})

    with tempfile.TemporaryDirectory() as tmp_dir:
        db = sqlite3.connect(":memory:")
        agent = DataAgent(
            http_client=None,  # not needed for save/read
            data_dir=Path(tmp_dir),
            db=db,
        )

        # Save then read back
        agent._save_parquet(df, "BTCUSDT", "15m")
        result = agent.read_ohlcv("BTCUSDT", "15m")

        # Shape must match
        assert result.shape == df.shape, (
            f"Shape mismatch: expected {df.shape}, got {result.shape}"
        )

        # Columns must match (same set, same order)
        assert list(result.columns) == list(df.columns), (
            f"Column mismatch: expected {list(df.columns)}, got {list(result.columns)}"
        )

        # Values must be numerically equivalent within atol=1e-9
        for col in ["open", "high", "low", "close", "volume"]:
            np.testing.assert_allclose(
                result[col].values,
                df[col].values,
                atol=1e-9,
                err_msg=f"Column '{col}' values differ after round-trip",
            )

        # Timestamps must be exactly preserved (integer, no tolerance needed)
        np.testing.assert_array_equal(
            result["timestamp"].values,
            df["timestamp"].values,
        )

        db.close()


# ---------------------------------------------------------------------------
# Unit Tests — Task 6.3
# Validates: Requirements 2.2, 2.3, 2.6
# ---------------------------------------------------------------------------

def _make_agent(tmp_dir: str) -> DataAgent:
    """Helper: create a DataAgent with an in-memory DB."""
    db = sqlite3.connect(":memory:")
    return DataAgent(http_client=None, data_dir=Path(tmp_dir), db=db)


def test_clean_data_forward_fills_nan() -> None:
    """
    Validates: Requirement 2.2
    _clean_data() must forward-fill NaN values in the close column.
    """
    df = pd.DataFrame(
        {
            "timestamp": [1, 2, 3, 4, 5],
            "open":      [100.0, 101.0, 102.0, 103.0, 104.0],
            "high":      [105.0, 106.0, 107.0, 108.0, 109.0],
            "low":       [95.0,  96.0,  97.0,  98.0,  99.0],
            "close":     [100.0, float("nan"), float("nan"), 103.0, 104.0],
            "volume":    [1000.0, 1100.0, 1200.0, 1300.0, 1400.0],
        }
    )

    with tempfile.TemporaryDirectory() as tmp_dir:
        agent = _make_agent(tmp_dir)
        result = agent._clean_data(df)

    assert result["close"].isna().sum() == 0, "NaN values should be forward-filled"
    # Row 1 and 2 should be filled with the previous value (100.0)
    assert result["close"].iloc[1] == pytest.approx(100.0)
    assert result["close"].iloc[2] == pytest.approx(100.0)


def test_clean_data_replaces_outliers() -> None:
    """
    Validates: Requirement 2.3
    _clean_data() must replace values that are >5 std from the rolling mean
    with the rolling median.
    """
    # Build a stable baseline of 30 rows around 100.0, then inject a clear outlier
    n = 30
    close_values = [100.0] * n
    close_values[25] = 100.0 * 100  # 10 000 — clearly > 5 std above mean

    df = pd.DataFrame(
        {
            "timestamp": list(range(n)),
            "open":      [100.0] * n,
            "high":      [105.0] * n,
            "low":       [95.0]  * n,
            "close":     close_values,
            "volume":    [1000.0] * n,
        }
    )

    with tempfile.TemporaryDirectory() as tmp_dir:
        agent = _make_agent(tmp_dir)
        result = agent._clean_data(df)

    # The outlier at index 25 must have been replaced (no longer 10 000)
    assert result["close"].iloc[25] < 1000.0, (
        f"Outlier should have been replaced, got {result['close'].iloc[25]}"
    )


@pytest.mark.asyncio
async def test_run_etl_retries_3_times_on_failure() -> None:
    """
    Validates: Requirement 2.6
    run_etl() must retry exactly 3 times when the HTTP client raises an exception,
    then return ETLResult(success=False).
    """
    from unittest.mock import AsyncMock, patch

    mock_client = AsyncMock()
    mock_client.get.side_effect = Exception("API down")

    with tempfile.TemporaryDirectory() as tmp_dir:
        db = sqlite3.connect(":memory:")
        agent = DataAgent(mock_client, Path(tmp_dir), db)

        # Patch asyncio.sleep to avoid waiting
        with patch("agents.data_agent.asyncio.sleep", new_callable=AsyncMock):
            result = await agent.run_etl("BTCUSDT", "15m", 100)

    assert result.success is False
    assert mock_client.get.call_count == 3
