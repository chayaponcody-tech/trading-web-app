import json
import logging
import os
import requests
import numpy as np

from logger import get_logger

logger = get_logger("confidence-engine")


class FeaturePipeline:
    FEATURE_NAMES = ['rsi_14', 'ema20', 'ema50', 'ema_cross',
                     'bb_position', 'volatility_20', 'momentum_10', 'atr_14']

    def extract(self, closes: list[float], highs: list[float],
                lows: list[float]) -> np.ndarray:
        """Returns shape (8,) feature vector: [rsi_14, ema20, ema50, ema_cross,
        bb_position, volatility_20, momentum_10, atr_14]"""
        arr = np.array(closes, dtype=float)
        highs_arr = np.array(highs, dtype=float)
        lows_arr = np.array(lows, dtype=float)

        # RSI 14
        deltas = np.diff(arr)
        gains = np.where(deltas > 0, deltas, 0.0)
        losses = np.where(deltas < 0, -deltas, 0.0)
        avg_gain = np.mean(gains[-14:]) if len(gains) >= 14 else 0.0
        avg_loss = np.mean(losses[-14:]) if len(losses) >= 14 else 1e-9
        rsi_14 = float(100 - (100 / (1 + avg_gain / (avg_loss + 1e-9))))

        # EMA helper
        def ema(data, period):
            k = 2 / (period + 1)
            result = [data[0]]
            for v in data[1:]:
                result.append(v * k + result[-1] * (1 - k))
            return result

        ema20 = float(ema(arr.tolist(), 20)[-1])
        ema50 = float(ema(arr.tolist(), 50)[-1]) if len(arr) >= 50 else ema20
        ema_cross = ema20 - ema50

        # Bollinger Band position (20-period)
        bb_window = arr[-20:]
        bb_mean = np.mean(bb_window)
        bb_std = np.std(bb_window)
        bb_upper = bb_mean + 2 * bb_std
        bb_lower = bb_mean - 2 * bb_std
        price = arr[-1]
        bb_position = float((price - bb_lower) / (bb_upper - bb_lower + 1e-9))

        # Volatility: std of last 20 returns
        returns = np.diff(arr[-21:]) / (arr[-21:-1] + 1e-9)
        volatility_20 = float(np.std(returns)) if len(returns) > 0 else 0.0

        # Momentum: price vs 10 candles ago
        momentum_10 = float((price - arr[-10]) / (arr[-10] + 1e-9)) if len(arr) >= 10 else 0.0

        # ATR 14
        atr_14 = 0.0
        if len(arr) >= 2 and len(highs_arr) >= 2 and len(lows_arr) >= 2:
            n = min(len(arr), len(highs_arr), len(lows_arr))
            h = highs_arr[:n]
            l = lows_arr[:n]
            c = arr[:n]
            hl = h[1:] - l[1:]
            hc = np.abs(h[1:] - c[:-1])
            lc = np.abs(l[1:] - c[:-1])
            tr = np.maximum(hl, np.maximum(hc, lc))
            recent_tr = tr[-14:]
            atr_14 = float(np.mean(recent_tr)) if len(recent_tr) > 0 else 0.0

        return np.array([rsi_14, ema20, ema50, ema_cross,
                         bb_position, volatility_20, momentum_10, atr_14],
                        dtype=float)


