# Feature: python-strategy-registry, Property 4: compute_signal always returns correct shape
# Feature: python-strategy-registry, Property 5: Breakout signal correctness
# Feature: python-strategy-registry, Property 6: ATR stoploss invariant

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import numpy as np
import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st

from strategies.bollinger_breakout import BollingerBreakout

STRATEGY = BollingerBreakout()

REQUIRED_METADATA_KEYS = {"ema_basis", "upper_band", "lower_band", "atr", "stoploss_price"}
VALID_SIGNALS = {"LONG", "SHORT", "NONE"}


# ---------------------------------------------------------------------------
# Shared generators
# ---------------------------------------------------------------------------

def ohlcv_arrays(min_bars=30, max_bars=200):
    """Generate consistent OHLCV arrays where high >= close >= low > 0."""
    return st.integers(min_value=min_bars, max_value=max_bars).flatmap(
        lambda n: st.lists(
            st.floats(min_value=1.0, max_value=10000.0, allow_nan=False, allow_infinity=False),
            min_size=n, max_size=n,
        ).map(lambda closes: _build_ohlcv(closes))
    )


def _build_ohlcv(closes):
    closes = [max(c, 0.01) for c in closes]
    highs  = [c * 1.01 for c in closes]
    lows   = [c * 0.99 for c in closes]
    volumes = [1000.0] * len(closes)
    return closes, highs, lows, volumes


# ---------------------------------------------------------------------------
# Property 4: compute_signal always returns correct shape
# Validates: Requirements 2.1, 3.6
# ---------------------------------------------------------------------------

@given(ohlcv=ohlcv_arrays(min_bars=30))
@settings(max_examples=100)
def test_compute_signal_output_shape(ohlcv):
    """For any OHLCV arrays of length >= 30, result has correct shape and keys."""
    closes, highs, lows, volumes = ohlcv
    result = STRATEGY.compute_signal(closes, highs, lows, volumes)

    assert isinstance(result, dict)
    assert "signal" in result
    assert "stoploss" in result
    assert "metadata" in result

    assert result["signal"] in VALID_SIGNALS
    assert result["stoploss"] is None or isinstance(result["stoploss"], float)
    assert isinstance(result["metadata"], dict)
    assert REQUIRED_METADATA_KEYS.issubset(result["metadata"].keys())


# ---------------------------------------------------------------------------
# Property 5: Breakout signal correctness
# Validates: Requirements 3.2, 3.3
# ---------------------------------------------------------------------------

@given(
    base_closes=st.lists(
        st.floats(min_value=100.0, max_value=1000.0, allow_nan=False, allow_infinity=False),
        min_size=29, max_size=199,
    ),
    last_close=st.floats(min_value=100.0, max_value=1000.0, allow_nan=False, allow_infinity=False),
)
@settings(max_examples=100)
def test_breakout_signal_correctness(base_closes, last_close):
    """Signal is LONG iff last close > EMA(30) + 1*SD, otherwise NONE."""
    closes = base_closes + [last_close]
    assume(len(closes) >= 30)

    highs   = [c * 1.01 for c in closes]
    lows    = [c * 0.99 for c in closes]
    volumes = [1000.0] * len(closes)

    arr = np.array(closes, dtype=float)
    ema = STRATEGY._ema(arr, 30)
    std = np.std(arr[-30:])
    upper = ema + std

    result = STRATEGY.compute_signal(closes, highs, lows, volumes)

    if last_close > upper:
        assert result["signal"] == "LONG", (
            f"Expected LONG: close={last_close:.4f} > upper={upper:.4f}"
        )
    else:
        assert result["signal"] == "NONE", (
            f"Expected NONE: close={last_close:.4f} <= upper={upper:.4f}"
        )


# ---------------------------------------------------------------------------
# Property 6: ATR stoploss invariant
# Validates: Requirements 3.4
# ---------------------------------------------------------------------------

@given(ohlcv=ohlcv_arrays(min_bars=30))
@settings(max_examples=100)
def test_atr_stoploss_invariant(ohlcv):
    """For any LONG signal, stoploss == close[-1] - 1.5*ATR(14) and stoploss < close[-1]."""
    closes, highs, lows, volumes = ohlcv
    result = STRATEGY.compute_signal(closes, highs, lows, volumes)

    if result["signal"] == "LONG":
        assert result["stoploss"] is not None

        arr = np.array(closes, dtype=float)
        h   = np.array(highs,  dtype=float)
        l   = np.array(lows,   dtype=float)
        atr = STRATEGY._atr(h, l, arr, 14)
        expected_stoploss = float(arr[-1] - 1.5 * atr)

        assert abs(result["stoploss"] - expected_stoploss) < 1e-6, (
            f"stoploss mismatch: got {result['stoploss']}, expected {expected_stoploss}"
        )
        assert result["stoploss"] < closes[-1], (
            f"stoploss {result['stoploss']} must be < close {closes[-1]}"
        )
    else:
        # NONE signal must have stoploss=None
        assert result["stoploss"] is None
