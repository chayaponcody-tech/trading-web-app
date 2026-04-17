import pandas as pd
import ta
from base_strategy import BaseStrategy


class VWAPScalpStrategy(BaseStrategy):
    """VWAP Scalp — Retest VWAP + RSI momentum — powered by ta"""

    def populate_indicators(self, df: pd.DataFrame, params: dict) -> pd.DataFrame:
        p = params or {}
        rsi_p = int(p.get("rsiPeriod", 9))
        
        # Calculate VWAP
        typical = (df["high"] + df["low"] + df["close"]) / 3
        df["vwap"] = (typical * df["volume"]).cumsum() / df["volume"].cumsum()
        df["rsi"] = ta.momentum.rsi(df["close"], window=rsi_p)
        return df

    def populate_signals(self, df: pd.DataFrame, params: dict) -> pd.DataFrame:
        prev_rsi = df["rsi"].shift(1)
        prev_price = df["close"].shift(1)

        touched_below = (prev_price < df["vwap"]) & (df["close"] >= df["vwap"])
        touched_above = (prev_price > df["vwap"]) & (df["close"] <= df["vwap"])

        df["signal"] = "NONE"
        df.loc[touched_below & (df["rsi"] > prev_rsi) & (df["rsi"] < 65), "signal"] = "LONG"
        df.loc[touched_above & (df["rsi"] < prev_rsi) & (df["rsi"] > 35), "signal"] = "SHORT"
        return df

    def get_metadata(self) -> dict:
        return {"name": "VWAP_SCALP", "description": "VWAP Retest + RSI momentum", "version": "3.0.0"}
