import pandas as pd
import ta
from base_strategy import BaseStrategy


class EMACross(BaseStrategy):
    """EMA 20/50 Golden/Death Cross — powered by ta"""

    def populate_indicators(self, df: pd.DataFrame, params: dict) -> pd.DataFrame:
        p = params or {}
        fast_p = int(p.get("fastPeriod", 20))
        slow_p = int(p.get("slowPeriod", 50))

        df["ema_fast"] = ta.trend.ema_indicator(df["close"], window=fast_p)
        df["ema_slow"] = ta.trend.ema_indicator(df["close"], window=slow_p)
        return df

    def populate_signals(self, df: pd.DataFrame, params: dict) -> pd.DataFrame:
        # Cross detection
        prev_fast = df["ema_fast"].shift(1)
        prev_slow = df["ema_slow"].shift(1)

        df["signal"] = "NONE"
        
        # Golden Cross
        df.loc[(prev_fast <= prev_slow) & (df["ema_fast"] > df["ema_slow"]), "signal"] = "LONG"
        # Death Cross
        df.loc[(prev_fast >= prev_slow) & (df["ema_fast"] < df["ema_slow"]), "signal"] = "SHORT"
        
        return df

    def get_metadata(self) -> dict:
        return {"name": "EMACross", "description": "EMA Golden/Death Cross", "version": "3.0.0"}
