from abc import ABC, abstractmethod


class BaseStrategy(ABC):
    @abstractmethod
    def compute_signal(
        self,
        closes: list[float],
        highs: list[float],
        lows: list[float],
        volumes: list[float],
        params: dict,
    ) -> dict:
        """
        Returns:
            {
                "signal": "LONG" | "SHORT" | "NONE",
                "stoploss": float | None,   # absolute price
                "metadata": dict            # strategy-specific debug info
            }
        """
        raise NotImplementedError

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
