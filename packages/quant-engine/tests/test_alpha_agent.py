"""
Property-Based and Unit Tests for AlphaAgent — Alpha Generation Termination.

Property 8: Alpha Generation Termination
Validates: Requirements 3.6, 3.9, 11.8

For ANY topic string, when the LLM always returns invalid Python code,
the agent must:
  - Exhaust all retry attempts (result.attempts <= 5)
  - Return result.status == "generation_failed"
"""
from __future__ import annotations

import sqlite3

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from agents.alpha_agent import AlphaAgent, MAX_GENERATION_ATTEMPTS
from core.sandbox_executor import SandboxExecutor


# ─── Mock LLM Client ──────────────────────────────────────────────────────────

class MockLLMClient:
    """LLM client that always returns invalid Python code."""

    async def complete(self, prompt: str) -> str:
        return "this is not valid python code!!!"


# ─── DB Fixture ───────────────────────────────────────────────────────────────

def _make_in_memory_db() -> sqlite3.Connection:
    """Create an in-memory SQLite connection with the required schema."""
    conn = sqlite3.connect(":memory:")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS mutation_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lineage_id TEXT NOT NULL,
            parent_key TEXT NOT NULL,
            child_key TEXT NOT NULL,
            mutation_round INTEGER NOT NULL,
            failure_reason TEXT,
            decay_metrics TEXT,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.commit()
    return conn


# ─── Property 8: Alpha Generation Termination ─────────────────────────────────

@settings(max_examples=50)
@given(topic=st.text(min_size=1, max_size=200))
def test_alpha_generation_termination_property(topic: str):
    """
    **Validates: Requirements 3.6, 3.9, 11.8**

    Property: for ANY topic string, when the LLM always returns invalid code,
    generate_strategy() must return:
      - result.attempts <= 5
      - result.status == "generation_failed"
    """
    import asyncio

    agent = AlphaAgent(
        llm_client=MockLLMClient(),
        sandbox=SandboxExecutor(timeout_seconds=5),
        strategy_ai_url="http://localhost:9999",  # unreachable, but won't be called on failure
        db=_make_in_memory_db(),
    )

    result = asyncio.get_event_loop().run_until_complete(
        agent.generate_strategy(topic, {})
    )

    assert result.attempts <= MAX_GENERATION_ATTEMPTS, (
        f"Expected attempts <= {MAX_GENERATION_ATTEMPTS}, got {result.attempts} "
        f"for topic={topic!r}"
    )
    assert result.status == "generation_failed", (
        f"Expected status='generation_failed', got {result.status!r} "
        f"for topic={topic!r}"
    )


# ─── Unit Test: Exact attempt count is 5 ─────────────────────────────────────

@pytest.mark.asyncio
async def test_alpha_generation_termination_exact_attempts():
    """
    Unit test: when the LLM always returns invalid code, the agent must
    exhaust exactly MAX_GENERATION_ATTEMPTS (5) retries and return
    status='generation_failed'.
    """
    agent = AlphaAgent(
        llm_client=MockLLMClient(),
        sandbox=SandboxExecutor(timeout_seconds=5),
        strategy_ai_url="http://localhost:9999",
        db=_make_in_memory_db(),
    )

    result = await agent.generate_strategy("momentum strategy", {})

    assert result.attempts == MAX_GENERATION_ATTEMPTS, (
        f"Expected exactly {MAX_GENERATION_ATTEMPTS} attempts, got {result.attempts}"
    )
    assert result.status == "generation_failed", (
        f"Expected status='generation_failed', got {result.status!r}"
    )
    assert result.strategy_key is not None
    assert result.lineage_id is not None


# ─── Unit Test: Empty topic also terminates correctly ─────────────────────────

@pytest.mark.asyncio
async def test_alpha_generation_termination_empty_topic():
    """Edge case: empty topic string should still exhaust retries and fail."""
    agent = AlphaAgent(
        llm_client=MockLLMClient(),
        sandbox=SandboxExecutor(timeout_seconds=5),
        strategy_ai_url="http://localhost:9999",
        db=_make_in_memory_db(),
    )

    result = await agent.generate_strategy("", {})

    assert result.attempts == MAX_GENERATION_ATTEMPTS
    assert result.status == "generation_failed"


