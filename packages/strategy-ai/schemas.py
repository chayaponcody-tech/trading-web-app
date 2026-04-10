from pydantic import BaseModel, field_validator
from typing import Optional


class AnalyzeRequest(BaseModel):
    symbol: str
    strategy: str                    # registry key e.g. "bb_breakout"
    closes: list[float]
    highs: list[float]
    lows: list[float]
    volumes: list[float]
    params: dict = {}
    # ── Microstructure context (optional, sent by JS before entry) ──
    signal: Optional[str] = None          # JS pre-computed signal hint
    funding_rate: Optional[float] = None  # lastFundingRate from exchange
    oi_change_pct: Optional[float] = None # % change in OI vs previous period
    funding_threshold: Optional[float] = 0.0005  # configurable per bot

    @field_validator("closes")
    @classmethod
    def closes_min_length(cls, v):
        if len(v) < 2:
            raise ValueError("closes must have at least 2 elements")
        return v


class AnalyzeResponse(BaseModel):
    symbol: str
    signal: str                      # "LONG" | "SHORT" | "NONE"
    confidence: float
    stoploss: float | None
    reason: str
    metadata: dict
    strategy: str
    microstructure: dict = {}        # funding/OI check details


class StrategyListResponse(BaseModel):
    strategies: list[str]
