"""
Sentiment Score Pipeline (Req 1)

Computes market sentiment from Funding Rate + Open Interest via Binance Futures API.
"""
from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime, timezone
from typing import Any

import httpx

from core.schemas import SentimentResult, NewsResult

logger = logging.getLogger(__name__)

BINANCE_FUTURES_BASE = "https://fapi.binance.com"


class SentimentAgent:
    """Agent that computes and persists Sentiment Scores from Binance Futures data."""

    def __init__(self, binance_http_client: httpx.AsyncClient, db: sqlite3.Connection, llm_client: Any = None) -> None:
        self._client = binance_http_client
        self._db = db
        self._llm = llm_client
        self._ensure_tables()

    def _ensure_tables(self) -> None:
        """Ensure news and sentiment tables exist."""
        self._db.execute("""
            CREATE TABLE IF NOT EXISTS sentiment_news (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                title_th TEXT,
                summary TEXT,
                summary_th TEXT,
                impact_score INTEGER,
                source TEXT,
                url TEXT UNIQUE,
                timestamp TEXT
            )
        """)
        self._db.execute("""
            CREATE TABLE IF NOT EXISTS sentiment_symbol_metadata (
                symbol TEXT PRIMARY KEY,
                category TEXT,
                tags TEXT,
                custom_instructions TEXT
            )
        """)
        self._db.commit()
        self._seed_metadata()

    def _seed_metadata(self) -> None:
        """Seed initial metadata for known symbols."""
        data = [
            ("BTCUSDT", "Macro / Layer 1", "King, Store of Value", "Focus on institutional adoption, SEC, and global liquidity."),
            ("ETHUSDT", "Layer 1 / DeFi", "Smart Contract, Merge", "Focus on network upgrades, gas fees, and L2 growth."),
            ("SOLUSDT", "Layer 1 / Ecosystem", "High Speed, NFT", "Focus on network stability, DEX volume, and developer activity."),
            ("XRPUSDT", "Payment / Security", "SEC, Ripple", "Focus on legal updates and cross-border bank partnerships."),
            ("AXSUSDT", "Gaming / Metaverse", "Play to Earn", "Focus on player stats, game updates, and community earnings."),
            ("PEPEUSDT", "Memecoin", "Community, Hype", "Focus on social media trends, whale alerts, and DEX liquidity.")
        ]
        for symbol, cat, tags, instr in data:
            self._db.execute("""
                INSERT OR IGNORE INTO sentiment_symbol_metadata (symbol, category, tags, custom_instructions)
                VALUES (?, ?, ?, ?)
            """, (symbol, cat, tags, instr))
        self._db.commit()

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
        timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

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

    # ─── Backfill Logic ───────────────────────────────────────────────────────

    async def backfill_history(self, symbol: str, limit: int = 100) -> int:
        """
        Backfill historical sentiment data for a symbol by fetching 
        past Funding Rates and Open Interest history from Binance.
        Returns the number of records backfilled.
        """
        try:
            # 1. Fetch History from Binance
            fr_url = f"{BINANCE_FUTURES_BASE}/fapi/v1/fundingRate"
            fr_resp = await self._client.get(fr_url, params={"symbol": symbol, "limit": limit})
            fr_resp.raise_for_status()
            fr_history = fr_resp.json()

            oi_url = f"{BINANCE_FUTURES_BASE}/futures/data/openInterestHist"
            oi_resp = await self._client.get(oi_url, params={"symbol": symbol, "period": "30m", "limit": limit})
            oi_resp.raise_for_status()
            oi_history = oi_resp.json()

            if not fr_history or not oi_history:
                return 0

            backfilled_count = 0
            fr_history_sorted = sorted(fr_history, key=lambda x: x["fundingTime"])
            
            # Iterate over OI history (dense 30m buckets)
            for i in range(len(oi_history)):
                oi_point = oi_history[i]
                ts_ms = oi_point["timestamp"]
                iso_ts = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc).isoformat().replace("+00:00", "Z")
                
                exists = self._db.execute("SELECT 1 FROM sentiment_scores WHERE symbol=? AND timestamp=?", (symbol, iso_ts)).fetchone()
                if exists: continue

                current_oi = float(oi_point["sumOpenInterest"])
                prev_oi = float(oi_history[i-1]["sumOpenInterest"]) if i > 0 else current_oi
                
                fr_val = 0.0
                for fr_point in reversed(fr_history_sorted):
                    if fr_point["fundingTime"] <= ts_ms:
                        fr_val = float(fr_point["fundingRate"])
                        break
                
                oi_change_pct = ((current_oi - prev_oi) / prev_oi * 100.0) if prev_oi != 0 else 0.0
                score = self._calculate_score(fr_val, oi_change_pct)
                
                result = SentimentResult(
                    symbol=symbol,
                    score=score,
                    funding_rate=fr_val,
                    oi_change_pct=oi_change_pct,
                    timestamp=iso_ts,
                    components={
                        "funding_component": max(0.0, min(100.0, (-fr_val / 0.002) * 50.0 + 50.0)),
                        "oi_component": max(0.0, min(100.0, (oi_change_pct / 10.0) * 50.0 + 50.0)),
                        "raw_oi": current_oi
                    }
                )
                await self.save_score(result)
                backfilled_count += 1

            logger.info("Backfilled %d sentiment records for %s", backfilled_count, symbol)
            return backfilled_count

        except Exception as e:
            logger.error("Failed to backfill sentiment for %s: %s", symbol, e)
            return 0

    # ─── News Logic ───────────────────────────────────────────────────────────

    async def fetch_latest_news(self, use_ai: bool = True, symbol: str = "BTCUSDT") -> list[NewsResult]:
        """Fetch latest news from RSS feeds and save to DB. Symbol-aware for AI tailoring."""
        feeds = [
            "https://www.coindesk.com/arc/outboundfeeds/rss/",
            # Cointelegraph RSS format might be different, but let's try
            "https://cointelegraph.com/rss"
        ]
        
        all_news = []
        for feed in feeds:
            try:
                # Use a proper User-Agent to avoid being blocked
                headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
                async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
                    resp = await client.get(feed)
                    if resp.status_code == 200:
                        from bs4 import BeautifulSoup
                        # RSS usually uses XML
                        soup = BeautifulSoup(resp.text, "xml")
                        items = soup.find_all('item')
                        for item in items[:5]:
                            title = item.find('title').text.strip()
                            link = item.find('link').text.strip()
                            # Description often contains HTML, let's clean it a bit
                            desc_raw = item.find('description').text if item.find('description') else ""
                            desc = BeautifulSoup(desc_raw, "html.parser").get_text().strip()
                            pub_date = item.find('pubDate').text if item.find('pubDate') else datetime.now(timezone.utc).isoformat()
                            
                            exists = self._db.execute("SELECT 1 FROM sentiment_news WHERE url = ?", (link,)).fetchone()
                            if exists:
                                # Still add to current list even if stored, to return it
                                row = self._db.execute("SELECT id, title, title_th, summary, summary_th, impact_score, source, url, timestamp FROM sentiment_news WHERE url = ?", (link,)).fetchone()
                                if row:
                                    all_news.append(NewsResult(id=row[0], title=row[1], title_th=row[2], summary=row[3], summary_th=row[4], impact_score=row[5], source=row[6], url=row[7], timestamp=row[8]))
                                continue

                            news_item = await self._process_news_with_ai(title, desc, link, pub_date, use_ai=use_ai, symbol=symbol)
                            await self.save_news(news_item)
                            all_news.append(news_item)
            except Exception as e:
                logger.error("Failed to fetch news feed %s: %s", feed, e)
        
        # Sort by timestamp desc
        all_news.sort(key=lambda x: x.timestamp, reverse=True)
        return all_news[:15]

    async def _process_news_with_ai(self, title: str, summary: str, url: str, timestamp: str, use_ai: bool = True, symbol: str = "BTCUSDT") -> NewsResult:
        """Use LLM to generate Thai translation and impact score, tailored to the symbol category."""
        if not self._llm or not use_ai:
            return NewsResult(
                title=title,
                summary=summary[:300],
                impact_score=0,
                source="RSS",
                url=url,
                timestamp=timestamp
            )
        
        # Load metadata for tailoring
        meta = self._db.execute(
            "SELECT category, custom_instructions FROM sentiment_symbol_metadata WHERE symbol = ?", 
            (symbol,)
        ).fetchone()
        category = meta[0] if meta else "General Crypto"
        instructions = meta[1] if meta else ""

        prompt = (
            f"You are an expert crypto analyst specialized in {category}.\n"
            f"Symbol: {symbol}\n"
            f"Sector Context: {instructions}\n\n"
            f"Analyze this news for its direct impact on {symbol}:\n"
            f"Title: {title}\n"
            f"Summary: {summary}\n\n"
            f"Tasks:\n"
            f"1. Translate Title to Thai.\n"
            f"2. Summarize key point in Thai (max 150 chars).\n"
            f"3. Assign impact score from -10 (bearish) to 10 (bullish).\n"
            f"   Crucial: If the news is specifically about {category} features/events, weight it more heavily.\n\n"
            f"Return ONLY JSON:\n"
            f'{{"title_th": "...", "summary_th": "...", "impact_score": 5}}'
        )
        
        try:
            response = await self._llm.complete(prompt, model="anthropic/claude-3-haiku")
            import re
            match = re.search(r'\{.*\}', response, re.DOTALL)
            if match:
                data = json.loads(match.group())
                return NewsResult(
                    title=title,
                    title_th=data.get("title_th"),
                    summary=summary[:300],
                    summary_th=data.get("summary_th"),
                    impact_score=data.get("impact_score", 0),
                    source="AI Intel",
                    url=url,
                    timestamp=timestamp
                )
        except Exception as e:
            logger.error("AI news processing failed: %s", e)
            
        return NewsResult(
            title=title,
            summary=summary[:300],
            impact_score=0,
            source="RSS",
            url=url,
            timestamp=timestamp
        )

    async def save_news(self, news: NewsResult) -> None:
        try:
            self._db.execute(
                """
                INSERT OR IGNORE INTO sentiment_news 
                    (title, title_th, summary, summary_th, impact_score, source, url, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (news.title, news.title_th, news.summary, news.summary_th, news.impact_score, news.source, news.url, news.timestamp)
            )
            self._db.commit()
        except Exception as e:
            logger.error("Failed to save news: %s", e)

    async def get_stored_news(self, limit: int = 15) -> list[NewsResult]:
        cursor = self._db.execute(
            "SELECT id, title, title_th, summary, summary_th, impact_score, source, url, timestamp "
            "FROM sentiment_news ORDER BY timestamp DESC LIMIT ?", 
            (limit,)
        )
        rows = cursor.fetchall()
        return [
            NewsResult(
                id=r[0], title=r[1], title_th=r[2], summary=r[3], 
                summary_th=r[4], impact_score=r[5], source=r[6], url=r[7], timestamp=r[8]
            )
            for r in rows
        ]

    # ─── Persistence ──────────────────────────────────────────────────────────

    async def save_score(self, result: SentimentResult) -> None:
        """Persist a SentimentResult to the sentiment_scores table."""
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
        """Return historical SentimentResults query within range."""
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
