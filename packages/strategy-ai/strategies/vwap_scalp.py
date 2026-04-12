import numpy as np
from base_strategy import BaseStrategy


class VWAPScalpStrategy(BaseStrategy):
    """VWAP Scalp — Retest VWAP + RSI momentum"""

    def compute_signal(self, closes, highs, lows, volumes, params=None) -> dict:
        p = params or {}
        arr = np.array(closes, dtype=float)
        rsi_period = int(p.get("rsiPeriod", 9))

        vwap = self._calc_vwap(arr, highs, lows, volumes, int(p.get("emaPeriod", 20)))
        rsi = self._rsi_series(arr, rsi_period)

        if vwap is None or len(rsi) < 2:
            return {"signal": "NONE", "stoploss": None, "metadata": {}}

        price, prev_price = arr[-1], arr[-2]
        curr_rsi, prev_rsi = rsi[-1], rsi[-2]

        touched_below = prev_price < vwap and price >= vwap
        touched_above = prev_price > vwap and price <= vwap

        if touched_below and curr_rsi > prev_rsi and curr_rsi < 65:
            signal = "LONG"
        elif touched_above and curr_rsi < prev_rsi and curr_rsi > 35:
            signal = "SHORT"
        else:
            signal = "NONE"

        return {
            "signal": signal,
            "stoploss": None,
            "metadata": {"vwap": round(float(vwap), 6), "rsi": round(float(curr_rsi), 2)},
        }

    def get_metadata(self) -> dict:
        return {"name": "VWAP_SCALP", "description": "VWAP Retest + RSI momentum", "version": "1.0.0"}

    def _calc_vwap(self, closes, highs, lows, volumes, ema_period: int):
        if highs and lows and volumes and len(volumes) == len(closes):
            h = np.array(highs, dtype=float)
            l = np.array(lows, dtype=float)
            v = np.array(volumes, dtype=float)
            typical = (h + l + closes) / 3
            cum_v = np.sum(v)
            return float(np.sum(typical * v) / cum_v) if cum_v > 0 else None
        # fallback: EMA as VWAP proxy
        if len(closes) < ema_period:
            return None
        k = 2.0 / (ema_period + 1)
        val = closes[0]
        for c in closes[1:]:
            val = c * k + val * (1 - k)
        return float(val)

    def _rsi_series(self, arr: np.ndarray, period: int) -> np.ndarray:
        deltas = np.diff(arr)
        gains = np.where(deltas > 0, deltas, 0.0)
        losses = np.where(deltas < 0, -deltas, 0.0)
        avg_gain = np.convolve(gains, np.ones(period) / period, mode="valid")
        avg_loss = np.convolve(losses, np.ones(period) / period, mode="valid")
        rs = np.where(avg_loss == 0, 100.0, avg_gain / (avg_loss + 1e-10))
        return 100 - (100 / (1 + rs))
