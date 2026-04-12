import numpy as np
from base_strategy import BaseStrategy


class EMACross(BaseStrategy):
    """EMA 20/50 Golden/Death Cross"""

    def compute_signal(self, closes, highs, lows, volumes, params=None) -> dict:
        p = params or {}
        fast_p = int(p.get("fastPeriod", 20))
        slow_p = int(p.get("slowPeriod", 50))

        arr = np.array(closes, dtype=float)
        if len(arr) < slow_p + 1:
            return {"signal": "NONE", "stoploss": None, "metadata": {}}

        fast = self._ema_series(arr, fast_p)
        slow = self._ema_series(arr, slow_p)

        if fast[-2] <= slow[-2] and fast[-1] > slow[-1]:
            signal = "LONG"
        elif fast[-2] >= slow[-2] and fast[-1] < slow[-1]:
            signal = "SHORT"
        else:
            signal = "NONE"

        return {
            "signal": signal,
            "stoploss": None,
            "metadata": {
                "ema_fast": round(float(fast[-1]), 6),
                "ema_slow": round(float(slow[-1]), 6),
                "fast_period": fast_p,
                "slow_period": slow_p,
            },
        }

    def get_metadata(self) -> dict:
        return {"name": "EMACross", "description": "EMA Golden/Death Cross", "version": "1.0.0"}

    def _ema_series(self, data: np.ndarray, period: int) -> np.ndarray:
        k = 2.0 / (period + 1)
        result = np.empty(len(data))
        result[0] = data[0]
        for i in range(1, len(data)):
            result[i] = data[i] * k + result[i - 1] * (1 - k)
        return result
