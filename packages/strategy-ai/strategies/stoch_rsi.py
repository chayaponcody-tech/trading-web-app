import pandas as pd
import ta
from base_strategy import BaseStrategy


class StochRSIStrategy(BaseStrategy):
    """Stochastic RSI — powered by ta"""

    def populate_indicators(self, df: pd.DataFrame, params: dict) -> pd.DataFrame:
        p = params or {}
        rsi_p = int(p.get("rsiPeriod", 14))
        stochrsi = ta.momentum.StochRSIIndicator(df["close"], window=rsi_p, smooth1=3, smooth2=3)
        df["stoch_k"] = stochrsi.stochrsi_k() * 100
        return df

    def populate_signals(self, df: pd.DataFrame, params: dict) -> pd.DataFrame:
        p = params or {}
        overbought = float(p.get("overbought", 80))
        oversold = float(p.get("oversold", 20))
        prev_k = df["stoch_k"].shift(1)

        df["signal"] = "NONE"
        df.loc[(prev_k <= oversold) & (df["stoch_k"] > oversold), "signal"] = "LONG"
        df.loc[(prev_k >= overbought) & (df["stoch_k"] < overbought), "signal"] = "SHORT"
        return df

    def get_metadata(self) -> dict:
        return {"name": "STOCH_RSI", "description": "Stochastic RSI micro-cycle", "version": "3.0.0"}
