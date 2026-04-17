"""
Sentiment Agent Router

Endpoints:
  GET /sentiment/{symbol}          — latest Sentiment_Score
  GET /sentiment/{symbol}/history  — historical scores (query: from, to)

Requirements: 10.5, 10.6
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request

from core.schemas import SentimentResult

router = APIRouter(tags=["sentiment"])


def _get_agent(request: Request):
    loop = getattr(request.app.state, "loop", None)
    if loop is None:
        raise HTTPException(status_code=503, detail="Quant engine not initialised")
    return loop.sentiment_agent


@router.get("/{symbol}", response_model=SentimentResult)
async def get_latest_sentiment(symbol: str, request: Request) -> SentimentResult:
    """Return the most recent Sentiment_Score for *symbol*."""
    agent = _get_agent(request)
    result = await agent.get_latest(symbol.upper())
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"No sentiment data found for symbol '{symbol}'",
        )
    return result


@router.get("/{symbol}/history", response_model=list[SentimentResult])
async def get_sentiment_history(
    symbol: str,
    request: Request,
    from_ts: str = Query(..., alias="from", description="ISO 8601 start timestamp"),
    to_ts: str = Query(..., alias="to", description="ISO 8601 end timestamp"),
) -> list[SentimentResult]:
    """Return historical Sentiment_Scores for *symbol* within [from, to]."""
    agent = _get_agent(request)
    results = await agent.get_history(symbol.upper(), from_ts, to_ts)
    return results
