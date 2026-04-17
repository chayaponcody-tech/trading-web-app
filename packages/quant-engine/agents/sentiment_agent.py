"""
Sentiment Score Pipeline (Req 1)

Computes market sentiment from Funding Rate + Open Interest via Binance Futures API.
"""
from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime, timezone

import httpx

from core.schemas import SentimentResult

logger = logging.getLogger(__name__)

BINANCE_FUTURES_BASE = "https://fapi.binance.com"


class SentimentAgent:
    """Agent that computes and persists Sentiment Scores from Binance Futures data."""

    def __init__(self, binance_http_client: httpx.AsyncClient, db: sqlite3.Connection) -> None:
        self._client = binance_http_client
        self._db = db

    # ─── Pure calculation ─────────────────────────────────────────────────────

    def _calculate_score(self, funding_rate: float, oi_change_pct: float) -> float:
        """
        Pure function: compute Sentiment_Score from weighted formula.

        Contrarian logic:
          funding_component = clamp((-fr / 0.002) * 50 + 50, 0, 100)
          oi_component      = clamp((oi / 10.0)   * 50 + 50, 0, 100)
          score             = 0.6 * funding_component + 0.4 * oi_component

        Invariant: return value ∈ [0.0, 100.0] for all finite inputs.
        """
        funding_raw = (-funding_rate / 0.002) * 50.0 + 50.0
        funding_component = max(0.0, min(100.0, funding_raw))

        oi_raw = (oi_change_pct / 10.0) * 50.0 + 50.0
        oi_component = max(0.0, min(100.0, oi_raw))

        score = 0.6 * funding_component + 0.4 * oi_component
        # Final clamp to guard against floating-point edge cases
        return max(0.0, min(100.0, score))

    # ─── Binance API helpers ──────────────────────────────────────────────────

    async def _fetch_funding_rate(self, symbol: str) -> float:
        """Fetch the latest funding rate for *symbol* from Binance Futures."""
        url = f"{BINANCE_FUTURES_BASE}/fapi/v1/fundingRate"
        resp = await self._client.get(url, params={"symbol": symbol, "limit": 1})
        resp.raise_for_status()
        data = resp.json()
        if not data:
            raise ValueError(f"Empty fundingRate response for {symbol}")
        return float(data[0]["fundingRate"])

    async def _fetch_open_interest(self, symbol: str) -> float:
        """Fetch the current open interest for *symbol* from Binance Futures."""
        url = f"{BINANCE_FUTURES_BASE}/fapi/v1/openInterest"
        resp = await self._client.get(url, params={"symbol": symbol})
        resp.raise_for_status()
        data = resp.json()
        return float(data["openInterest"])

    def _get_last_stored_oi(self, symbol: str) -> float | None:
        """Return the most recently stored OI value for *symbol*, or None."""
        cursor = self._db.execute(
            """
            SELECT oi_change_pct, score
            FROM sentiment_scores
            WHERE symbol = ?
            ORDER BY timestamp DESC
            LIMIT 1
            """,
            (symbol,),
        )
        row = cursor.fetchone()
        if row is None:
            return None
        # We stored oi_change_pct, not raw OI — we need raw OI.
        # Store raw OI in the components JSON so we can retrieve it.
        cursor2 = self._db.execute(
            """
            SELECT components
            FROM sentiment_scores
            WHERE symbol = ?
            ORDER BY timestamp DESC
            LIMIT 1
            """,
            (symbol,),
        )
        row2 = cursor2.fetchone()
        if row2 is None:
            return None
        try:
            components = json.loads(row2[0])
            return float(components.get("raw_oi", 0.0)) or None
        except (json.JSONDecodeError, TypeError, KeyError):
            return None

    # ─── Main compute ─────────────────────────────────────────────────────────

    async def compute_score(self, symbol: str) -> SentimentResult:
        """
        Fetch FundingRate + OI from Binance, compute Sentiment_Score.

        Falls back to score=50 (neutral) when any API call fails (Req 1.6).
        """
        timestamp = datetime.now(timezone.utc).isoformat()

        try:
            funding_rate = await self._fetch_funding_rate(symbol)
            current_oi = await self._fetch_open_interest(symbol)

            # OI change % vs last stored value
            prev_oi = self._get_last_stored_oi(symbol)
            if prev_oi is not None and prev_oi != 0.0:
                oi_change_pct = ((current_oi - prev_oi) / prev_oi) * 100.0
            else:
                oi_change_pct = 0.0

            score = self._calculate_score(funding_rate, oi_change_pct)

            funding_component = max(0.0, min(100.0, (-funding_rate / 0.002) * 50.0 + 50.0))
            oi_component = max(0.0, min(100.0, (oi_change_pct / 10.0) * 50.0 + 50.0))

            components: dict[str, float] = {
                "funding_component": funding_component,
                "oi_component": oi_component,
                "raw_oi": current_oi,
            }

            return SentimentResult(
                symbol=symbol,
                score=score,
                funding_rate=funding_rate,
                oi_change_pct=oi_change_pct,
                timestamp=timestamp,
                components=components,
            )

        except Exception as exc:
            logger.warning(
                "SentimentAgent: API failure for %s — falling back to neutral score. Error: %s",
                symbol,
                exc,
            )
            return SentimentResult(
                symbol=symbol,
                score=50.0,
                funding_rate=0.0,
                oi_change_pct=0.0,
                timestamp=timestamp,
                components={"funding_component": 50.0, "oi_component": 50.0, "raw_oi": 0.0},
            )

    # ─── Persistence ──────────────────────────────────────────────────────────

    async def save_score(self, result: SentimentResult) -> None:
        """Persist a SentimentResult to the sentiment_scores table (Req 1.5)."""
        self._db.execute(
            """
            INSERT INTO sentiment_scores
                (symbol, score, funding_rate, oi_change_pct, components, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                result.symbol,
                result.score,
                result.funding_rate,
                result.oi_change_pct,
                json.dumps(result.components),
                result.timestamp,
            ),
        )
        self._db.commit()

    async def get_latest(self, symbol: str) -> SentimentResult | None:
        """Return the most recent SentimentResult for *symbol*, or None."""
        cursor = self._db.execute(
            """
            SELECT symbol, score, funding_rate, oi_change_pct, components, timestamp
            FROM sentiment_scores
            WHERE symbol = ?
            ORDER BY timestamp DESC
            LIMIT 1
            """,
            (symbol,),
        )
        row = cursor.fetchone()
        if row is None:
            return None
        return self._row_to_result(row)

    async def get_history(
        self, symbol: str, from_ts: str, to_ts: str
    ) -> list[SentimentResult]:
        """Return historical SentimentResults for *symbol* within [from_ts, to_ts]."""
        cursor = self._db.execute(
            """
            SELECT symbol, score, funding_rate, oi_change_pct, components, timestamp
            FROM sentiment_scores
            WHERE symbol = ?
              AND timestamp >= ?
              AND timestamp <= ?
            ORDER BY timestamp ASC
            """,
            (symbol, from_ts, to_ts),
        )
        return [self._row_to_result(row) for row in cursor.fetchall()]

    # ─── Internal helpers ─────────────────────────────────────────────────────

    @staticmethod
    def _row_to_result(row: tuple) -> SentimentResult:
        symbol, score, funding_rate, oi_change_pct, components_json, timestamp = row
        try:
            components = json.loads(components_json)
        except (json.JSONDecodeError, TypeError):
            components = {}
        return SentimentResult(
            symbol=symbol,
            score=score,
            funding_rate=funding_rate,
            oi_change_pct=oi_change_pct,
            timestamp=timestamp,
            components=components,
        )
