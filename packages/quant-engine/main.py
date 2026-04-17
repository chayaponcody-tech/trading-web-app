"""
FastAPI app + APScheduler bootstrap for the Evolutionary Quant System.

Requirements: 10.1, 10.3, 2.1, 1.1
"""
from __future__ import annotations

import logging
import os
import sqlite3
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from agents.alpha_agent import AlphaAgent
from agents.backtest_agent import BacktestAgent
from agents.data_agent import DataAgent
from agents.sentiment_agent import SentimentAgent
from agents.strategy_manager import StrategyManager
from core.evolutionary_loop import AgentRegistry, EvolutionaryLoop
from core.sandbox_executor import SandboxExecutor

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# ─── Environment Variables ────────────────────────────────────────────────────

BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:4001")
STRATEGY_AI_URL = os.getenv("STRATEGY_AI_URL", "http://strategy-ai:8001")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
BINANCE_API_KEY = os.getenv("BINANCE_API_KEY", "")
# Resolve paths relative to the quant-engine package root so the service
# works both locally (run from packages/quant-engine/) and inside Docker.
_PACKAGE_ROOT = Path(__file__).parent
_REPO_ROOT = _PACKAGE_ROOT.parent.parent

DATA_DIR = Path(os.getenv("DATA_DIR", str(_PACKAGE_ROOT / "data")))
DB_PATH = os.getenv("DB_PATH", str(_REPO_ROOT / "trading_app.db"))
ETL_SYMBOLS = [s.strip() for s in os.getenv("ETL_SYMBOLS", "BTCUSDT,ETHUSDT").split(",")]
ETL_INTERVAL = os.getenv("ETL_INTERVAL", "15m")
DECAY_THRESHOLD = float(os.getenv("DECAY_THRESHOLD", "70"))


# ─── OpenRouter LLM Client ────────────────────────────────────────────────────

class OpenRouterHTTPClient:
    """Thin wrapper around httpx.AsyncClient for OpenRouter API calls."""

    def __init__(self, api_key: str, http_client: httpx.AsyncClient, model: str = "anthropic/claude-3-haiku") -> None:
        self.api_key = api_key
        self.http_client = http_client
        self.model = model

    async def complete(self, prompt: str) -> str:
        response = await self.http_client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
            },
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]


# ─── Shared state (populated during lifespan startup) ─────────────────────────

_db: sqlite3.Connection | None = None
_http_client: httpx.AsyncClient | None = None
_scheduler: AsyncIOScheduler | None = None
_loop: EvolutionaryLoop | None = None


# ─── Scheduled job helpers ────────────────────────────────────────────────────

async def _run_etl_all() -> None:
    """ETL job: fetch OHLCV for all configured symbols."""
    if _loop is None:
        return
    for symbol in ETL_SYMBOLS:
        try:
            await _loop.data_agent.run_etl(symbol, ETL_INTERVAL)
        except Exception as exc:
            logger.error("ETL failed for %s: %s", symbol, exc)


async def _run_sentiment_all() -> None:
    """Sentiment job: compute and save scores for all configured symbols."""
    if _loop is None:
        return
    for symbol in ETL_SYMBOLS:
        try:
            result = await _loop.sentiment_agent.compute_score(symbol)
            await _loop.sentiment_agent.save_score(result)
        except Exception as exc:
            logger.error("Sentiment failed for %s: %s", symbol, exc)


async def _run_generation_cycle() -> None:
    """Generation cycle job: run the full evolutionary loop."""
    if _loop is None:
        return
    try:
        topic = "momentum and mean-reversion hybrid strategy for crypto futures"
        await _loop.run_generation_cycle(topic)
    except Exception as exc:
        logger.error("Generation cycle failed: %s", exc)


async def _run_decay_check() -> None:
    """Decay check job: evaluate alpha decay for all active strategies."""
    if _loop is None:
        return
    try:
        await _loop.run_decay_check()
    except Exception as exc:
        logger.error("Decay check failed: %s", exc)


