import ccxt from 'ccxt';
const c = new ccxt.binanceusdm();
console.log(JSON.stringify(c.urls.api, null, 2));
