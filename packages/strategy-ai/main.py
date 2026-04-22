from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import os
import time
import requests
import numpy as np

from logger import get_logger
from registry import StrategyRegistry
from pine_loader import load_pine_strategies
from db_strategy_loader import load_db_strategies
from strategies.bollinger_breakout import BollingerBreakout
from strategies.ema_cross import EMACross
from strategies.rsi_strategy import RSIStrategy
from strategies.bollinger_bands import BollingerBandsStrategy
from strategies.composite import EMARSIStrategy, BBRSIStrategy, EMABBRSIStrategy
from strategies.ema_scalp import EMAScalpStrategy
from strategies.stoch_rsi import StochRSIStrategy
from strategies.vwap_scalp import VWAPScalpStrategy
from strategies.scouter import ScouterStrategy
from strategies.grid import GridStrategy
from strategies.oi_funding_alpha import OIFundingAlphaStrategy
from strategies.sats import SelfAwareTrendSystem
from confidence_engine import ConfidenceEngine
from microstructure_filter import check as microstructure_check
from schemas import AnalyzeRequest, AnalyzeResponse, BatchAnalyzeRequest, BatchAnalyzeResponse, StrategyListResponse, StrategyEntry, RegisterDynamicRequest, UnregisterRequest, SavePineRequest, OptimizeRequest, OptimizeResponse, VbtOptimizeRequest, VbtOptimizeResponse
from vbt_optimizer import run_vbt_optimize, VBT_AVAILABLE
import optuna

optuna.logging.set_verbosity(optuna.logging.WARNING)
from base_strategy import BaseStrategy

app = FastAPI(title="CryptoSmartTrade - Strategy AI (Quant Brain)")

log = get_logger("strategy-ai")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def activity_log_middleware(request: Request, call_next):
    """Log every incoming request with method, path, status, and latency."""
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000

    # Skip noisy health-check spam
    if request.url.path not in ("/health", "/"):
        log.info(
            f"{request.method} {request.url.path} → {response.status_code} "
            f"({elapsed_ms:.1f}ms)"
        )

    return response

GATEWAY_URL = os.environ.get("GATEWAY_INTERNAL_URL", "http://backend:4001")
AI_MODE = os.environ.get("STRATEGY_AI_MODE", "ml")  # off | ml | full
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "meta-llama/llama-3.1-8b-instruct")

CONFIDENCE_THRESHOLD = 0.60

# ─── Registry Bootstrap ───────────────────────────────────────────────────────

registry = StrategyRegistry()
registry.register("bb_breakout", BollingerBreakout())
registry.register("EMA", EMACross())
registry.register("EMA_CROSS", EMACross())
registry.register("EMA_CROSS_V2", EMACross())
registry.register("RSI", RSIStrategy())
registry.register("RSI_TREND", RSIStrategy())
registry.register("BB", BollingerBandsStrategy())
registry.register("EMA_RSI", EMARSIStrategy())
registry.register("BB_RSI", BBRSIStrategy())
registry.register("EMA_BB_RSI", EMABBRSIStrategy())
registry.register("EMA_SCALP", EMAScalpStrategy())
registry.register("STOCH_RSI", StochRSIStrategy())
registry.register("VWAP_SCALP", VWAPScalpStrategy())
registry.register("AI_SCOUTER", ScouterStrategy())
registry.register("GRID", GridStrategy())
registry.register("AI_GRID", GridStrategy())
registry.register("AI_GRID_SCALP", GridStrategy())
registry.register("AI_GRID_SWING", GridStrategy())
registry.register("RSI_DIVERGENCE", RSIStrategy())
registry.register("BOLLINGER_BREAKOUT", BollingerBreakout())
registry.register("OI_FUNDING_ALPHA", OIFundingAlphaStrategy())
registry.register("SATS", SelfAwareTrendSystem())

loaded = load_pine_strategies(registry, "strategies/")
log.info(f"🌲 [PineLoader] Loaded {len(loaded)} pine strategies: {loaded}")

db_loaded = load_db_strategies(registry)
log.info(f"🗄️  [DBLoader] Loaded {len(db_loaded)} DB strategies: {[k for k,_ in db_loaded]}")

confidence_engine = ConfidenceEngine(
    mode=AI_MODE,
    openrouter_key=OPENROUTER_API_KEY,
    openrouter_model=OPENROUTER_MODEL,
)