class ConfidenceEngine:
    def __init__(self, mode: str, openrouter_key: str, openrouter_model: str):
        self.mode = mode
        self.openrouter_key = openrouter_key
        self.openrouter_model = openrouter_model

        # ML model (optional)
        self.model = None
        model_path = os.environ.get("MODEL_PATH")
        if model_path and os.path.exists(model_path):
            try:
                import joblib
                self.model = joblib.load(model_path)
                logger.info(f"Loaded ML model from {model_path}")
            except Exception as e:
                logger.warning(f"Failed to load model: {e}")

        self.pipeline = FeaturePipeline()

    def score(
        self,
        signal: str,
        features: dict,
        regime: str,
        strategy_metadata: dict,
        closes: list[float] = None,
        highs: list[float] = None,
        lows: list[float] = None,
    ) -> tuple[float, str]:
        """
        AI Committee Implementation:
        Aggregates insights from multiple virtual agents (Personas).
        """
        if signal == "NONE":
            return 0.0, "No signal"

        # 1. Base Quantitative Score (The "Quant Agent")
        base_conf, base_reason = self._rule_based(signal, features, regime)

        # 2. ML Validation (The "ML Agent")
        ml_conf = None
        if self.model is not None and closes is not None and len(closes) >= 50:
            try:
                feat_vec = self.pipeline.extract(
                    closes,
                    highs if highs is not None else closes,
                    lows if lows is not None else closes,
                )
                ml_conf = self._ml_score(feat_vec)
            except Exception as e:
                logger.error(f"[AI-Committee] ML Agent failed: {e}")

        # 3. LLM Committee (The "AI Experts")
        # Only invoke if mode is "full" OR if ML/Quant results are contradictory
        llm_conf = None
        llm_reason = ""
        
        should_invoke_llm = (self.mode == "full") or (ml_conf is not None and abs(ml_conf - base_conf) > 0.4)
        
        if should_invoke_llm and self.openrouter_key:
            committee_results = self._llm_committee_vote(signal, features, regime, strategy_metadata)
            llm_conf = committee_results["avg_confidence"]
            llm_reason = committee_results["consensus_reason"]

        # 4. Final Aggregation
        # Weighting: Quant (30%), ML (30% if available), LLM (40% if available)
        final_confidence = base_conf
        final_reason = base_reason

        if ml_conf is not None and llm_conf is not None:
            final_confidence = (base_conf * 0.2) + (ml_conf * 0.3) + (llm_conf * 0.5)
            final_reason = f"[Committee Consensus] {llm_reason} (ML:{ml_conf:.1%}, Quant:{base_conf:.1%})"
        elif ml_conf is not None:
            final_confidence = (base_conf * 0.5) + (ml_conf * 0.5)
            final_reason = f"[Quant+ML] {base_reason} | ML Confirmation: {ml_conf:.1%}"
        elif llm_conf is not None:
            final_confidence = (base_conf * 0.4) + (llm_conf * 0.6)
            final_reason = f"[Quant+AI] {llm_reason}"

        return round(max(0.0, min(1.0, final_confidence)), 4), final_reason

    def _llm_committee_vote(self, signal, features, regime, metadata) -> dict:
        """
        Simulates a committee of 3 AI personas to evaluate the trade.
        """
        symbol = metadata.get("name", "unknown")
        
        # We use a single multi-turn or multi-persona prompt to save on API calls/latency
        prompt = f"""You are a Trading Committee evaluating a {signal} signal for {symbol}.
Current Market: Regime={regime}, RSI={features.get('rsi',0):.1f}, Volatility={features.get('volatility',0):.4f}, Momentum={features.get('momentum',0):.4f}

Provide analysis from 3 perspectives:
1. TREND_FOLLOWER: Does the momentum support this?
2. MEAN_REVERSION: Is it overextended?
3. RISK_AUDITOR: What is the worst-case scenario?

Reply with JSON only:
{{
  "trend_follower": {{"approved": bool, "confidence": 0-1, "thought": "..."}},
  "mean_reversion": {{"approved": bool, "confidence": 0-1, "thought": "..."}},
  "risk_auditor": {{"approved": bool, "confidence": 0-1, "thought": "..."}},
  "consensus_reason": "Summary in Thai",
  "avg_confidence": 0-1
}}"""

        try:
            resp = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {self.openrouter_key}", "Content-Type": "application/json"},
                json={
                    "model": self.openrouter_model,
                    "messages": [{"role": "user", "content": prompt}],
                    "response_format": {"type": "json_object"},
                },
                timeout=12,
            )
            data = resp.json()["choices"][0]["message"]["content"]
            result = json.loads(data)
            return result
        except Exception as e:
            logger.error(f"[AI-Committee] Voting failed: {e}")
            return {"avg_confidence": 0.5, "consensus_reason": "Committee Error: Fallback to base logic"}

    def _ml_score(self, features: np.ndarray) -> float:
        """Call model.predict_proba and return positive class probability."""
        return float(self.model.predict_proba(features.reshape(1, -1))[0][1])

    def _rule_based(self, signal: str, features: dict, regime: str) -> tuple[float, str]:
        """Rule-based confidence scoring — moved verbatim from main.py compute_confidence()"""
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
            if rsi < 35:
                score += 0.15
                reasons.append(f"RSI oversold ({rsi:.1f})")
            elif rsi < 50:
                score += 0.05
            elif rsi > 70:
                score -= 0.20
                reasons.append(f"RSI overbought ({rsi:.1f}) — risky LONG")

            if bb_pos < 0.2:
                score += 0.15
                reasons.append("ราคาใกล้ BB lower")
            elif bb_pos > 0.8:
                score -= 0.15

            if ema_cross > 0:
                score += 0.10
                reasons.append("EMA20 > EMA50 (uptrend)")
            else:
                score -= 0.10

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

        if regime == "volatile":
            score -= 0.15
            reasons.append("ตลาด volatile — ลด confidence")
        elif regime in ("trending_up", "trending_down"):
            score += 0.05

        if vol > 0.025:
            score -= 0.10

        score = max(0.0, min(1.0, score))
        reason_text = " | ".join(reasons) if reasons else f"confidence {score:.0%}"
        return score, reason_text
