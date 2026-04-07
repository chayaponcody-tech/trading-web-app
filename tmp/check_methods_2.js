import ccxt;
const exchange = new ccxt.binanceusdm();
console.log('Searching for historical OI method...');
const methods = Object.keys(exchange).filter(m => m.toLowerCase().includes('openinterest') || m.toLowerCase().includes('hist'));
console.log(JSON.stringify(methods, null, 2));

console.log('Checking specific candidate: futuresDataGetOpenInterestHist');
if (typeof exchange.futuresDataGetOpenInterestHist === 'function') {
  console.log('FOUND: futuresDataGetOpenInterestHist');
} else if (typeof exchange.fapiPublicGetOpenInterestHist === 'function') {
  console.log('FOUND: fapiPublicGetOpenInterestHist');
} else {
  console.log('NOT FOUND in binanceusdm.');
}
