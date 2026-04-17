"""
Alpha Agent Router

Endpoints:
  POST /alpha/generate  — trigger strategy generation
  POST /alpha/mutate    — trigger strategy mutation
  GET  /alpha/status    — generation queue / agent status

Requirements: 10.3
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from core.schemas import GenerationResult

router = APIRouter(tags=["alpha"])


def _get_agent(request: Request):
    loop = getattr(request.app.state, "loop", None)
    if loop is None:
        raise HTTPException(status_code=503, detail="Quant engine not initialised")
    return loop.alpha_agent


def _get_loop(request: Request):
    loop = getattr(request.app.state, "loop", None)
    if loop is None:
        raise HTTPException(status_code=503, detail="Quant engine not initialised")
    return loop


class GenerateRequest(BaseModel):
    topic: str
    context: dict = {}


class MutateRequest(BaseModel):
    original_code: str
    metrics: dict
    failure_reason: str
    lineage_id: str


@router.post("/generate", response_model=GenerationResult)
async def generate_strategy(body: GenerateRequest, request: Request) -> GenerationResult:
    """Trigger LLM-based strategy generation for the given research topic."""
    agent = _get_agent(request)
    result = await agent.generate_strategy(body.topic, body.context)
    return result


@router.post("/mutate", response_model=GenerationResult)
async def mutate_strategy(body: MutateRequest, request: Request) -> GenerationResult:
    """Trigger mutation of an existing strategy using its failure context."""
    agent = _get_agent(request)
    result = await agent.mutate_strategy(
        body.original_code,
        body.metrics,
        body.failure_reason,
        body.lineage_id,
    )
    return result


@router.get("/status")
async def get_alpha_status(request: Request) -> dict:
    """Return the current status of the Alpha Agent."""
    loop = _get_loop(request)
    statuses = loop.get_status()
    alpha_status = statuses.get("alpha_agent")
    return {
        "agent": "alpha_agent",
        "status": alpha_status.model_dump() if alpha_status else {"state": "unknown"},
    }
