"""
Data Agent — OHLCV ETL Pipeline (Req 2)

Responsibilities:
- Fetch OHLCV data from Binance Futures API via httpx
- Clean data (forward-fill, outlier replacement, sort, dedup)
- Persist to Parquet
- Expose read_ohlcv() for other agents
- Update ohlcv_metadata in SQLite
- Retry with exponential backoff (3 attempts)
"""
from __future__ import annotations

import asyncio
import logging
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import httpx
import pandas as pd

from core.schemas import ETLResult, OHLCVMetadata

logger = logging.getLogger(__name__)

BINANCE_KLINES_URL = "https://fapi.binance.com/fapi/v1/klines"

OHLCV_COLUMNS = ["timestamp", "open", "high", "low", "close", "volume"]


class DataAgent:
    """ETL pipeline agent for OHLCV data."""

    def __init__(
        self,
        http_client: httpx.AsyncClient,
        data_dir: Path,
        db: sqlite3.Connection,
    ) -> None:
        self.http_client = http_client
        self.data_dir = Path(data_dir)
        self.db = db
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self._ensure_metadata_table()

    # ──────────────────────────────────────────────────────────────────────────
    # Public interface
    # ──────────────────────────────────────────────────────────────────────────

    async def run_etl(
        self,
        symbol: str,
        interval: str = "15m",
        limit: int = 1000,
    ) -> ETLResult:
        """
        Main ETL pipeline: fetch → clean → save Parquet → update metadata.
        Retries up to 3 times with exponential backoff (1s, 2s, 4s).
        After 3 failures logs an alert and returns ETLResult(success=False).
        """
        last_error: str | None = None

        for attempt in range(3):
            try:
                df = await self._fetch_ohlcv(symbol, interval, limit)
                df = self._clean_data(df)
                self._save_parquet(df, symbol, interval)
                now_iso = datetime.now(timezone.utc).isoformat()
                await self._update_metadata(symbol, interval, len(df))
                return ETLResult(
                    symbol=symbol,
                    interval=interval,
                    rows_written=len(df),
                    last_updated=now_iso,
                    success=True,
                )
            except Exception as exc:
                last_error = str(exc)
                logger.warning(
                    "ETL attempt %d/3 failed for %s/%s: %s",
                    attempt + 1,
                    symbol,
                    interval,
                    exc,
                )
                if attempt < 2:
                    backoff = 2 ** attempt  # 1s, 2s (then give up)
                    await asyncio.sleep(backoff)

        # All 3 attempts exhausted
        logger.error(
            "ALERT: ETL failed 3 consecutive times for %s/%s — %s",
            symbol,
            interval,
            last_error,
        )
        return ETLResult(
            symbol=symbol,
            interval=interval,
            rows_written=0,
            last_updated=datetime.now(timezone.utc).isoformat(),
            success=False,
            error=last_error,
        )

    def read_ohlcv(
        self,
        symbol: str,
        interval: str,
        from_ts: int | None = None,
        to_ts: int | None = None,
    ) -> pd.DataFrame:
        """
        Read OHLCV data from Parquet.
        Optionally filter by timestamp range [from_ts, to_ts] (ms).
        Round-trip invariant: read(write(df)) ≡ df
        """
        path = self._parquet_path(symbol, interval)
        if not path.exists():
            return pd.DataFrame(columns=OHLCV_COLUMNS)

        df = pd.read_parquet(path)
        if from_ts is not None:
            df = df[df["timestamp"] >= from_ts]
        if to_ts is not None:
            df = df[df["timestamp"] <= to_ts]
        return df.reset_index(drop=True)

    # ──────────────────────────────────────────────────────────────────────────
    # Private helpers
    # ──────────────────────────────────────────────────────────────────────────

    async def _fetch_ohlcv(
        self,
        symbol: str,
        interval: str,
        limit: int,
    ) -> pd.DataFrame:
        """
        Fetch OHLCV from Binance Futures klines endpoint.
        Response: [[open_time, open, high, low, close, volume, close_time, ...], ...]
        """
        params = {"symbol": symbol, "interval": interval, "limit": limit}
        response = await self.http_client.get(BINANCE_KLINES_URL, params=params)
        response.raise_for_status()
        raw: list[list] = response.json()

        records = [
            {
                "timestamp": int(row[0]),
                "open": float(row[1]),
                "high": float(row[2]),
                "low": float(row[3]),
                "close": float(row[4]),
                "volume": float(row[5]),
            }
            for row in raw
        ]

        df = pd.DataFrame(records, columns=OHLCV_COLUMNS)
        df = df.astype(
            {
                "timestamp": "int64",
                "open": "float64",
                "high": "float64",
                "low": "float64",
                "close": "float64",
                "volume": "float64",
            }
        )
        return df

    def _clean_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        1. Forward-fill missing values
        2. Replace outliers (> 5 std from rolling mean 20) with rolling median
        3. Sort by timestamp ascending
        4. Drop duplicate timestamps
        Invariant: output timestamps are ascending and unique.
        """
        if df.empty:
            return df

        # 1. Forward-fill missing values
        df = df.ffill()

        # 2. Replace outliers in price/volume columns
        # Use a lagged (shifted) rolling window so each row is compared against
        # stats computed from the PREVIOUS 20 rows only — this prevents the
        # outlier from inflating its own window's std (Req 2.3).
        price_cols = ["open", "high", "low", "close", "volume"]
        for col in price_cols:
            shifted = df[col].shift(1)
            rolling_mean = shifted.rolling(window=20, min_periods=1).mean()
            rolling_std = shifted.rolling(window=20, min_periods=1).std(ddof=0)
            rolling_median = shifted.rolling(window=20, min_periods=1).median()

            # When std > 0: flag if |value - mean| > 5 * std
            # When std == 0: flag if value differs from mean at all (any deviation
            # from a perfectly flat window is an outlier)
            deviation = (df[col] - rolling_mean).abs()
            is_outlier = rolling_std.gt(0) & (deviation > 5 * rolling_std) | (
                rolling_std.eq(0) & rolling_mean.gt(0) & deviation.gt(0)
            )
            df[col] = df[col].where(~is_outlier, rolling_median)

        # 3. Sort ascending by timestamp
        df = df.sort_values("timestamp", ascending=True)

        # 4. Drop duplicate timestamps (keep last)
        df = df.drop_duplicates(subset=["timestamp"], keep="last")

        return df.reset_index(drop=True)

    def _save_parquet(
        self,
        df: pd.DataFrame,
        symbol: str,
        interval: str,
    ) -> Path:
        """Save DataFrame to Parquet file."""
        path = self._parquet_path(symbol, interval)
        df.to_parquet(path, index=False, engine="pyarrow")
        logger.debug("Saved %d rows to %s", len(df), path)
        return path

    async def _update_metadata(
        self,
        symbol: str,
        interval: str,
        row_count: int,
    ) -> None:
        """Upsert ohlcv_metadata row for (symbol, interval)."""
        now_iso = datetime.now(timezone.utc).isoformat()
        parquet_path = str(self._parquet_path(symbol, interval))

        cursor = self.db.cursor()
        cursor.execute(
            """
            INSERT INTO ohlcv_metadata (symbol, interval, last_updated, row_count, parquet_path)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(symbol, interval) DO UPDATE SET
                last_updated = excluded.last_updated,
                row_count    = excluded.row_count,
                parquet_path = excluded.parquet_path
            """,
            (symbol, interval, now_iso, row_count, parquet_path),
        )
        self.db.commit()
        logger.debug("Updated metadata for %s/%s: %d rows", symbol, interval, row_count)

    # ──────────────────────────────────────────────────────────────────────────
    # Utilities
    # ──────────────────────────────────────────────────────────────────────────

    def _parquet_path(self, symbol: str, interval: str) -> Path:
        return self.data_dir / f"{symbol}_{interval}.parquet"

    def _ensure_metadata_table(self) -> None:
        """Create ohlcv_metadata table if it doesn't exist."""
        self.db.execute(
            """
            CREATE TABLE IF NOT EXISTS ohlcv_metadata (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol       TEXT NOT NULL,
                interval     TEXT NOT NULL,
                last_updated TEXT NOT NULL,
                row_count    INTEGER NOT NULL,
                parquet_path TEXT NOT NULL,
                UNIQUE(symbol, interval)
            )
            """
        )
        self.db.commit()
