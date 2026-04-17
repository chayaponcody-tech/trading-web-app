"""
Unit tests for EvolutionaryLoop (Req 10.2, 10.3, 10.7)
"""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock

import pytest

from core.evolutionary_loop import AgentRegistry, EvolutionaryLoop
from core.schemas import BacktestResult, GenerationResult


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _make_loop(
    alpha=None,
    backtest=None,
    strategy_manager=None,
    sentiment=None,
    data=None,
) -> EvolutionaryLoop:
    """Build an EvolutionaryLoop with mock agents and an in-memory DB stub."""
    agents = AgentRegistry(
        alpha_agent=alpha or AsyncMock(),
        backtest_agent=backtest or AsyncMock(),
        strategy_manager=strategy_manager or AsyncMock(),
        sentiment_agent=sentiment or AsyncMock(),
        data_agent=data or AsyncMock(),
    )
    db = MagicMock()
    return EvolutionaryLoop(agents=agents, db=db)


# ─── Test 1: Timeout handling (Req 10.2) ──────────────────────────────────────

@pytest.mark.asyncio
async def test_agent_timeout_marks_status_as_timeout():
    """
    When an agent coroutine hangs beyond the timeout, _call_with_timeout
    must set the agent's state to "timeout" and raise asyncio.TimeoutError.

    Validates: Requirements 10.2
    """
    loop = _make_loop()

    async def hanging_coro():
        await asyncio.sleep(100)

    with pytest.raises(asyncio.TimeoutError):
        await loop._call_with_timeout("alpha_agent", hanging_coro(), timeout=0.1)

    assert loop._agent_status["alpha_agent"].state == "timeout"


# ─── Test 2: Pipeline order Alpha → Backtest → Strategy_Manager (Req 10.3) ───

@pytest.mark.asyncio
async def test_pipeline_order_alpha_then_backtest_then_strategy_manager():
    """
    run_generation_cycle must call agents in strict order:
    alpha_agent → backtest_agent → strategy_manager.

    Validates: Requirements 10.3
    """
    call_order: list[str] = []

    async def mock_generate(*args, **kwargs):
        call_order.append("alpha")
        return GenerationResult(
            strategy_key="key",
            python_code="code",
            attempts=1,
            status="success",
            lineage_id="lid",
        )

    async def mock_evaluate(*args, **kwargs):
        call_order.append("backtest")
        return BacktestResult(
            strategy_key="key",
            approved=True,
            avg_sharpe=2.0,
            regime_results=[],
            metrics={"sharpe": 2.0},
            tested_at="2024-01-01",
        )

    async def mock_register(*args, **kwargs):
        call_order.append("strategy_manager")

    alpha = MagicMock()
    alpha.generate_strategy = mock_generate

    backtest = MagicMock()
    backtest.evaluate = mock_evaluate

    strategy_manager = MagicMock()
    strategy_manager.register_approved = mock_register

    loop = _make_loop(alpha=alpha, backtest=backtest, strategy_manager=strategy_manager)
    await loop.run_generation_cycle("momentum")

    assert call_order == ["alpha", "backtest", "strategy_manager"]


# ─── Test 3: Error log contains required fields (Req 10.7) ────────────────────

@pytest.mark.asyncio
async def test_error_log_contains_required_fields():
    """
    When an agent raises an exception, the error log entry appended to
    CycleResult.errors must contain: agent_name, timestamp, input_payload,
    error_type, cycle_id.

    Validates: Requirements 10.7
    """
    alpha = MagicMock()

    async def failing_generate(*args, **kwargs):
        raise RuntimeError("LLM unavailable")

    alpha.generate_strategy = failing_generate

    loop = _make_loop(alpha=alpha)
    result = await loop.run_generation_cycle("momentum")

    assert len(result.errors) == 1
    error = result.errors[0]

    required_fields = {"agent_name", "timestamp", "input_payload", "error_type", "cycle_id"}
    assert required_fields.issubset(error.keys()), (
        f"Missing fields: {required_fields - error.keys()}"
    )


# ─── Test 4: get_status returns all 5 agents (Req 10.3) ───────────────────────

def test_get_status_returns_all_agents():
    """
    get_status() must return a dict containing entries for all 5 agents.

    Validates: Requirements 10.3
    """
    loop = _make_loop()
    status = loop.get_status()

    expected_agents = {
        "alpha_agent",
        "backtest_agent",
        "strategy_manager",
        "sentiment_agent",
        "data_agent",
    }
    assert expected_agents == set(status.keys())
