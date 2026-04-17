"""
Backtest Agent Router

Endpoints:
  POST /backtest/evaluate                    — submit strategy for evaluation
  GET  /backtest/results/{strategy_key}      — query backtest history

Requirements: 10.3
"""
from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from core.schemas import BacktestResult

router = APIRouter(tags=["backtest"])


def _get_agent(request: Request):
    loop = getattr(request.app.state, "loop", None)
    if loop is None:
        raise HTTPException(status_code=503, detail="Quant engine not initialised")
    return loop.backtest_agent


class EvaluateRequest(BaseModel):
    strategy_key: str
    python_code: str
    symbol: str = "BTCUSDT"


@router.post("/evaluate", response_model=BacktestResult)
async def evaluate_strategy(body: EvaluateRequest, request: Request) -> BacktestResult:
    """Run walk-forward backtest evaluation for the given strategy."""
    agent = _get_agent(request)
    result = await agent.evaluate(body.strategy_key, body.python_code, body.symbol)
    return result


@router.get("/results/{strategy_key}")
async def get_backtest_results(strategy_key: str, request: Request) -> list[dict]:
    """Return all backtest results for the given strategy_key."""
    agent = _get_agent(request)
    cursor = agent.db.execute(
        """
        SELECT backtestId, symbol, strategy, interval, config, metrics, createdAt
        FROM backtest_results
        WHERE strategy = ?
        ORDER BY createdAt DESC
        """,
        (strategy_key,),
    )
    rows = cursor.fetchall()
    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"No backtest results found for strategy '{strategy_key}'",
        )
    return [
        {
            "backtest_id": row[0],
            "symbol": row[1],
            "strategy_key": row[2],
            "interval": row[3],
            "config": json.loads(row[4]),
            "metrics": json.loads(row[5]),
            "created_at": row[6],
        }
        for row in rows
    ]
