import json
import requests


class ConfidenceEngine:
    def __init__(self, mode: str, openrouter_key: str, openrouter_model: str):
        self.mode = mode
        self.openrouter_key = openrouter_key
        self.openrouter_model = openrouter_model

    def score(
        self,
        signal: str,
        features: dict,
        regime: str,
        strategy_metadata: dict,
    ) -> tuple[float, str]:
        """Returns (confidence: float, reason: str) clamped to [0.0, 1.0]"""
        confidence, reason = self._rule_based(signal, features, regime)

        if self.mode == "full" and 0.50 <= confidence <= 0.70:
            if self.openrouter_key:
                llm_conf, llm_reason = self._llm_analyze(signal, features, regime, strategy_metadata)
                confidence = (confidence + llm_conf) / 2
                reason = f"[ML+LLM] {llm_reason}"

        return round(max(0.0, min(1.0, confidence)), 4), reason

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

    def _llm_analyze(
        self,
        signal: str,
        features: dict,
        regime: str,
        strategy_metadata: dict,
    ) -> tuple[float, str]:
        """LLM-based analysis — moved verbatim from main.py llm_analyze(), symbol replaced by strategy_metadata"""
        if not self.openrouter_key:
            return 0.5, "LLM key missing"

        symbol = strategy_metadata.get("name", "unknown")

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
                headers={"Authorization": f"Bearer {self.openrouter_key}", "Content-Type": "application/json"},
                json={
                    "model": self.openrouter_model,
                    "messages": [{"role": "user", "content": prompt}],
                    "response_format": {"type": "json_object"},
                },
                timeout=10,
            )
            content = resp.json()["choices"][0]["message"]["content"]
            data = json.loads(content)
            return float(data.get("confidence", 0.5)), data.get("reason", "LLM analyzed")
        except Exception as e:
            return 0.5, f"LLM error: {str(e)[:50]}"
