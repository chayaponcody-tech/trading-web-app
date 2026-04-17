"""
Strategy Manager Router

Endpoints:
  GET  /strategies                    — list all strategies (filter: status, min_sharpe)
  GET  /strategies/{key}              — strategy detail
  POST /strategies/{key}/retire       — manually retire a strategy
  GET  /allocations                   — current capital allocations

Requirements: 10.3, 10.6
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from core.schemas import ApprovedStrategy, StrategyAllocation

router = APIRouter(tags=["strategies"])


def _get_manager(request: Request):
    loop = getattr(request.app.state, "loop", None)
    if loop is None:
        raise HTTPException(status_code=503, detail="Quant engine not initialised")
    return loop.strategy_manager


class RetireRequest(BaseModel):
    decay_metrics: dict = {}


@router.get("", response_model=list[ApprovedStrategy])
async def list_strategies(
    request: Request,
    status: str | None = Query(None, description="Filter by status: active, retired, decayed"),
    min_sharpe: float | None = Query(None, description="Minimum avg Sharpe ratio"),
) -> list[ApprovedStrategy]:
    """List all strategies, optionally filtered by status and/or minimum Sharpe."""
    manager = _get_manager(request)
    registry = manager._registry

    if status is not None:
        strategies = registry.list_by_status(status)
    elif min_sharpe is not None:
        strategies = registry.list_by_sharpe(min_sharpe)
    else:
        # Return all strategies across all statuses
        strategies = []
        for s in ("active", "retired", "decayed"):
            strategies.extend(registry.list_by_status(s))

    return strategies


@router.get("/allocations", response_model=list[StrategyAllocation])
async def get_allocations(
    request: Request,
    total_capital: float = Query(10000.0, description="Total capital in USDT"),
) -> list[StrategyAllocation]:
    """Return current volatility-adjusted capital allocations."""
    manager = _get_manager(request)
    allocations = manager.compute_allocations(total_capital)

    # Build StrategyAllocation objects with volatility info
    result: list[StrategyAllocation] = []
    for strategy_key, capital_usdt in allocations.items():
        vol = manager._compute_volatility(strategy_key)
        weight = capital_usdt / total_capital if total_capital > 0 else 0.0
        result.append(
            StrategyAllocation(
                strategy_key=strategy_key,
                weight=weight,
                capital_usdt=capital_usdt,
                volatility=vol,
            )
        )
    return result


@router.get("/{key}", response_model=ApprovedStrategy)
async def get_strategy(key: str, request: Request) -> ApprovedStrategy:
    """Return detail for a single strategy by its key."""
    manager = _get_manager(request)
    strategy = manager._registry.lookup(key)
    if strategy is None:
        raise HTTPException(
            status_code=404,
            detail=f"Strategy '{key}' not found",
        )
    return strategy


@router.post("/{key}/retire")
async def retire_strategy(key: str, body: RetireRequest, request: Request) -> dict:
    """Manually retire a strategy and trigger mutation."""
    manager = _get_manager(request)
    strategy = manager._registry.lookup(key)
    if strategy is None:
        raise HTTPException(
            status_code=404,
            detail=f"Strategy '{key}' not found",
        )
    await manager.retire_strategy(key, body.decay_metrics)
    return {"message": f"Strategy '{key}' retired successfully"}
