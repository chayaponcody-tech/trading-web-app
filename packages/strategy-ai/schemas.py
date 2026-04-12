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
    atr_value: float | None = None   # ATR(14) in price units
    regime: str | None = None        # trending_up | trending_down | ranging | volatile


class BatchAnalyzeRequest(BaseModel):
    symbol: str
    strategy: str
    closes: list[float]
    highs: list[float]
    lows: list[float]
    volumes: list[float]
    params: dict = {}


class BatchAnalyzeResponse(BaseModel):
    signals: list[str]        # ["LONG", "NONE", "SHORT", ...]
    confidences: list[float]  # [0.72, 0.0, 0.65, ...]


class StrategyEntry(BaseModel):
    key: str
    engine: str


class StrategyListResponse(BaseModel):
    strategies: list[StrategyEntry]


class RegisterDynamicRequest(BaseModel):
    key: str
    python_code: str


class UnregisterRequest(BaseModel):
    key: str


class SavePineRequest(BaseModel):
    key: str
    python_code: str
    filename: str


class OptimizeRequest(BaseModel):
    strategy: str
    closes: list[float]
    highs: list[float]
    lows: list[float]
    volumes: list[float]
    search_space: dict   # e.g. {"rsiOversold": [20, 50], "rsiOverbought": [50, 80]}
    n_trials: int = 50


class OptimizeResponse(BaseModel):
    best_params: dict
    best_sharpe: float
    n_trials: int


class VbtOptimizeRequest(BaseModel):
    strategy: str
    closes: list[float]
    highs: list[float]
    lows: list[float]
    volumes: list[float]
    search_space: dict   # e.g. {"rsiOversold": [20, 50], "rsiOverbought": [50, 80]}
    n_trials: int = 50
    # VectorBT-specific options
    fees: float = 0.0004          # taker fee rate (0.04%)
    slippage: float = 0.0005      # slippage rate (0.05%)
    init_cash: float = 1000.0     # starting capital


class VbtOptimizeResponse(BaseModel):
    best_params: dict
    best_sharpe: float
    best_return: float            # total return % of best params
    best_max_drawdown: float      # max drawdown of best params
    n_trials: int
    engine: str = "vectorbt"
