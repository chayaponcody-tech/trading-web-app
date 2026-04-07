import ccxt;
const exchange = new ccxt.binanceusdm();
const methods = Object.keys(exchange).filter(m => m.toLowerCase().includes('openinterest'));
console.log(JSON.stringify(methods, null, 2));
console.log('--- Historical ---');
const histMethods = Object.keys(exchange).filter(m => m.toLowerCase().includes('hist'));
console.log(JSON.stringify(histMethods, null, 2));
