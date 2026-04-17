import pandas as pd
import ta
from base_strategy import BaseStrategy


class BollingerBandsStrategy(BaseStrategy):
    """BB Mean Reversion (20, 2σ) — powered by ta"""

    def populate_indicators(self, df: pd.DataFrame, params: dict) -> pd.DataFrame:
        p = params or {}
        period = int(p.get("bbPeriod", 20))
        std_dev = float(p.get("bbStdDev", 2))

        bb = ta.volatility.BollingerBands(df["close"], window=period, window_dev=std_dev)
        df["upper"] = bb.bollinger_hband()
        df["lower"] = bb.bollinger_lband()
        return df

    def populate_signals(self, df: pd.DataFrame, params: dict) -> pd.DataFrame:
        prev_price = df["close"].shift(1)
        prev_upper = df["upper"].shift(1)
        prev_lower = df["lower"].shift(1)

        df["signal"] = "NONE"
        # Cross UP from lower (Buy)
        df.loc[(prev_price <= prev_lower) & (df["close"] > df["lower"]), "signal"] = "LONG"
        # Cross DOWN from upper (Sell)
        df.loc[(prev_price >= prev_upper) & (df["close"] < df["upper"]), "signal"] = "SHORT"

        return df

    def get_metadata(self) -> dict:
        return {"name": "BollingerBands", "description": "BB Mean Reversion (20, 2σ)", "version": "3.0.0"}