# ─── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _db, _http_client, _scheduler, _loop

    # ── Startup ──────────────────────────────────────────────────────────────
    logger.info("Starting Quant Engine...")

    # 1. Connect to SQLite
    _db = sqlite3.connect(DB_PATH, check_same_thread=False)
    _db.execute("PRAGMA journal_mode=WAL")
    logger.info("Connected to SQLite: %s", DB_PATH)

    # 2. Create httpx.AsyncClient
    _http_client = httpx.AsyncClient(timeout=30.0)

    # 3. Fetch OpenRouter key from backend global config (fallback to env var)
    openrouter_key = OPENROUTER_API_KEY
    openrouter_model = "anthropic/claude-3-haiku"
    try:
        resp = await _http_client.get(f"{BACKEND_URL}/api/binance/config/internal-keys", timeout=5.0)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("openRouterKey"):
                openrouter_key = data["openRouterKey"]
                logger.info("OpenRouter key loaded from backend global config")
            if data.get("openRouterModel"):
                openrouter_model = data["openRouterModel"]
    except Exception as e:
        logger.warning("Could not fetch keys from backend (%s), using env var fallback", e)

    # 4. Initialize LLM client
    llm_client = OpenRouterHTTPClient(
        api_key=openrouter_key,
        http_client=_http_client,
        model=openrouter_model,
    )

    # 5. Initialize agents
    sandbox = SandboxExecutor(timeout_seconds=30)

    data_agent = DataAgent(
        http_client=_http_client,
        data_dir=DATA_DIR,
        db=_db,
    )

    sentiment_agent = SentimentAgent(
        binance_http_client=_http_client,
        db=_db,
    )

    alpha_agent = AlphaAgent(
        llm_client=llm_client,
        sandbox=sandbox,
        strategy_ai_url=STRATEGY_AI_URL,
        db=_db,
    )

    backtest_agent = BacktestAgent(
        data_agent=data_agent,
        strategy_ai_url=STRATEGY_AI_URL,
        db=_db,
    )

    strategy_manager = StrategyManager(
        db=_db,
        backend_url=BACKEND_URL,
        strategy_ai_url=STRATEGY_AI_URL,
        alpha_agent=alpha_agent,
    )
    # Apply configurable decay threshold from env
    strategy_manager.DECAY_THRESHOLD = DECAY_THRESHOLD

    # 5. Initialize EvolutionaryLoop
    registry = AgentRegistry(
        alpha_agent=alpha_agent,
        backtest_agent=backtest_agent,
        strategy_manager=strategy_manager,
        sentiment_agent=sentiment_agent,
        data_agent=data_agent,
    )
    _loop = EvolutionaryLoop(agents=registry, db=_db)

    # 6. Start APScheduler
    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(_run_etl_all, "cron", minute="*/15", id="etl_job")
    _scheduler.add_job(_run_sentiment_all, "cron", minute="*/15", id="sentiment_job")
    _scheduler.add_job(_run_generation_cycle, "cron", hour="*/6", id="generation_job")
    _scheduler.add_job(_run_decay_check, "cron", hour="*/1", id="decay_job")
    _scheduler.start()
    logger.info("APScheduler started with 4 jobs")

    # 7. Expose agents via app.state for router dependency injection
    app.state.loop = _loop

    yield

    # ── Shutdown ─────────────────────────────────────────────────────────────
    logger.info("Shutting down Quant Engine...")

    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")

    if _http_client is not None:
        await _http_client.aclose()
        logger.info("HTTP client closed")

    if _db is not None:
        _db.close()
        logger.info("DB connection closed")

    app.state.loop = None


# ─── FastAPI App ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="Quant Engine - Evolutionary Trading System",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Router mounting (graceful fallback if routers not yet implemented) ───────

try:
    from routers import (  # type: ignore[import]
        alpha_router,
        backtest_router,
        data_router,
        loop_router,
        sentiment_router,
        strategy_router,
    )

    app.include_router(sentiment_router, prefix="/sentiment")
    app.include_router(data_router, prefix="/data")
    app.include_router(alpha_router, prefix="/alpha")
    app.include_router(backtest_router, prefix="/backtest")
    app.include_router(strategy_router, prefix="/strategies")
    app.include_router(loop_router, prefix="/loop")
    logger.info("All routers mounted successfully")
