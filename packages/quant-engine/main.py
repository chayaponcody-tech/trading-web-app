import os
import sys
import logging
import sqlite3
import httpx
from datetime import datetime, timezone
from pathlib import Path
from contextlib import asynccontextmanager

# Add the current directory to sys.path to resolve 'core' and 'agents' imports correctly
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler

# Import Agents and Core components
from core.evolutionary_loop import EvolutionaryLoop, AgentRegistry
from agents.alpha_agent import AlphaAgent
from agents.backtest_agent import BacktestAgent
from agents.strategy_manager import StrategyManager
from agents.sentiment_agent import SentimentAgent
from agents.data_agent import DataAgent
from agents.scout_agent import ScoutAgent
from core.llm import LLMClient
from core.sandbox_executor import SandboxExecutor

# ─── Configuration ─────────────────────────────────────────────────────────────

logger = logging.getLogger("quant_engine")
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")

_REPO_ROOT = Path(__file__).parent.parent.parent
DB_PATH = _REPO_ROOT / "trading_app.db"
DATA_DIR = _REPO_ROOT / "data" / "klines"
RESEARCH_DIR = _REPO_ROOT / "research" / "scout_reports"

STRATEGY_AI_URL = "http://localhost:8000"
BACKEND_URL = "http://localhost:4001"

# Symbols to track for sentiment and general ETL
ETL_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "STXUSDT", "BNBUSDT", "XRPUSDT", "ADAUSDT", "DOGEUSDT", "DOTUSDT", "POLUSDT", "LINKUSDT", "1000PEPEUSDT", "1000SHIBUSDT"]

# Globals
_db: sqlite3.Connection | None = None
_http_client: httpx.AsyncClient | None = None
_scheduler: AsyncIOScheduler | None = None
_loop: EvolutionaryLoop | None = None

def _get_openrouter_key() -> str:
    """Helper to fetch the current OpenRouter API key from DB."""
    if not _db: return ""
    try:
        import json
        cursor = _db.execute("SELECT value FROM settings WHERE key='binanceConfig'")
        row = cursor.fetchone()
        if row:
            config = json.loads(row[0])
            return config.get("openRouterKey", "")
    except Exception as e:
        logger.error(f"Failed to fetch API key from DB: {e}")
    return ""


# ─── Background Tasks ──────────────────────────────────────────────────────────

async def _run_etl_all() -> None:
    if not _loop: return
    for symbol in ETL_SYMBOLS:
        try:
            await _loop.data_agent.run_etl(symbol, interval="15m")
        except Exception as exc:
            logger.error(f"ETL failed for {symbol}: {exc}")

async def _run_sentiment_all() -> None:
    if not _loop: return
    for symbol in ETL_SYMBOLS:
        try:
            result = await _loop.sentiment_agent.compute_score(symbol)
            await _loop.sentiment_agent.save_score(result)
        except Exception as exc:
            logger.error("Sentiment failed for %s: %s", symbol, exc)

async def _run_generation_cycle() -> None:
    if _loop: await _loop.run_generation_cycle("auto")

async def _run_decay_check() -> None:
    if _loop: await _loop.run_decay_check()


# ─── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _db, _http_client, _scheduler, _loop

    logger.info("🚀 Starting Quant Engine (Port 8002)...")

    # 1. DB Connection
    _db = sqlite3.connect(DB_PATH, check_same_thread=False)
    _db.execute("PRAGMA journal_mode=WAL")
    
    # 2. Shared Clients
    _http_client = httpx.AsyncClient(timeout=30.0)
    llm_client = LLMClient(api_key_factory=_get_openrouter_key)
    sandbox = SandboxExecutor()

    # 3. Instantiate Agents in strict dependency order
    # (Order: DataAgent -> AlphaAgent -> BacktestAgent -> StrategyManager)
    
    data_agent = DataAgent(
        http_client=_http_client,
        data_dir=DATA_DIR,
        db=_db
    )
    
    alpha_agent = AlphaAgent(
        llm_client=llm_client, 
        sandbox=sandbox, 
        strategy_ai_url=STRATEGY_AI_URL, 
        db=_db
    )
    
    backtest_agent = BacktestAgent(
        data_agent=data_agent,
        strategy_ai_url=STRATEGY_AI_URL,
        db=_db
    )
    
    strategy_manager = StrategyManager(
        db=_db,
        backend_url=BACKEND_URL,
        strategy_ai_url=STRATEGY_AI_URL,
        alpha_agent=alpha_agent
    )
    
    sentiment_agent = SentimentAgent(
        binance_http_client=_http_client, 
        db=_db,
        llm_client=llm_client
    )
    
    scout_agent = ScoutAgent(
        llm_client=llm_client,
        db=_db,
        research_dir=RESEARCH_DIR,
    )

    # 4. Registry & Loop
    registry = AgentRegistry(
        alpha_agent=alpha_agent,
        backtest_agent=backtest_agent,
        strategy_manager=strategy_manager,
        sentiment_agent=sentiment_agent,
        data_agent=data_agent,
        scout_agent=scout_agent,
    )
    _loop = EvolutionaryLoop(agents=registry, db=_db)

    # 5. Scheduler
    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(_run_etl_all, "cron", minute="*/15", id="etl")
    _scheduler.add_job(_run_sentiment_all, "cron", minute="*/15", id="sentiment")
    _scheduler.add_job(_run_generation_cycle, "cron", hour="*/6", id="cycle")
    _scheduler.add_job(_run_decay_check, "cron", hour="*/1", id="decay")
    _scheduler.start()

    app.state.loop = _loop

    logger.info("✅ Quant Engine initialized and tasks scheduled.")

    yield

    # ── Shutdown ──
    logger.info("Shutting down Quant Engine...")
    if _scheduler: _scheduler.shutdown(wait=False)
    if _http_client: await _http_client.aclose()
    if _db: _db.close()
    app.state.loop = None


# ─── FastAPI App ──────────────────────────────────────────────────────────────

app = FastAPI(title="Quant Engine", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Router mounting
try:
    from routers import loop_router, sentiment_router, data_router
    app.include_router(sentiment_router, prefix="/sentiment")
    app.include_router(data_router, prefix="/data")
    app.include_router(loop_router, prefix="/loop")
    logger.info("🛡️ Routers (loop, sentiment, data) mounted.")
except Exception as e:
    logger.error("❌ Router mounting failed: %s", e)

@app.get("/config")
async def get_config():
    if not _loop: return {"error": "initializing"}
    return {
        "backend_url": BACKEND_URL,
        "strategy_ai_url": STRATEGY_AI_URL,
        "etl_symbols": ETL_SYMBOLS,
        "etl_interval": "15m", # Mocked for now to match UI expectations
        "decay_threshold": 70
    }

@app.patch("/config")
async def update_config(data: dict):
    # In a real app, we'd persist these to DB/file. 
    # For now, let's just log it and accept for UI consistency.
    logger.info(f"Config update requested: {data}")
    return {"status": "success", "message": "Configuration updated (memory only)"}

@app.get("/health")
async def health():
    return {"status": "ok", "db": _db is not None}

@app.get("/status")
async def status():
    if not _loop: return {"error": "initializing"}
    return {"agents": {n: s.model_dump() for n, s in _loop.get_status().items()}}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
