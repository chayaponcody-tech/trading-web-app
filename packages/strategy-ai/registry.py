from base_strategy import BaseStrategy


class StrategyRegistry:
    def __init__(self):
        self._strategies: dict[str, BaseStrategy] = {}

    def register(self, key: str, strategy: BaseStrategy) -> None:
        """Register a strategy with a key"""
        self._strategies[key] = strategy

    def get(self, key: str) -> BaseStrategy:
        """Return strategy instance or raise KeyError with message"""
        if key not in self._strategies:
            available = list(self._strategies.keys())
            raise KeyError(f"Strategy '{key}' not found. Available: {available}")
        return self._strategies[key]

    def list_keys(self) -> list[str]:
        """Return list of all registered keys"""
        return list(self._strategies.keys())