except ImportError:
    pass  # Routers not yet implemented


# ─── Core Endpoints ───────────────────────────────────────────────────────────

@app.get("/health")
async def health() -> dict:
    """Health check endpoint."""
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/status")
async def status() -> dict:
    """Return the evolutionary loop agent statuses."""
    if _loop is None:
        return {"status": "not_initialized"}
    agent_statuses = _loop.get_status()
    return {
        "status": "running",
        "agents": {
            name: s.model_dump() for name, s in agent_statuses.items()
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ─── Global Configuration Endpoints ──────────────────────────────────────────

from pydantic import BaseModel as _BaseModel
from typing import Optional as _Optional

class QuantConfig(_BaseModel):
    backend_url: str
    strategy_ai_url: str
    etl_symbols: list[str]
    etl_interval: str
    decay_threshold: float
    data_dir: str
    db_path: str

class QuantConfigPatch(_BaseModel):
    backend_url: _Optional[str] = None
    strategy_ai_url: _Optional[str] = None
    etl_symbols: _Optional[list[str]] = None
    etl_interval: _Optional[str] = None
    decay_threshold: _Optional[float] = None


@app.get("/config", response_model=QuantConfig)
async def get_config() -> QuantConfig:
    """Return current runtime configuration."""
    return QuantConfig(
        backend_url=BACKEND_URL,
        strategy_ai_url=STRATEGY_AI_URL,
        etl_symbols=ETL_SYMBOLS,
        etl_interval=ETL_INTERVAL,
        decay_threshold=DECAY_THRESHOLD,
        data_dir=str(DATA_DIR),
        db_path=DB_PATH,
    )


@app.patch("/config", response_model=QuantConfig)
async def patch_config(body: QuantConfigPatch) -> QuantConfig:
    """
    Update runtime configuration without restarting.

    - etl_symbols / etl_interval: reschedules the ETL APScheduler job
    - decay_threshold: updates StrategyManager threshold immediately
    - backend_url / strategy_ai_url: updates agent HTTP targets
    """
    global BACKEND_URL, STRATEGY_AI_URL, ETL_SYMBOLS, ETL_INTERVAL, DECAY_THRESHOLD

    if body.backend_url is not None:
        BACKEND_URL = body.backend_url
        if _loop is not None:
            _loop.strategy_manager.backend_url = BACKEND_URL
        logger.info("Config updated: backend_url=%s", BACKEND_URL)

    if body.strategy_ai_url is not None:
        STRATEGY_AI_URL = body.strategy_ai_url
        if _loop is not None:
            _loop.strategy_manager.strategy_ai_url = STRATEGY_AI_URL
            _loop.alpha_agent.strategy_ai_url = STRATEGY_AI_URL
            _loop.backtest_agent.strategy_ai_url = STRATEGY_AI_URL
        logger.info("Config updated: strategy_ai_url=%s", STRATEGY_AI_URL)

    if body.decay_threshold is not None:
        DECAY_THRESHOLD = body.decay_threshold
        if _loop is not None:
            _loop.strategy_manager.DECAY_THRESHOLD = DECAY_THRESHOLD
        logger.info("Config updated: decay_threshold=%s", DECAY_THRESHOLD)

    if body.etl_symbols is not None:
        ETL_SYMBOLS = body.etl_symbols
        logger.info("Config updated: etl_symbols=%s", ETL_SYMBOLS)

    if body.etl_interval is not None:
        ETL_INTERVAL = body.etl_interval
        # Reschedule ETL job with new interval
        if _scheduler is not None:
            try:
                _scheduler.remove_job("etl_job")
                _scheduler.add_job(_run_etl_all, "cron", minute="*/15", id="etl_job")
            except Exception as e:
                logger.warning("Could not reschedule ETL job: %s", e)
        logger.info("Config updated: etl_interval=%s", ETL_INTERVAL)

    return await get_config()