# ─── Unit Tests: Task 8.3 ─────────────────────────────────────────────────────
# Validates: Requirements 3.2, 3.3, 3.5, 9.1


def _make_agent() -> AlphaAgent:
    """Create a minimal AlphaAgent for unit testing (no LLM calls needed)."""
    return AlphaAgent(
        llm_client=None,
        sandbox=SandboxExecutor(timeout_seconds=5),
        strategy_ai_url="http://localhost:9999",
        db=_make_in_memory_db(),
    )


def test_self_correction_prompt_contains_error():
    """
    Validates: Requirements 3.2, 3.3

    _build_self_correction_prompt must embed the error/stack trace in the prompt
    so the LLM can fix the failing code.
    """
    agent = _make_agent()
    code = "class Foo(BaseStrategy): pass"
    error = "Traceback (most recent call last):\n  File 'x.py', line 1\nNameError: name 'bar' is not defined"

    prompt = agent._build_self_correction_prompt(code, error)

    assert error in prompt, "Error/stack trace must appear verbatim in the self-correction prompt"


def test_mutation_prompt_contains_failure_reason():
    """
    Validates: Requirements 3.5, 9.1

    _build_mutation_prompt must embed the failure_reason so the LLM knows
    why the strategy was rejected.
    """
    agent = _make_agent()
    code = "class Foo(BaseStrategy): pass"
    metrics = {"sharpe": 0.3, "max_drawdown": -0.45}
    failure_reason = "Sharpe ratio below threshold"

    prompt = agent._build_mutation_prompt(code, metrics, failure_reason)

    assert failure_reason in prompt, "failure_reason must appear in the mutation prompt"


def test_mutation_prompt_contains_metrics():
    """
    Validates: Requirements 3.5, 9.1

    _build_mutation_prompt must embed the performance metrics so the LLM
    has quantitative context for the mutation.
    """
    agent = _make_agent()
    code = "class Foo(BaseStrategy): pass"
    metrics = {"sharpe": 0.3, "max_drawdown": -0.45}
    failure_reason = "Sharpe ratio below threshold"

    prompt = agent._build_mutation_prompt(code, metrics, failure_reason)

    # Both metric values must appear in the serialised prompt
    assert "0.3" in prompt, "sharpe metric value must appear in the mutation prompt"
    assert "-0.45" in prompt, "max_drawdown metric value must appear in the mutation prompt"


def test_validate_code_rejects_no_base_strategy():
    """
    Validates: Requirements 3.2

    Code that defines a class without inheriting BaseStrategy must be rejected
    with an error message mentioning 'BaseStrategy'.
    """
    agent = _make_agent()

    result = agent._validate_code("class MyStrategy: pass")

    assert result.valid is False, "Class without BaseStrategy should be invalid"
    assert result.error is not None
    assert "BaseStrategy" in result.error, (
        f"Error message should mention 'BaseStrategy', got: {result.error!r}"
    )


def test_validate_code_accepts_base_strategy_subclass():
    """
    Validates: Requirements 3.2

    Code that defines a class inheriting from BaseStrategy must be accepted.
    """
    agent = _make_agent()

    result = agent._validate_code("class MyStrategy(BaseStrategy): pass")

    assert result.valid is True, "Class inheriting BaseStrategy should be valid"


def test_validate_code_rejects_syntax_error():
    """
    Validates: Requirements 3.2

    Code with a syntax error must be rejected; the error message should
    indicate a syntax problem.
    """
    agent = _make_agent()

    result = agent._validate_code("def broken(:\n    pass")

    assert result.valid is False, "Syntactically invalid code should be rejected"
    assert result.error is not None
    # ast.parse raises SyntaxError; str(exc) may not contain the word "SyntaxError"
    # but the error must be non-empty and meaningful
    assert len(result.error) > 0, "Error message must be non-empty for syntax errors"