# ─── Feature Engineering ──────────────────────────────────────────────────────

def compute_atr(highs: list[float], lows: list[float], closes: list[float], period: int = 14) -> float:
    """Compute ATR(period) from OHLC arrays. Returns 0.0 if insufficient data."""
    h = np.array(highs, dtype=float)
    l = np.array(lows, dtype=float)
    c = np.array(closes, dtype=float)
    n = min(len(h), len(l), len(c))
    if n < period + 1:
        return 0.0
    h, l, c = h[:n], l[:n], c[:n]
    tr = np.maximum(h[1:] - l[1:], np.maximum(np.abs(h[1:] - c[:-1]), np.abs(l[1:] - c[:-1])))
    return float(np.mean(tr[-period:]))


def compute_batch_features(closes: list[float], highs: list[float] = None, lows: list[float] = None) -> list[dict]:
    """Vectorized calculation of features for all indices in the dataset. O(n)."""
    arr = np.array(closes, dtype=float)
    n = len(arr)
    if n < 50:
        return [{} for _ in range(n)]

    import pandas as pd
    import ta
    df = pd.DataFrame({"close": arr})
    if highs: df["high"] = np.array(highs, dtype=float)
    if lows: df["low"] = np.array(lows, dtype=float)

    # Calculate indicators for the ENTIRE array at once
    rsi = ta.momentum.rsi(df["close"], window=14)
    ema20 = ta.trend.ema_indicator(df["close"], window=20)
    ema50 = ta.trend.ema_indicator(df["close"], window=50)
    
    bb = ta.volatility.BollingerBands(df["close"], window=20, window_dev=2)
    bb_upper = bb.bollinger_hband()
    bb_lower = bb.bollinger_lband()
    bb_pos = (df["close"] - bb_lower) / (bb_upper - bb_lower + 1e-9)

    # Returns for volatility
    rets = df["close"].pct_change()
    vol = rets.rolling(20).std()
    
    # Momentum
    mom = df["close"].pct_change(10)

    # ATR (requires highs/lows)
    atr_series = pd.Series([0.0] * n)
    if "high" in df and "low" in df:
        atr_series = ta.volatility.average_true_range(df["high"], df["low"], df["close"], window=14)

    features_list = []
    for i in range(n):
        features_list.append({
            "rsi": float(rsi.iloc[i]) if not pd.isna(rsi.iloc[i]) else 50.0,
            "ema20": float(ema20.iloc[i]) if not pd.isna(ema20.iloc[i]) else 0.0,
            "ema50": float(ema50.iloc[i]) if not pd.isna(ema50.iloc[i]) else 0.0,
            "ema_cross": float(ema20.iloc[i] - ema50.iloc[i]) if not pd.isna(ema20.iloc[i]) and not pd.isna(ema50.iloc[i]) else 0.0,
            "bb_position": float(bb_pos.iloc[i]) if not pd.isna(bb_pos.iloc[i]) else 0.5,
            "volatility": float(vol.iloc[i]) if not pd.isna(vol.iloc[i]) else 0.0,
            "momentum": float(mom.iloc[i]) if not pd.isna(mom.iloc[i]) else 0.0,
            "price": float(df["close"].iloc[i]),
            "atr": float(atr_series.iloc[i]) if not pd.isna(atr_series.iloc[i]) else 0.0,
        })
    return features_list



# ─── Regime Detection ─────────────────────────────────────────────────────────

def detect_regime(features: dict) -> str:
    """Classify market regime: trending_up | trending_down | ranging | volatile"""
    if not features:
        return "unknown"

    vol = features.get("volatility", 0)
    momentum = features.get("momentum", 0)
    ema_cross = features.get("ema_cross", 0)

    if vol > 0.03:
        return "volatile"
    if abs(momentum) > 0.02 and abs(ema_cross) > 0:
        return "trending_up" if momentum > 0 else "trending_down"
    return "ranging"


# ─── ML-style Confidence Score (Rule-based, no external API) ─────────────────

