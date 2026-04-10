# Feature: python-strategy-registry, Property 7: ConfidenceEngine output is bounded

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from hypothesis import given, settings
from hypothesis import strategies as st

from confidence_engine import ConfidenceEngine


# ---------------------------------------------------------------------------
# Property 7: ConfidenceEngine output is bounded
# Validates: Requirements 5.2
# ---------------------------------------------------------------------------

_signals = st.sampled_from(["LONG", "SHORT", "NONE"])

_features = st.dictionaries(
    keys=st.sampled_from(["rsi", "bb_position", "ema_cross", "momentum", "volatility"]),
    values=st.floats(min_value=-1e6, max_value=1e6, allow_nan=False, allow_infinity=False),
)

_regimes = st.sampled_from(["trending_up", "trending_down", "volatile", "ranging", "unknown"])

_strategy_metadata = st.dictionaries(
    keys=st.text(min_size=1, max_size=20),
    values=st.one_of(
        st.text(max_size=50),
        st.floats(min_value=-1e6, max_value=1e6, allow_nan=False, allow_infinity=False),
    ),
    max_size=10,
)


@given(
    signal=_signals,
    features=_features,
    regime=_regimes,
    strategy_metadata=_strategy_metadata,
)
@settings(max_examples=100)
def test_confidence_engine_output_bounded(signal, features, regime, strategy_metadata):
    """
    For any inputs, ConfidenceEngine.score() returns confidence in [0.0, 1.0]
    and a non-empty reason string.

    **Validates: Requirements 5.2**
    """
    engine = ConfidenceEngine(mode="rule_based", openrouter_key="", openrouter_model="")
    confidence, reason = engine.score(signal, features, regime, strategy_metadata)

    assert 0.0 <= confidence <= 1.0, (
        f"confidence={confidence} is out of [0.0, 1.0] for "
        f"signal={signal!r}, features={features!r}, regime={regime!r}"
    )
    assert isinstance(reason, str) and len(reason) > 0, (
        f"reason must be a non-empty string, got {reason!r}"
    )
