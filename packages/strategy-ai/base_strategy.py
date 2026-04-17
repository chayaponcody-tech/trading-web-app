from abc import ABC, abstractmethod
import pandas as pd
import numpy as np


class BaseStrategy(ABC):
    @abstractmethod
    def populate_indicators(self, df: pd.DataFrame, params: dict) -> pd.DataFrame:
        """
        Calculate all indicators and add them as columns to the DataFrame.
        Should return the modified DataFrame.
        """
        raise NotImplementedError

    @abstractmethod
    def populate_signals(self, df: pd.DataFrame, params: dict) -> pd.DataFrame:
        """
        Define buy/sell conditions and set the 'signal' column.
        Values should be "LONG", "SHORT", or "NONE".
        Should return the modified DataFrame.
        """
        raise NotImplementedError

    def compute_signal(
        self,
        closes: list[float],
        highs: list[float],
        lows: list[float],
        volumes: list[float],
        params: dict,
    ) -> dict:
        """
        Live trading entry point. Efficiently calculates only what's needed for the last candle.
        """
        # Convert to DF
        df = pd.DataFrame({
            "close": np.array(closes, dtype=float),
            "high": np.array(highs, dtype=float),
            "low": np.array(lows, dtype=float),
            "volume": np.array(volumes, dtype=float),
        })
        
        # Populate
        df = self.populate_indicators(df, params)
        df = self.populate_signals(df, params)
        
        if df.empty:
            return {"signal": "NONE", "stoploss": None, "metadata": {}}
            
        last = df.iloc[-1]
        
        # Extract metadata (all columns except internal OHLCV and signal)
        exclude = {"close", "high", "low", "volume", "signal", "open"}
        metadata = {k: v for k, v in last.to_dict().items() if k not in exclude}
        
        # Handle nan/inf for JSON serialization
        metadata = {k: (None if pd.isna(v) else v) for k, v in metadata.items()}

        return {
            "signal": last.get("signal", "NONE"),
            "stoploss": last.get("stoploss"), # Optional column if strategy defines it
            "metadata": metadata
        }

    def compute_batch_signals(
        self,
        closes: list[float],
        highs: list[float],
        lows: list[float],
        volumes: list[float],
        params: dict,
    ) -> dict:
        """
        Backtesting entry point. Processes all candles in a single vectorized pass.
        """
        df = pd.DataFrame({
            "close": np.array(closes, dtype=float),
            "high": np.array(highs, dtype=float),
            "low": np.array(lows, dtype=float),
            "volume": np.array(volumes, dtype=float),
        })
        
        df = self.populate_indicators(df, params)
        df = self.populate_signals(df, params)
        
        if df.empty:
            return {"signals": [], "confidences": None, "metadatas": []}

        # Ensure signal column exists
        if "signal" not in df.columns:
            df["signal"] = "NONE"

        signals = df["signal"].tolist()
        
        # Metadata processing
        exclude = {"close", "high", "low", "volume", "signal", "open"}
        metadatas = df.drop(columns=[c for c in df.columns if c in exclude]).to_dict("records")
        
        # Clean numeric values for JSON
        def clean_dict(d):
            return {k: (None if pd.isna(v) else v) for k, v in d.items()}
        
        cleaned_metadatas = [clean_dict(m) for m in metadatas]

        return {
            "signals": signals,
            "confidences": None, # Computed by ConfidenceEngine later
            "metadatas": cleaned_metadatas
        }

    @abstractmethod
    def get_metadata(self) -> dict:
        """
        Returns:
            {
                "name": str,
                "description": str,
                "version": str
            }
        """
        raise NotImplementedError
