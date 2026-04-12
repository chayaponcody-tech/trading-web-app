import numpy as np
from base_strategy import BaseStrategy


class GridStrategy(BaseStrategy):
    """Grid Mean Reversion — Buy Low / Sell High"""

    def compute_signal(self, closes, highs, lows, volumes, params=None) -> dict:
        p = params or {}
        arr = np.array(closes, dtype=float)
        curr = float(arr[-1])

        grid_upper = p.get("gridUpper")
        grid_lower = p.get("gridLower")

        if grid_upper and grid_lower:
            if curr <= float(grid_lower):
                signal = "LONG"
            elif curr >= float(grid_upper):
                signal = "SHORT"
            else:
                signal = "NONE"
        else:
            # Fallback: EMA20 deviation
            if len(arr) < 20:
                return {"signal": "NONE", "stoploss": None, "metadata": {}}
            k = 2.0 / 21
            ema = arr[0]
            for c in arr[1:]:
                ema = c * k + ema * (1 - k)
            dev = (curr - ema) / ema
            if dev <= -0.01:
                signal = "LONG"
            elif dev >= 0.01:
                signal = "SHORT"
            else:
                signal = "NONE"

        return {
            "signal": signal,
            "stoploss": None,
            "metadata": {
                "price": round(curr, 6),
                "grid_upper": grid_upper,
                "grid_lower": grid_lower,
            },
        }

    def get_metadata(self) -> dict:
        return {"name": "GRID", "description": "Grid Mean Reversion", "version": "1.0.0"}
