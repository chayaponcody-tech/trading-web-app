import pandas as pd
import ta
from base_strategy import BaseStrategy


class EMAScalpStrategy(BaseStrategy):
    """EMA 3/8 Scalping — powered by ta"""

    def populate_indicators(self, df: pd.DataFrame, params: dict) -> pd.DataFrame:
        p = params or {}
        fast_p = int(p.get("fastPeriod", 3))
        slow_p = int(p.get("slowPeriod", 8))
        df["ema_fast"] = ta.trend.ema_indicator(df["close"], window=fast_p)
        df["ema_slow"] = ta.trend.ema_indicator(df["close"], window=slow_p)
        return df

    def populate_signals(self, df: pd.DataFrame, params: dict) -> pd.DataFrame:
        prev_fast = df["ema_fast"].shift(1)
        prev_slow = df["ema_slow"].shift(1)

        df["signal"] = "NONE"
        df.loc[(prev_fast <= prev_slow) & (df["ema_fast"] > df["ema_slow"]), "signal"] = "LONG"
        df.loc[(prev_fast >= prev_slow) & (df["ema_fast"] < df["ema_slow"]), "signal"] = "SHORT"
        return df

    def get_metadata(self) -> dict:
        return {"name": "EMA_SCALP", "description": "EMA 3/8 Scalp", "version": "3.0.0"}
