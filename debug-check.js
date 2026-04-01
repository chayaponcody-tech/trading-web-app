import fetch from 'node-fetch';

async function check() {
    try {
        const res = await fetch('http://localhost:4001/api/binance/config');
        const data = await res.json();
        console.log('--- BACKEND CONFIG CHECK ---');
        console.log('Status Code:', res.status);
        console.log('Data:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('--- BACKEND ERROR ---');
        console.error(e.message);
    }
}
check();