def compute_confidence(signal: str, features: dict, regime: str) -> tuple[float, str]:
    """
    Compute confidence score 0.0-1.0 using quantitative rules.
    No LLM call — runs entirely in-container.
    """
    if not features:
        return 0.5, "ข้อมูลไม่เพียงพอ"

    score = 0.5
    reasons = []

    rsi = features.get("rsi", 50)
    bb_pos = features.get("bb_position", 0.5)
    ema_cross = features.get("ema_cross", 0)
    momentum = features.get("momentum", 0)
    vol = features.get("volatility", 0)

    if signal == "LONG":
        # RSI confirmation
        if rsi < 35:
            score += 0.15
            reasons.append(f"RSI oversold ({rsi:.1f})")
        elif rsi < 50:
            score += 0.05
        elif rsi > 70:
            score -= 0.20
            reasons.append(f"RSI overbought ({rsi:.1f}) — risky LONG")

        # BB position
        if bb_pos < 0.2:
            score += 0.15
            reasons.append("ราคาใกล้ BB lower")
        elif bb_pos > 0.8:
            score -= 0.15

        # EMA trend
        if ema_cross > 0:
            score += 0.10
            reasons.append("EMA20 > EMA50 (uptrend)")
        else:
            score -= 0.10

        # Momentum
        if momentum > 0.01:
            score += 0.05

    elif signal == "SHORT":
        if rsi > 65:
            score += 0.15
            reasons.append(f"RSI overbought ({rsi:.1f})")
        elif rsi > 50:
            score += 0.05
        elif rsi < 30:
            score -= 0.20
            reasons.append(f"RSI oversold ({rsi:.1f}) — risky SHORT")

        if bb_pos > 0.8:
            score += 0.15
            reasons.append("ราคาใกล้ BB upper")
        elif bb_pos < 0.2:
            score -= 0.15

        if ema_cross < 0:
            score += 0.10
            reasons.append("EMA20 < EMA50 (downtrend)")
        else:
            score -= 0.10

        if momentum < -0.01:
            score += 0.05

    # Regime adjustment
    if regime == "volatile":
        score -= 0.15
        reasons.append("ตลาด volatile — ลด confidence")
    elif regime in ("trending_up", "trending_down"):
        score += 0.05

    # High volatility penalty
    if vol > 0.025:
        score -= 0.10

    score = max(0.0, min(1.0, score))
    reason_text = " | ".join(reasons) if reasons else f"confidence {score:.0%}"
    return score, reason_text


# ─── LLM Edge Case Analysis (full mode only) ─────────────────────────────────

def llm_analyze(signal: str, features: dict, regime: str, symbol: str) -> tuple[float, str]:
    """Call LLM only when confidence is in gray zone (0.5-0.7). Costs AI credit."""
    if not OPENROUTER_API_KEY:
        return 0.5, "LLM key missing"

    prompt = f"""You are a quant trading risk manager. Analyze this signal:
Symbol: {symbol}
Signal: {signal}
Regime: {regime}
Features: RSI={features.get('rsi', 0):.1f}, BB_position={features.get('bb_position', 0):.2f}, EMA_cross={features.get('ema_cross', 0):.4f}, volatility={features.get('volatility', 0):.4f}, momentum={features.get('momentum', 0):.4f}

Should we enter this trade? Reply with JSON only:
{{"approved": true/false, "confidence": 0.0-1.0, "reason": "brief Thai reason"}}"""

    try:
        resp = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}", "Content-Type": "application/json"},
            json={"model": OPENROUTER_MODEL, "messages": [{"role": "user", "content": prompt}], "response_format": {"type": "json_object"}},
            timeout=10
        )
        content = resp.json()["choices"][0]["message"]["content"]
        import json
        data = json.loads(content)
        return float(data.get("confidence", 0.5)), data.get("reason", "LLM analyzed")
    except Exception as e:
        return 0.5, f"LLM error: {str(e)[:50]}"


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"status": "AI Signal Engine Online", "mode": AI_MODE, "role": "Strategy Layer (Python)"}


@app.get("/health")
async def health():
    return {"status": "ok", "mode": AI_MODE}


