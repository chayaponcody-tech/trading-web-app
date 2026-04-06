import ccxt from 'ccxt';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../../.env') });

async function test() {
  const apiKey = process.env.BINANCE_API_KEY;
  const apiSecret = process.env.BINANCE_API_SECRET;

  console.log('--- DIAGNOSTIC: BINANCE DEMO TRADING ---');
  console.log(`API Key: ${apiKey ? apiKey.slice(0, 6) + '...' : 'MISSING'}`);
  
  const client = new ccxt.binanceusdm({
    apiKey,
    secret: apiSecret,
    enableRateLimit: true,
    options: { 
      defaultType: 'future',
      adjustForTimeDifference: true,
      recvWindow: 60000,
      fetchMarkets: ['linear'], // ห้ามไป Spot
      fetchCurrencies: false    // ห้ามไป Margin/SAPI
    },
    verbose: true 
  });

  // TOTAL LOCKDOWN: Prevent CCXT from hitting production (api.binance.com)
  const demoDomain = 'demo-fapi.binance.com';
  client.urls['api']['public'] = `https://${demoDomain}/fapi/v1`;
  client.urls['api']['private'] = `https://${demoDomain}/fapi/v1`;
  client.urls['api']['fapiPublic'] = `https://${demoDomain}/fapi/v1`;
  client.urls['api']['fapiPrivate'] = `https://${demoDomain}/fapi/v1`;
  client.urls['api']['fapiPublicV2'] = `https://${demoDomain}/fapi/v2`;
  client.urls['api']['fapiPrivateV2'] = `https://${demoDomain}/fapi/v2`;
  
  console.log(`TOTAL LOCKDOWN ACTIVE. Target Domain: ${demoDomain}`);

  try {
    console.log('Testing V2 Account Info (GET)...');
    const res = await client.fapiPrivateV2GetAccount();
    console.log('[SUCCESS] Account retrieved! Assets: ' + res.assets.length);
    
    console.log('Testing setLeverage (POST)...');
    const leverageRes = await client.setLeverage(10, 'BTCUSDT');
    console.log('[SUCCESS] Leverage set to 10x! (Trading Key is working)');
  } catch (e) {
    console.error('[FAILED] Error Details:');
    console.error(`- Message: ${e.message}`);
    if (e.message.includes('-2015')) {
      console.error('- Hint: Check "Enable Futures" permission in Binance settings.');
    }
  }
}

test();
