# Feature: pine-script-importer, Property 14: Auto-load all pine_ files on startup

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import textwrap
import tempfile

from hypothesis import given, settings
from hypothesis import strategies as st

from registry import StrategyRegistry
from pine_loader import load_pine_strategies


# ---------------------------------------------------------------------------
# Generators
# ---------------------------------------------------------------------------

# Template for a valid pine_*.py file containing a BaseStrategy subclass.
# The class name is parameterised so each generated file has a unique class.
_STRATEGY_TEMPLATE = textwrap.dedent("""\
    import sys, os
    sys.path.insert(0, {strategy_ai_path!r})
    from base_strategy import BaseStrategy

    class {class_name}(BaseStrategy):
        def compute_signal(self, closes, highs, lows, volumes, params):
            return {{"signal": "NONE", "stoploss": None, "metadata": {{}}}}

        def get_metadata(self):
            return {{"name": {class_name!r}, "description": "test", "version": "0.0.1"}}
""")

# Path to strategy-ai root so generated files can import BaseStrategy
_STRATEGY_AI_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


@st.composite
def pine_class_names(draw):
    """Generate valid Python class names like 'MyEma', 'Rsi2', etc."""
    first = draw(st.text(alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ", min_size=1, max_size=1))
    rest = draw(st.text(alphabet="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", min_size=1, max_size=10))
    return first + rest


@st.composite
def unique_class_name_list(draw):
    """Generate a list of 1–8 unique class names."""
    names = draw(st.lists(pine_class_names(), min_size=1, max_size=8, unique=True))
    return names


# ---------------------------------------------------------------------------
# Property 14: Auto-load all pine_ files on startup
# Validates: Requirements 7.4
# ---------------------------------------------------------------------------

@given(class_names=unique_class_name_list())
@settings(max_examples=50)
def test_autoload_all_pine_files(class_names):
    """
    For any set of pine_*.py files in strategies_dir, after load_pine_strategies()
    completes, every file containing a class that extends BaseStrategy SHALL be
    registered in the registry.

    **Validates: Requirements 7.4**
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        # Write one pine_*.py file per class name
        for class_name in class_names:
            filename = f"pine_{class_name.lower()}.py"
            filepath = os.path.join(tmpdir, filename)
            code = _STRATEGY_TEMPLATE.format(
                strategy_ai_path=_STRATEGY_AI_ROOT,
                class_name=class_name,
            )
            with open(filepath, "w") as f:
                f.write(code)

        registry = StrategyRegistry()
        loaded_keys = load_pine_strategies(registry, tmpdir)

        # Every class must have been registered
        assert len(loaded_keys) == len(class_names), (
            f"Expected {len(class_names)} keys loaded, got {len(loaded_keys)}. "
            f"class_names={class_names}, loaded_keys={loaded_keys}"
        )

        for class_name in class_names:
            expected_key = f"PINE_{class_name.upper()}"
            assert expected_key in registry.list_keys(), (
                f"Expected key {expected_key!r} to be registered, "
                f"but registry contains: {registry.list_keys()}"
            )
            assert expected_key in loaded_keys, (
                f"Expected key {expected_key!r} in loaded_keys, got: {loaded_keys}"
            )
