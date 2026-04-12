import numpy as np
from base_strategy import BaseStrategy


class BollingerBandsStrategy(BaseStrategy):
    """BB Mean Reversion (20, 2σ)"""

    def compute_signal(self, closes, highs, lows, volumes, params=None) -> dict:
        p = params or {}
        period = int(p.get("bbPeriod", 20))
        std_dev = float(p.get("bbStdDev", 2))

        arr = np.array(closes, dtype=float)
        if len(arr) < period + 1:
            return {"signal": "NONE", "stoploss": None, "metadata": {}}

        upper, lower = self._bb(arr, period, std_dev)

        prev, curr = arr[-2], arr[-1]
        prev_upper, curr_upper = upper[-2], upper[-1]
        prev_lower, curr_lower = lower[-2], lower[-1]

        if prev <= prev_lower and curr > curr_lower:
            signal = "LONG"
        elif prev >= prev_upper and curr < curr_upper:
            signal = "SHORT"
        else:
            signal = "NONE"

        return {
            "signal": signal,
            "stoploss": None,
            "metadata": {
                "upper": round(float(curr_upper), 6),
                "lower": round(float(curr_lower), 6),
                "price": round(float(curr), 6),
            },
        }

    def get_metadata(self) -> dict:
        return {"name": "BollingerBands", "description": "BB Mean Reversion (20, 2σ)", "version": "1.0.0"}

    def _bb(self, arr: np.ndarray, period: int, std_dev: float):
        upper, lower = np.empty(len(arr)), np.empty(len(arr))
        for i in range(period - 1, len(arr)):
            window = arr[i - period + 1 : i + 1]
            mid = np.mean(window)
            sd = np.std(window)
            upper[i] = mid + std_dev * sd
            lower[i] = mid - std_dev * sd
        return upper, lower
