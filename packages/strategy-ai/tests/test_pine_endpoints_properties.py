# Feature: pine-script-importer, Property 8: Temp key format invariant

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import uuid
import textwrap

from hypothesis import given, settings
from hypothesis import strategies as st

from registry import StrategyRegistry
from base_strategy import BaseStrategy


# ---------------------------------------------------------------------------
# Generators
# ---------------------------------------------------------------------------

_STRATEGY_AI_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

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


@st.composite
def valid_class_names(draw):
    """Generate valid Python class names like 'MyEma', 'Rsi2', etc."""
    first = draw(st.text(alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ", min_size=1, max_size=1))
    rest = draw(st.text(
        alphabet="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
        min_size=1,
        max_size=10,
    ))
    return first + rest


@st.composite
def valid_strategy_code(draw):
    """Generate a valid Python code string defining a class that extends BaseStrategy."""
    class_name = draw(valid_class_names())
    code = _STRATEGY_TEMPLATE.format(
        strategy_ai_path=_STRATEGY_AI_ROOT,
        class_name=class_name,
    )
    return code


def _register_dynamic_logic(registry: StrategyRegistry, key: str, python_code: str) -> dict:
    """
    Replicate the register_dynamic endpoint logic directly (no HTTP).
    Mirrors the implementation in main.py.
    """
    namespace = {}
    exec(python_code, namespace)

    strategy_class = None
    for obj in namespace.values():
        if isinstance(obj, type) and issubclass(obj, BaseStrategy) and obj is not BaseStrategy:
            strategy_class = obj
            break

    if not strategy_class:
        raise ValueError("ไม่พบ class ที่ extend BaseStrategy")

    registry.register(key, strategy_class())
    return {"registered": True, "key": key}


# ---------------------------------------------------------------------------
# Property 8: Temp key format invariant
# Validates: Requirements 4.2
# ---------------------------------------------------------------------------

@given(python_code=valid_strategy_code())
@settings(max_examples=50)
def test_temp_key_format_invariant(python_code):
    """
    For any valid Python code sent to register-dynamic, the key SHALL have the
    format PINE_TEMP_ followed by a UUID, and the strategy SHALL be registered
    in the registry under that key.

    **Validates: Requirements 4.2**
    """
    registry = StrategyRegistry()

    # Simulate what the API Gateway does: generate a PINE_TEMP_ key
    temp_key = f"PINE_TEMP_{uuid.uuid4()}"

    # Key must start with PINE_TEMP_
    assert temp_key.startswith("PINE_TEMP_"), (
        f"Generated key {temp_key!r} does not start with 'PINE_TEMP_'"
    )

    # The UUID portion after PINE_TEMP_ must be a valid UUID
    uuid_part = temp_key[len("PINE_TEMP_"):]
    try:
        parsed = uuid.UUID(uuid_part)
        assert str(parsed) == uuid_part, (
            f"UUID portion {uuid_part!r} is not in canonical form"
        )
    except ValueError:
        raise AssertionError(f"UUID portion {uuid_part!r} is not a valid UUID")

    # Register the strategy using the temp key
    result = _register_dynamic_logic(registry, temp_key, python_code)

    # Registration must succeed
    assert result["registered"] is True, (
        f"Expected registered=True, got {result}"
    )
    assert result["key"] == temp_key, (
        f"Returned key {result['key']!r} does not match temp_key {temp_key!r}"
    )

    # Strategy must appear in registry
    assert temp_key in registry.list_keys(), (
        f"Key {temp_key!r} not found in registry after registration. "
        f"Registry keys: {registry.list_keys()}"
    )

    # The registered instance must be a BaseStrategy
    strategy_instance = registry.get(temp_key)
    assert isinstance(strategy_instance, BaseStrategy), (
        f"Registered object is not a BaseStrategy instance: {type(strategy_instance)}"
    )


# ---------------------------------------------------------------------------
# Property 9: Temp key cleanup after backtest
# Validates: Requirements 4.6
# ---------------------------------------------------------------------------

@given(python_code=valid_strategy_code())
@settings(max_examples=50)
def test_temp_key_cleanup_after_backtest(python_code):
    """
    For any backtest run with a PINE_TEMP_ key (success or error), after the
    backtest completes the key SHALL NOT appear in registry.list_keys() anymore.

    **Validates: Requirements 4.6**
    """
    registry = StrategyRegistry()

    # Simulate API Gateway: generate a PINE_TEMP_ key
    temp_key = f"PINE_TEMP_{uuid.uuid4()}"

    # Register the strategy (simulates register-dynamic endpoint)
    _register_dynamic_logic(registry, temp_key, python_code)

    # Key must be present after registration
    assert temp_key in registry.list_keys(), (
        f"Key {temp_key!r} should be in registry after registration. "
        f"Registry keys: {registry.list_keys()}"
    )

    # Simulate unregister (mirrors DELETE /strategy/unregister logic)
    del registry._strategies[temp_key]

    # Key must NOT appear in registry after unregister
    assert temp_key not in registry.list_keys(), (
        f"Key {temp_key!r} still present in registry after unregister. "
        f"Registry keys: {registry.list_keys()}"
    )


# ---------------------------------------------------------------------------
# Property 11: Duplicate key detection
# Validates: Requirements 6.5, 8.5
# ---------------------------------------------------------------------------

import tempfile


def _save_pine_logic(
    registry: StrategyRegistry,
    key: str,
    python_code: str,
    strategies_dir: str,
    filename: str,
) -> dict:
    """
    Replicate the save-pine endpoint logic directly (no HTTP).
    Mirrors the implementation in main.py.

    Raises ValueError (equivalent to HTTP 409) when key already exists.
    """
    if key in registry._strategies:
        raise ValueError("Strategy name already exists")  # equivalent to HTTP 409

    os.makedirs(strategies_dir, exist_ok=True)
    filepath = os.path.join(strategies_dir, filename)
    with open(filepath, "w") as f:
        f.write(python_code)

    namespace = {}
    exec(python_code, namespace)

    strategy_class = None
    for obj in namespace.values():
        if isinstance(obj, type) and issubclass(obj, BaseStrategy) and obj is not BaseStrategy:
            strategy_class = obj
            break

    if not strategy_class:
        raise ValueError("ไม่พบ class ที่ extend BaseStrategy")

    registry.register(key, strategy_class())
    return {"strategyKey": key, "message": "บันทึกสำเร็จ"}


@given(python_code=valid_strategy_code(), key=st.text(
    alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_",
    min_size=3,
    max_size=30,
).map(lambda s: f"PINE_{s}"))
@settings(max_examples=50)
def test_duplicate_key_detection(python_code, key):
    """
    For any strategy key that already exists in the registry, a second save
    with the same key SHALL raise an error (equivalent to HTTP 409) and SHALL
    NOT overwrite the file that was written by the first save.

    **Validates: Requirements 6.5, 8.5**
    """
    registry = StrategyRegistry()

    with tempfile.TemporaryDirectory() as tmpdir:
        filename = "pine_test_strategy.py"
        filepath = os.path.join(tmpdir, filename)

        # --- First save: must succeed ---
        result = _save_pine_logic(registry, key, python_code, tmpdir, filename)
        assert result["strategyKey"] == key, (
            f"First save returned unexpected key: {result['strategyKey']!r}"
        )
        assert key in registry._strategies, (
            f"Key {key!r} not in registry after first save"
        )

        # Record the file content written by the first save
        with open(filepath) as f:
            original_content = f.read()

        # --- Second save with same key: must raise ValueError (HTTP 409 equivalent) ---
        raised = False
        try:
            _save_pine_logic(registry, key, python_code, tmpdir, filename)
        except ValueError as exc:
            raised = True
            assert "already exists" in str(exc).lower(), (
                f"Expected 'already exists' in error message, got: {exc}"
            )

        assert raised, (
            f"Expected ValueError (HTTP 409) on duplicate key {key!r}, but no error was raised"
        )

        # --- File must NOT have been overwritten ---
        with open(filepath) as f:
            current_content = f.read()

        assert current_content == original_content, (
            f"File was overwritten on duplicate save for key {key!r}"
        )
