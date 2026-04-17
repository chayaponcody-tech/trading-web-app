"""
Tests for Sentiment Agent (Req 1)

Validates: Requirements 1.2, 1.7, 11.1
"""
import math

import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st

from agents.sentiment_agent import SentimentAgent


# ─── Property 1: Sentiment Score Invariant ───────────────────────────────────
# Validates: Requirements 1.2, 1.7, 11.1


@given(
    funding_rate=st.floats(min_value=-0.01, max_value=0.01),
    oi_change_pct=st.floats(min_value=-50.0, max_value=50.0),
)
@settings(max_examples=200)
def test_sentiment_score_invariant(funding_rate: float, oi_change_pct: float) -> None:
    """
    **Property 1: Sentiment Score Invariant**
    **Validates: Requirements 1.2, 1.7, 11.1**

    For any finite (funding_rate, oi_change_pct) within the expected input range,
    _calculate_score() must return a value in [0.0, 100.0].
    """
    assume(not math.isnan(funding_rate))
    assume(not math.isnan(oi_change_pct))

    # Create a minimal instance without calling __init__ (no DB/HTTP deps needed)
    agent = SentimentAgent.__new__(SentimentAgent)
    score = agent._calculate_score(funding_rate, oi_change_pct)

    assert 0.0 <= score <= 100.0, (
        f"Score {score} out of [0, 100] for "
        f"funding_rate={funding_rate}, oi_change_pct={oi_change_pct}"
    )


# ─── Property 10: Sentiment Score Idempotence ────────────────────────────────
# Validates: Requirements 11.10


@given(
    funding_rate=st.floats(min_value=-0.01, max_value=0.01),
    oi_change_pct=st.floats(min_value=-50.0, max_value=50.0),
)
@settings(max_examples=200)
def test_sentiment_score_idempotence(funding_rate: float, oi_change_pct: float) -> None:
    """
    **Property 10: Sentiment Score Idempotence**
    **Validates: Requirements 11.10**

    Calling _calculate_score() twice with the same inputs must return
    exactly the same float value — the function is pure and deterministic.
    """
    assume(not math.isnan(funding_rate))
    assume(not math.isnan(oi_change_pct))

    agent = SentimentAgent.__new__(SentimentAgent)
    score_first = agent._calculate_score(funding_rate, oi_change_pct)
    score_second = agent._calculate_score(funding_rate, oi_change_pct)

    assert score_first == score_second, (
        f"Idempotence violated: first={score_first}, second={score_second} "
        f"for funding_rate={funding_rate}, oi_change_pct={oi_change_pct}"
    )


# ─── Unit Tests: Boundary Conditions & API Failure Fallback ──────────────────
# Validates: Requirements 1.3, 1.4, 1.6


def test_high_funding_rate_gives_bearish_score() -> None:
    """
    FR = +0.002 (0.2%) → contrarian logic → score < 40 (bearish signal).
    Validates: Requirements 1.3, 1.4
    """
    agent = SentimentAgent.__new__(SentimentAgent)
    score = agent._calculate_score(funding_rate=0.002, oi_change_pct=0.0)
    assert score < 40, f"Expected score < 40 for high FR, got {score}"


def test_low_funding_rate_gives_bullish_score() -> None:
    """
    FR = -0.002 (-0.2%) → contrarian logic → score > 60 (bullish signal).
    Validates: Requirements 1.3, 1.4
    """
    agent = SentimentAgent.__new__(SentimentAgent)
    score = agent._calculate_score(funding_rate=-0.002, oi_change_pct=0.0)
    assert score > 60, f"Expected score > 60 for low FR, got {score}"


def test_neutral_inputs_give_neutral_score() -> None:
    """
    FR = 0.0, OI change = 0.0 → score == 50.0 (perfectly neutral).
    Validates: Requirements 1.3, 1.4
    """
    agent = SentimentAgent.__new__(SentimentAgent)
    score = agent._calculate_score(funding_rate=0.0, oi_change_pct=0.0)
    assert score == 50.0, f"Expected score == 50.0 for neutral inputs, got {score}"


@pytest.mark.asyncio
async def test_api_failure_returns_fallback_score() -> None:
    """
    When the Binance API raises an exception, compute_score must return score=50.0.
    Validates: Requirements 1.6
    """
    from unittest.mock import AsyncMock, MagicMock

    mock_client = AsyncMock()
    mock_client.get.side_effect = Exception("Connection refused")
    mock_db = MagicMock()

    agent = SentimentAgent(mock_client, mock_db)
    result = await agent.compute_score("BTCUSDT")

    assert result.score == 50.0
    assert result.symbol == "BTCUSDT"
