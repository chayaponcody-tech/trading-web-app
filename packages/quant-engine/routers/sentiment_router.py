"""
Sentiment Agent Router

Endpoints:
  GET /sentiment/{symbol}          — latest Sentiment_Score
  GET /sentiment/{symbol}/history  — historical scores (query: from, to)

Requirements: 10.5, 10.6
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request

from core.schemas import SentimentResult, NewsResult

router = APIRouter(tags=["sentiment"])


def _get_agent(request: Request):
    loop = getattr(request.app.state, "loop", None)
    if loop is None:
        raise HTTPException(status_code=503, detail="Quant engine not initialised")
    return loop.sentiment_agent


@router.get("/news", response_model=list[NewsResult])
async def get_sentiment_news(request: Request, limit: int = 15):
    """Return stored sentiment news."""
    agent = _get_agent(request)
    return await agent.get_stored_news(limit=limit)


@router.post("/news/refresh")
async def refresh_sentiment_news(request: Request, use_ai: bool = Query(True), symbol: str = Query("BTCUSDT")):
    """Trigger a news scrape and AI analysis job with sector awareness."""
    agent = _get_agent(request)
    new_items = await agent.fetch_latest_news(use_ai=use_ai, symbol=symbol)
    return {"status": "success", "new_items_count": len(new_items)}


@router.get("/status")
async def get_sentiment_job_status(request: Request):
    """Check if the internal sentiment job is paused or active."""
    scheduler = getattr(request.app.state, "scheduler", None)
    if not scheduler:
        return {"status": "inactive"}
    
    job = scheduler.get_job("sentiment_job")
    if not job:
        return {"status": "not_scheduled"}
    
    return {"status": "active" if job.next_run_time else "paused"}


@router.post("/toggle")
async def toggle_sentiment_job(request: Request):
    """Pause or resume the automated sentiment worker."""
    scheduler = getattr(request.app.state, "scheduler", None)
    if not scheduler:
        raise HTTPException(status_code=503, detail="Scheduler not initialized")
    
    job = scheduler.get_job("sentiment_job")
    if not job:
        raise HTTPException(status_code=404, detail="Sentiment job not found")
    
    if job.next_run_time:
        job.pause()
        return {"status": "paused"}
    else:
        job.resume()
        return {"status": "active"}


@router.get("/metadata/{symbol}")
async def get_symbol_metadata(symbol: str, request: Request):
    """Return category and tags for a symbol."""
    agent = _get_agent(request)
    cursor = agent._db.execute(
        "SELECT category, tags, custom_instructions FROM sentiment_symbol_metadata WHERE symbol = ?", 
        (symbol.upper(),)
    )
    row = cursor.fetchone()
    if not row:
        return {"category": "General Crypto", "tags": "", "custom_instructions": ""}
    return {
        "category": row[0],
        "tags": row[1],
        "instructions": row[2]
    }


@router.post("/{symbol}/backfill")
async def manual_backfill(symbol: str, request: Request, limit: int = Query(100)):
    """Manually trigger a backfill for a specific symbol."""
    agent = _get_agent(request)
    symbol_upper = symbol.upper()
    count = await agent.backfill_history(symbol_upper, limit=limit)
    return {"status": "success", "symbol": symbol_upper, "records_added": count}


@router.get("/{symbol}", response_model=SentimentResult)
async def get_latest_sentiment(symbol: str, request: Request) -> SentimentResult:
    """Return the most recent Sentiment_Score for *symbol*. If not found, compute it immediately."""
    agent = _get_agent(request)
    symbol_upper = symbol.upper()
    result = await agent.get_latest(symbol_upper)
    
    if result is None:
        # On-demand computation + Backfill for new symbols
        try:
            from fastapi.logger import logger
            logger.info("New symbol detected: %s. Starting backfill and initial compute.", symbol_upper)
            # 1. Trigger backfill in background (or wait for it here to be sure)
            await agent.backfill_history(symbol_upper)
            # 2. Compute latest
            computed = await agent.compute_score(symbol_upper)
            await agent.save_score(computed)
            return computed
        except Exception as e:
            raise HTTPException(
                status_code=404,
                detail=f"Failed to compute sentiment for '{symbol_upper}': {str(e)}",
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
    symbol_upper = symbol.upper()
    results = await agent.get_history(symbol_upper, from_ts, to_ts)
    
    # If history is missing or very sparse, try to backfill
    if len(results) < 10:
        try:
            from fastapi.logger import logger
            logger.info("Sparse history for %s. Triggering backfill.", symbol_upper)
            await agent.backfill_history(symbol_upper)
            # Re-fetch after backfill
            results = await agent.get_history(symbol_upper, from_ts, to_ts)
        except Exception as e:
            logger.error("Backfill failed in history route: %s", e)
            
    return results
