# Feature: python-strategy-registry, Property 8: Low confidence suppresses signal
# Feature: python-strategy-registry, Property 9: Analyze response always has required fields

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import patch

from hypothesis import given, settings
from hypothesis import strategies as st
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# Generators
# ---------------------------------------------------------------------------

def _price_series(draw, min_bars=30):
    """Generate a realistic ascending/random price series of length >= min_bars."""
    n = draw(st.integers(min_value=min_bars, max_value=100))
    base = draw(st.floats(min_value=100.0, max_value=100_000.0, allow_nan=False, allow_infinity=False))
    # small percentage changes per bar
    changes = draw(
        st.lists(
            st.floats(min_value=-0.02, max_value=0.02, allow_nan=False, allow_infinity=False),
            min_size=n - 1,
            max_size=n - 1,
        )
    )
    prices = [base]
    for c in changes:
        prices.append(max(prices[-1] * (1 + c), 0.01))
    return prices


@st.composite
def valid_ohlcv(draw):
    closes = _price_series(draw, min_bars=30)
    n = len(closes)
    spread_pct = 0.002
    highs = [c * (1 + spread_pct) for c in closes]
    lows = [c * (1 - spread_pct) for c in closes]
    volumes = draw(
        st.lists(
            st.floats(min_value=0.1, max_value=1000.0, allow_nan=False, allow_infinity=False),
            min_size=n,
            max_size=n,
        )
    )
    return closes, highs, lows, volumes


# ---------------------------------------------------------------------------
# Property 8: Low confidence suppresses signal
# Validates: Requirements 5.3
# ---------------------------------------------------------------------------

@given(ohlcv=valid_ohlcv())
@settings(max_examples=100)
def test_low_confidence_suppresses_signal(ohlcv):
    """
    For any valid OHLCV input to POST /strategy/analyze, when the computed
    confidence is below 0.60, the response signal SHALL be "NONE" regardless
    of what the strategy computed.

    **Validates: Requirements 5.3**
    """
    closes, highs, lows, volumes = ohlcv

    payload = {
        "symbol": "BTCUSDT",
        "strategy": "bb_breakout",
        "closes": closes,
        "highs": highs,
        "lows": lows,
        "volumes": volumes,
    }

    # Mock confidence_engine.score to return a confidence below the 0.60 threshold
    with patch("main.confidence_engine.score", return_value=(0.30, "mocked low confidence")):
        response = client.post("/strategy/analyze", json=payload)

    assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    data = response.json()
    assert data["signal"] == "NONE", (
        f"Expected signal='NONE' when confidence=0.30 < 0.60, "
        f"but got signal={data['signal']!r} with confidence={data['confidence']}"
    )


# ---------------------------------------------------------------------------
# Property 9: Analyze response always has required fields
# Validates: Requirements 4.2
# ---------------------------------------------------------------------------

@given(ohlcv=valid_ohlcv())
@settings(max_examples=100)
def test_analyze_response_shape(ohlcv):
    """
    For any valid POST /strategy/analyze request (strategy exists, closes >= 2),
    the response SHALL contain signal, confidence, stoploss, reason, metadata,
    and strategy fields, with signal being one of "LONG", "SHORT", or "NONE".

    **Validates: Requirements 4.2**
    """
    closes, highs, lows, volumes = ohlcv

    payload = {
        "symbol": "BTCUSDT",
        "strategy": "bb_breakout",
        "closes": closes,
        "highs": highs,
        "lows": lows,
        "volumes": volumes,
    }

    response = client.post("/strategy/analyze", json=payload)

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    data = response.json()

    # All required fields must be present
    required_fields = {"signal", "confidence", "stoploss", "reason", "metadata", "strategy"}
    missing = required_fields - data.keys()
    assert not missing, f"Response missing required fields: {missing}"

    # signal must be one of the valid values
    assert data["signal"] in {"LONG", "SHORT", "NONE"}, (
        f"signal must be LONG, SHORT, or NONE, got {data['signal']!r}"
    )

    # confidence must be a float in [0.0, 1.0]
    assert isinstance(data["confidence"], (int, float)), (
        f"confidence must be a float, got {type(data['confidence'])}"
    )
    assert 0.0 <= data["confidence"] <= 1.0, (
        f"confidence must be in [0.0, 1.0], got {data['confidence']}"
    )

    # stoploss must be None or a float
    assert data["stoploss"] is None or isinstance(data["stoploss"], (int, float)), (
        f"stoploss must be None or a float, got {type(data['stoploss'])}: {data['stoploss']!r}"
    )

    # strategy must match what was requested
    assert data["strategy"] == "bb_breakout", (
        f"strategy in response must match request, got {data['strategy']!r}"
    )
