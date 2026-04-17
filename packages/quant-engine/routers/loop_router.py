"""
Evolutionary Loop Router

Endpoints:
  GET  /loop/status    — agent statuses (all agents)
  POST /loop/trigger   — manually trigger a generation cycle
  GET  /loop/history   — cycle history from DB

Requirements: 10.3
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from core.schemas import AgentStatus, CycleResult

router = APIRouter(tags=["loop"])


def _get_loop(request: Request):
    loop = getattr(request.app.state, "loop", None)
    if loop is None:
        raise HTTPException(status_code=503, detail="Quant engine not initialised")
    return loop


class TriggerRequest(BaseModel):
    topic: str = "momentum and mean-reversion hybrid strategy for crypto futures"


@router.get("/status")
async def get_loop_status(request: Request) -> dict:
    """Return current status of all agents in the evolutionary loop."""
    loop = _get_loop(request)
    statuses = loop.get_status()
    return {
        "agents": {name: s.model_dump() for name, s in statuses.items()}
    }


@router.post("/trigger", response_model=CycleResult)
async def trigger_generation_cycle(body: TriggerRequest, request: Request) -> CycleResult:
    """Manually trigger a full generation cycle (Alpha → Backtest → Strategy_Manager)."""
    loop = _get_loop(request)
    result = await loop.run_generation_cycle(body.topic)
    return result


@router.get("/history")
async def get_loop_history(request: Request) -> list[dict]:
    """
    Return recent cycle history.

    Reads from the cycle_history table if it exists, otherwise returns an
    empty list (table is created lazily on first cycle run).
    """
    loop = _get_loop(request)
    try:
        cursor = loop.db.execute(
            """
            SELECT cycle_id, started_at, completed_at,
                   strategies_generated, strategies_approved,
                   strategies_rejected, errors
            FROM cycle_history
            ORDER BY started_at DESC
            LIMIT 100
            """
        )
        rows = cursor.fetchall()
    except Exception:
        # Table may not exist yet
        return []

    import json
    return [
        {
            "cycle_id": row[0],
            "started_at": row[1],
            "completed_at": row[2],
            "strategies_generated": row[3],
            "strategies_approved": row[4],
            "strategies_rejected": row[5],
            "errors": json.loads(row[6]) if row[6] else [],
        }
        for row in rows
    ]
