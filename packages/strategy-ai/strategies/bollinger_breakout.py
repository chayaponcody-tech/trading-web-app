import numpy as np
from base_strategy import BaseStrategy


class BollingerBreakout(BaseStrategy):
    def compute_signal(self, closes, highs, lows, volumes, params=None) -> dict:
        if len(closes) < 30:
            return {"signal": "NONE", "stoploss": None, "metadata": {}}

        arr = np.array(closes, dtype=float)
        h   = np.array(highs,  dtype=float)
        l   = np.array(lows,   dtype=float)

        # EMA-based Bollinger Bands (period=30, stddev=1x)
        ema = self._ema(arr, 30)
        std = np.std(arr[-30:])
        upper = ema + std
        lower = ema - std

        # ATR(14) stoploss
        atr = self._atr(h, l, arr, 14)
        stoploss = float(arr[-1] - 1.5 * atr)

        signal = "LONG" if arr[-1] > upper else "NONE"

        return {
            "signal": signal,
            "stoploss": stoploss if signal == "LONG" else None,
            "metadata": {
                "ema_basis": round(float(ema), 6),
                "upper_band": round(float(upper), 6),
                "lower_band": round(float(lower), 6),
                "atr": round(float(atr), 6),
                "stoploss_price": round(stoploss, 6),
            }
        }

    def get_metadata(self) -> dict:
        return {
            "name": "BollingerBreakout",
            "description": "EMA-based BB breakout (period=30, 1x SD) with ATR(14) stoploss",
            "version": "1.0.0",
        }

    def _ema(self, data: np.ndarray, period: int) -> float:
        k = 2.0 / (period + 1)
        val = data[0]
        for v in data[1:]:
            val = v * k + val * (1 - k)
        return val

    def _atr(self, highs, lows, closes, period: int) -> float:
        tr = np.maximum(
            highs[1:] - lows[1:],
            np.maximum(
                np.abs(highs[1:] - closes[:-1]),
                np.abs(lows[1:]  - closes[:-1])
            )
        )
        return float(np.mean(tr[-period:]))