@app.post("/strategy/analyze", response_model=AnalyzeResponse)
async def strategy_analyze(req: AnalyzeRequest):
    """
    Main analysis endpoint.
    1. Run strategy to get raw signal from OHLCV
    2. Run microstructure filter (Funding + OI) — replaces JS _checkMicrostructure
    3. Compute confidence score
    4. Return final signal + confidence + stoploss
    """
    try:
        strategy = registry.get(req.strategy)
    except KeyError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # ── Step 1: Strategy computes signal from raw OHLCV ──────────────────────
    result = strategy.compute_signal(req.closes, req.highs, req.lows, req.volumes, req.params)
    raw_signal = result["signal"]

    # ── Step 2: Microstructure Filter (Funding Rate + OI) ────────────────────
    micro = microstructure_check(
        signal=raw_signal,
        funding_rate=req.funding_rate,
        oi_change_pct=req.oi_change_pct,
        funding_threshold=req.funding_threshold or 0.0005,
    )

    micro_detail = {
        "passed": micro.passed,
        "reason": micro.reason,
        "funding_rate": micro.funding_rate,
        "oi_change_pct": micro.oi_change_pct,
        "penalty": micro.penalty,
    }

    if not micro.passed:
        log.warning(f"🚫 [{req.symbol}] Microstructure BLOCK: {micro.reason}")
        features = compute_features(req.closes, req.highs, req.lows)
        regime = detect_regime(features)
        atr_value = features.get("atr", 0.0) or None
        return AnalyzeResponse(
            symbol=req.symbol,
            signal="NONE",
            confidence=0.0,
            stoploss=None,
            reason=f"[Microstructure Block] {micro.reason}",
            metadata=result["metadata"],
            strategy=req.strategy,
            microstructure=micro_detail,
            atr_value=round(atr_value, 6) if atr_value else None,
            regime=regime,
        )

    # ── Step 3: Feature engineering + Confidence score ───────────────────────
    # Legacy compute_features (single point)
    def compute_features_single(cls, hi, lo):
        batch = compute_batch_features(cls, hi, lo)
        return batch[-1] if batch else {}

    features = compute_features_single(req.closes, req.highs, req.lows)
    regime = detect_regime(features)

    atr_value = features.get("atr", 0.0) or None

    confidence, reason = confidence_engine.score(
        raw_signal, features, regime, result["metadata"],
        closes=req.closes, highs=req.highs, lows=req.lows,
    )

    # Apply microstructure soft penalty
    if micro.penalty > 0:
        confidence = max(0.0, confidence - micro.penalty)
        reason = f"{reason} | OI penalty -{micro.penalty:.0%}"

    final_signal = raw_signal if confidence >= CONFIDENCE_THRESHOLD else "NONE"

    # Enhanced breakdown for the log
    rsi = features.get("rsi", 0)
    bb_pos = features.get("bb_position", 0)
    ema_cross = features.get("ema_cross", 0)
    vol = features.get("volatility", 0)
    
    breakdown = f"[RSI:{rsi:.1f} BB:{bb_pos:.2f} EMA:{ema_cross:.4f} Vol:{vol:.4f}]"

    atr_str = f"{atr_value:.4f}" if atr_value else "N/A"
    log.info(
        f"🧠 [{req.symbol}] {raw_signal}→{final_signal} conf={confidence:.0%} {breakdown} | {reason}"
    )

    return AnalyzeResponse(
        symbol=req.symbol,
        signal=final_signal,
        confidence=round(confidence, 4),
        stoploss=result["stoploss"] if final_signal != "NONE" else None,
        reason=reason,
        metadata=result["metadata"],
        strategy=req.strategy,
        microstructure=micro_detail,
        atr_value=round(atr_value, 6) if atr_value else None,
        regime=regime,
    )


