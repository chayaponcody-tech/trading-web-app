import numpy as np
import pandas as pd
import ta
from base_strategy import BaseStrategy


class BollingerBreakout(BaseStrategy):
    """EMA-based BB breakout (period=30, 1x SD) with ATR(14) stoploss"""

    def populate_indicators(self, df: pd.DataFrame, params: dict) -> pd.DataFrame:
        df["ema_basis"] = ta.trend.ema_indicator(df["close"], window=30)
        std = df["close"].rolling(30).std()
        df["upper_band"] = df["ema_basis"] + std
        df["lower_band"] = df["ema_basis"] - std
        df["atr"] = ta.volatility.average_true_range(df["high"], df["low"], df["close"], window=14)
        return df

    def populate_signals(self, df: pd.DataFrame, params: dict) -> pd.DataFrame:
        df["signal"] = "NONE"
        df.loc[df["close"] > df["upper_band"], "signal"] = "LONG"
        
        # Stoploss calculation (stored in df for batch retrieval)
        df["stoploss"] = df["close"] - (1.5 * df["atr"])
        
        return df

    def get_metadata(self) -> dict:
        return {
            "name": "BollingerBreakout",
            "description": "EMA-based BB breakout (period=30, 1x SD) with ATR(14) stoploss",
            "version": "3.0.0",
        }
