// Test script to check hosted auth endpoint
const https = require('https');

// First, let's just test the endpoint directly
const options = {
  hostname: 'app.meet-sam.com',
  port: 443,
  path: '/api/linkedin/hosted-auth',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    // We need to add your actual session cookie here
    // You can get this from browser DevTools > Application > Cookies
    'Cookie': 'YOUR_SESSION_COOKIE_HERE'
  }
};

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, JSON.stringify(res.headers, null, 2));
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\nResponse body:');
    try {
      console.log(JSON.stringify(JSON.parse(data), null, 2));
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(JSON.stringify({}));
req.end();