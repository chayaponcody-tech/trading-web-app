"""
Scout Agent — Perception Layer (Req 10.1)

Responsibilities:
  - Search the web for new quantitative alpha ideas, research papers, and technical indicators.
  - Summarize findings into "Idea Markdown" files.
  - Provide research topics for the Alpha Agent.
  - Persistent storage of findings and AI summaries.
"""
from __future__ import annotations

import logging
import json
import httpx
from typing import Any
from pathlib import Path
from datetime import datetime, timezone
import sqlite3
import re

from core.scraper import TradingViewScraper

logger = logging.getLogger(__name__)

class ScoutAgent:
    """
    Scouts for new alpha ideas using search tools and LLM summarization.
    """

    def __init__(
        self,
        llm_client: Any,
        db: sqlite3.Connection,
        search_api_url: str = "https://api.tavily.com/search",
        research_dir: Path | None = None
    ) -> None:
        self.llm_client = llm_client
        self.db = db
        self.search_api_url = search_api_url
        self.research_dir = research_dir
        self.scraper = TradingViewScraper()
        self._ensure_table_exists()

    def _ensure_table_exists(self) -> None:
        """Create the tracking tables if they don't exist."""
        try:
            # Table for data sources
            self.db.execute("""
                CREATE TABLE IF NOT EXISTS research_sources (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    type TEXT NOT NULL, 
                    url TEXT NOT NULL,
                    enabled INTEGER DEFAULT 1,
                    last_scanned TIMESTAMP,
                    config_json TEXT 
                )
            """)
            
            # Table for persistent research findings
            self.db.execute("""
                CREATE TABLE IF NOT EXISTS research_findings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    source_id INTEGER,
                    title TEXT,
                    description TEXT,
                    link TEXT UNIQUE,
                    timestamp TIMESTAMP,
                    ai_summary TEXT,
                    alpha_potential TEXT,
                    FOREIGN KEY(source_id) REFERENCES research_sources(id) ON DELETE CASCADE
                )
            """)

            # Table for agent-level settings (e.g. LLM model)
            self.db.execute("""
                CREATE TABLE IF NOT EXISTS agent_settings (
                    agent_id TEXT PRIMARY KEY,
                    model_name TEXT,
                    config_json TEXT
                )
            """)
            
            # Insert default sources if table is empty
            cursor = self.db.cursor()
            cursor.execute("SELECT COUNT(*) FROM research_sources")
            if cursor.fetchone()[0] == 0:
                defaults = [
                    ("TradingView Strategies", "scraper", "https://www.tradingview.com/scripts/?script_type=strategies", 1, json.dumps({"limit": 10})),
                    ("Tavily Web Search", "api", "https://api.tavily.com/search", 0, json.dumps({"api_key": "", "max_results": 5})),
                    ("Arxiv Quant Finance", "rss", "https://export.arxiv.org/rss/q-fin", 1, json.dumps({"limit": 5}))
                ]
                self.db.executemany(
                    "INSERT INTO research_sources (name, type, url, enabled, config_json) VALUES (?, ?, ?, ?, ?)",
                    defaults
                )

            # Insert default settings for scout_agent if missing
            self.db.execute("INSERT OR IGNORE INTO agent_settings (agent_id, model_name) VALUES (?, ?)", ("scout_agent", "anthropic/claude-3-haiku"))

            self.db.commit()
        except Exception as exc:
            logger.error("Failed to ensure research tables: %s", exc)

    def get_sources(self) -> list[dict]:
        cursor = self.db.execute("SELECT id, name, type, url, enabled, last_scanned, config_json FROM research_sources")
        rows = cursor.fetchall()
        return [
            {
                "id": r[0], "name": r[1], "type": r[2], "url": r[3], 
                "enabled": bool(r[4]), "last_scanned": r[5], "config": json.loads(r[6]) if r[6] else {}
            }
            for r in rows
        ]

    def add_source(self, name: str, source_type: str, url: str, config: dict = None) -> int:
        cursor = self.db.execute(
            "INSERT INTO research_sources (name, type, url, enabled, config_json) VALUES (?, ?, ?, ?, ?)",
            (name, source_type, url, 1, json.dumps(config or {}))
        )
        self.db.commit()
        return cursor.lastrowid

    def update_source(self, source_id: int, enabled: bool = None, url: str = None, config: dict = None) -> None:
        updates = []
        params = []
        if enabled is not None:
            updates.append("enabled = ?")
            params.append(1 if enabled else 0)
        if url is not None:
            updates.append("url = ?")
            params.append(url)
        if config is not None:
            updates.append("config_json = ?")
            params.append(json.dumps(config))
        if not updates: return
        params.append(source_id)
        self.db.execute(f"UPDATE research_sources SET {', '.join(updates)} WHERE id = ?", tuple(params))
        self.db.commit()

    def delete_source(self, source_id: int) -> None:
        self.db.execute("DELETE FROM research_sources WHERE id = ?", (source_id,))
        self.db.commit()

    def get_settings(self) -> dict:
        cursor = self.db.execute("SELECT model_name FROM agent_settings WHERE agent_id = 'scout_agent'")
        row = cursor.fetchone()
        return {"model": row[0] if row else "anthropic/claude-3-haiku"}

    def update_settings(self, model_name: str) -> None:
        self.db.execute("UPDATE agent_settings SET model_name = ? WHERE agent_id = 'scout_agent'", (model_name,))
        self.db.commit()

    async def scrape_source(self, source: dict, query: str = "") -> list[dict]:
        findings = []
        new_links = set()
        session_ts = datetime.now(timezone.utc).isoformat()
        
        try:
            config = source.get('config', {})
            source_id = source['id']
            
            if source['type'] == 'scraper' and "tradingview" in source['url'].lower():
                limit = config.get('limit', 10)
                scraped = await self.scraper.fetch_trending_strategies(limit=limit)
                for f in scraped: 
                    f['timestamp'] = session_ts
                    findings.append(f)
                
            elif source['type'] == 'api' and "tavily" in source['url'].lower():
                api_key = config.get('api_key')
                if api_key:
                    scraped = await self._search_web_tavily(api_key, query, config.get('max_results', 5))
                    for f in scraped: 
                        f['timestamp'] = session_ts
                        findings.append(f)
                    
            elif source['type'] == 'rss':
                limit = config.get('limit', 5)
                scraped = await self._scrape_rss(source['url'], limit)
                for f in scraped: findings.append(f)
            
            # Detect existing links before inserting
            existing_links = {r[0] for r in self.db.execute("SELECT link FROM research_findings WHERE source_id = ?", (source_id,)).fetchall()}
            
            # PERSIST: Save findings to database
            for f in findings:
                if f['link'] not in existing_links:
                    self.db.execute("""
                        INSERT OR IGNORE INTO research_findings (source_id, title, description, link, timestamp)
                        VALUES (?, ?, ?, ?, ?)
                    """, (source_id, f['title'], f['description'], f['link'], f.get('timestamp')))
                    new_links.add(f['link'])
            self.db.commit()
                
        except Exception as e:
            logger.error("ScoutAgent: Scrape failed for %s: %s", source['name'], e)
        
        # Return current findings for the source from DB
        cursor = self.db.execute("""
            SELECT title, description, link, timestamp, ai_summary, alpha_potential 
            FROM research_findings 
            WHERE source_id = ? 
            ORDER BY timestamp DESC LIMIT 40
        """, (source['id'],))
        rows = cursor.fetchall()
        
        return [
            {
                "title": r[0], "description": r[1], "link": r[2], 
                "timestamp": r[3], "ai_summary": r[4], "alpha_potential": r[5],
                "is_from_db": r[2] not in new_links
            }
            for r in rows
        ]

    async def _search_web_tavily(self, api_key: str, query: str, max_results: int) -> list[dict]:
        findings = []
        async with httpx.AsyncClient() as client:
            resp = await client.post(self.search_api_url, json={
                "api_key": api_key, "query": query, "search_depth": "smart", "max_results": max_results
            })
            if resp.status_code == 200:
                for res in resp.json().get('results', []):
                    findings.append({"title": res['title'], "link": res['url'], "description": res['content']})
        return findings

    async def _scrape_rss(self, url: str, limit: int) -> list[dict]:
        findings = []
        headers = {"User-Agent": "Mozilla/5.0"}
        try:
            async with httpx.AsyncClient(headers=headers, timeout=12.0, follow_redirects=True) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    from bs4 import BeautifulSoup
                    soup = BeautifulSoup(resp.text, "xml")
                    items = soup.find_all(['item', 'entry'])
                    for item in items[:limit]:
                        link_node = item.find(['link', 'id'])
                        link = link_node.text.strip() if link_node and not link_node.has_attr('href') else link_node['href'] if link_node else ""
                        title = item.find('title').get_text(strip=True) if item.find('title') else "Untitled"
                        date_node = item.find(['pubDate', 'published', 'updated', 'dc:date'])
                        timestamp = date_node.text.strip() if date_node else datetime.now(timezone.utc).isoformat()
                        desc_node = item.find(['description', 'summary', 'content'])
                        desc = desc_node.get_text(strip=True) if desc_node else ""
                        desc = BeautifulSoup(desc, "html.parser").get_text()[:400]
                        findings.append({"title": title, "link": link, "description": desc, "timestamp": timestamp})
        except Exception as e: logger.error("ScoutAgent RSS error: %s", e)
        return findings

    async def summarize_finding(self, link: str, force: bool = False) -> str:
        """Analyze a singular finding for alpha potential in Thai. Preserves in DB."""
        # Check cache first
        cursor = self.db.execute("SELECT title, description, ai_summary FROM research_findings WHERE link = ?", (link,))
        row = cursor.fetchone()
        if not row: return "Finding not found in database."
        if row[2] and not force: return row[2] # Return existing summary if not forcing

        title, description = row[0], row[1]
        model = self.get_settings()["model"]

        prompt = (
            f"คุณคือ Senior Quant Analyst และ Lead Developer ผู้เชี่ยวชาญด้านการออกแบบระบบเทรดอัตโนมัติ.\n"
            f"จงวิเคราะห์ข้อมูลวิจัยต่อไปนี้เพื่อนำไปประยุกต์ใช้ในระบบเทรดของเรา:\n\n"
            f"หัวข้อ: {title}\n"
            f"รายละเอียด: {description}\n"
            f"แหล่งที่มา: {link}\n\n"
            f"จงสรุปในรูปแบบ Markdown โดยเน้นประเด็นดังนี้:\n"
            f"1. **ระบบคะแนน (Quantitative Scoring)**:\n"
            f"   - **Implementation Feasibility (0-100)**: ความยากง่ายในการเขียนโค้ดลงระบบ (อาศัยข้อมูลที่มีอยู่ เช่น OHLCV, Indicator พื้นฐาน)\n"
            f"   - **Alpha Potential (0-100)**: ศักยภาพในการทำกำไรและความเสี่ยง\n"
            f"2. **แนวคิดหลัก (Core Concept)**: สรุปหัวใจสำคัญใน 1-2 ประโยค\n"
            f"3. **สูตรและสมการกลยุทธ์ (Strategy Blueprint)**: แกะตรรกะหรือสมการทางคณิตศาสตร์ออกมาให้ชัดเจนที่สุด (เช่น IF Signal > 0.5 THEN BUY) หากบทความไม่มีรายละเอียดเชิงลึกพอ ให้ระบุว่า 'ไม่ระบุสูตรชัดเจน'\n"
            f"4. **ข้อเสนอแนะเชิงเทคนิค (Technical Insight)**: การ Mapping ข้อมูลเข้ากับระบบเรา (ต้องใช้ Data อะไรเพิ่มไหม?)\n"
            f"5. **คำตัดสิน (Verdict)**: สรุปความคุ้มค่าในการนำไปพัฒนาต่อ\n\n"
            f"หมายเหตุ: ช่วยเน้นตัวเลขคะแนนให้เด่นชัด (เช่นใช้ตัวหนามากหรือสัญลักษณ์)"
        )
        
        summary = await self.llm_client.complete(prompt, model=model)
        
        # Add metadata stamp
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        summary += f"\n\n---\n*Analyzed at {now_str} (UTC) using {model}*"
        
        # Save to DB
        self.db.execute("UPDATE research_findings SET ai_summary = ? WHERE link = ?", (summary, link))
        self.db.commit()
        return summary

    async def run_scrape_only(self, source_id: int | None = None) -> list[dict]:
        if source_id:
            sources = self.get_sources()
            source = next((s for s in sources if s['id'] == source_id), None)
            if source: return await self.scrape_source(source, query="latest crypto quant alpha")
        return []

    async def scout_for_alpha(self, query: str = "latest crypto trading strategies 2024") -> str:
        all_findings = []
        sources = self.get_sources()
        for source in sources:
            if source['enabled']:
                findings = await self.scrape_source(source, query=query)
                all_findings.extend(findings)
                self.db.execute("UPDATE research_sources SET last_scanned = ? WHERE id = ?", (datetime.now(timezone.utc).isoformat(), source['id']))
        
        top_findings = all_findings[:10]
        if not top_findings: return ""
        
        findings_str = "\n".join([f"- {f['title']}: {f['description']} ({f['link']})" for f in top_findings])
        prompt = (
            f"You are a Senior Quant Researcher.\n"
            f"Review these findings:\n{findings_str}\n\n"
            f"Synthesize these into ONE highly specific, technical trading strategy research topic for crypto futures."
        )
        model = self.get_settings()["model"]
        topic = await self.llm_client.complete(prompt, model=model)
        return topic
