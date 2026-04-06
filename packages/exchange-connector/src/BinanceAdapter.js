import crypto from 'crypto';
import https from 'https';
import querystring from 'querystring';
import { BaseExchange } from './BaseExchange.js';

const TESTNET_URL = 'https://testnet.binancefuture.com';
const LIVE_URL = 'https://fapi.binance.com';

// Select BASE URL based on environment or default to Testnet
const BASE_URL = process.env.BINANCE_USE_TESTNET === 'false' ? LIVE_URL : TESTNET_URL;

// ─── Binance Testnet Futures Adapter ─────────────────────────────────────────
// Implements BaseExchange for Binance USDT-M Futures Testnet.
// This is the single source of truth for Binance API — replaces both
// the old `binance-service.js` (root) and `backend/services/binanceService.js`.

export class BinanceAdapter extends BaseExchange {
  constructor(apiKey, apiSecret) {
    super(apiKey, apiSecret);
  }

  // ─── Private HTTP ─────────────────────────────────────────────────────────

  _signedRequest(method, path, params = {}, retries = 3) {
    return new Promise((resolve, reject) => {
      const exec = () => {
        const timestamp = Date.now();
        const fullParams = { ...params, timestamp };
        const query = querystring.stringify(fullParams);
        const signature = crypto
          .createHmac('sha256', this.apiSecret)
          .update(query)
          .digest('hex');

        const url = `${BASE_URL}${path}?${query}&signature=${signature}`;
        const options = {
          method,
          headers: {
            'X-MBX-APIKEY': this.apiKey,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        };

        const req = https.request(url, options, (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try {
              const json = JSON.parse(body);
              if (res.statusCode >= 200 && res.statusCode < 300) resolve(json);
              else reject(new Error(`Binance API [${res.statusCode}]: ${json.msg || body}`));
            } catch (e) {
              reject(new Error(`Binance parse error: ${body}`));
            }
          });
        });

        req.on('error', (err) => {
          if (retries > 0 && (err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET')) {
            console.warn(`[BinanceAdapter] Retrying ${path} due to ${err.code}... (${retries} left)`);
            setTimeout(() => {
              this._signedRequest(method, path, params, retries - 1).then(resolve).catch(reject);
            }, 2000);
          } else {
            reject(err);
          }
        });
        req.end();
      };
      exec();
    });
  }

  _publicGet(path, params = {}, retries = 3) {
    return new Promise((resolve, reject) => {
      const exec = () => {
        const query = querystring.stringify(params);
        const url = `${BASE_URL}${path}${query ? '?' + query : ''}`;
        https.get(url, (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try {
              const json = JSON.parse(body);
              if (res.statusCode === 200) resolve(json);
              else reject(new Error(`Binance Public [${res.statusCode}]: ${json.msg || body}`));
            } catch (e) {
              reject(new Error(`Binance public parse error: ${body}`));
            }
          });
        }).on('error', (err) => {
          if (retries > 0 && (err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET')) {
            console.warn(`[BinanceAdapter] Retrying GET ${path} due to ${err.code}... (${retries} left)`);
            setTimeout(() => {
              this._publicGet(path, params, retries - 1).then(resolve).catch(reject);
            }, 2000);
          } else {
            reject(err);
          }
        });
      };
      exec();
    });
  }

  // ─── Public Interface ─────────────────────────────────────────────────────

  async getAccountInfo() {
    return this._signedRequest('GET', '/fapi/v2/account');
  }

  async getPositionRisk() {
    return this._signedRequest('GET', '/fapi/v2/positionRisk');
  }

  async getExchangeInfo() {
    return this._publicGet('/fapi/v1/exchangeInfo');
  }

  async getUSDTBalance() {
    const info = await this.getAccountInfo();
    const usdt = (info.assets || []).find((a) => a.asset === 'USDT');
    return usdt ? parseFloat(usdt.walletBalance) : 0;
  }

  async getTickerPrice(symbol) {
    return this._publicGet('/fapi/v1/ticker/price', { symbol: symbol.toUpperCase() });
  }

  async getKlines(symbol, interval, limit = 100) {
    return this._publicGet('/fapi/v1/klines', {
      symbol: symbol.toUpperCase(),
      interval: interval.toLowerCase(),
      limit,
    });
  }

  async placeOrder(symbol, side, type, quantity, price = null) {
    const params = {
      symbol: symbol.toUpperCase(),
      side: side.toUpperCase(),
      type: type.toUpperCase(),
      quantity: String(quantity),
    };
    if (price && type === 'LIMIT') {
      params.price = String(price);
      params.timeInForce = 'GTC';
    }
    return this._signedRequest('POST', '/fapi/v1/order', params);
  }

  async setLeverage(symbol, leverage) {
    return this._signedRequest('POST', '/fapi/v1/leverage', {
      symbol: symbol.toUpperCase(),
      leverage: parseInt(leverage),
    });
  }

  async closePosition(symbol, positionSide, quantity) {
    const side =
      positionSide.toUpperCase() === 'LONG' || positionSide.toUpperCase() === 'BUY'
        ? 'SELL'
        : 'BUY';
    return this.placeOrder(symbol, side, 'MARKET', quantity);
  }

  async get24hTickers() {
    return this._publicGet('/fapi/v1/ticker/24hr');
  }

  /** Helper: parse exchange info into a simple symbol → rules map */
  async getSymbolRules() {
    const info = await this.getExchangeInfo();
    const rules = {};
    (info.symbols || []).forEach((s) => {
      const lotSize = s.filters.find((f) => f.filterType === 'LOT_SIZE');
      const priceFilter = s.filters.find((f) => f.filterType === 'PRICE_FILTER');
      
      rules[s.symbol] = {
        // Quantity Rules
        stepSize: lotSize ? parseFloat(lotSize.stepSize) : 0.001,
        minQty: lotSize ? parseFloat(lotSize.minQty) : 0.001,
        precision: lotSize ? (lotSize.stepSize.toString().split('.')[1]?.length || 0) : 3,
        // Price Rules
        tickSize: priceFilter ? parseFloat(priceFilter.tickSize) : 0.0001,
        pricePrecision: priceFilter ? (priceFilter.tickSize.toString().split('.')[1]?.length || 0) : 4,
      };
    });
    return rules;
  }
}

// Named export for backwards compat with existing code that imports BinanceTestnetService
export { BinanceAdapter as BinanceTestnetService };
