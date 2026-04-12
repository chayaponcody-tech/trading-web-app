import numpy as np
from base_strategy import BaseStrategy


class ScouterStrategy(BaseStrategy):
    """AI Scouter — SMA7/14 + RSI scalping"""

    def compute_signal(self, closes, highs, lows, volumes, params=None) -> dict:
        arr = np.array(closes, dtype=float)
        if len(arr) < 14:
            return {"signal": "NONE", "stoploss": None, "metadata": {}}

        sma7 = float(np.mean(arr[-7:]))
        sma14 = float(np.mean(arr[-14:]))
        rsi = self._rsi_last(arr, 14)

        if sma7 > sma14 and rsi < 55:
            signal = "LONG"
        elif sma7 < sma14 and rsi > 45:
            signal = "SHORT"
        else:
            signal = "NONE"

        return {
            "signal": signal,
            "stoploss": None,
            "metadata": {"sma7": round(sma7, 6), "sma14": round(sma14, 6), "rsi": round(rsi, 2)},
        }

    def get_metadata(self) -> dict:
        return {"name": "AI_SCOUTER", "description": "SMA7/14 + RSI Scouter", "version": "1.0.0"}

    def _rsi_last(self, arr: np.ndarray, period: int) -> float:
        deltas = np.diff(arr)
        gains = np.where(deltas > 0, deltas, 0.0)
        losses = np.where(deltas < 0, -deltas, 0.0)
        avg_gain = np.mean(gains[-period:]) if len(gains) >= period else 0.0
        avg_loss = np.mean(losses[-period:]) if len(losses) >= period else 1e-10
        return 100 - (100 / (1 + avg_gain / (avg_loss + 1e-10)))
