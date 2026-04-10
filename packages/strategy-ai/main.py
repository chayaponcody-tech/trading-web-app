from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import os
import requests
import numpy as np

from registry import StrategyRegistry
from strategies.bollinger_breakout import BollingerBreakout
from confidence_engine import ConfidenceEngine
from microstructure_filter import check as microstructure_check
from schemas import AnalyzeRequest, AnalyzeResponse, StrategyListResponse

app = FastAPI(title="CryptoSmartTrade - Strategy AI (Quant Brain)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

GATEWAY_URL = os.environ.get("GATEWAY_INTERNAL_URL", "http://backend:4001")
AI_MODE = os.environ.get("STRATEGY_AI_MODE", "ml")  # off | ml | full
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "meta-llama/llama-3.1-8b-instruct")

CONFIDENCE_THRESHOLD = 0.60

# ─── Registry Bootstrap ───────────────────────────────────────────────────────

registry = StrategyRegistry()
registry.register("bb_breakout", BollingerBreakout())

confidence_engine = ConfidenceEngine(
    mode=AI_MODE,
    openrouter_key=OPENROUTER_API_KEY,
    openrouter_model=OPENROUTER_MODEL,
)


# ─── Feature Engineering ──────────────────────────────────────────────────────

def compute_features(closes: list[float]) -> dict:
    """Compute quantitative features from close prices."""
    arr = np.array(closes, dtype=float)
    if len(arr) < 20:
        return {}

    # RSI (14)
    deltas = np.diff(arr)
    gains = np.where(deltas > 0, deltas, 0)
    losses = np.where(deltas < 0, -deltas, 0)
    avg_gain = np.mean(gains[-14:]) if len(gains) >= 14 else 0
    avg_loss = np.mean(losses[-14:]) if len(losses) >= 14 else 1e-9
    rsi = 100 - (100 / (1 + avg_gain / avg_loss))

    # EMA 20 / 50
    def ema(data, period):
        k = 2 / (period + 1)
        result = [data[0]]
        for v in data[1:]:
            result.append(v * k + result[-1] * (1 - k))
        return result

    ema20 = ema(arr.tolist(), 20)[-1]
    ema50 = ema(arr.tolist(), 50)[-1] if len(arr) >= 50 else ema20
    price = arr[-1]

    # Bollinger Bands (20)
    bb_window = arr[-20:]
    bb_mean = np.mean(bb_window)
    bb_std = np.std(bb_window)
    bb_upper = bb_mean + 2 * bb_std
    bb_lower = bb_mean - 2 * bb_std
    bb_position = (price - bb_lower) / (bb_upper - bb_lower + 1e-9)  # 0=lower, 1=upper

    # Volatility (std of last 20 returns)
    returns = np.diff(arr[-21:]) / arr[-21:-1]
    volatility = float(np.std(returns)) if len(returns) > 0 else 0

    # Momentum (price vs 10 candles ago)
    momentum = float((price - arr[-10]) / arr[-10]) if len(arr) >= 10 else 0

    # Candle body ratio (last candle)
    body = abs(arr[-1] - arr[-2]) / (arr[-2] + 1e-9) if len(arr) >= 2 else 0

    return {
        "rsi": float(rsi),
        "ema20": float(ema20),
        "ema50": float(ema50),
        "ema_cross": float(ema20 - ema50),
        "bb_position": float(bb_position),
        "volatility": float(volatility),
        "momentum": float(momentum),
        "body_ratio": float(body),
        "price": float(price),
    }


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
        print(f"🚫 [{req.symbol}] Microstructure BLOCK: {micro.reason}")
        return AnalyzeResponse(
            symbol=req.symbol,
            signal="NONE",
            confidence=0.0,
            stoploss=None,
            reason=f"[Microstructure Block] {micro.reason}",
            metadata=result["metadata"],
            strategy=req.strategy,
            microstructure=micro_detail,
        )

    # ── Step 3: Feature engineering + Confidence score ───────────────────────
    features = compute_features(req.closes)
    regime = detect_regime(features)

    confidence, reason = confidence_engine.score(
        raw_signal, features, regime, result["metadata"]
    )

    # Apply microstructure soft penalty
    if micro.penalty > 0:
        confidence = max(0.0, confidence - micro.penalty)
        reason = f"{reason} | OI penalty -{micro.penalty:.0%}"

    final_signal = raw_signal if confidence >= CONFIDENCE_THRESHOLD else "NONE"

    print(
        f"🧠 [{req.symbol}] strategy={req.strategy} signal={raw_signal}→{final_signal} "
        f"confidence={confidence:.0%} regime={regime} | {reason}"
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
    )


@app.get("/strategy/list", response_model=StrategyListResponse)
async def strategy_list():
    """Return all registered strategy keys."""
    return StrategyListResponse(strategies=registry.list_keys())


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

    print(f"🧠 [{symbol}] signal={signal} regime={regime} confidence={confidence:.2f} — {reason}")

    return {
        "symbol": symbol,
        "signal": signal if confidence >= 0.60 else "NONE",
        "confidence": round(confidence, 4),
        "regime": regime,
        "reason": reason,
        "features": {k: round(v, 4) for k, v in features.items() if k != "price"},
    }


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
