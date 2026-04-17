import pandas as pd
import ta
from base_strategy import BaseStrategy


class EMARSIStrategy(BaseStrategy):
    """EMA Cross confirmed by RSI not being extreme — powered by ta"""

    def populate_indicators(self, df: pd.DataFrame, params: dict) -> pd.DataFrame:
        p = params or {}
        fast_p = int(p.get("fastPeriod", 20))
        slow_p = int(p.get("slowPeriod", 50))
        rsi_p = int(p.get("rsiPeriod", 14))

        df["ema_fast"] = ta.trend.ema_indicator(df["close"], window=fast_p)
        df["ema_slow"] = ta.trend.ema_indicator(df["close"], window=slow_p)
        df["rsi"] = ta.momentum.rsi(df["close"], window=rsi_p)
        return df

    def populate_signals(self, df: pd.DataFrame, params: dict) -> pd.DataFrame:
        prev_fast = df["ema_fast"].shift(1)
        prev_slow = df["ema_slow"].shift(1)

        ema_long = (prev_fast <= prev_slow) & (df["ema_fast"] > df["ema_slow"])
        ema_short = (prev_fast >= prev_slow) & (df["ema_fast"] < df["ema_slow"])

        df["signal"] = "NONE"
        df.loc[ema_long & (df["rsi"] < 70), "signal"] = "LONG"
        df.loc[ema_short & (df["rsi"] > 30), "signal"] = "SHORT"
        return df

    def get_metadata(self) -> dict:
        return {"name": "EMA_RSI", "description": "EMA Cross + RSI confirmation", "version": "3.0.0"}


class BBRSIStrategy(BaseStrategy):
    """BB Mean Reversion confirmed by RSI — powered by ta"""

    def populate_indicators(self, df: pd.DataFrame, params: dict) -> pd.DataFrame:
        p = params or {}
        bb_p = int(p.get("bbPeriod", 20))
        bb_std = float(p.get("bbStd", 2))
        rsi_p = int(p.get("rsiPeriod", 14))

        bb = ta.volatility.BollingerBands(df["close"], window=bb_p, window_dev=bb_std)
        df["upper"] = bb.bollinger_hband()
        df["lower"] = bb.bollinger_lband()
        df["rsi"] = ta.momentum.rsi(df["close"], window=rsi_p)
        return df

    def populate_signals(self, df: pd.DataFrame, params: dict) -> pd.DataFrame:
        p = params or {}
        oversold = float(p.get("rsiBuy", 30))
        overbought = float(p.get("rsiSell", 70))

        df["signal"] = "NONE"
        df.loc[(df["close"] < df["lower"]) & (df["rsi"] < oversold), "signal"] = "LONG"
        df.loc[(df["close"] > df["upper"]) & (df["rsi"] > overbought), "signal"] = "SHORT"
        return df

    def get_metadata(self) -> dict:
        return {"name": "BB_RSI", "description": "BB + RSI confirmation", "version": "3.0.0"}


class EMABBRSIStrategy(BaseStrategy):
    """Triple confirmation: EMA + BB + RSI — powered by ta"""

    def populate_indicators(self, df: pd.DataFrame, params: dict) -> pd.DataFrame:
        p = params or {}
        fast_p = int(p.get("fastPeriod", 20))
        slow_p = int(p.get("slowPeriod", 50))
        bb_p = int(p.get("bbPeriod", 20))
        bb_std = float(p.get("bbStd", 2))
        rsi_p = int(p.get("rsiPeriod", 14))

        df["ema_fast"] = ta.trend.ema_indicator(df["close"], window=fast_p)
        df["ema_slow"] = ta.trend.ema_indicator(df["close"], window=slow_p)
        bb = ta.volatility.BollingerBands(df["close"], window=bb_p, window_dev=bb_std)
        df["upper"] = bb.bollinger_hband()
        df["lower"] = bb.bollinger_lband()
        df["rsi"] = ta.momentum.rsi(df["close"], window=rsi_p)
        return df

    def populate_signals(self, df: pd.DataFrame, params: dict) -> pd.DataFrame:
        prev_fast = df["ema_fast"].shift(1)
        prev_slow = df["ema_slow"].shift(1)
        ema_long = (prev_fast <= prev_slow) & (df["ema_fast"] > df["ema_slow"])
        ema_short = (prev_fast >= prev_slow) & (df["ema_fast"] < df["ema_slow"])

        bb_long = df["close"] < df["lower"]
        bb_short = df["close"] > df["upper"]

        df["signal"] = "NONE"
        df.loc[ema_long & (bb_long | (df["rsi"] < 40)), "signal"] = "LONG"
        df.loc[ema_short & (bb_short | (df["rsi"] > 60)), "signal"] = "SHORT"
        return df

    def get_metadata(self) -> dict:
        return {"name": "EMA_BB_RSI", "description": "Triple confirmation EMA+BB+RSI", "version": "3.0.0"}
