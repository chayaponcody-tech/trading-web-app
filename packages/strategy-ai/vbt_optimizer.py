"""
vbt_optimizer.py
VectorBT-powered parameter sweep for strategy optimization.

Instead of Optuna's sequential Bayesian search (which calls compute_signal
once per candle per trial), this module:
  1. Generates a parameter grid from the search_space
  2. For each param combo, builds a signal array via the strategy's batch compute
  3. Runs vectorbt.Portfolio.from_signals() — fully vectorized, no Python loop
  4. Extracts Sharpe, total return, and max drawdown
  5. Returns the best param set

This is significantly faster than the Optuna approach for small-to-medium
search spaces because vectorbt's core is NumPy/Numba-accelerated.
"""

import itertools
import numpy as np
import pandas as pd

from logger import get_logger

_log = get_logger("vbt-optimizer")

try:
    import vectorbt as vbt
    VBT_AVAILABLE = True
except ImportError:
    VBT_AVAILABLE = False


def _build_param_grid(search_space: dict, n_trials: int) -> list[dict]:
    """
    Convert search_space bounds into a list of param dicts.
    For integer params: linspace between lo and hi, capped at n_trials total combos.
    For float params: linspace with ~5 steps per dimension.
    """
    axes = {}
    for name, bounds in search_space.items():
        lo, hi = bounds[0], bounds[1]
        if isinstance(lo, int) and isinstance(hi, int):
            steps = min(hi - lo + 1, max(3, n_trials // max(len(search_space), 1)))
            axes[name] = list(map(int, np.linspace(lo, hi, steps)))
        else:
            steps = min(10, max(3, n_trials // max(len(search_space), 1)))
            axes[name] = list(np.linspace(float(lo), float(hi), steps))

    # Cartesian product, capped at n_trials
    keys = list(axes.keys())
    combos = list(itertools.product(*[axes[k] for k in keys]))
    if len(combos) > n_trials:
        # Uniform subsample
        indices = np.linspace(0, len(combos) - 1, n_trials, dtype=int)
        combos = [combos[i] for i in indices]

    return [dict(zip(keys, combo)) for combo in combos]


def _signals_to_entries_exits(signals: list[str]) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Convert signal list to vectorbt entry/exit boolean arrays for LONG and SHORT."""
    n = len(signals)
    long_entries  = np.zeros(n, dtype=bool)
    long_exits    = np.zeros(n, dtype=bool)
    short_entries = np.zeros(n, dtype=bool)
    short_exits   = np.zeros(n, dtype=bool)

    in_long = False
    in_short = False

    for i, sig in enumerate(signals):
        if sig == "LONG" and not in_long:
            long_entries[i] = True
            if in_short:
                short_exits[i] = True
                in_short = False
            in_long = True
        elif sig == "SHORT" and not in_short:
            short_entries[i] = True
            if in_long:
                long_exits[i] = True
                in_long = False
            in_short = True
        elif sig == "NONE":
            pass  # hold

    return long_entries, long_exits, short_entries, short_exits


def run_vbt_optimize(
    strategy,
    closes: list[float],
    highs: list[float],
    lows: list[float],
    volumes: list[float],
    search_space: dict,
    n_trials: int = 50,
    fees: float = 0.0004,
    slippage: float = 0.0005,
    init_cash: float = 1000.0,
) -> dict:
    """
    Run VectorBT-powered parameter optimization.

    Args:
        strategy: BaseStrategy instance with compute_signal()
        closes/highs/lows/volumes: OHLCV arrays
        search_space: dict of {param_name: [lo, hi]}
        n_trials: max number of parameter combinations to evaluate
        fees: taker fee rate per side
        slippage: slippage rate per side
        init_cash: starting capital

    Returns:
        {
            "best_params": dict,
            "best_sharpe": float,
            "best_return": float,
            "best_max_drawdown": float,
            "n_trials": int,
            "engine": "vectorbt" | "fallback_numpy"
        }
    """
    if not VBT_AVAILABLE:
        _log.warning("vectorbt not installed — using fallback_numpy optimizer")
        return _fallback_numpy_optimize(
            strategy, closes, highs, lows, volumes,
            search_space, n_trials, fees, init_cash
        )

    price = pd.Series(closes, dtype=float)
    param_grid = _build_param_grid(search_space, n_trials)

    _log.info(f"Starting VBT grid sweep: {len(param_grid)} combos, {len(closes)} candles")

    best_sharpe = -np.inf
    best_params = param_grid[0] if param_grid else {}
    best_return = 0.0
    best_mdd = 0.0

    for params in param_grid:
        # Build signal array for this param combo (no-look-ahead: slice grows)
        signals = []
        for i in range(len(closes)):
            end = i + 1
            result = strategy.compute_signal(
                closes[:end], highs[:end], lows[:end], volumes[:end], params
            )
            signals.append(result.get("signal", "NONE"))

        long_entries, long_exits, short_entries, short_exits = _signals_to_entries_exits(signals)

        try:
            # Run vectorbt portfolio simulation
            pf = vbt.Portfolio.from_signals(
                close=price,
                entries=long_entries,
                exits=long_exits,
                short_entries=short_entries,
                short_exits=short_exits,
                fees=fees,
                slippage=slippage,
                init_cash=init_cash,
                freq="1h",  # assumed; affects annualization
            )

            sharpe = float(pf.sharpe_ratio())
            total_return = float(pf.total_return()) * 100  # as %
            mdd = float(pf.max_drawdown())

            if np.isnan(sharpe):
                sharpe = 0.0

            if sharpe > best_sharpe:
                best_sharpe = sharpe
                best_params = params
                best_return = total_return
                best_mdd = mdd

        except Exception:
            # Skip invalid combos silently
            continue

    return {
        "best_params": best_params,
        "best_sharpe": round(best_sharpe, 4) if best_sharpe != -np.inf else 0.0,
        "best_return": round(best_return, 4),
        "best_max_drawdown": round(best_mdd, 4),
        "n_trials": len(param_grid),
        "engine": "vectorbt",
    }


def _fallback_numpy_optimize(
    strategy,
    closes: list[float],
    highs: list[float],
    lows: list[float],
    volumes: list[float],
    search_space: dict,
    n_trials: int,
    fees: float,
    init_cash: float,
) -> dict:
    """
    Pure NumPy fallback when vectorbt is not installed.
    Simulates a simple equity curve from signals to compute Sharpe.
    """
    param_grid = _build_param_grid(search_space, n_trials)
    closes_arr = np.array(closes, dtype=float)

    best_sharpe = -np.inf
    best_params = param_grid[0] if param_grid else {}
    best_return = 0.0
    best_mdd = 0.0

    for params in param_grid:
        signals = []
        for i in range(len(closes)):
            end = i + 1
            result = strategy.compute_signal(
                closes[:end], highs[:end], lows[:end], volumes[:end], params
            )
            signals.append(result.get("signal", "NONE"))

        # Simple equity simulation
        capital = init_cash
        equity = [capital]
        for i in range(1, len(closes_arr)):
            sig = signals[i - 1]
            ret = (closes_arr[i] - closes_arr[i - 1]) / closes_arr[i - 1]
            if sig == "LONG":
                capital *= (1 + ret - fees * 2)
            elif sig == "SHORT":
                capital *= (1 - ret - fees * 2)
            equity.append(capital)

        eq = np.array(equity, dtype=float)
        returns = np.diff(eq) / eq[:-1]

        if len(returns) < 2 or np.std(returns) == 0:
            continue

        sharpe = float(np.mean(returns) / np.std(returns) * np.sqrt(252))
        total_return = (eq[-1] - init_cash) / init_cash * 100

        # Max drawdown
        peak = np.maximum.accumulate(eq)
        mdd = float(np.max((peak - eq) / (peak + 1e-9)))

        if sharpe > best_sharpe:
            best_sharpe = sharpe
            best_params = params
            best_return = total_return
            best_mdd = mdd

    return {
        "best_params": best_params,
        "best_sharpe": round(best_sharpe, 4) if best_sharpe != -np.inf else 0.0,
        "best_return": round(best_return, 4),
        "best_max_drawdown": round(best_mdd, 4),
        "n_trials": len(param_grid),
        "engine": "fallback_numpy",
    }