@app.post("/strategy/analyze/batch", response_model=BatchAnalyzeResponse)
async def strategy_analyze_batch(req: BatchAnalyzeRequest):
    """
    Batch analysis endpoint.
    Returns a SignalArray and ConfidenceArray for all N candles in the input.

    Validation:
    - closes must have >= 50 elements (HTTP 422 otherwise)
    - all arrays (closes, highs, lows, volumes) must have the same length (HTTP 422 otherwise)

    Signal computation uses no-look-ahead equivalence: for candle i, only the
    first (i+1) elements of each array are visible to the strategy, matching
    what POST /strategy/analyze would see if called N times with growing slices.
    Indicator math inside each strategy uses vectorized pandas/numpy over the slice.
    """
    n = len(req.closes)

    if n < 50:
        raise HTTPException(
            status_code=422,
            detail=f"closes must have at least 50 elements, got {n}",
        )

    lengths = {"highs": len(req.highs), "lows": len(req.lows), "volumes": len(req.volumes)}
    mismatched = {k: v for k, v in lengths.items() if v != n}
    if mismatched:
        detail = "; ".join(f"{k} has {v} elements (expected {n})" for k, v in mismatched.items())
        raise HTTPException(status_code=422, detail=f"Array length mismatch: {detail}")

    try:
        strategy = registry.get(req.strategy)
    except KeyError as e:
        raise HTTPException(status_code=400, detail=str(e))

    closes_arr = np.array(req.closes, dtype=float)
    highs_arr = np.array(req.highs, dtype=float)
    lows_arr = np.array(req.lows, dtype=float)
    volumes_arr = np.array(req.volumes, dtype=float)

    signals: list[str] = []
    confidences: list[float] = []
    metadatas: list[dict] = []

    # ── Step 1: Call vectorized strategy execution ────────────────────────
    batch_result = strategy.compute_batch_signals(
        req.closes, req.highs, req.lows, req.volumes, req.params
    )
    raw_signals = batch_result["signals"]
    raw_metadatas = batch_result["metadatas"]

    # ── Step 2: Vectorized Feature Engineering for the whole batch ────────
    all_features = compute_batch_features(req.closes, req.highs, req.lows)

    signals: list[str] = []
    confidences: list[float] = []
    metadatas: list[dict] = []

    # ── Step 3: Fast loop for confidence scoring (no redundant indicator math) ──
    for i in range(n):
        raw_signal = raw_signals[i]
        features = all_features[i]
        regime = detect_regime(features)
        
        # Note: microstructure check is skipped for backtesting efficiency 
        # as it would require historical funding/OI data which is often missing
        
        confidence, _ = confidence_engine.score(
            raw_signal, features, regime, raw_metadatas[i],
            closes=None, # Prevents re-extracting features in ConfidenceEngine
        )
        
        signals.append(raw_signal)
        confidences.append(round(confidence, 4))
        metadatas.append(raw_metadatas[i])


    longs  = signals.count("LONG")
    shorts = signals.count("SHORT")
    log.info(
        f"[Batch] strategy={req.strategy} candles={n} "
        f"LONG={longs} SHORT={shorts} NONE={n - longs - shorts}"
    )

    return BatchAnalyzeResponse(signals=signals, confidences=confidences, metadatas=metadatas)


@app.get("/strategy/list", response_model=StrategyListResponse)
async def strategy_list():
    """Return all registered Python strategy keys with engine tag."""
    entries = [{"key": k, "engine": "python"} for k in registry.list_keys()]
    return StrategyListResponse(strategies=entries)


@app.post("/strategy/register-dynamic")
async def register_dynamic(req: RegisterDynamicRequest):
    """Compile and register a dynamic Python strategy class at runtime."""
    namespace = {}
    try:
        exec(req.python_code, namespace)
    except SyntaxError as e:
        raise HTTPException(status_code=400, detail=f"Python syntax error: {e}")

    strategy_class = None
    for obj in namespace.values():
        if isinstance(obj, type) and issubclass(obj, BaseStrategy) and obj is not BaseStrategy:
            strategy_class = obj
            break

    if not strategy_class:
        raise HTTPException(status_code=400, detail="ไม่พบ class ที่ extend BaseStrategy")

    registry.register(req.key, strategy_class())
    log.info(f"[Registry] Dynamic strategy registered: key={req.key}")
    return {"registered": True, "key": req.key}


@app.delete("/strategy/unregister")
async def unregister_strategy(req: UnregisterRequest):
    """Remove a dynamically registered strategy from the registry."""
    if req.key not in registry._strategies:
        return {"unregistered": False}
    del registry._strategies[req.key]
    log.info(f"[Registry] Strategy unregistered: key={req.key}")
    return {"unregistered": True}


