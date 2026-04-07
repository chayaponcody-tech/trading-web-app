import ccxt;
const exchange = new ccxt.binanceusdm();
console.log('--- PUBLIC Methods ---');
const publicKeys = Object.keys(exchange.api.fapi.public);
console.log(JSON.stringify(publicKeys, null, 2));
console.log('--- FUTURES DATA Methods ---');
const dataKeys = Object.keys(exchange.api.futuresData);
console.log(JSON.stringify(dataKeys, null, 2));
