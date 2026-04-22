// ─── Base Exchange Interface ─────────────────────────────────────────────────
// All exchange adapters must implement these methods.
// This allows adding new exchanges (e.g. OKX, Bybit) in the future
// without changing Bot Engine code.

export class BaseExchange {
  constructor(apiKey, apiSecret) {
    if (new.target === BaseExchange) {
      throw new Error('BaseExchange is abstract. Use a concrete adapter like BinanceAdapter.');
    }
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  /** @returns {Promise<object>} Account info with assets and positions */
  async getAccountInfo() { throw new Error('Not implemented'); }

  /** @returns {Promise<Array>} Position risk data */
  async getPositionRisk() { throw new Error('Not implemented'); }

  /** @returns {Promise<object>} Exchange rules (lot sizes, precision) */
  async getExchangeInfo() { throw new Error('Not implemented'); }

  /** @returns {Promise<number>} USDT wallet balance */
  async getUSDTBalance() { throw new Error('Not implemented'); }

  /** @returns {Promise<object>} Latest ticker price for symbol */
  async getTickerPrice(symbol) { throw new Error('Not implemented'); }

  /**
   * @param {string} symbol
   * @param {string} interval - e.g. '1h', '5m'
   * @param {number} limit
   * @returns {Promise<Array>} Kline data
   */
  async getKlines(symbol, interval, limit) { throw new Error('Not implemented'); }

  /**
   * @param {string} symbol
   * @param {'BUY'|'SELL'} side
   * @param {'MARKET'|'LIMIT'} type
   * @param {string} quantity
   * @param {number|null} price
   */
  async placeOrder(symbol, side, type, quantity, price) { throw new Error('Not implemented'); }

  /**
   * @param {string} symbol
   * @param {'LONG'|'SHORT'} positionSide
   * @param {string} quantity
   */
  async closePosition(symbol, positionSide, quantity) { throw new Error('Not implemented'); }

  /** @returns {Promise<Array>} 24h ticker data for all symbols */
  async get24hTickers() { throw new Error('Not implemented'); }

  /** @returns {Promise<Array>} Real trade history from exchange */
  async getMyTrades(symbol, since, limit) { throw new Error('Not implemented'); }
}