@app.post("/strategy/save-pine")
async def save_pine(req: SavePineRequest):
    """Save a Pine Script-converted strategy to disk and register it permanently."""
    if req.key in registry._strategies:
        raise HTTPException(status_code=409, detail="Strategy name already exists")

    os.makedirs("strategies", exist_ok=True)
    with open(f"strategies/{req.filename}", "w") as f:
        f.write(req.python_code)

    namespace = {}
    try:
        exec(req.python_code, namespace)
    except SyntaxError as e:
        raise HTTPException(status_code=400, detail=f"Python syntax error: {e}")

    strategy_class = None
    for obj in namespace.values():
        if isinstance(obj, type) and issubclass(obj, BaseStrategy) and obj is not BaseStrategy:
            strategy_class = obj
            break

    if not strategy_class:
        raise HTTPException(status_code=400, detail="ไม่พบ class ที่ extend BaseStrategy")

    registry.register(req.key, strategy_class())
    log.info(f"[Registry] Pine strategy saved and registered: key={req.key} file={req.filename}")
    return {"strategyKey": req.key, "message": "บันทึกสำเร็จ"}


@app.post("/analyze-signal")
async def analyze_signal(req: Request):
    """
    Main entry point from Node.js BotManager.
    Receives market data, runs quant analysis, returns signal + confidence.
    """
    data = await req.json()
    symbol = data.get("symbol", "BTCUSDT")
    signal = data.get("signal", "NONE")
    closes = data.get("closes", [])
    mode = data.get("mode", AI_MODE)

    if signal == "NONE" or not closes:
        return {"symbol": symbol, "signal": "NONE", "confidence": 0.0, "reason": "No signal to analyze"}

    # Step 1: Feature engineering
    features = compute_features(closes)

    # Step 2: Regime detection
    regime = detect_regime(features)

    # Step 3: ML confidence score (always runs, no API cost)
    confidence, reason = compute_confidence(signal, features, regime)

    # Step 4: LLM edge case (only in "full" mode AND gray zone)
    if mode == "full" and 0.50 <= confidence <= 0.70:
        llm_conf, llm_reason = llm_analyze(signal, features, regime, symbol)
        # Blend ML + LLM
        confidence = (confidence + llm_conf) / 2
        reason = f"[ML+LLM] {llm_reason}"

    log.info(f"🧠 [{symbol}] signal={signal} regime={regime} confidence={confidence:.2f} — {reason}")

    return {
        "symbol": symbol,
        "signal": signal if confidence >= 0.60 else "NONE",
        "confidence": round(confidence, 4),
        "regime": regime,
        "reason": reason,
        "features": {k: round(v, 4) for k, v in features.items() if k != "price"},
    }


@app.post("/strategy/optimize", response_model=OptimizeResponse)
async def strategy_optimize(req: OptimizeRequest):
    """
    Bayesian parameter optimization using Optuna.
    Searches the parameter space to maximize SharpeRatio over the provided OHLCV data.
    """
    try:
        strategy = registry.get(req.strategy)
    except KeyError as e:
        raise HTTPException(status_code=400, detail=str(e))

    closes = req.closes
    highs = req.highs
    lows = req.lows
    volumes = req.volumes

    # Length Validation
    lengths = [len(closes), len(highs), len(lows), len(volumes)]
    if len(set(lengths)) > 1:
        log.error(f"❌ Array length mismatch: C={len(closes)}, H={len(highs)}, L={len(lows)}, V={len(volumes)}")
        raise HTTPException(status_code=400, detail=f"Array length mismatch: {lengths}")

    log.info(f"[Optimize/Optuna] strategy={req.strategy} candles={len(closes)} trials={req.n_trials}")

    def objective(trial: optuna.Trial) -> float:
        params = {}
        for param_name, bounds in req.search_space.items():
            lo, hi = bounds[0], bounds[1]
            if isinstance(lo, int) and isinstance(hi, int):
                params[param_name] = trial.suggest_int(param_name, lo, hi)
            else:
                params[param_name] = trial.suggest_float(param_name, float(lo), float(hi))

        # For SharpeRatio we need a signal series — use batch-style iteration
        signal_list = []
        for i in range(len(closes)):
            end = i + 1
            r = strategy.compute_signal(
                closes[:end], highs[:end], lows[:end], volumes[:end], params
            )
            signal_list.append(r.get("signal", "NONE"))

        # Compute returns based on signals
        returns = []
        for i in range(1, len(closes)):
            sig = signal_list[i - 1]
            ret = (closes[i] - closes[i - 1]) / closes[i - 1]
            if sig == "LONG":
                returns.append(ret)
            elif sig == "SHORT":
                returns.append(-ret)
            else:
                returns.append(0.0)

        if len(returns) < 2:
            return 0.0

        arr = np.array(returns, dtype=float)
        std = np.std(arr)
        if std == 0:
            return 0.0

        sharpe = float(np.mean(arr) / std * np.sqrt(252))
        return sharpe

    study = optuna.create_study(direction="maximize")
    study.optimize(objective, n_trials=req.n_trials)

    log.info(
        f"[Optimize/Optuna] done strategy={req.strategy} "
        f"best_sharpe={study.best_value:.4f} best_params={study.best_params}"
    )

    return OptimizeResponse(
        best_params=study.best_params,
        best_sharpe=study.best_value,
        n_trials=len(study.trials),
    )


