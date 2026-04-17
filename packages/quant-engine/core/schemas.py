"""
Pydantic schemas for the Evolutionary Quant System.
"""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel


# ─── Sentiment ────────────────────────────────────────────────────────────────

class SentimentResult(BaseModel):
    symbol: str
    score: float                    # [0.0, 100.0]
    funding_rate: float
    oi_change_pct: float
    timestamp: str                  # ISO 8601
    components: dict[str, float]    # {"funding_component": x, "oi_component": y}


# ─── OHLCV ────────────────────────────────────────────────────────────────────

class OHLCVMetadata(BaseModel):
    symbol: str
    interval: str
    last_updated: str
    row_count: int
    parquet_path: str


class ETLResult(BaseModel):
    symbol: str
    interval: str
    rows_written: int
    last_updated: str
    success: bool
    error: str | None = None


# ─── Alpha Generation ─────────────────────────────────────────────────────────

class GenerationResult(BaseModel):
    strategy_key: str
    python_code: str
    attempts: int                   # <= 5
    status: Literal["success", "generation_failed"]
    lineage_id: str                 # UUID


class ValidationResult(BaseModel):
    valid: bool
    error: str | None = None
    class_name: str | None = None


class SandboxResult(BaseModel):
    success: bool
    output: Any | None = None
    error: str | None = None
    execution_time_ms: float = 0.0


# ─── Backtest ─────────────────────────────────────────────────────────────────

class RegimeResult(BaseModel):
    regime: Literal["bull", "bear", "sideways"]
    sharpe: float
    max_drawdown: float
    win_rate: float
    total_trades: int


class BacktestResult(BaseModel):
    strategy_key: str
    approved: bool
    avg_sharpe: float
    regime_results: list[RegimeResult]
    rejection_reason: str | None = None
    worst_regime: str | None = None
    metrics: dict[str, float]
    tested_at: str


# ─── Strategy Registry ────────────────────────────────────────────────────────

class ApprovedStrategy(BaseModel):
    strategy_key: str
    python_code: str
    backtest_metrics: dict[str, float]
    approved_at: str
    status: Literal["active", "retired", "decayed"] = "active"
    lineage_id: str
    mutation_count: int = 0
    bot_id: str | None = None
    updated_at: str


class StrategyAllocation(BaseModel):
    strategy_key: str
    weight: float                   # [0.0, 1.0]
    capital_usdt: float
    volatility: float


# ─── Alpha Decay ──────────────────────────────────────────────────────────────

class DecayMetrics(BaseModel):
    consecutive_losses: int
    rolling_sharpe_30d: float
    max_drawdown_7d: float
    decay_score: float              # [0.0, 100.0]


class DecayEvent(BaseModel):
    strategy_key: str
    decay_score: float
    metrics: DecayMetrics
    timestamp: str
    action: Literal["retired", "mutation_triggered"]


# ─── Orchestration ────────────────────────────────────────────────────────────

class AgentStatus(BaseModel):
    name: str
    state: Literal["idle", "running", "error", "timeout"]
    last_run: str | None = None
    last_error: str | None = None


class CycleResult(BaseModel):
    cycle_id: str
    started_at: str
    completed_at: str
    strategies_generated: int
    strategies_approved: int
    strategies_rejected: int
    errors: list[dict]
