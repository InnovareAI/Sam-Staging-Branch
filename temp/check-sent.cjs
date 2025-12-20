const https = require('https');

const UNIPILE_API_KEY = 'PSwP8P+p.sI2dmBbFOUbYbazMbpOF3ikiP8yL36aS7Ug=';

const req = https.request({
  hostname: 'api6.unipile.com',
  port: 13670,
  path: '/api/v1/emails?account_id=rV0czB_nTLC8KSRb69_zRg&folder=SENT&limit=10',
  method: 'GET',
  headers: {
    'X-API-KEY': UNIPILE_API_KEY,
    'Accept': 'application/json'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const result = JSON.parse(data);
    console.log('Recent Sent Emails from Jennifer:');
    const items = result.items || [];
    for (let i = 0; i < Math.min(5, items.length); i++) {
      const email = items[i];
      console.log('\n' + (i + 1) + '. Subject: ' + email.subject);
      console.log('   To: ' + (email.to_attendees?.map(a => a.identifier).join(', ') || 'N/A'));
      console.log('   Date: ' + email.date);
    }
  });
});
req.end();
