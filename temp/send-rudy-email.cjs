const https = require('https');

const UNIPILE_API_KEY = '85ZMr7iE.Pw5mVHOgvpPXOl47GXXXoW0uLPvOUK23bWXD+hHuziA=';

const emailData = {
  account_id: 'rV0czB_nTLC8KSRb69_zRg',
  to: [{
    identifier: 'rudy@sbfoglobal.com',
    display_name: 'Rudy Walgraef'
  }],
  subject: 'Re: SAM Demo Video',
  body: `Hi Rudy,

Yep, SAM's still going strong! Here's the demo video: https://links.innovareai.com/SamAIDemoVideo

Let me know if you have any questions after watching.

Happy holidays!

Jennifer`
};

console.log('Sending email to Rudy...');
console.log('Request body:', JSON.stringify(emailData, null, 2));

const postData = JSON.stringify(emailData);

const req = https.request({
  hostname: 'api6.unipile.com',
  port: 13670,
  path: '/api/v1/emails',
  method: 'POST',
  headers: {
    'X-API-KEY': UNIPILE_API_KEY,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('\nResponse Status:', res.statusCode);
    console.log('Response:', data);
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.write(postData);
req.end();
