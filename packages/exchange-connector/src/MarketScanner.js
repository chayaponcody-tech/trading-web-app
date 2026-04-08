/**
 * Market Scanner Utility
 * Analyzes market data to find trading opportunities.
 */
export class MarketScanner {
    /**
     * @param {import('./BinanceAdapter.js').BinanceAdapter} exchange 
     */
    constructor(exchange) {
        this.exchange = exchange;
    }

    /**
     * Compute ADX (Average Directional Index) from high/low/close arrays.
     * Returns the last ADX value. Low ADX (<25) = ranging/sideway market.
     */
    _computeADX(highs, lows, closes, period = 14) {
        if (closes.length < period * 2) return null;
        const trueRanges = [], plusDMs = [], minusDMs = [];
        for (let i = 1; i < closes.length; i++) {
            const h = highs[i], l = lows[i], ph = highs[i - 1], pl = lows[i - 1], pc = closes[i - 1];
            trueRanges.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
            plusDMs.push(h - ph > pl - l && h - ph > 0 ? h - ph : 0);
            minusDMs.push(pl - l > h - ph && pl - l > 0 ? pl - l : 0);
        }
        const smooth = (arr) => {
            let s = arr.slice(0, period).reduce((a, b) => a + b, 0);
            const out = [s];
            for (let i = period; i < arr.length; i++) {
                s = s - s / period + arr[i];
                out.push(s);
            }
            return out;
        };
        const atr = smooth(trueRanges), pDI = smooth(plusDMs), mDI = smooth(minusDMs);
        const dxArr = [];
        for (let i = 0; i < atr.length; i++) {
            if (atr[i] === 0) { dxArr.push(0); continue; }
            const pdi = (pDI[i] / atr[i]) * 100;
            const mdi = (mDI[i] / atr[i]) * 100;
            dxArr.push(Math.abs(pdi - mdi) / (pdi + mdi) * 100);
        }
        // Smooth DX into ADX
        let adx = dxArr.slice(0, period).reduce((a, b) => a + b, 0) / period;
        for (let i = period; i < dxArr.length; i++) {
            adx = (adx * (period - 1) + dxArr[i]) / period;
        }
        return adx;
    }

    /**
     * Compute Bollinger Band Width % (BBW) from closes.
     * Low BBW = price is consolidating (good for grid).
     */
    _computeBBWidth(closes, period = 20) {
        if (closes.length < period) return null;
        const slice = closes.slice(-period);
        const mean = slice.reduce((a, b) => a + b, 0) / period;
        const sd = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
        return (sd * 4) / mean * 100; // BBW% = (upper - lower) / middle * 100
    }

    /**
     * Assess market regime suitability for a given strategy type.
     * Returns { suitable: bool, regime: string, adx, bbWidth, score }
     */
    async assessSuitability(symbol, strategyType, interval = '1h') {
        try {
            const klines = await this.exchange.getKlines(symbol, interval, 60);
            if (!klines || klines.length < 30) return { suitable: false, regime: 'insufficient_data', score: 0 };

            const highs  = klines.map(k => parseFloat(k[2]));
            const lows   = klines.map(k => parseFloat(k[3]));
            const closes = klines.map(k => parseFloat(k[4]));

            const adx     = this._computeADX(highs, lows, closes);
            const bbWidth = this._computeBBWidth(closes);
            const priceChange = Math.abs((closes.at(-1) - closes[0]) / closes[0] * 100);

            let regime = 'unknown', suitable = false, score = 0;

            if (strategyType === 'grid') {
                // Grid loves: low ADX (<25), narrow BB, small price drift
                const adxOk  = adx !== null && adx < 25;
                const bbOk   = bbWidth !== null && bbWidth < 5;
                const driftOk = priceChange < 8;
                score = 0;
                if (adxOk)   score += 40;
                if (bbOk)    score += 35;
                if (driftOk) score += 25;
                suitable = score >= 60;
                regime = adx < 20 ? 'sideway_strong' : adx < 25 ? 'sideway' : adx < 35 ? 'weak_trend' : 'trending';
            } else if (strategyType === 'trend') {
                // Trend loves: high ADX (>25), wide BB
                const adxOk = adx !== null && adx > 25;
                const bbOk  = bbWidth !== null && bbWidth > 4;
                score = 0;
                if (adxOk) score += 50;
                if (bbOk)  score += 30;
                if (priceChange > 5) score += 20;
                suitable = score >= 60;
                regime = adx > 40 ? 'strong_trend' : adx > 25 ? 'trending' : 'ranging';
            } else if (strategyType === 'scalp') {
                // Scalp loves: high volatility + volume
                const bbOk = bbWidth !== null && bbWidth > 3;
                score = bbOk ? 60 : 30;
                if (priceChange > 3) score += 40;
                suitable = score >= 50;
                regime = priceChange > 5 ? 'volatile' : 'low_volatility';
            }

            return { suitable, regime, adx: adx ? parseFloat(adx.toFixed(2)) : null, bbWidth: bbWidth ? parseFloat(bbWidth.toFixed(2)) : null, priceChange: parseFloat(priceChange.toFixed(2)), score };
        } catch (e) {
            return { suitable: false, regime: 'error', score: 0, error: e.message };
        }
    }

    /**
     * Scan for symbols based on strategy needs.
     * @param {number} limit
     * @param {'volume'|'scout'|'dip'|'precision'|'grid'} mode
     */
    async scanTopUSDT(limit = 20, mode = 'volume') {
        const tickers = await this.exchange.get24hTickers();
        if (!Array.isArray(tickers)) return [];

        let usdtPairs = tickers.filter(t => t.symbol.endsWith('USDT') && !t.symbol.includes('_'));

        if (mode === 'scout') {
            // Find High Volatility / Momentum
            usdtPairs.sort((a, b) => {
                const volA = Math.abs(parseFloat(a.priceChangePercent)) * Math.log10(parseFloat(a.quoteVolume));
                const volB = Math.abs(parseFloat(b.priceChangePercent)) * Math.log10(parseFloat(b.quoteVolume));
                return volB - volA;
            });
        } else if (mode === 'dip') {
            // Find deep dips with high volume
            usdtPairs = usdtPairs.filter(t => parseFloat(t.priceChangePercent) < -3);
            usdtPairs.sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));
        } else if (mode === 'precision') {
            // Top Volume Leaders
            usdtPairs.sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));
        } else if (mode === 'grid') {
            // Sideway candidates: low absolute price change + high volume
            usdtPairs = usdtPairs.filter(t => Math.abs(parseFloat(t.priceChangePercent)) < 5);
            usdtPairs.sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));
        } else {
            // Default to price change ranking
            usdtPairs.sort((a, b) => Math.abs(parseFloat(b.priceChangePercent)) - Math.abs(parseFloat(a.priceChangePercent)));
        }

        return usdtPairs.slice(0, limit).map(t => {
            const change = parseFloat(t.priceChangePercent);
            let tag = '穩定';
            if (change > 5) tag = '🔥 突破';
            else if (change < -5) tag = '📉 深跌';
            else if (change > 2) tag = '📈 有趣';
            
            return {
                symbol: t.symbol,
                price: parseFloat(t.lastPrice),
                change,
                volume: parseFloat(t.quoteVolume),
                tag
            };
        });
    }
}
