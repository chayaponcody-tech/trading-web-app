"""
Backtest Agent — Walk-Forward Approval Gate (Req 5)

Responsibilities:
- Run Walk-Forward Optimization via strategy-ai /strategy/optimize/vectorbt
- Test strategy across 3 market regimes: bull, bear, sideways
- Approve strategy when avg_sharpe > 1.5
- Persist results to backtest_results table (SQLite)
- Determinism invariant: same strategy + same data → same result
"""
from __future__ import annotations

import json
import logging
import sqlite3
import uuid
from datetime import datetime, timezone

import httpx
import pandas as pd

from agents.data_agent import DataAgent
from core.schemas import BacktestResult, RegimeResult

logger = logging.getLogger(__name__)

REGIMES = ("bull", "bear", "sideways")


class BacktestAgent:
    """Walk-Forward backtest agent with regime-aware evaluation."""

    def __init__(
        self,
        data_agent: DataAgent,
        strategy_ai_url: str,
        db: sqlite3.Connection,
    ) -> None:
        self.data_agent = data_agent
        self.strategy_ai_url = strategy_ai_url.rstrip("/")
        self.db = db
        self._ensure_table()

    # ──────────────────────────────────────────────────────────────────────────
    # Public interface
    # ──────────────────────────────────────────────────────────────────────────

    async def evaluate(
        self,
        strategy_key: str,
        python_code: str,  # noqa: ARG002  (reserved for future sandbox use)
        symbol: str = "BTCUSDT",
    ) -> BacktestResult:
        """
        Run walk-forward evaluation across 3 market regimes.

        1. Select regime-specific historical data
        2. Run walk-forward for each regime
        3. Compute avg_sharpe and identify worst_regime
        4. Approve if avg_sharpe > 1.5

        Determinism invariant: same strategy + same data → same result (Req 5.7)
        """
        regime_data = self._select_regime_data(symbol)

        regime_results: list[RegimeResult] = []
        for regime in REGIMES:
            ohlcv = regime_data[regime]
            wf = await self._run_walk_forward(strategy_key, ohlcv)
            regime_results.append(
                RegimeResult(
                    regime=regime,  # type: ignore[arg-type]
                    sharpe=wf.get("sharpe", 0.0),
                    max_drawdown=wf.get("max_drawdown", 0.0),
                    win_rate=wf.get("win_rate", 0.0),
                    total_trades=int(wf.get("total_trades", 0)),
                )
            )

        sharpes = [r.sharpe for r in regime_results]
        avg_sharpe = sum(sharpes) / len(sharpes) if sharpes else 0.0

        worst_regime_result = min(regime_results, key=lambda r: r.sharpe)
        worst_regime = worst_regime_result.regime

        approved = self._make_approval_decision(avg_sharpe)

        rejection_reason: str | None = None
        if not approved:
            rejection_reason = (
                f"avg_sharpe={avg_sharpe:.4f} ≤ 1.5; "
                f"worst_regime={worst_regime} (sharpe={worst_regime_result.sharpe:.4f})"
            )

        metrics = {
            "sharpe": avg_sharpe,
            "max_drawdown": max((r.max_drawdown for r in regime_results), default=0.0),
            "win_rate": (
                sum(r.win_rate for r in regime_results) / len(regime_results)
                if regime_results
                else 0.0
            ),
            "total_trades": float(sum(r.total_trades for r in regime_results)),
        }

        result = BacktestResult(
            strategy_key=strategy_key,
            approved=approved,
            avg_sharpe=avg_sharpe,
            regime_results=regime_results,
            rejection_reason=rejection_reason,
            worst_regime=worst_regime,
            metrics=metrics,
            tested_at=datetime.now(timezone.utc).isoformat(),
        )

        await self._save_result(result, symbol)
        return result

    # ──────────────────────────────────────────────────────────────────────────
    # Regime classification
    # ──────────────────────────────────────────────────────────────────────────

    def _classify_regime(self, ohlcv: pd.DataFrame) -> str:
        """
        Classify market regime from price trend.

        Compare first 20% vs last 20% of close prices:
        - last_avg > first_avg * 1.05  → "bull"
        - last_avg < first_avg * 0.95  → "bear"
        - otherwise                    → "sideways"
        """
        if ohlcv.empty or len(ohlcv) < 2:
            return "sideways"

        n = len(ohlcv)
        split = max(1, int(n * 0.2))

        first_avg = ohlcv["close"].iloc[:split].mean()
        last_avg = ohlcv["close"].iloc[-split:].mean()

        if first_avg == 0:
            return "sideways"

        if last_avg > first_avg * 1.05:
            return "bull"
        if last_avg < first_avg * 0.95:
            return "bear"
        return "sideways"

    # ──────────────────────────────────────────────────────────────────────────
    # Regime data selection
    # ──────────────────────────────────────────────────────────────────────────

    def _select_regime_data(self, symbol: str) -> dict[str, pd.DataFrame]:
        """
        Read all available OHLCV data, split into chunks, classify each chunk,
        and return a dict with DataFrames for each regime.

        Falls back to the full dataset for any regime with no matching chunks.
        """
        full_df = self.data_agent.read_ohlcv(symbol, "15m")

        regime_frames: dict[str, list[pd.DataFrame]] = {r: [] for r in REGIMES}

        if not full_df.empty:
            n = len(full_df)
            # Use chunks of ~20% of total data (at least 1 row)
            chunk_size = max(1, n // 5)
            for start in range(0, n, chunk_size):
                chunk = full_df.iloc[start : start + chunk_size].reset_index(drop=True)
                regime = self._classify_regime(chunk)
                regime_frames[regime].append(chunk)

        result: dict[str, pd.DataFrame] = {}
        for regime in REGIMES:
            frames = regime_frames[regime]
            if frames:
                result[regime] = pd.concat(frames, ignore_index=True)
            else:
                # Fallback: use full dataset
                result[regime] = full_df.copy() if not full_df.empty else pd.DataFrame()

        return result

    # ──────────────────────────────────────────────────────────────────────────
    # Approval decision (pure function — Req 5.7 determinism)
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _make_approval_decision(avg_sharpe: float) -> bool:
        """Pure function: sharpe > 1.5 → True, otherwise False."""
        return avg_sharpe > 1.5

    # ──────────────────────────────────────────────────────────────────────────
    # Walk-forward via strategy-ai
    # ──────────────────────────────────────────────────────────────────────────

    async def _run_walk_forward(
        self,
        strategy_key: str,
        ohlcv: pd.DataFrame,
    ) -> dict:
        """
        POST to {strategy_ai_url}/strategy/optimize/vectorbt.

        Payload: {"strategy_key": strategy_key, "ohlcv": [...records...]}
        Returns dict with sharpe, max_drawdown, win_rate, total_trades.
        On error returns zeroed metrics.
        """
        if ohlcv.empty:
            logger.warning("Empty OHLCV for strategy %s — returning zero metrics", strategy_key)
            return {"sharpe": 0.0, "max_drawdown": 0.0, "win_rate": 0.0, "total_trades": 0}

        payload = {
            "strategy_key": strategy_key,
            "ohlcv": ohlcv.to_dict(orient="records"),
        }

        url = f"{self.strategy_ai_url}/strategy/optimize/vectorbt"
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
                return {
                    "sharpe": float(data.get("sharpe", 0.0)),
                    "max_drawdown": float(data.get("max_drawdown", 0.0)),
                    "win_rate": float(data.get("win_rate", 0.0)),
                    "total_trades": int(data.get("total_trades", 0)),
                }
        except Exception as exc:
            logger.error("Walk-forward failed for %s: %s", strategy_key, exc)
            return {"sharpe": 0.0, "max_drawdown": 0.0, "win_rate": 0.0, "total_trades": 0}

    # ──────────────────────────────────────────────────────────────────────────
    # Persistence
    # ──────────────────────────────────────────────────────────────────────────

    async def _save_result(self, result: BacktestResult, symbol: str) -> None:
        """
        Persist backtest result to backtest_results table.

        Schema:
            backtestId TEXT PRIMARY KEY,
            symbol     TEXT NOT NULL,
            strategy   TEXT NOT NULL,
            interval   TEXT NOT NULL,
            config     TEXT NOT NULL,
            metrics    TEXT NOT NULL,
            createdAt  TEXT NOT NULL
        """
        backtest_id = str(uuid.uuid4())

        config = {
            "approved": result.approved,
            "avg_sharpe": result.avg_sharpe,
            "worst_regime": result.worst_regime,
            "rejection_reason": result.rejection_reason,
            "regime_results": [r.model_dump() for r in result.regime_results],
        }

        metrics = result.metrics.copy()

        try:
            cursor = self.db.cursor()
            cursor.execute(
                """
                INSERT INTO backtest_results
                    (backtestId, symbol, strategy, interval, config, metrics, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    backtest_id,
                    symbol,
                    result.strategy_key,
                    "15m",
                    json.dumps(config),
                    json.dumps(metrics),
                    result.tested_at,
                ),
            )
            self.db.commit()
            logger.debug(
                "Saved backtest result %s for strategy %s (approved=%s)",
                backtest_id,
                result.strategy_key,
                result.approved,
            )
        except Exception as exc:
            logger.error("Failed to save backtest result: %s", exc)

    # ──────────────────────────────────────────────────────────────────────────
    # Schema bootstrap
    # ──────────────────────────────────────────────────────────────────────────

    def _ensure_table(self) -> None:
        """Create backtest_results table if it doesn't exist."""
        self.db.execute(
            """
            CREATE TABLE IF NOT EXISTS backtest_results (
                backtestId TEXT PRIMARY KEY,
                symbol     TEXT NOT NULL,
                strategy   TEXT NOT NULL,
                interval   TEXT NOT NULL,
                config     TEXT NOT NULL,
                metrics    TEXT NOT NULL,
                createdAt  TEXT NOT NULL
            )
            """
        )
        self.db.commit()
