import { BinanceAdapter } from './BinanceAdapter.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../../.env') });

async function test() {
  console.log('--- TESTING BINANCE ADAPTER (CCXT - MAINNET PUBLIC) ---');
  
  // We use null keys to ensure we only test PUBLIC methods that don't require Auth
  // And we force LIVE mode just for this test to bypass the broken Testnet URLs
  process.env.BINANCE_USE_TESTNET = 'true'; 
  
  const adapter = new BinanceAdapter(process.env.BINANCE_API_KEY, process.env.BINANCE_API_SECRET);
  console.log('--- TESTING BINANCE ADAPTER (CCXT) ---');
  console.log('URLs:', adapter.client.urls.api);

  try {
    const account = await adapter.getAccountInfo();
    console.log(`[SUCCESS] Account Assets: ${account.assets.length}`);

    const ticker = await adapter.getTickerPrice('BTC/USDT');
    console.log(`[SUCCESS] BTC Price: ${ticker.price}`);

    const oi = await adapter.fetchOpenInterest('BTC/USDT');
    // Normalize OI display
    const oiValue = oi.openInterestAmount || oi.info?.sumOpenInterest || oi;
    console.log(`[SUCCESS] BTC Open Interest: ${oiValue}`);

    const funding = await adapter.fetchFundingRate('BTC/USDT');
    console.log(`[SUCCESS] BTC Funding Rate: ${funding.fundingRate ? (funding.fundingRate * 100).toFixed(4) : 'N/A'}%`);

  } catch (e) {
    console.error(`[FAILED] Test error: ${e.message}`);
  }
}

test();
