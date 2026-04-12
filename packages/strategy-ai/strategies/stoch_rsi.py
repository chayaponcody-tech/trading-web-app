import numpy as np
from base_strategy import BaseStrategy


class StochRSIStrategy(BaseStrategy):
    """Stochastic RSI — จับ micro-cycle"""

    def compute_signal(self, closes, highs, lows, volumes, params=None) -> dict:
        p = params or {}
        rsi_period = int(p.get("rsiPeriod", 14))
        stoch_period = int(p.get("stochPeriod", 14))
        overbought = float(p.get("overbought", 80))
        oversold = float(p.get("oversold", 20))

        arr = np.array(closes, dtype=float)
        rsi = self._rsi_series(arr, rsi_period)
        if len(rsi) < stoch_period + 1:
            return {"signal": "NONE", "stoploss": None, "metadata": {}}

        k_series = self._stoch_k(rsi, stoch_period)
        if len(k_series) < 2:
            return {"signal": "NONE", "stoploss": None, "metadata": {}}

        prev_k, curr_k = k_series[-2], k_series[-1]

        if prev_k <= oversold and curr_k > oversold:
            signal = "LONG"
        elif prev_k >= overbought and curr_k < overbought:
            signal = "SHORT"
        else:
            signal = "NONE"

        return {
            "signal": signal,
            "stoploss": None,
            "metadata": {"stoch_k": round(float(curr_k), 2), "overbought": overbought, "oversold": oversold},
        }

    def get_metadata(self) -> dict:
        return {"name": "STOCH_RSI", "description": "Stochastic RSI micro-cycle", "version": "1.0.0"}

    def _rsi_series(self, arr: np.ndarray, period: int) -> np.ndarray:
        deltas = np.diff(arr)
        gains = np.where(deltas > 0, deltas, 0.0)
        losses = np.where(deltas < 0, -deltas, 0.0)
        avg_gain = np.convolve(gains, np.ones(period) / period, mode="valid")
        avg_loss = np.convolve(losses, np.ones(period) / period, mode="valid")
        rs = np.where(avg_loss == 0, 100.0, avg_gain / (avg_loss + 1e-10))
        return 100 - (100 / (1 + rs))

    def _stoch_k(self, rsi: np.ndarray, period: int) -> np.ndarray:
        k = np.empty(len(rsi) - period + 1)
        for i in range(len(k)):
            window = rsi[i : i + period]
            lo, hi = window.min(), window.max()
            k[i] = 100 * (rsi[i + period - 1] - lo) / (hi - lo + 1e-10)
        return k
