"""
Integration tests for the Strategy AI FastAPI service.
Tests: POST /strategy/analyze, POST /analyze-signal, GET /strategy/list,
       HTTP 400 unknown strategy, HTTP 422 invalid closes.

Requirements: 4.3, 4.4, 4.6, 7.1, 7.2, 7.3
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_ohlcv(n=100, base_price=50000.0, trend=0.0):
    """Generate n realistic OHLCV bars around base_price."""
    import random
    random.seed(42)
    closes, highs, lows, volumes = [], [], [], []
    price = base_price
    for _ in range(n):
        change = price * random.uniform(-0.005, 0.005 + trend)
        price = max(price + change, 1.0)
        spread = price * 0.002
        closes.append(round(price, 2))
        highs.append(round(price + spread, 2))
        lows.append(round(price - spread, 2))
        volumes.append(round(random.uniform(0.5, 5.0), 4))
    return closes, highs, lows, volumes


# ---------------------------------------------------------------------------
# Test 1: POST /strategy/analyze — end-to-end with BollingerBreakout
# Requirements: 4.3, 4.2
# ---------------------------------------------------------------------------

def test_strategy_analyze_end_to_end():
    """POST /strategy/analyze with 100 real BollingerBreakout bars returns valid response."""
    closes, highs, lows, volumes = _make_ohlcv(n=100)

    payload = {
        "symbol": "BTCUSDT",
        "strategy": "bb_breakout",
        "closes": closes,
        "highs": highs,
        "lows": lows,
        "volumes": volumes,
    }

    response = client.post("/strategy/analyze", json=payload)
    assert response.status_code == 200

    data = response.json()

    # Required fields present
    assert "symbol" in data
    assert "signal" in data
    assert "confidence" in data
    assert "stoploss" in data
    assert "reason" in data
    assert "metadata" in data
    assert "strategy" in data

    # Field value constraints
    assert data["symbol"] == "BTCUSDT"
    assert data["signal"] in ("LONG", "SHORT", "NONE")
    assert 0.0 <= data["confidence"] <= 1.0
    assert isinstance(data["reason"], str) and len(data["reason"]) > 0
    assert data["strategy"] == "bb_breakout"
    assert isinstance(data["metadata"], dict)

    # stoploss is None or a float
    assert data["stoploss"] is None or isinstance(data["stoploss"], float)

    # If signal is NONE, stoploss must be None
    if data["signal"] == "NONE":
        assert data["stoploss"] is None


# ---------------------------------------------------------------------------
# Test 2: POST /analyze-signal — backward compatibility
# Requirements: 7.1, 7.2, 7.3
# ---------------------------------------------------------------------------

def test_analyze_signal_backward_compat():
    """POST /analyze-signal returns same response shape as before."""
    closes, _, _, _ = _make_ohlcv(n=60)

    payload = {
        "symbol": "ETHUSDT",
        "signal": "LONG",
        "closes": closes,
        "mode": "ml",
    }

    response = client.post("/analyze-signal", json=payload)
    assert response.status_code == 200

    data = response.json()

    # Verify the original response shape is preserved
    assert "symbol" in data
    assert "signal" in data
    assert "confidence" in data
    assert "reason" in data

    assert data["symbol"] == "ETHUSDT"
    assert data["signal"] in ("LONG", "SHORT", "NONE")
    assert 0.0 <= data["confidence"] <= 1.0
    assert isinstance(data["reason"], str)


# ---------------------------------------------------------------------------
# Test 3: GET /strategy/list — returns ["bb_breakout"]
# Requirements: 4.6
# ---------------------------------------------------------------------------

def test_strategy_list_returns_bb_breakout():
    """GET /strategy/list returns a list containing 'bb_breakout' with engine='python'."""
    response = client.get("/strategy/list")
    assert response.status_code == 200

    data = response.json()
    assert "strategies" in data
    assert isinstance(data["strategies"], list)
    keys = [s["key"] for s in data["strategies"]]
    assert "bb_breakout" in keys
    # All entries must have engine="python"
    for entry in data["strategies"]:
        assert entry["engine"] == "python"


# ---------------------------------------------------------------------------
# Test 4: HTTP 400 when unknown strategy key is sent
# Requirements: 4.3
# ---------------------------------------------------------------------------

def test_unknown_strategy_returns_400():
    """POST /strategy/analyze with unknown strategy key returns HTTP 400."""
    closes, highs, lows, volumes = _make_ohlcv(n=50)

    payload = {
        "symbol": "BTCUSDT",
        "strategy": "nonexistent_strategy_xyz",
        "closes": closes,
        "highs": highs,
        "lows": lows,
        "volumes": volumes,
    }

    response = client.post("/strategy/analyze", json=payload)
    assert response.status_code == 400

    data = response.json()
    assert "detail" in data
    # Error message should mention the unknown strategy key
    assert "nonexistent_strategy_xyz" in data["detail"]


# ---------------------------------------------------------------------------
# Test 5: HTTP 422 when closes has fewer than 2 elements
# Requirements: 4.4
# ---------------------------------------------------------------------------

def test_closes_too_short_returns_422():
    """POST /strategy/analyze with closes < 2 elements returns HTTP 422."""
    payload = {
        "symbol": "BTCUSDT",
        "strategy": "bb_breakout",
        "closes": [50000.0],   # only 1 element — should fail validation
        "highs": [50100.0],
        "lows": [49900.0],
        "volumes": [1.0],
    }

    response = client.post("/strategy/analyze", json=payload)
    assert response.status_code == 422


def test_closes_empty_returns_422():
    """POST /strategy/analyze with empty closes returns HTTP 422."""
    payload = {
        "symbol": "BTCUSDT",
        "strategy": "bb_breakout",
        "closes": [],
        "highs": [],
        "lows": [],
        "volumes": [],
    }

    response = client.post("/strategy/analyze", json=payload)
    assert response.status_code == 422
