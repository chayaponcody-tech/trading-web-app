# Feature: python-strategy-registry, Property 1: Registry round-trip
# Feature: python-strategy-registry, Property 2: Registry lists all registered keys
# Feature: python-strategy-registry, Property 3: Unregistered key raises descriptive error

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from registry import StrategyRegistry
from base_strategy import BaseStrategy


class _DummyStrategy(BaseStrategy):
    """Minimal concrete strategy for testing the registry."""

    def compute_signal(self, closes, highs, lows, volumes, params) -> dict:
        return {"signal": "NONE", "stoploss": None, "metadata": {}}

    def get_metadata(self) -> dict:
        return {"name": "dummy", "description": "test", "version": "0.0.1"}


# ---------------------------------------------------------------------------
# Property 1: Registry round-trip
# Validates: Requirements 1.1, 1.3
# ---------------------------------------------------------------------------

@given(key=st.text(min_size=1, max_size=50))
@settings(max_examples=100)
def test_registry_round_trip(key):
    """register(key, s) then get(key) returns the exact same instance."""
    registry = StrategyRegistry()
    strategy = _DummyStrategy()
    registry.register(key, strategy)
    assert registry.get(key) is strategy


# ---------------------------------------------------------------------------
# Property 2: Registry lists all registered keys
# Validates: Requirements 1.5
# ---------------------------------------------------------------------------

@given(keys=st.sets(st.text(min_size=1, max_size=50), min_size=1, max_size=20))
@settings(max_examples=100)
def test_registry_list_completeness(keys):
    """list_keys() returns exactly the set of registered keys."""
    registry = StrategyRegistry()
    for key in keys:
        registry.register(key, _DummyStrategy())
    assert set(registry.list_keys()) == keys


# ---------------------------------------------------------------------------
# Property 3: Unregistered key raises descriptive error
# Validates: Requirements 1.4
# ---------------------------------------------------------------------------

@given(key=st.text(min_size=1, max_size=50))
@settings(max_examples=100)
def test_unregistered_key_raises_descriptive_error(key):
    """get(unregistered_key) raises KeyError whose message contains the key."""
    registry = StrategyRegistry()
    # Ensure the key is definitely not registered
    with pytest.raises(KeyError) as exc_info:
        registry.get(key)
    # KeyError args[0] is the raw message string — check it directly
    error_message = exc_info.value.args[0]
    assert key in error_message
