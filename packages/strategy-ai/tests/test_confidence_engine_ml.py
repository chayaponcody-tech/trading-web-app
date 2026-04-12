# Feature: quant-engine-upgrade, Property 6: feature pipeline shape invariant
# Feature: quant-engine-upgrade, Property 7: ML confidence probability bounds

import sys
import os
import logging
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import MagicMock, patch
import numpy as np
import pytest

from hypothesis import given, settings
from hypothesis import strategies as st

from confidence_engine import ConfidenceEngine, FeaturePipeline


# ---------------------------------------------------------------------------
# Generators
# ---------------------------------------------------------------------------

@st.composite
def valid_ohlcv(draw, min_n=50, max_n=200):
    """Generate valid OHLCV arrays of length N in [min_n, max_n]."""
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
    return closes, highs, lows


@st.composite
def valid_feature_vector(draw):
    """Generate a valid 8-element feature vector."""
    return draw(
        st.lists(
            st.floats(min_value=-1e6, max_value=1e6, allow_nan=False, allow_infinity=False),
            min_size=8,
            max_size=8,
        )
    )


# ---------------------------------------------------------------------------
# Property 6: Feature pipeline shape invariant
# Validates: Requirements 7.5
# ---------------------------------------------------------------------------

@given(ohlcv=valid_ohlcv(min_n=50, max_n=200))
@settings(max_examples=100)
def test_feature_pipeline_shape_invariant(ohlcv):
    """
    For any valid OHLCV input with length >= 50, the FeaturePipeline SHALL
    always produce a feature vector of exactly 8 elements.

    **Validates: Requirements 7.5**
    """
    closes, highs, lows = ohlcv
    pipeline = FeaturePipeline()
    features = pipeline.extract(closes, highs, lows)

    assert len(features) == 8, (
        f"Expected 8 features, got {len(features)} for input length {len(closes)}"
    )


# ---------------------------------------------------------------------------
# Property 7: ML confidence probability bounds
# Validates: Requirements 7.6
# ---------------------------------------------------------------------------

@given(feat_vec=valid_feature_vector())
@settings(max_examples=100)
def test_ml_confidence_probability_bounds(feat_vec):
    """
    For any valid feature vector passed to a loaded MLModel, the confidence
    score returned by _ml_score() SHALL be in [0.0, 1.0].

    **Validates: Requirements 7.6**
    """
    # Build a mock model whose predict_proba returns a valid probability
    # drawn from the feature vector values mapped to [0, 1]
    prob = abs(feat_vec[0]) % 1.0 if feat_vec[0] != 0 else 0.5
    mock_model = MagicMock()
    mock_model.predict_proba.return_value = np.array([[1 - prob, prob]])

    engine = ConfidenceEngine(mode="rule_based", openrouter_key="", openrouter_model="")
    engine.model = mock_model

    features_arr = np.array(feat_vec, dtype=float)
    result = engine._ml_score(features_arr)

    assert 0.0 <= result <= 1.0, (
        f"_ml_score() returned {result}, which is outside [0.0, 1.0]"
    )


# ---------------------------------------------------------------------------
# Unit test 4.9: ConfidenceEngine fallback when MODEL_PATH is not set
# Validates: Requirements 7.3
# ---------------------------------------------------------------------------

def test_confidence_engine_no_model_path_falls_back_to_rule_based():
    """
    When MODEL_PATH is not set, ConfidenceEngine.score() SHALL call
    _rule_based() and SHALL NOT raise an error.

    **Validates: Requirements 7.3**
    """
    env = {k: v for k, v in os.environ.items() if k != "MODEL_PATH"}
    with patch.dict(os.environ, env, clear=True):
        engine = ConfidenceEngine(mode="rule_based", openrouter_key="", openrouter_model="")

    assert engine.model is None, "model should be None when MODEL_PATH is not set"

    confidence, reason = engine.score(
        signal="LONG",
        features={"rsi": 40, "bb_position": 0.3, "ema_cross": 0.01, "momentum": 0.005, "volatility": 0.01},
        regime="trending_up",
        strategy_metadata={"name": "test"},
    )

    assert 0.0 <= confidence <= 1.0, f"confidence {confidence} out of bounds"
    assert isinstance(reason, str) and len(reason) > 0


# ---------------------------------------------------------------------------
# Unit test 4.10: ConfidenceEngine exception fallback when predict_proba raises
# Validates: Requirements 7.7
# ---------------------------------------------------------------------------

def test_confidence_engine_exception_falls_back_to_rule_based(caplog):
    """
    When model.predict_proba() raises an exception, ConfidenceEngine.score()
    SHALL log the error and fall back to the rule-based score without raising.

    **Validates: Requirements 7.7**
    """
    mock_model = MagicMock()
    mock_model.predict_proba.side_effect = RuntimeError("model exploded")

    engine = ConfidenceEngine(mode="rule_based", openrouter_key="", openrouter_model="")
    engine.model = mock_model

    closes = [100.0 + i * 0.1 for i in range(60)]
    highs = [c * 1.002 for c in closes]
    lows = [c * 0.998 for c in closes]

    with caplog.at_level(logging.ERROR, logger="confidence_engine"):
        confidence, reason = engine.score(
            signal="SHORT",
            features={"rsi": 70, "bb_position": 0.85, "ema_cross": -0.01, "momentum": -0.005, "volatility": 0.02},
            regime="volatile",
            strategy_metadata={"name": "test"},
            closes=closes,
            highs=highs,
            lows=lows,
        )

    assert 0.0 <= confidence <= 1.0, f"confidence {confidence} out of bounds after exception"
    assert isinstance(reason, str) and len(reason) > 0

    # Verify the error was logged
    error_logs = [r for r in caplog.records if r.levelno >= logging.ERROR]
    assert len(error_logs) > 0, "Expected an error to be logged when predict_proba raises"
    assert any("ML scoring failed" in r.message or "falling back" in r.message.lower()
               or "ml" in r.message.lower() for r in error_logs), (
        f"Expected ML error log, got: {[r.message for r in error_logs]}"
    )
