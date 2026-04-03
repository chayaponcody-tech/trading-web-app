const http = require('http');

const options = {
  hostname: 'localhost',
  port: 4001,
  path: '/api/forward-test/clear-all',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Response Status:', res.statusCode);
    console.log('Response Data:', data);
    process.exit(0);
  });
});

req.on('error', (error) => {
  console.error('Request Error:', error.message);
  process.exit(1);
});

req.end();
