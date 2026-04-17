"""
Data Agent Router

Endpoints:
  GET  /data/ohlcv/{symbol}   — query OHLCV data (query: interval, from, to)
  GET  /data/metadata         — ETL metadata for all symbols
  POST /data/etl/trigger      — manually trigger ETL for a symbol

Requirements: 10.5
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from core.schemas import ETLResult, OHLCVMetadata

router = APIRouter(tags=["data"])


def _get_agent(request: Request):
    loop = getattr(request.app.state, "loop", None)
    if loop is None:
        raise HTTPException(status_code=503, detail="Quant engine not initialised")
    return loop.data_agent


class ETLTriggerRequest(BaseModel):
    symbol: str
    interval: str = "15m"
    limit: int = 1000


@router.get("/ohlcv/{symbol}")
async def get_ohlcv(
    symbol: str,
    request: Request,
    interval: str = Query("15m", description="Kline interval, e.g. 15m, 1h"),
    from_ts: int | None = Query(None, alias="from", description="Start timestamp (ms)"),
    to_ts: int | None = Query(None, alias="to", description="End timestamp (ms)"),
) -> dict[str, Any]:
    """Return OHLCV data for *symbol* from Parquet storage."""
    agent = _get_agent(request)
    df = agent.read_ohlcv(symbol.upper(), interval, from_ts, to_ts)
    if df.empty:
        raise HTTPException(
            status_code=404,
            detail=f"No OHLCV data found for {symbol}/{interval}",
        )
    return {
        "symbol": symbol.upper(),
        "interval": interval,
        "rows": len(df),
        "data": df.to_dict(orient="records"),
    }


@router.get("/metadata", response_model=list[OHLCVMetadata])
async def get_metadata(request: Request) -> list[OHLCVMetadata]:
    """Return ETL metadata for all tracked symbols."""
    agent = _get_agent(request)
    cursor = agent.db.execute(
        "SELECT symbol, interval, last_updated, row_count, parquet_path FROM ohlcv_metadata"
    )
    rows = cursor.fetchall()
    return [
        OHLCVMetadata(
            symbol=row[0],
            interval=row[1],
            last_updated=row[2],
            row_count=row[3],
            parquet_path=row[4],
        )
        for row in rows
    ]


@router.post("/etl/trigger", response_model=ETLResult)
async def trigger_etl(body: ETLTriggerRequest, request: Request) -> ETLResult:
    """Manually trigger an ETL run for the given symbol."""
    agent = _get_agent(request)
    result = await agent.run_etl(
        body.symbol.upper(),
        body.interval,
        body.limit,
    )
    return result
