import ccxt from 'ccxt';
import { BaseExchange } from './BaseExchange.js';

// Select BASE URL based on environment or default to Testnet
const USE_TESTNET = process.env.BINANCE_USE_TESTNET !== 'false';

/**
 * ─── Binance USDT-M Futures Adapter ─────────────────────────────────────────
 * Implements BaseExchange using CCXT for standardisation and robustness.
 * This is the single source of truth for Binance API.
 */
export class BinanceAdapter extends BaseExchange {
  constructor(apiKey, apiSecret) {
    super(apiKey, apiSecret);

    console.log(`[BinanceAdapter] Initializing with API Key: ${this.apiKey ? this.apiKey.substring(0, 5) + '***' : 'NONE'} | Secret: ${this.apiSecret ? 'SET' : 'MISSING'}`);
    
    // Initialize CCXT Binance client with default Futures options
    const exchangeOptions = {
      apiKey: this.apiKey,
      secret: this.apiSecret,
      enableRateLimit: true,
      options: { 
        defaultType: 'future',
        adjustForTimeDifference: true, // AUTO-SYNC CLOCK
        recvWindow: 60000, // EXTEND TIMEOUT WINDOW
        warnOnFetchBalanceWithoutSymbol: false,
        fetchMarkets: ['linear'], // FORCE FUTURES ONLY (USDT-M)
        fetchCurrencies: false,   // DISABLE SAPI CURRENCY LOAD
      },
    };

    this.client = new ccxt.binanceusdm(exchangeOptions);
    this.publicClient = new ccxt.binanceusdm({ ...exchangeOptions, apiKey: undefined, secret: undefined });

    if (USE_TESTNET) {
      const demoDomain = 'demo-fapi.binance.com';
      
      const overrideUrls = (ex) => {
        // PROVEN TOTAL LOCKDOWN: Block all SAPI/Margin leaks to production
        ex.urls['api']['public'] = `https://${demoDomain}/fapi/v1`;
        ex.urls['api']['private'] = `https://${demoDomain}/fapi/v1`;
        ex.urls['api']['fapiPublic'] = `https://${demoDomain}/fapi/v1`;
        ex.urls['api']['fapiPrivate'] = `https://${demoDomain}/fapi/v1`;
        ex.urls['api']['fapiPublicV2'] = `https://${demoDomain}/fapi/v2`;
        ex.urls['api']['fapiPrivateV2'] = `https://${demoDomain}/fapi/v2`;
        ex.urls['api']['sapi'] = `https://${demoDomain}/sapi/v1`; // Redirect sapi to demo (it will fail but won't leak)
      };


      overrideUrls(this.client);
      overrideUrls(this.publicClient);
      
      console.log('[BinanceAdapter] TOTAL LOCKDOWN: All endpoints routed to Demo Server.');
    } else {
      console.log('[BinanceAdapter] Initialized in LIVE (Production) mode.');
    }
  }

  // ─── Shared Helper ────────────────────────────────────────────────────────

  /** Returns the client to use based on whether keys are valid/required */
  _getPublic() {
    return this.publicClient;
  }

  // ─── Public Interface (Mapping to CCXT) ───────────────────────────────────

  async getAccountInfo() {
    try {
      return await this.client.fapiPrivateV2GetAccount();
    } catch (e) {
      throw new Error(`[BinanceAdapter] getAccountInfo error: ${e.message}`);
    }
  }

  async getPositionRisk() {
    try {
      return await this.client.fapiPrivateV2GetPositionRisk();
    } catch (e) {
      throw new Error(`[BinanceAdapter] getPositionRisk error: ${e.message}`);
    }
  }

  async getExchangeInfo() {
    try {
      return await this._getPublic().fapiPublicGetExchangeInfo();
    } catch (e) {
      throw new Error(`[BinanceAdapter] getExchangeInfo error: ${e.message}`);
    }
  }

  async getUSDTBalance() {
    try {
      const balance = await this.client.fetchBalance();
      return balance.total.USDT || 0;
    } catch (e) {
      throw new Error(`[BinanceAdapter] getUSDTBalance error: ${e.message}`);
    }
  }

  async getTickerPrice(symbol) {
    try {
      const ticker = await this._getPublic().fetchTicker(symbol.toUpperCase());
      return { symbol: ticker.symbol, price: ticker.last };
    } catch (e) {
      throw new Error(`[BinanceAdapter] getTickerPrice error: ${e.message}`);
    }
  }

