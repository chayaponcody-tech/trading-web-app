import pandas as pd
import ta
from base_strategy import BaseStrategy


class GridStrategy(BaseStrategy):
    """Grid Mean Reversion — Buy Low / Sell High"""

    def populate_indicators(self, df: pd.DataFrame, params: dict) -> pd.DataFrame:
        df["ema20"] = ta.trend.ema_indicator(df["close"], window=20)
        df["dev"] = (df["close"] - df["ema20"]) / df["ema20"]
        return df

    def populate_signals(self, df: pd.DataFrame, params: dict) -> pd.DataFrame:
        gu = params.get("gridUpper")
        gl = params.get("gridLower")

        df["signal"] = "NONE"
        if gu and gl:
            df.loc[df["close"] <= float(gl), "signal"] = "LONG"
            df.loc[df["close"] >= float(gu), "signal"] = "SHORT"
        else:
            # Fallback: EMA deviation
            df.loc[df["dev"] <= -0.01, "signal"] = "LONG"
            df.loc[df["dev"] >= 0.01, "signal"] = "SHORT"
            
        return df

    def get_metadata(self) -> dict:
        return {"name": "GRID", "description": "Grid Mean Reversion", "version": "3.0.0"}
