import pandas as pd
import ta
from base_strategy import BaseStrategy

class EMACrossoverStrategy(BaseStrategy):
    """EMA Crossover strategy with 9 and 21 period EMAs - Refactored for speed"""

    def populate_indicators(self, df: pd.DataFrame, params: dict) -> pd.DataFrame:
        fast_period = params.get("fast_period", 9)
        slow_period = params.get("slow_period", 21)
        
        df["ema_fast"] = ta.trend.ema_indicator(df["close"], window=fast_period)
        df["ema_slow"] = ta.trend.ema_indicator(df["close"], window=slow_period)
        return df

    def populate_signals(self, df: pd.DataFrame, params: dict) -> pd.DataFrame:
        prev_fast = df["ema_fast"].shift(1)
        prev_slow = df["ema_slow"].shift(1)

        df["signal"] = "NONE"
        df.loc[(prev_fast <= prev_slow) & (df["ema_fast"] > df["ema_slow"]), "signal"] = "LONG"
        df.loc[(prev_fast >= prev_slow) & (df["ema_fast"] < df["ema_slow"]), "signal"] = "SHORT"
        
        # Stoploss logic
        df["stoploss"] = pd.NA
        df.loc[df["signal"] == "LONG", "stoploss"] = df["close"] * 0.98
        df.loc[df["signal"] == "SHORT", "stoploss"] = df["close"] * 1.02
        
        return df
    
    def get_metadata(self):
        return {
            "name": "EMA Crossover",
            "description": "EMA crossover strategy with 9 and 21 period EMAs",
            "version": "3.0.0",
            "params": {
                "fast_period": 9,
                "slow_period": 21
            }
        }