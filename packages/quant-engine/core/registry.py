"""
SQLite repository layer for the Approved Strategy Registry.

Requirements: 6.1, 6.2, 6.3, 6.4, 6.6
"""

from __future__ import annotations

import json
import sqlite3
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from core.schemas import ApprovedStrategy


class StrategyRegistry:
    """
    Persistent repository for approved trading strategies backed by SQLite.

    Accepts a shared sqlite3.Connection so the caller controls the connection
    lifecycle (and can pass an in-memory DB for tests).
    """

    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn
        self._conn.row_factory = sqlite3.Row

    # ------------------------------------------------------------------ #
    # Write                                                                #
    # ------------------------------------------------------------------ #

    def register(self, strategy: "ApprovedStrategy") -> None:
        """
        Upsert a strategy into approved_strategies.

        Uses INSERT OR REPLACE so duplicate strategy_key updates the row
        instead of raising an IntegrityError (idempotence — Req 6.6).
        """
        sql = """
            INSERT OR REPLACE INTO approved_strategies (
                strategy_key,
                python_code,
                backtest_metrics,
                approved_at,
                status,
                lineage_id,
                mutation_count,
                bot_id,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        self._conn.execute(
            sql,
            (
                strategy.strategy_key,
                strategy.python_code,
                json.dumps(strategy.backtest_metrics),
                strategy.approved_at,
                strategy.status,
                strategy.lineage_id,
                strategy.mutation_count,
                getattr(strategy, "bot_id", None),
                strategy.updated_at,
            ),
        )
        self._conn.commit()

    # ------------------------------------------------------------------ #
    # Read                                                                 #
    # ------------------------------------------------------------------ #

    def lookup(self, strategy_key: str) -> "ApprovedStrategy | None":
        """
        Return the strategy matching *strategy_key*, or None if not found.

        Round-trip guarantee: register(s) → lookup(s.strategy_key) ≡ s
        (Req 6.5, 11.6)
        """
        row = self._conn.execute(
            "SELECT * FROM approved_strategies WHERE strategy_key = ?",
            (strategy_key,),
        ).fetchone()

        if row is None:
            return None

        return self._row_to_strategy(row)

    def list_by_status(self, status: str) -> list["ApprovedStrategy"]:
        """
        Return all strategies whose *status* column matches the given value.

        Supports: 'active', 'retired', 'decayed'  (Req 6.3)
        """
        rows = self._conn.execute(
            "SELECT * FROM approved_strategies WHERE status = ?",
            (status,),
        ).fetchall()

        return [self._row_to_strategy(r) for r in rows]

    def list_by_sharpe(self, min_sharpe: float) -> list["ApprovedStrategy"]:
        """
        Return all strategies whose backtest_metrics.sharpe >= *min_sharpe*.

        Sharpe is stored inside the JSON backtest_metrics column; we use
        SQLite's json_extract() for an in-database filter so we avoid
        deserialising every row in Python first.  (Req 6.3)
        """
        rows = self._conn.execute(
            """
            SELECT * FROM approved_strategies
            WHERE CAST(json_extract(backtest_metrics, '$.sharpe') AS REAL) >= ?
            """,
            (min_sharpe,),
        ).fetchall()

        return [self._row_to_strategy(r) for r in rows]

    # ------------------------------------------------------------------ #
    # Internal helpers                                                     #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _row_to_strategy(row: sqlite3.Row) -> "ApprovedStrategy":
        """Convert a sqlite3.Row to an ApprovedStrategy Pydantic model."""
        # Import here to avoid a circular import at module load time.
        from core.schemas import ApprovedStrategy  # noqa: PLC0415

        return ApprovedStrategy(
            strategy_key=row["strategy_key"],
            python_code=row["python_code"],
            backtest_metrics=json.loads(row["backtest_metrics"]),
            approved_at=row["approved_at"],
            status=row["status"],
            lineage_id=row["lineage_id"],
            mutation_count=row["mutation_count"],
            bot_id=row["bot_id"],
            updated_at=row["updated_at"],
        )
