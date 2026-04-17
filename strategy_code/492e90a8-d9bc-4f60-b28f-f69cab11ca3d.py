# strategy_key: Self-Aware Trend System (SATS)
import pandas as pd
import ta
import numpy as np
from base_strategy import BaseStrategy

class SelfAwareTrendSystem(BaseStrategy):
    def populate_indicators(self, df: pd.DataFrame, params: dict) -> pd.DataFrame:
        p = params or {}

        # ── Parameters ────────────────────────────────────────────────────────
        atr_len           = p.get("atr_len", 14)
        er_len            = p.get("er_len", 20)
        atr_baseline_len  = p.get("atr_baseline_len", 100)
        tqi_struct_len    = p.get("tqi_struct_len", 20)
        tqi_mom_len       = p.get("tqi_mom_len", 10)
        vol_len           = p.get("vol_len", 20)
        adx_len           = p.get("adx_len", 14)
        base_mult         = p.get("base_mult", 2.0)
        quality_strength  = p.get("quality_strength", 0.4)

        if len(df) < max(atr_len, er_len, atr_baseline_len, tqi_struct_len, tqi_mom_len, vol_len) + 10:
            return df

        # ── Base Indicators ───────────────────────────────────────────────────
        df['raw_atr'] = ta.volatility.average_true_range(df['high'], df['low'], df['close'], window=atr_len)
        df['atr_baseline'] = df['raw_atr'].rolling(window=atr_baseline_len).mean()

        # Efficiency Ratio
        change = (df['close'] - df['close'].shift(er_len)).abs()
        path = (df['close'].diff().abs()).rolling(window=er_len).sum()
        df['er_value'] = (change / path.replace(0, np.nan)).fillna(0).clip(0, 1)

        # Efficiency-weighted ATR
        df['eff_atr'] = df['raw_atr'] * (0.5 + 0.5 * df['er_value'])

        # ── TQI Components ────────────────────────────────────────────────────
        df['vol_ratio'] = (df['raw_atr'] / df['atr_baseline'].replace(0, np.nan)).fillna(1)
        tqi_vol = ((df['vol_ratio'] - 0.6) / (1.8 - 0.6)).clip(0, 1)

        struct_hi = df['high'].rolling(window=tqi_struct_len).max()
        struct_lo = df['low'].rolling(window=tqi_struct_len).min()
        price_pos = (df['close'] - struct_lo) / (struct_hi - struct_lo).replace(0, np.nan)
        tqi_struct = ((price_pos.fillna(0.5) - 0.5).abs() * 2.0).clip(0, 1)

        # Momentum persistence
        direction = np.sign(df['close'] - df['close'].shift(tqi_mom_len))
        bar_dir = np.sign(df['close'].diff())
        aligned = pd.Series(0.0, index=df.index)
        for lag in range(tqi_mom_len):
            aligned += (direction == bar_dir.shift(lag)).astype(float)
        tqi_mom = (aligned / tqi_mom_len).clip(0, 1)

        # ADX Component
        adx_ind = ta.trend.ADXIndicator(df['high'], df['low'], df['close'], window=adx_len)
        tqi_adx = (adx_ind.adx() / 50.0).clip(0, 1)

        # Weighted TQI
        df['tqi'] = (df['er_value'] * 0.25 + tqi_vol * 0.15 + tqi_struct * 0.20 + tqi_mom * 0.20 + tqi_adx * 0.20).clip(0, 1)
        df['tqi_slope'] = df['tqi'].diff(3)

        # Vol Z-score
        vol_mean = df['volume'].rolling(window=vol_len).mean()
        vol_std = df['volume'].rolling(window=vol_len).std().replace(0, np.nan)
        df['vol_z'] = ((df['volume'] - vol_mean) / vol_std).fillna(0)

        # ── Adaptive Multiplier ───────────────────────────────────────────────
        quality_deviation = (1.0 - df['tqi']) ** 1.5
        tqi_mult = 1.0 - quality_strength + quality_strength * (0.6 + 0.8 * quality_deviation)
        df['sym_mult'] = (base_mult * tqi_mult).ewm(alpha=0.15, adjust=False).mean()

        # ── SuperTrend Logic ──────────────────────────────────────────────────
        n = len(df)
        lower_band = np.full(n, np.nan)
        upper_band = np.full(n, np.nan)
        trend = np.ones(n, dtype=int)

        closes_arr = df['close'].values
        eff_arr = df['eff_atr'].values
        mult_arr = df['sym_mult'].values

        for i in range(1, n):
            if np.isnan(eff_arr[i]) or np.isnan(mult_arr[i]):
                lower_band[i] = lower_band[i-1] if not np.isnan(lower_band[i-1]) else closes_arr[i]
                upper_band[i] = upper_band[i-1] if not np.isnan(upper_band[i-1]) else closes_arr[i]
                trend[i] = trend[i-1]
                continue

            l_raw = closes_arr[i] - mult_arr[i] * eff_arr[i]
            u_raw = closes_arr[i] + mult_arr[i] * eff_arr[i]

            if trend[i-1] == 1:
                lower_band[i] = max(l_raw, lower_band[i-1]) if not np.isnan(lower_band[i-1]) else l_raw
            else:
                lower_band[i] = l_raw

            if trend[i-1] == -1:
                upper_band[i] = min(u_raw, upper_band[i-1]) if not np.isnan(upper_band[i-1]) else u_raw
            else:
                upper_band[i] = u_raw

            if trend[i-1] == 1 and closes_arr[i] < lower_band[i]:
                trend[i] = -1
            elif trend[i-1] == -1 and closes_arr[i] > upper_band[i]:
                trend[i] = 1
            else:
                trend[i] = trend[i-1]

        df['lower_band'] = lower_band
        df['upper_band'] = upper_band
        df['trend'] = trend
        
        return df

    def populate_signals(self, df: pd.DataFrame, params: dict) -> pd.DataFrame:
        p = params or {}
        tqi_min_entry = p.get("tqi_min_entry", 0.3)
        tqi_exit_floor = p.get("tqi_exit_floor", 0.18)
        tqi_slope_threshold = p.get("tqi_slope_threshold", -0.15)
        sl_atr_mult = p.get("sl_atr_mult", 1.5)

        if 'trend' not in df.columns or len(df) < 2:
            df['signal'] = "NONE"
            return df

        # Prepare columns
        df['signal'] = "NONE"
        df['stoploss'] = np.nan
        df['exit_msg'] = ""

        trend = df['trend'].values
        tqi = df['tqi'].values
        tqi_slope = df['tqi_slope'].values
        closes = df['close'].values
        eff_atr = df['eff_atr'].values

        for i in range(1, len(df)):
            curr_trend = trend[i]
            prev_trend = trend[i-1]
            curr_tqi = tqi[i]
            curr_slope = tqi_slope[i]

            is_collapsing = (curr_tqi < tqi_exit_floor) or (curr_slope < tqi_slope_threshold)

            if curr_trend == 1 and prev_trend == -1 and curr_tqi >= tqi_min_entry:
                df.iloc[i, df.columns.get_loc('signal')] = "LONG"
                df.iloc[i, df.columns.get_loc('stoploss')] = float(closes[i] - sl_atr_mult * eff_atr[i])
            elif curr_trend == -1 and prev_trend == 1 and curr_tqi >= tqi_min_entry:
                df.iloc[i, df.columns.get_loc('signal')] = "SHORT"
                df.iloc[i, df.columns.get_loc('stoploss')] = float(closes[i] + sl_atr_mult * eff_atr[i])
            elif is_collapsing:
                df.iloc[i, df.columns.get_loc('signal')] = "NONE"
                df.iloc[i, df.columns.get_loc('exit_msg')] = "TQI_COLLAPSE" if curr_tqi < tqi_exit_floor else "TQI_SLOPE_CRASH"

        return df

    def get_metadata(self):
        return {
            "name": "Self-Aware Trend System",
            "description": "Adaptive SuperTrend with Character-Flip (Pre-emptive Exit). Includes TQI (ER, Vol, Struct, Mom, ADX).",
            "version": "2.1.0"
        }
