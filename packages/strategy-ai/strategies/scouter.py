import pandas as pd
import ta
from base_strategy import BaseStrategy


class ScouterStrategy(BaseStrategy):
    """AI Scouter — SMA7/14 + RSI scalping — powered by ta"""

    def populate_indicators(self, df: pd.DataFrame, params: dict) -> pd.DataFrame:
        df["sma7"] = ta.trend.sma_indicator(df["close"], window=7)
        df["sma14"] = ta.trend.sma_indicator(df["close"], window=14)
        df["rsi"] = ta.momentum.rsi(df["close"], window=14)
        return df

    def populate_signals(self, df: pd.DataFrame, params: dict) -> pd.DataFrame:
        df["signal"] = "NONE"
        df.loc[(df["sma7"] > df["sma14"]) & (df["rsi"] < 55), "signal"] = "LONG"
        df.loc[(df["sma7"] < df["sma14"]) & (df["rsi"] > 45), "signal"] = "SHORT"
        return df

    def get_metadata(self) -> dict:
        return {"name": "AI_SCOUTER", "description": "SMA7/14 + RSI Scouter", "version": "3.0.0"}
