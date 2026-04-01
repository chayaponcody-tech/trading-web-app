import crypto from 'crypto';
import https from 'https';
import querystring from 'querystring';

const FUTURES_BASE_URL = 'https://testnet.binancefuture.com';
const SPOT_BASE_URL = 'https://testnet.binance.vision';

export class BinanceTestnetService {
  constructor(apiKey, apiSecret) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  _makeRequest(baseUrl, method, path, params = {}) {
    return new Promise((resolve, reject) => {
      const timestamp = Date.now();
      const fullParams = { ...params, timestamp };
      const query = querystring.stringify(fullParams);
      const signature = crypto
        .createHmac('sha256', this.apiSecret)
        .update(query)
        .digest('hex');

      const url = `${baseUrl}${path}?${query}&signature=${signature}`;
      
      const options = {
        method,
        headers: {
          'X-MBX-APIKEY': this.apiKey,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      };

      const req = https.request(url, options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(json);
            } else {
              reject(new Error(`Binance API Error: ${json.msg || body}`));
            }
          } catch (e) {
            reject(new Error(`Failed to parse response: ${body}`));
          }
        });
      });

      req.on('error', (e) => reject(e));
      req.end();
    });
  }

  // --- Futures Testnet (USDT-M) ---

  async getAccountInfo() {
    return this._makeRequest(FUTURES_BASE_URL, 'GET', '/fapi/v2/account');
  }

  async getPositionRisk() {
    return this._makeRequest(FUTURES_BASE_URL, 'GET', '/fapi/v2/positionRisk');
  }
  
  async getExchangeInfo() {
    // Public endpoint, no signature needed
    const url = `${FUTURES_BASE_URL}/fapi/v1/exchangeInfo`;
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try { 
            const json = JSON.parse(body);
            if (res.statusCode === 200) resolve(json);
            else reject(new Error(`ExchangeInfo Error ${res.statusCode}: ${json.msg || body}`));
          } catch (e) { reject(e); }
        });
      }).on('error', reject);
    });
  }

  async getBalances() {
    const info = await this.getAccountInfo();
    return info.assets || [];
  }

  async getUSDTBalance() {
    const balances = await this.getBalances();
    const usdt = balances.find(b => b.asset === 'USDT');
    return usdt ? parseFloat(usdt.walletBalance) : 0;
  }

  async getPositions() {
    const info = await this.getAccountInfo();
    return info.positions || [];
  }

  async placeOrder(symbol, side, type, quantity, price = null) {
    const params = {
      symbol: symbol.toUpperCase(),
      side: side.toUpperCase(), // BUY, SELL
      type: type.toUpperCase(), // LIMIT, MARKET
      quantity: quantity.toString(),
    };
    if (price && type === 'LIMIT') {
      params.price = price.toString();
      params.timeInForce = 'GTC';
    }
    return this._makeRequest(FUTURES_BASE_URL, 'POST', '/fapi/v1/order', params);
  }

  async closePosition(symbol, side, quantity) {
    // Correct mapping for closing positions:
    // If LONG (BUY), must close with SELL
    // If SHORT (SELL), must close with BUY
    let reverseSide;
    if (side.toUpperCase() === 'LONG' || side.toUpperCase() === 'BUY') {
      reverseSide = 'SELL';
    } else {
      reverseSide = 'BUY';
    }
    return this.placeOrder(symbol, reverseSide, 'MARKET', quantity);
  }

  async getTickerPrice(symbol) {
    const url = `${FUTURES_BASE_URL}/fapi/v1/ticker/price?symbol=${symbol.toUpperCase()}`;
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try { 
            const json = JSON.parse(body);
            if (res.statusCode === 200) resolve(json);
            else reject(new Error(`Ticker Error ${res.statusCode}: ${json.msg || body}`));
          } catch (e) { reject(e); }
        });
      }).on('error', reject);
    });
  }

  async getKlines(symbol, interval, limit = 100) {
    // Klines are public, no signature needed
    const url = `${FUTURES_BASE_URL}/fapi/v1/klines?symbol=${symbol.toUpperCase()}&interval=${interval.toLowerCase()}&limit=${limit}`;
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try { 
            const json = JSON.parse(body);
            if (res.statusCode === 200) resolve(json);
            else reject(new Error(`Klines Error ${res.statusCode}: ${json.msg || body}`));
          } catch (e) { reject(e); }
        });
      }).on('error', reject);
    });
  }
}
