import numpy as np
from base_strategy import BaseStrategy


def _ema_series(arr: np.ndarray, period: int) -> np.ndarray:
    k = 2.0 / (period + 1)
    result = np.empty(len(arr))
    result[0] = arr[0]
    for i in range(1, len(arr)):
        result[i] = arr[i] * k + result[i - 1] * (1 - k)
    return result


def _rsi_last(arr: np.ndarray, period: int) -> float:
    deltas = np.diff(arr)
    gains = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)
    avg_gain = np.mean(gains[-period:]) if len(gains) >= period else 0.0
    avg_loss = np.mean(losses[-period:]) if len(losses) >= period else 1e-10
    return 100 - (100 / (1 + avg_gain / (avg_loss + 1e-10)))


def _ema_cross(arr, params):
    fast_p = int(params.get("fastPeriod", 20))
    slow_p = int(params.get("slowPeriod", 50))
    if len(arr) < slow_p + 1:
        return "NONE", None, None
    fast = _ema_series(arr, fast_p)
    slow = _ema_series(arr, slow_p)
    if fast[-2] <= slow[-2] and fast[-1] > slow[-1]:
        return "LONG", fast[-1], slow[-1]
    if fast[-2] >= slow[-2] and fast[-1] < slow[-1]:
        return "SHORT", fast[-1], slow[-1]
    return "NONE", fast[-1], slow[-1]


def _bb_signal(arr, params):
    period = int(params.get("bbPeriod", 20))
    std_dev = float(params.get("bbStd", 2))
    if len(arr) < period:
        return "NONE"
    window = arr[-period:]
    mid = np.mean(window)
    sd = np.std(window)
    upper = mid + std_dev * sd
    lower = mid - std_dev * sd
    curr = arr[-1]
    if curr < lower:
        return "LONG"
    if curr > upper:
        return "SHORT"
    return "NONE"


class EMARSIStrategy(BaseStrategy):
    """EMA Cross confirmed by RSI not being extreme"""

    def compute_signal(self, closes, highs, lows, volumes, params=None) -> dict:
        p = params or {}
        arr = np.array(closes, dtype=float)
        ema_sig, _, _ = _ema_cross(arr, p)
        rsi = _rsi_last(arr, int(p.get("rsiPeriod", 14)))

        if ema_sig == "LONG" and rsi < 70:
            signal = "LONG"
        elif ema_sig == "SHORT" and rsi > 30:
            signal = "SHORT"
        else:
            signal = "NONE"

        return {"signal": signal, "stoploss": None, "metadata": {"rsi": round(rsi, 2)}}

    def get_metadata(self) -> dict:
        return {"name": "EMA_RSI", "description": "EMA Cross + RSI confirmation", "version": "1.0.0"}


class BBRSIStrategy(BaseStrategy):
    """BB Mean Reversion confirmed by RSI"""

    def compute_signal(self, closes, highs, lows, volumes, params=None) -> dict:
        p = params or {}
        arr = np.array(closes, dtype=float)
        bb_sig = _bb_signal(arr, p)
        rsi = _rsi_last(arr, int(p.get("rsiPeriod", 14)))
        oversold = float(p.get("rsiBuy", 30))
        overbought = float(p.get("rsiSell", 70))

        if bb_sig == "LONG" and rsi < oversold:
            signal = "LONG"
        elif bb_sig == "SHORT" and rsi > overbought:
            signal = "SHORT"
        else:
            signal = "NONE"

        return {"signal": signal, "stoploss": None, "metadata": {"rsi": round(rsi, 2), "bb": bb_sig}}

    def get_metadata(self) -> dict:
        return {"name": "BB_RSI", "description": "BB + RSI confirmation", "version": "1.0.0"}


class EMABBRSIStrategy(BaseStrategy):
    """Triple confirmation: EMA + BB + RSI"""

    def compute_signal(self, closes, highs, lows, volumes, params=None) -> dict:
        p = params or {}
        arr = np.array(closes, dtype=float)
        ema_sig, _, _ = _ema_cross(arr, p)
        bb_sig = _bb_signal(arr, p)
        rsi = _rsi_last(arr, int(p.get("rsiPeriod", 14)))

        if ema_sig == "LONG" and (bb_sig == "LONG" or rsi < 40):
            signal = "LONG"
        elif ema_sig == "SHORT" and (bb_sig == "SHORT" or rsi > 60):
            signal = "SHORT"
        else:
            signal = "NONE"

        return {"signal": signal, "stoploss": None, "metadata": {"rsi": round(rsi, 2), "ema": ema_sig, "bb": bb_sig}}

    def get_metadata(self) -> dict:
        return {"name": "EMA_BB_RSI", "description": "Triple confirmation EMA+BB+RSI", "version": "1.0.0"}
