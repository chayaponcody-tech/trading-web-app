"""
Property-Based and Unit Tests for SandboxExecutor.

Property 3: Sandbox Security Invariant
Validates: Requirements 3.8, 4.2, 4.6, 11.3

For ANY module name NOT in IMPORT_WHITELIST, executing `import <module>`
must return result.success=False and result.error containing "ImportError".
"""
import keyword

import pytest
from hypothesis import assume, given, settings
from hypothesis import strategies as st

from core.sandbox_executor import IMPORT_WHITELIST, SandboxExecutor


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _is_valid_identifier(name: str) -> bool:
    """Return True if name is a valid Python identifier and not a keyword."""
    return name.isidentifier() and not keyword.iskeyword(name)


# ─── Generator: module names outside the whitelist ────────────────────────────

# Generate text that looks like a Python identifier but is NOT in the whitelist.
_module_name_st = (
    st.text(
        alphabet=st.characters(
            whitelist_categories=("Ll", "Lu", "Nd"),
            whitelist_characters="_",
        ),
        min_size=1,
        max_size=40,
    )
    .filter(_is_valid_identifier)
    .filter(lambda name: name not in IMPORT_WHITELIST)
)


# ─── Property 3: Sandbox Security Invariant ───────────────────────────────────

@settings(max_examples=200)
@given(module_name=_module_name_st)
def test_sandbox_security_invariant(module_name: str):
    """
    **Validates: Requirements 3.8, 4.2, 4.6, 11.3**

    Property: for any module name NOT in IMPORT_WHITELIST,
    executing `import <module>` must return:
      - result.success == False
      - "ImportError" in result.error
    """
    assume(module_name not in IMPORT_WHITELIST)

    executor = SandboxExecutor(timeout_seconds=5)
    result = executor.execute(f"import {module_name}")

    assert result.success is False, (
        f"Expected success=False for blocked import '{module_name}', got True"
    )
    assert result.error is not None, (
        f"Expected error message for blocked import '{module_name}', got None"
    )
    assert "ImportError" in result.error, (
        f"Expected 'ImportError' in error for '{module_name}', got: {result.error!r}"
    )


# ─── Unit Tests: Whitelist imports work ───────────────────────────────────────

@pytest.mark.parametrize("module_name", ["math", "statistics", "collections", "itertools"])
def test_whitelist_imports_succeed(module_name: str):
    """Whitelisted standard-library modules must import without error."""
    executor = SandboxExecutor(timeout_seconds=5)
    result = executor.execute(f"import {module_name}")

    assert result.success is True, (
        f"Expected success=True for whitelisted import '{module_name}', "
        f"got error: {result.error!r}"
    )
    assert result.error is None


# ─── Unit Tests: Blocked builtins raise NameError ─────────────────────────────

@pytest.mark.parametrize("builtin_call", [
    "open('test.txt')",
    "exec('x=1')",
    "eval('1+1')",
])
def test_blocked_builtins_raise_name_error(builtin_call: str):
    """Dangerous builtins (open, exec, eval) must not be available in sandbox."""
    executor = SandboxExecutor(timeout_seconds=5)
    result = executor.execute(builtin_call)

    assert result.success is False, (
        f"Expected success=False for blocked builtin call: {builtin_call!r}"
    )
    assert result.error is not None
    assert "NameError" in result.error, (
        f"Expected 'NameError' for blocked builtin {builtin_call!r}, got: {result.error!r}"
    )


# ─── Unit Test: Timeout behavior ──────────────────────────────────────────────

def test_timeout_terminates_infinite_loop():
    """Code with an infinite loop must be terminated after timeout."""
    executor = SandboxExecutor(timeout_seconds=1)
    result = executor.execute("while True: pass")

    assert result.success is False, "Expected success=False for timed-out code"
    assert result.error is not None
    assert "timeout" in result.error.lower(), (
        f"Expected timeout message in error, got: {result.error!r}"
    )
    # Execution time should be close to the timeout (at least 1s)
    assert result.execution_time_ms >= 900, (
        f"Expected execution_time_ms >= 900ms, got {result.execution_time_ms:.1f}ms"
    )


# ─── Unit Test: Valid code executes successfully ──────────────────────────────

def test_valid_code_executes_successfully():
    """Simple valid Python code must execute and return success=True."""
    executor = SandboxExecutor(timeout_seconds=5)
    result = executor.execute("x = 1 + 1")

    assert result.success is True, f"Expected success=True, got error: {result.error!r}"
    assert result.error is None
    assert result.output is not None
    assert result.output.get("x") == 2


# ─── Unit Test: Syntax errors return success=False ───────────────────────────

def test_syntax_error_returns_failure():
    """Code with a syntax error must return success=False with an error message."""
    executor = SandboxExecutor(timeout_seconds=5)
    result = executor.execute("def broken(:\n    pass")

    assert result.success is False, "Expected success=False for syntax error"
    assert result.error is not None
    assert "SyntaxError" in result.error, (
        f"Expected 'SyntaxError' in error, got: {result.error!r}"
    )


# ─── Unit Test: Namespace isolation between executions ───────────────────────

def test_namespace_is_isolated_between_executions():
    """Variables from one execution must not leak into a subsequent execution."""
    executor = SandboxExecutor(timeout_seconds=5)

    # First execution sets a variable
    result1 = executor.execute("secret = 42")
    assert result1.success is True

    # Second execution should not see 'secret'
    result2 = executor.execute("x = secret")
    assert result2.success is False, (
        "Expected success=False because 'secret' should not exist in new namespace"
    )
    assert result2.error is not None
    assert "NameError" in result2.error, (
        f"Expected 'NameError' for leaked variable, got: {result2.error!r}"
    )
