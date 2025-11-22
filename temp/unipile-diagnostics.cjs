const https = require('https');

const UNIPILE_DSN = process.env.UNIPILE_DSN || 'api6.unipile.com:13670';
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

if (!UNIPILE_API_KEY) {
  console.error('ERROR: UNIPILE_API_KEY not found in environment');
  process.exit(1);
}

const [host, port] = UNIPILE_DSN.split(':');

function makeRequest(path, label) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: host,
      port: port || 443,
      path: path,
      method: 'GET',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    };

    console.log('\n' + '='.repeat(80));
    console.log(label);
    console.log('='.repeat(80));
    console.log(`URL: https://${host}:${port || 443}${path}`);
    console.log('');

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        console.log('');
        try {
          const json = JSON.parse(data);
          console.log(JSON.stringify(json, null, 2));
        } catch (e) {
          console.log('Raw Response:', data);
        }
        resolve();
      });
    });

    req.on('error', (error) => {
      console.error('Request Error:', error.message);
      resolve();
    });

    req.end();
  });
}

async function runDiagnostics() {
  // 1. Check Irish's account status
  await makeRequest(
    '/api/v1/accounts/ymtTx4xVQ6OVUFk83ctwtA',
    '1. IRISH ACCOUNT STATUS'
  );

  // 2. Check Bradley's profile details
  await makeRequest(
    '/api/v1/users/profile?account_id=ymtTx4xVQ6OVUFk83ctwtA&identifier=http://www.linkedin.com/in/bradleybreton',
    '2. BRADLEY PROFILE DETAILS'
  );

  // 3. Check Irish's sent invitations
  await makeRequest(
    '/api/v1/users/invitations?account_id=ymtTx4xVQ6OVUFk83ctwtA&type=SENT',
    '3. IRISH SENT INVITATIONS HISTORY'
  );
}

runDiagnostics().catch(console.error);
