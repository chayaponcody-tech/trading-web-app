import { EMA, BollingerBands, RSI, SMA, ATR, ADX } from 'technicalindicators';

/**
 * MarketDataEngine
 * Centralized engine for calculating Market Features (Technical, Quant, Microstructure)
 */
export class MarketDataEngine {
  constructor(binanceService) {
    this.binanceService = binanceService;
    this.cache = new Map(); // symbol_interval -> { data, timestamp }
    this.CACHE_TTL = 30000; // 30 seconds
  }

  /**
   * Get all features for a symbol and interval
   */
  async getMarketFeatures(symbol, interval) {
    const cacheKey = `${symbol}_${interval}`;
    const now = Date.now();
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (now - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }
    }

    try {
      // 1. Fetch Raw Data in Parallel
      const [klines, ticker, oiData, fundingData, liqs, aggTrades] = await Promise.all([
        this.binanceService.getKlines(symbol, interval, 250),
        this.binanceService.getTickerPrice(symbol),
        this.binanceService.getOpenInterest(symbol).catch(() => null),
        this.binanceService.getFundingRate(symbol).catch(() => null),
        this.binanceService.getLiquidationOrders(symbol, 100).catch(() => []),
        this.binanceService.getAggregateTrades(symbol, 500).catch(() => [])
      ]);

      if (!Array.isArray(klines) || klines.length < 50) {
        throw new Error('Insufficient data for feature calculation');
      }

      const highs = klines.map(k => parseFloat(k[2]));
      const lows = klines.map(k => parseFloat(k[3]));
      const closes = klines.map(k => parseFloat(k[4]));
      const volumes = klines.map(k => parseFloat(k[5]));
      const currPrice = parseFloat(ticker.price);

      // 2. Calculate Features
      const technicals = this._calculateTechnicals(closes, highs, lows);
      const quant = this._calculateQuantFeatures(closes, highs, lows);
      
      // Calculate Microstructure (Liquidity + Order Flow)
      const liqVol = liqs.reduce((acc, curr) => acc + (parseFloat(curr.lastFillQty || 0) * parseFloat(curr.lastFillPrice || 0)), 0);
      
      const buyVol = aggTrades.filter(t => t.m === false).reduce((acc, curr) => acc + parseFloat(curr.q), 0);
      const sellVol = aggTrades.filter(t => t.m === true).reduce((acc, curr) => acc + parseFloat(curr.q), 0);
      const delta = (buyVol - sellVol) / (buyVol + sellVol || 1);

      const microstructure = {
        openInterest: oiData ? parseFloat(oiData.openInterest) : null,
        fundingRate: fundingData ? parseFloat(fundingData.lastFundingRate) : null,
        liquidationVolume: Math.round(liqVol),
        orderFlowDelta: Math.round(delta * 1000) / 1000,
        nextFundingTime: fundingData ? fundingData.nextFundingTime : null,
      };

      // Simulated On-Chain Data (High-Premium Demo)
      // Real implementation would connect to Glassnode/Dune APIs
      const onchain = {
          exchangeNetflow: (Math.random() * 2 - 1) * 100, // Normalized -100 to 100
          stablecoinRatio: 12.5 + (Math.random() * 2),   // Base 12.5%
          whaleActivity: Math.random() > 0.7 ? 'HIGH' : 'LOW'
      };

      const result = {
        symbol,
        interval,
        price: currPrice,
        timestamp: now,
        features: {
          technicals,
          quant,
          microstructure,
          onchain
        }
      };

      this.cache.set(cacheKey, { data: result, timestamp: now });
      return result;
    } catch (error) {
      console.error(`[MarketDataEngine] Error fetching features for ${symbol}:`, error.message);
      throw error;
    }
  }

  _calculateTechnicals(closes, highs, lows) {
    const lastPrice = closes[closes.length - 1];
    
    const rsi = RSI.calculate({ period: 14, values: closes });
    const ema20 = EMA.calculate({ period: 20, values: closes });
    const ema50 = EMA.calculate({ period: 50, values: closes });
    const bb = BollingerBands.calculate({ period: 20, stdDev: 2, values: closes });
    
    return {
      rsi: rsi[rsi.length - 1] || null,
      ema20: ema20[ema20.length - 1] || null,
      ema50: ema50[ema50.length - 1] || null,
      bb: bb[bb.length - 1] || null,
      trend_direction: (ema20[ema20.length - 1] > ema50[ema50.length - 1]) ? 'UP' : 'DOWN'
    };
  }

  _calculateQuantFeatures(closes, highs, lows) {
    // 1. Efficiency Ratio (ER)
    const er_len = 20;
    const change = Math.abs(closes[closes.length - 1] - closes[closes.length - 1 - er_len]);
    let path = 0;
    for (let i = closes.length - er_len; i < closes.length; i++) {
      path += Math.abs(closes[i] - closes[i - 1]);
    }
    const er = path === 0 ? 0 : Math.min(1, change / path);

    // 2. Volatility Ratio
    const atr_len = 14;
    const atr_baseline_len = 100;
    const atr_vals = ATR.calculate({ high: highs, low: lows, close: closes, period: atr_len });
    const currATr = atr_vals[atr_vals.length - 1] || 0;
    
    // Simple baseline mean of ATR
    const atr_subset = atr_vals.slice(-atr_baseline_len);
    const atr_baseline = atr_subset.reduce((a, b) => a + b, 0) / (atr_subset.length || 1);
    const vol_ratio = atr_baseline === 0 ? 1 : currATr / atr_baseline;
    const tqi_vol = Math.min(1, Math.max(0, (vol_ratio - 0.6) / (1.8 - 0.6)));

    // 3. Price Structure
    const struct_len = 20;
    const recent_highs = highs.slice(-struct_len);
    const recent_lows = lows.slice(-struct_len);
    const struct_hi = Math.max(...recent_highs);
    const struct_lo = Math.min(...recent_lows);
    const price_pos = (closes[closes.length - 1] - struct_lo) / (struct_hi - struct_lo || 1);
    const tqi_struct = Math.min(1, Math.max(0, Math.abs(price_pos - 0.5) * 2));

    // 4. Momentum Persistence
    const mom_len = 10;
    const direction = Math.sign(closes[closes.length - 1] - closes[closes.length - 1 - mom_len]);
    let aligned = 0;
    for (let i = closes.length - mom_len; i < closes.length; i++) {
        const bar_dir = Math.sign(closes[i] - closes[i - 1]);
        if (bar_dir === direction) aligned++;
    }
    const tqi_mom = aligned / mom_len;

    // 5. ADX Component
    const adx_vals = ADX.calculate({ high: highs, low: lows, close: closes, period: 14 });
    const last_adx = adx_vals[adx_vals.length - 1]?.adx || 0;
    const tqi_adx = Math.min(1, last_adx / 50.0);

    // Composite TQI (v2.1 weights)
    const tqi = (er * 0.25 + tqi_vol * 0.15 + tqi_struct * 0.20 + tqi_mom * 0.20 + tqi_adx * 0.20);

    return {
      tqi: Math.round(tqi * 1000) / 1000,
      efficiency_ratio: Math.round(er * 1000) / 1000,
      volatility_ratio: Math.round(tqi_vol * 1000) / 1000,
      structure_score: Math.round(tqi_struct * 1000) / 1000,
      momentum_persistence: Math.round(tqi_mom * 1000) / 1000,
      adx_strength: Math.round(tqi_adx * 1000) / 1000
    };
  }
}
