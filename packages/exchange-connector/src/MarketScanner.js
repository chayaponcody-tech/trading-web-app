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
     * Scan for symbols based on strategy needs.
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
            usdtPairs = usdtPairs.filter(t => parseFloat(t.priceChangePercent) < -3); // Re-added filter to usdtPairs
            usdtPairs.sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));
        } else if (mode === 'precision') {
            // Top Volume Leaders
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
