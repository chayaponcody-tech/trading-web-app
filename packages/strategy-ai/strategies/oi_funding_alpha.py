import pandas as pd
import numpy as np
import ta
from base_strategy import BaseStrategy


class OIFundingAlphaStrategy(BaseStrategy):
    """Alpha strategy based on OI Divergence + Funding Rate Anomaly."""

    def populate_indicators(self, df: pd.DataFrame, params: dict) -> pd.DataFrame:
        p = params or {}
        oi = p.get("oi", [])
        funding = p.get("funding_rates", [])
        window = int(p.get("window", 5))
        n = len(df)

        # OI Proxy if missing
        if len(oi) < n:
            df["oi"] = df["volume"]
        else:
            df["oi"] = np.array(oi[:n], dtype=float)

        # Funding Proxy if missing
        if len(funding) < n:
            df["funding_rate"] = df["close"].pct_change().fillna(0) * 0.1
        else:
            df["funding_rate"] = np.array(funding[:n], dtype=float)

        # ROC and Z-Score
        df["price_roc"] = df["close"].pct_change(periods=window)
        df["oi_roc"] = df["oi"].pct_change(periods=window)
        
        rolling_mean = df["funding_rate"].rolling(window=30).mean()
        rolling_std = df["funding_rate"].rolling(window=30).std()
        df["fz"] = (df["funding_rate"] - rolling_mean) / (rolling_std + 1e-9)

        # ATR
        df["atr"] = ta.volatility.average_true_range(df["high"], df["low"], df["close"], window=14)
        return df

    def populate_signals(self, df: pd.DataFrame, params: dict) -> pd.DataFrame:
        df["signal"] = "NONE"
        
        # Conditions
        short_cond = (df["price_roc"] > 0.02) & (df["oi_roc"] < -0.05) & (df["fz"] > 1.5)
        long_cond = (df["price_roc"] < -0.02) & (df["oi_roc"] < -0.05) & (df["fz"] < -1.5)

        df.loc[short_cond, "signal"] = "SHORT"
        df.loc[long_cond, "signal"] = "LONG"
        
        # Stoploss
        df["stoploss"] = np.nan
        df.loc[df["signal"] == "LONG", "stoploss"] = df["close"] - 1.5 * df["atr"]
        df.loc[df["signal"] == "SHORT", "stoploss"] = df["close"] + 1.5 * df["atr"]
        
        # Internal confidence for metadata
        df["confidence"] = np.clip(abs(df["fz"]) / 4.0, 0.50, 0.99)
        df.loc[df["signal"] == "NONE", "confidence"] = 0.0
        
        return df

    def get_metadata(self) -> dict:
        return {
            "name": "OI Funding Alpha",
            "description": "OI Divergence + Funding Rate Z-Score anomaly detection",
            "version": "3.0.0",
        }
