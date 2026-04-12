# Feature: quant-engine-upgrade, Property 2: batch response length invariant
# Feature: quant-engine-upgrade, Property 1: batch no-look-ahead equivalence

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from hypothesis import given, settings
from hypothesis import strategies as st
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# Generators
# ---------------------------------------------------------------------------

@st.composite
def valid_batch_ohlcv(draw, min_n=50, max_n=200):
    """Generate a valid OHLCV dataset of length N in [min_n, max_n]."""
    n = draw(st.integers(min_value=min_n, max_value=max_n))
    base = draw(st.floats(min_value=100.0, max_value=100_000.0, allow_nan=False, allow_infinity=False))
    changes = draw(
        st.lists(
            st.floats(min_value=-0.02, max_value=0.02, allow_nan=False, allow_infinity=False),
            min_size=n - 1,
            max_size=n - 1,
        )
    )
    closes = [base]
    for c in changes:
        closes.append(max(closes[-1] * (1 + c), 0.01))

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
# Property 2: Batch response length invariant
# Validates: Requirements 1.2
# ---------------------------------------------------------------------------

@given(ohlcv=valid_batch_ohlcv(min_n=50, max_n=200))
@settings(max_examples=100)
def test_batch_response_length_invariant(ohlcv):
    """
    For any valid batch request with a closes array of length N, the returned
    signals and confidences arrays SHALL each have exactly N elements.

    **Validates: Requirements 1.2**
    """
    closes, highs, lows, volumes = ohlcv
    n = len(closes)

    payload = {
        "symbol": "BTCUSDT",
        "strategy": "bb_breakout",
        "closes": closes,
        "highs": highs,
        "lows": lows,
        "volumes": volumes,
    }

    response = client.post("/strategy/analyze/batch", json=payload)
    assert response.status_code == 200, (
        f"Expected 200, got {response.status_code}: {response.text}"
    )

    data = response.json()
    signals = data["signals"]
    confidences = data["confidences"]

    assert len(signals) == n, (
        f"Expected len(signals) == {n}, got {len(signals)}"
    )
    assert len(confidences) == n, (
        f"Expected len(confidences) == {n}, got {len(confidences)}"
    )


# ---------------------------------------------------------------------------
# Property 1: Batch no-look-ahead equivalence
# Validates: Requirements 1.6, 2.4
# ---------------------------------------------------------------------------

@given(ohlcv=valid_batch_ohlcv(min_n=50, max_n=80))
@settings(max_examples=10, deadline=None)
def test_batch_no_lookahead_equivalence(ohlcv):
    """
    For any valid OHLCV dataset of length N >= 50, the SignalArray returned by
    POST /strategy/analyze/batch SHALL be equivalent to calling the batch
    endpoint N times with progressively longer slices of the same input
    (no-look-ahead equivalence: candle i only sees data up to index i).

    For candles where the slice has >= 50 elements (i >= 49), we compare the
    full-dataset batch signal against a separate batch call with that slice.
    The last element of the slice batch response must match the full-dataset
    batch signal at the same index.

    **Validates: Requirements 1.6, 2.4**
    """
    closes, highs, lows, volumes = ohlcv
    n = len(closes)

    # --- Full-dataset batch call ---
    batch_payload = {
        "symbol": "BTCUSDT",
        "strategy": "bb_breakout",
        "closes": closes,
        "highs": highs,
        "lows": lows,
        "volumes": volumes,
    }
    batch_resp = client.post("/strategy/analyze/batch", json=batch_payload)
    assert batch_resp.status_code == 200, (
        f"Batch call failed: {batch_resp.status_code}: {batch_resp.text}"
    )
    batch_signals = batch_resp.json()["signals"]

    # --- Sequential batch calls with growing slices (only for slices >= 50) ---
    for i in range(49, n):
        end = i + 1
        slice_payload = {
            "symbol": "BTCUSDT",
            "strategy": "bb_breakout",
            "closes": closes[:end],
            "highs": highs[:end],
            "lows": lows[:end],
            "volumes": volumes[:end],
        }
        slice_resp = client.post("/strategy/analyze/batch", json=slice_payload)
        assert slice_resp.status_code == 200, (
            f"Slice batch call at i={i} failed: {slice_resp.status_code}: {slice_resp.text}"
        )
        # The last element of the slice batch response is the signal for candle i
        slice_signal = slice_resp.json()["signals"][-1]
        assert batch_signals[i] == slice_signal, (
            f"No-look-ahead violation at candle {i}: "
            f"full-dataset batch={batch_signals[i]!r}, "
            f"slice batch (len={end})={slice_signal!r}"
        )
