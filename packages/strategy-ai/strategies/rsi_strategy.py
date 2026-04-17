import pandas as pd
import ta
from base_strategy import BaseStrategy


class RSIStrategy(BaseStrategy):
    """RSI Overbought/Oversold (30/70) — powered by ta"""

    def populate_indicators(self, df: pd.DataFrame, params: dict) -> pd.DataFrame:
        p = params or {}
        period = int(p.get("rsiPeriod", 14))
        df["rsi"] = ta.momentum.rsi(df["close"], window=period)
        return df

    def populate_signals(self, df: pd.DataFrame, params: dict) -> pd.DataFrame:
        p = params or {}
        overbought = float(p.get("rsiOverbought", 70))
        oversold = float(p.get("rsiOversold", 30))

        prev_rsi = df["rsi"].shift(1)
        df["signal"] = "NONE"

        # Cross above oversold (Buy)
        df.loc[(prev_rsi <= oversold) & (df["rsi"] > oversold), "signal"] = "LONG"
        # Cross below overbought (Sell)
        df.loc[(prev_rsi >= overbought) & (df["rsi"] < overbought), "signal"] = "SHORT"

        return df

    def get_metadata(self) -> dict:
        return {"name": "RSIStrategy", "description": "RSI Overbought/Oversold", "version": "3.0.0"}