@app.post("/strategy/optimize/vectorbt", response_model=VbtOptimizeResponse)
async def strategy_optimize_vectorbt(req: VbtOptimizeRequest):
    """
    VectorBT-powered parameter optimization.

    Faster than /strategy/optimize (Optuna) for grid-style sweeps because
    vectorbt runs portfolio simulation in vectorized NumPy/Numba instead of
    a Python loop. Falls back to pure NumPy if vectorbt is not installed.

    Returns best_params, best_sharpe, best_return, best_max_drawdown.
    """
    try:
        strategy = registry.get(req.strategy)
    except KeyError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Length Validation
    lengths = [len(req.closes), len(req.highs), len(req.lows), len(req.volumes)]
    if len(set(lengths)) > 1:
        log.error(f"❌ VBT Array length mismatch: C={len(req.closes)}, H={len(req.highs)}, L={len(req.lows)}, V={len(req.volumes)}")
        raise HTTPException(status_code=400, detail=f"Array length mismatch: {lengths}")

    log.info(
        f"[Optimize/VBT] strategy={req.strategy} candles={len(req.closes)} "
        f"trials={req.n_trials} vbt_available={VBT_AVAILABLE}"
    )

    result = run_vbt_optimize(
        strategy=strategy,
        closes=req.closes,
        highs=req.highs,
        lows=req.lows,
        volumes=req.volumes,
        search_space=req.search_space,
        n_trials=req.n_trials,
        fees=req.fees,
        slippage=req.slippage,
        init_cash=req.init_cash,
    )

    log.info(
        f"[Optimize/VBT] done strategy={req.strategy} engine={result['engine']} "
        f"best_sharpe={result['best_sharpe']} return={result['best_return']}% "
        f"mdd={result['best_max_drawdown']} best_params={result['best_params']}"
    )

    return VbtOptimizeResponse(**result)


@app.get("/admin/log-level")
async def get_log_level():
    """Return the current log level of the strategy-ai service."""
    import logging
    current = logging.getLogger("strategy-ai").level
    name = logging.getLevelName(current) if current != 0 else LOG_LEVEL
    return {"level": name}


@app.post("/admin/log-level")
async def set_log_level(request: Request):
    """
    Change the log level at runtime without restarting the container.
    Accepted values: DEBUG | INFO | WARNING | ERROR | CRITICAL
    """
    import logging
    body = await request.json()
    level_str = body.get("level", "INFO").upper()

    valid = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
    if level_str not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid level '{level_str}'. Use one of: {sorted(valid)}")

    numeric = getattr(logging, level_str)

    # Update every logger that uses our shared handler
    for name in ("strategy-ai", "confidence-engine", "vbt-optimizer"):
        logging.getLogger(name).setLevel(numeric)

    # Also update the shared handler level
    for handler in logging.getLogger("strategy-ai").handlers:
        handler.setLevel(numeric)

    log.info(f"[Admin] Log level changed → {level_str}")
    return {"level": level_str, "ok": True}


@app.get("/strategy/optimize/vectorbt/status")
async def vbt_status():
    """Check whether vectorbt is installed and available."""
    return {"vectorbt_available": VBT_AVAILABLE}


@app.post("/request-execute")
async def request_execute(symbol: str, type: str, quantity: float):
    """Python-initiated trade execution → Node.js"""
    payload = {"symbol": symbol, "type": type.upper(), "quantity": quantity, "source": "Python-AI-Strategy"}
    try:
        response = requests.post(f"{GATEWAY_URL}/api/execute-python", json=payload, timeout=5)
        return response.json()
    except Exception as e:
        return {"error": str(e), "msg": "Failed to communicate with trade-gateway"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