  async getKlines(symbol, interval, limit = 100) {
    try {
      return await this._getPublic().fetchOHLCV(symbol.toUpperCase(), interval.toLowerCase(), undefined, limit);
    } catch (e) {
      throw new Error(`[BinanceAdapter] getKlines error: ${e.message}`);
    }
  }

  async placeOrder(symbol, side, type, quantity, price = null) {
    try {
      const params = {};
      if (price && type.toUpperCase() === 'LIMIT') {
        return await this.client.createOrder(symbol.toUpperCase(), type.toLowerCase(), side.toLowerCase(), quantity, price);
      }
      return await this.client.createOrder(symbol.toUpperCase(), type.toLowerCase(), side.toLowerCase(), quantity);
    } catch (e) {
      throw new Error(`[BinanceAdapter] placeOrder error: ${e.message}`);
    }
  }

  async setLeverage(symbol, leverage) {
    try {
      return await this.client.setLeverage(parseInt(leverage), symbol.toUpperCase());
    } catch (e) {
      throw new Error(`[BinanceAdapter] setLeverage error: ${e.message}`);
    }
  }

  async closePosition(symbol, positionSide, quantity) {
    try {
      const side = (positionSide.toUpperCase() === 'LONG' || positionSide.toUpperCase() === 'BUY') ? 'SELL' : 'BUY';
      return await this.client.createOrder(symbol.toUpperCase(), 'market', side.toLowerCase(), quantity);
    } catch (e) {
      throw new Error(`[BinanceAdapter] closePosition error: ${e.message}`);
    }
  }

  async get24hTickers() {
    try {
      const tickers = await this._getPublic().fetchTickers();
      return Object.values(tickers);
    } catch (e) {
      throw new Error(`[BinanceAdapter] get24hTickers error: ${e.message}`);
    }
  }

  // ─── Quantitative Advanced Features (Microstructure) ──────────────────────

  /**
   * Fetch Open Interest for a specific symbol.
   * @param {string} symbol - e.g., BTC/USDT:USDT
   */
  async fetchOpenInterest(symbol) {
    try {
      // CCXT provides fetchOpenInterest for Futures
      return await this._getPublic().fetchOpenInterest(symbol.toUpperCase());
    } catch (e) {
      console.warn(`[BinanceAdapter] fetchOpenInterest failed for ${symbol}: ${e.message}`);
      return null;
    }
  }

  /**
   * Fetch current Funding Rate.
   */
  async fetchFundingRate(symbol) {
    try {
      return await this._getPublic().fetchFundingRate(symbol.toUpperCase());
    } catch (e) {
      console.warn(`[BinanceAdapter] fetchFundingRate failed for ${symbol}: ${e.message}`);
      return null;
    }
  }

  /**
   * Fetch Long/Short Ratio from Binance specific endpoints.
   */
  async fetchLongShortRatio(symbol, period = '5m') {
    try {
      // Direct call to Binance specific FAPI endpoint via CCXT
      return await this._getPublic().fapiPublicGetLongShortRatio({
        symbol: symbol.toUpperCase().replace('/', ''),
        period: period
      });
    } catch (e) {
      console.warn(`[BinanceAdapter] fetchLongShortRatio failed for ${symbol}: ${e.message}`);
      return null;
    }
  }

  /** Helper: parse exchange info into a simple symbol → rules map */
  async getSymbolRules() {
    try {
      const pub = this._getPublic();
      await pub.loadMarkets();
      const markets = pub.markets;
      const rules = {};

      Object.values(markets).forEach(m => {
        if (m.future || m.type === 'swap') {
          rules[m.id] = {
            stepSize: m.precision.amount ? Math.pow(10, -m.precision.amount) : 0.001,
            minQty: m.limits.amount.min,
            precision: m.precision.amount,
            tickSize: m.precision.price ? Math.pow(10, -m.precision.price) : 0.0001,
            pricePrecision: m.precision.price,
          };
        }
      });
      return rules;
    } catch (e) {
      throw new Error(`[BinanceAdapter] getSymbolRules error: ${e.message}`);
    }
  }
}

// Named export for backwards compat with existing code that imports BinanceTestnetService
export { BinanceAdapter as BinanceTestnetService };
