import numpy as np
from base_strategy import BaseStrategy


class RSIStrategy(BaseStrategy):
    """RSI Overbought/Oversold (30/70)"""

    def compute_signal(self, closes, highs, lows, volumes, params=None) -> dict:
        p = params or {}
        period = int(p.get("rsiPeriod", 14))
        overbought = float(p.get("rsiOverbought", 70))
        oversold = float(p.get("rsiOversold", 30))

        arr = np.array(closes, dtype=float)
        rsi = self._rsi(arr, period)
        if len(rsi) < 2:
            return {"signal": "NONE", "stoploss": None, "metadata": {}}

        prev, curr = rsi[-2], rsi[-1]

        if prev <= oversold and curr > oversold:
            signal = "LONG"
        elif prev >= overbought and curr < overbought:
            signal = "SHORT"
        else:
            signal = "NONE"

        return {
            "signal": signal,
            "stoploss": None,
            "metadata": {"rsi": round(float(curr), 2), "overbought": overbought, "oversold": oversold},
        }

    def get_metadata(self) -> dict:
        return {"name": "RSIStrategy", "description": "RSI Overbought/Oversold", "version": "1.0.0"}

    def _rsi(self, arr: np.ndarray, period: int) -> np.ndarray:
        deltas = np.diff(arr)
        gains = np.where(deltas > 0, deltas, 0.0)
        losses = np.where(deltas < 0, -deltas, 0.0)
        avg_gain = np.convolve(gains, np.ones(period) / period, mode="valid")
        avg_loss = np.convolve(losses, np.ones(period) / period, mode="valid")
        rs = np.where(avg_loss == 0, 100.0, avg_gain / (avg_loss + 1e-10))
        return 100 - (100 / (1 + rs))
