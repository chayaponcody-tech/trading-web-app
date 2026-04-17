"""
API routers for the Evolutionary Quant System.

Each router is imported here so main.py can do:
    from routers import sentiment_router, data_router, ...
"""
from routers.alpha_router import router as alpha_router
from routers.backtest_router import router as backtest_router
from routers.data_router import router as data_router
from routers.loop_router import router as loop_router
from routers.sentiment_router import router as sentiment_router
from routers.strategy_router import router as strategy_router

__all__ = [
    "alpha_router",
    "backtest_router",
    "data_router",
    "loop_router",
    "sentiment_router",
    "strategy_router",
]
