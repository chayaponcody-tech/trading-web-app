"""
Strategy Manager — Registry + Allocation + Decay (Req 6, 7, 8)

Responsibilities:
  - register_approved: idempotent upsert via StrategyRegistry
  - compute_allocations: inverse volatility weighting
  - _compute_volatility: std of daily returns from trades table
  - compute_decay_score: composite Alpha_Decay_Score formula
  - check_alpha_decay: evaluate all active strategies, trigger on consecutive_losses >= 5
  - retire_strategy: mark decayed, stop bot, save event, send to Alpha_Agent
  - get_active_strategies: query approved_strategies table
"""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

import httpx

from core.registry import StrategyRegistry
from core.schemas import ApprovedStrategy, DecayEvent, DecayMetrics

if TYPE_CHECKING:
    from agents.alpha_agent import AlphaAgent


class StrategyManager:
    """
    Manages the portfolio of approved trading strategies.

    Parameters
    ----------
    db:
        Open sqlite3.Connection to the shared trading_app.db.
    backend_url:
        Base URL of the backend service (e.g. "http://backend:4001").
    strategy_ai_url:
        Base URL of the strategy-ai service (e.g. "http://strategy-ai:8001").
    alpha_agent:
        AlphaAgent instance used to trigger mutation on decayed strategies.
    """

    # Alpha_Decay_Score threshold — score > 70 triggers decay
    DECAY_THRESHOLD = 70.0
    # Immediate trigger: consecutive losses >= 5
    IMMEDIATE_LOSS_TRIGGER = 5

    def __init__(
        self,
        db: sqlite3.Connection,
        backend_url: str,
        strategy_ai_url: str,
        alpha_agent: "AlphaAgent",
    ) -> None:
        self.db = db
        self.backend_url = backend_url.rstrip("/")
        self.strategy_ai_url = strategy_ai_url.rstrip("/")
        self.alpha_agent = alpha_agent
        self._registry = StrategyRegistry(db)

    # ------------------------------------------------------------------ #
    # Registry                                                             #
    # ------------------------------------------------------------------ #

    async def register_approved(
        self,
        strategy_key: str,
        python_code: str,
        metrics: dict,
    ) -> None:
        """
        Idempotent upsert of an approved strategy into the registry.

        Round-trip invariant: register(s) → lookup(s.key) ≡ s  (Req 6.5)
        Idempotence: duplicate strategy_key updates instead of inserting (Req 6.6)
        """
        now = datetime.now(timezone.utc).isoformat()

        # Check if already registered so we can preserve lineage_id / mutation_count
        existing = self._registry.lookup(strategy_key)
        if existing is not None:
            strategy = ApprovedStrategy(
                strategy_key=strategy_key,
                python_code=python_code,
                backtest_metrics=metrics,
                approved_at=existing.approved_at,
                status=existing.status,
                lineage_id=existing.lineage_id,
                mutation_count=existing.mutation_count,
                bot_id=existing.bot_id,
                updated_at=now,
            )
        else:
            import uuid
            # Deploy a live bot for the newly approved strategy
            bot_id = await self._deploy_bot(strategy_key, python_code, metrics)
            strategy = ApprovedStrategy(
                strategy_key=strategy_key,
                python_code=python_code,
                backtest_metrics=metrics,
                approved_at=now,
                status="active",
                lineage_id=str(uuid.uuid4()),
                mutation_count=0,
                bot_id=bot_id,
                updated_at=now,
            )

        self._registry.register(strategy)

    # ------------------------------------------------------------------ #
    # Capital Allocation                                                   #
    # ------------------------------------------------------------------ #

    def compute_allocations(self, total_capital: float) -> dict[str, float]:
        """
        Compute capital allocations using inverse volatility weighting.

        weight_i = (1/vol_i) / sum(1/vol_j for all j)

        For vol == 0: use minimum_weight = 0.01 (1%) of total_capital.

        Budget invariant: sum(allocations.values()) <= total_capital  (Req 7.5)
        Symmetry invariant: equal volatility → equal allocation  (Req 7.6, 11.9)

        Returns
        -------
        dict[strategy_key, capital_usdt]
        """
        strategies = self._registry.list_by_status("active")
        if not strategies:
            return {}

        MIN_WEIGHT = 0.01  # 1% minimum for zero-volatility strategies
        # Treat any vol below this threshold as effectively zero to avoid
        # division overflow (inf) from subnormal / near-zero floats.
        VOL_THRESHOLD = 1e-10

        # Compute volatility for each strategy
        vols: dict[str, float] = {}
        for s in strategies:
            vols[s.strategy_key] = self._compute_volatility(s.strategy_key)

        # Separate zero-vol and non-zero-vol strategies
        zero_vol_keys = [k for k, v in vols.items() if v < VOL_THRESHOLD]
        nonzero_vol_keys = [k for k, v in vols.items() if v >= VOL_THRESHOLD]

        # Assign minimum weight to zero-vol strategies
        zero_vol_total_weight = len(zero_vol_keys) * MIN_WEIGHT

        # Remaining weight budget for non-zero-vol strategies
        remaining_weight = max(1.0 - zero_vol_total_weight, 0.0)

        weights: dict[str, float] = {}

        # Assign minimum weight to zero-vol strategies
        for k in zero_vol_keys:
            weights[k] = MIN_WEIGHT

        # Inverse volatility weighting for non-zero-vol strategies
        if nonzero_vol_keys:
            inv_vols = {k: 1.0 / vols[k] for k in nonzero_vol_keys}
            total_inv_vol = sum(inv_vols.values())
            for k in nonzero_vol_keys:
                weights[k] = (inv_vols[k] / total_inv_vol) * remaining_weight

        # Convert weights to capital amounts
        # Budget invariant: sum <= total_capital
        allocations: dict[str, float] = {
            k: w * total_capital for k, w in weights.items()
        }

        return allocations

    def _compute_volatility(
        self, strategy_key: str, lookback_days: int = 30
    ) -> float:
        """
        Compute the standard deviation of daily returns for a strategy.

        Queries the trades table for the strategy's trade history over
        the last *lookback_days* days, aggregates PnL by day, and returns
        the std of daily returns.

        Returns 0.0 if there are no trades.  (Req 7.1)
        """
        try:
            # Compute the cutoff timestamp (ISO 8601 string)
            from datetime import timedelta
            cutoff = (
                datetime.now(timezone.utc) - timedelta(days=lookback_days)
            ).isoformat()

            rows = self.db.execute(
                """
                SELECT DATE(created_at) AS trade_date,
                       SUM(pnl)         AS daily_pnl
                FROM   trades
                WHERE  strategy_key = ?
                  AND  created_at   >= ?
                GROUP  BY DATE(created_at)
                ORDER  BY trade_date ASC
                """,
                (strategy_key, cutoff),
            ).fetchall()

            if not rows or len(rows) < 2:
                return 0.0

            daily_pnls = [row[1] for row in rows]

            # Standard deviation of daily PnL (population std via statistics)
            import statistics
            return statistics.stdev(daily_pnls)

        except Exception:
            return 0.0

    # ------------------------------------------------------------------ #
    # Alpha Decay                                                          #
    # ------------------------------------------------------------------ #

    def compute_decay_score(
        self,
        consecutive_losses: int,
        rolling_sharpe_30d: float,
        max_drawdown_7d: float,
    ) -> float:
        """
        Composite Alpha_Decay_Score formula (Req 8.1, 8.6, 8.7):

            loss_score     = min(consecutive_losses / 10.0, 1.0) × 40
            sharpe_score   = clamp((1.5 - rolling_sharpe_30d) / 3.0, 0, 1) × 40
            drawdown_score = clamp(max_drawdown_7d / 0.20, 0, 1) × 20

            Alpha_Decay_Score = loss_score + sharpe_score + drawdown_score

        Invariant: return value ∈ [0.0, 100.0]
        Monotonic: more consecutive_losses → score does not decrease
        """
        loss_score = min(consecutive_losses / 10.0, 1.0) * 40.0

        sharpe_raw = (1.5 - rolling_sharpe_30d) / 3.0
        sharpe_clamped = max(0.0, min(1.0, sharpe_raw))
        sharpe_score = sharpe_clamped * 40.0

        drawdown_raw = max_drawdown_7d / 0.20
        drawdown_clamped = max(0.0, min(1.0, drawdown_raw))
        drawdown_score = drawdown_clamped * 20.0

        score = loss_score + sharpe_score + drawdown_score
        # Clamp to [0, 100] as a safety net
        return max(0.0, min(100.0, score))

    async def check_alpha_decay(self) -> list[str]:
        """
        Evaluate Alpha_Decay_Score for every active strategy.

        Triggers immediately when consecutive_losses >= IMMEDIATE_LOSS_TRIGGER (5).
        Also triggers when decay_score > DECAY_THRESHOLD (70).

        Returns list of strategy_keys that were decayed.  (Req 8.1–8.5)
        """
        strategies = await self.get_active_strategies()
        decayed_keys: list[str] = []

        for strategy in strategies:
            metrics = self._fetch_decay_metrics(strategy.strategy_key)
            consecutive_losses = metrics["consecutive_losses"]
            rolling_sharpe_30d = metrics["rolling_sharpe_30d"]
            max_drawdown_7d = metrics["max_drawdown_7d"]

            decay_score = self.compute_decay_score(
                consecutive_losses, rolling_sharpe_30d, max_drawdown_7d
            )

            # Immediate trigger: consecutive_losses >= 5
            should_decay = (
                consecutive_losses >= self.IMMEDIATE_LOSS_TRIGGER
                or decay_score > self.DECAY_THRESHOLD
            )

            if should_decay:
                decay_metrics = {
                    "consecutive_losses": consecutive_losses,
                    "rolling_sharpe_30d": rolling_sharpe_30d,
                    "max_drawdown_7d": max_drawdown_7d,
                    "decay_score": decay_score,
                }
                await self.retire_strategy(strategy.strategy_key, decay_metrics)
                decayed_keys.append(strategy.strategy_key)

        return decayed_keys

    def _fetch_decay_metrics(self, strategy_key: str) -> dict[str, Any]:
        """
        Fetch recent trade data to compute decay metrics for a strategy.

        Returns a dict with:
          - consecutive_losses: int
          - rolling_sharpe_30d: float
          - max_drawdown_7d: float
        """
        try:
            from datetime import timedelta

            now = datetime.now(timezone.utc)
            cutoff_30d = (now - timedelta(days=30)).isoformat()
            cutoff_7d = (now - timedelta(days=7)).isoformat()

            # ── Consecutive losses (most recent trades, ordered desc) ──────
            recent_trades = self.db.execute(
                """
                SELECT pnl FROM trades
                WHERE  strategy_key = ?
                ORDER  BY created_at DESC
                LIMIT  50
                """,
                (strategy_key,),
            ).fetchall()

            consecutive_losses = 0
            for row in recent_trades:
                if row[0] < 0:
                    consecutive_losses += 1
                else:
                    break

            # ── Rolling Sharpe 30d ────────────────────────────────────────
            rows_30d = self.db.execute(
                """
                SELECT DATE(created_at) AS trade_date,
                       SUM(pnl)         AS daily_pnl
                FROM   trades
                WHERE  strategy_key = ?
                  AND  created_at   >= ?
                GROUP  BY DATE(created_at)
                ORDER  BY trade_date ASC
                """,
                (strategy_key, cutoff_30d),
            ).fetchall()

            rolling_sharpe_30d = 0.0
            if len(rows_30d) >= 2:
                import statistics
                daily_pnls = [r[1] for r in rows_30d]
                mean_pnl = statistics.mean(daily_pnls)
                std_pnl = statistics.stdev(daily_pnls)
                if std_pnl > 0:
                    # Annualised Sharpe (daily → annualised with sqrt(252))
                    import math
                    rolling_sharpe_30d = (mean_pnl / std_pnl) * math.sqrt(252)

            # ── Max drawdown 7d ───────────────────────────────────────────
            rows_7d = self.db.execute(
                """
                SELECT pnl FROM trades
                WHERE  strategy_key = ?
                  AND  created_at   >= ?
                ORDER  BY created_at ASC
                """,
                (strategy_key, cutoff_7d),
            ).fetchall()

            max_drawdown_7d = 0.0
            if rows_7d:
                pnls = [r[0] for r in rows_7d]
                cumulative = 0.0
                peak = 0.0
                for pnl in pnls:
                    cumulative += pnl
                    if cumulative > peak:
                        peak = cumulative
                    drawdown = (peak - cumulative) / (abs(peak) + 1e-9)
                    if drawdown > max_drawdown_7d:
                        max_drawdown_7d = drawdown

            return {
                "consecutive_losses": consecutive_losses,
                "rolling_sharpe_30d": rolling_sharpe_30d,
                "max_drawdown_7d": max_drawdown_7d,
            }

        except Exception:
            return {
                "consecutive_losses": 0,
                "rolling_sharpe_30d": 0.0,
                "max_drawdown_7d": 0.0,
            }

    # ------------------------------------------------------------------ #
    # Retirement                                                           #
    # ------------------------------------------------------------------ #

    async def retire_strategy(
        self, strategy_key: str, decay_metrics: dict
    ) -> None:
        """
        Retire a decayed strategy:

        1. Update status to "decayed" in approved_strategies  (Req 8.2)
        2. POST /api/bots/{bot_id}/stop to backend  (Req 8.2)
        3. Save decay event to alpha_decay_events table  (Req 8.4)
        4. Send mutation request to Alpha_Agent  (Req 8.3)
        """
        now = datetime.now(timezone.utc).isoformat()

        # 1. Mark as decayed in registry
        existing = self._registry.lookup(strategy_key)
        if existing is not None:
            updated = ApprovedStrategy(
                strategy_key=existing.strategy_key,
                python_code=existing.python_code,
                backtest_metrics=existing.backtest_metrics,
                approved_at=existing.approved_at,
                status="decayed",
                lineage_id=existing.lineage_id,
                mutation_count=existing.mutation_count,
                bot_id=existing.bot_id,
                updated_at=now,
            )
            self._registry.register(updated)

            # 2. Stop the bot in backend
            if existing.bot_id:
                await self._stop_bot(existing.bot_id)

            # 4. Trigger mutation via Alpha_Agent
            await self.alpha_agent.mutate_strategy(
                original_code=existing.python_code,
                metrics=existing.backtest_metrics,
                failure_reason=f"Alpha decay detected. Score: {decay_metrics.get('decay_score', 0):.1f}",
                lineage_id=existing.lineage_id,
            )

        # 3. Save decay event to alpha_decay_events
        self._save_decay_event(strategy_key, decay_metrics, now)

    async def _deploy_bot(self, strategy_key: str, python_code: str, metrics: dict) -> str | None:
        """
        POST /api/bots to backend service to deploy a live trading bot.

        Returns the bot_id assigned by the backend, or None on failure.
        (Req 10.5 — deploy approved strategy as live bot)
        """
        url = f"{self.backend_url}/api/bots"
        payload = {
            "strategy_key": strategy_key,
            "python_code": python_code,
            "metrics": metrics,
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, json=payload)
                if response.status_code in (200, 201):
                    data = response.json()
                    return str(data.get("id") or data.get("bot_id") or "")
                return None
        except Exception:
            return None  # non-fatal: best-effort deploy

    async def _stop_bot(self, bot_id: str) -> None:
        """PUT /api/bots/{bot_id}/stop to backend service. (Req 10.6)"""
        url = f"{self.backend_url}/api/bots/{bot_id}/stop"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.put(url)
        except Exception:
            pass  # non-fatal: best-effort stop

    def _save_decay_event(
        self, strategy_key: str, decay_metrics: dict, timestamp: str
    ) -> None:
        """Insert a row into alpha_decay_events table."""
        try:
            self.db.execute(
                """
                INSERT INTO alpha_decay_events (
                    strategy_key,
                    decay_score,
                    consecutive_losses,
                    rolling_sharpe_30d,
                    max_drawdown_7d,
                    action,
                    timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    strategy_key,
                    decay_metrics.get("decay_score", 0.0),
                    decay_metrics.get("consecutive_losses", 0),
                    decay_metrics.get("rolling_sharpe_30d", 0.0),
                    decay_metrics.get("max_drawdown_7d", 0.0),
                    "retired",
                    timestamp,
                ),
            )
            self.db.commit()
        except Exception:
            pass  # non-fatal

    # ------------------------------------------------------------------ #
    # Queries                                                              #
    # ------------------------------------------------------------------ #

    async def get_active_strategies(self) -> list[ApprovedStrategy]:
        """
        Return all strategies with status == 'active' from approved_strategies.
        (Req 6.3)
        """
        return self._registry.list_by_status("active")
