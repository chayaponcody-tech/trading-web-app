import pandas as pd
import numpy as np
from base_strategy import BaseStrategy


class OIFundingAlphaStrategy(BaseStrategy):
    """
    Alpha strategy based on OI Divergence + Funding Rate Anomaly.

    Requires params:
        - oi: list[float]            — Open Interest array (same length as closes)
        - funding_rates: list[float] — Funding rate array (same length as closes)
        - window: int                — ROC window (default 5)
    """

    def compute_signal(
        self,
        closes: list[float],
        highs: list[float],
        lows: list[float],
        volumes: list[float],
        params: dict,
    ) -> dict:
        oi = params.get("oi", [])
        funding_rates = params.get("funding_rates", [])
        window = int(params.get("window", 5))

        # ── Validation ────────────────────────────────────────────────────────
        min_len = max(window + 1, 31)  # need at least 30 candles for rolling

        # ── Backtest fallback: synthesize OI from volumes if not provided ─────
        # In live mode, real OI/funding arrays are injected via params.
        # In backtest mode, volumes serve as an OI proxy (correlated with OI).
        if len(oi) < min_len:
            oi = volumes  # volume as OI proxy
        if len(funding_rates) < min_len:
            # Synthesize funding from price momentum: positive momentum → positive funding
            n = len(closes)
            funding_rates = [
                (closes[i] - closes[i - 1]) / closes[i - 1] * 0.1 if i > 0 else 0.0
                for i in range(n)
            ]

        if len(closes) < min_len or len(oi) < min_len or len(funding_rates) < min_len:
            return {"signal": "NONE", "stoploss": None, "metadata": {"reason": "insufficient data"}}
        # ── Align arrays to same length ───────────────────────────────────────
        n = min(len(closes), len(oi), len(funding_rates))
        df = pd.DataFrame({
            "close": closes[-n:],
            "oi": oi[-n:],
            "funding_rate": funding_rates[-n:],
        })

        # ── Rate of Change ────────────────────────────────────────────────────
        df["price_roc"] = df["close"].pct_change(periods=window)
        df["oi_roc"] = df["oi"].pct_change(periods=window)

        # ── Funding Z-Score (30-bar rolling) ──────────────────────────────────
        rolling_mean = df["funding_rate"].rolling(window=30).mean()
        rolling_std = df["funding_rate"].rolling(window=30).std()
        df["funding_zscore"] = (df["funding_rate"] - rolling_mean) / rolling_std

        # ── Signal conditions (last bar only) ─────────────────────────────────
        last = df.iloc[-1]
        price_roc = last["price_roc"]
        oi_roc = last["oi_roc"]
        fz = last["funding_zscore"]

        # SHORT: price pumped + OI dropped + funding extremely positive (overleveraged longs)
        short_cond = (price_roc > 0.02) and (oi_roc < -0.05) and (fz > 1.5)
        # LONG: price dumped + OI dropped + funding extremely negative (panic sell / forced liquidation)
        long_cond = (price_roc < -0.02) and (oi_roc < -0.05) and (fz < -1.5)

        if short_cond:
            signal = "SHORT"
        elif long_cond:
            signal = "LONG"
        else:
            signal = "NONE"

        # ── Confidence: clip |Z-score| / 4 to [0.50, 0.99] ───────────────────
        confidence = float(np.clip(abs(fz) / 4.0, 0.50, 0.99)) if signal != "NONE" else 0.0

        # ── Stoploss: ATR-based (1.5x ATR from entry) ─────────────────────────
        stoploss = None
        if signal != "NONE" and len(highs) >= 15 and len(lows) >= 15:
            h = np.array(highs[-15:])
            l = np.array(lows[-15:])
            c = np.array(closes[-15:])
            tr = np.maximum(h[1:] - l[1:], np.maximum(np.abs(h[1:] - c[:-1]), np.abs(l[1:] - c[:-1])))
            atr = float(np.mean(tr[-14:]))
            price = closes[-1]
            stoploss = price - 1.5 * atr if signal == "LONG" else price + 1.5 * atr

        return {
            "signal": signal,
            "stoploss": stoploss,
            "metadata": {
                "price_roc": round(float(price_roc), 6) if not np.isnan(price_roc) else None,
                "oi_roc": round(float(oi_roc), 6) if not np.isnan(oi_roc) else None,
                "funding_zscore": round(float(fz), 4) if not np.isnan(fz) else None,
                "confidence": round(confidence, 4),
                "window": window,
            },
        }

    def get_metadata(self) -> dict:
        return {
            "name": "OI Funding Alpha",
            "description": "OI Divergence + Funding Rate Z-Score anomaly detection",
            "version": "1.0.0",
        }
