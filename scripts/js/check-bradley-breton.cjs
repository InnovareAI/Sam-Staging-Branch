const https = require('https');

const UNIPILE_DSN = process.env.UNIPILE_DSN || 'api6.unipile.com:13670';
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const ACCOUNT_ID = 'ymtTx4xVQ6OVUFk83ctwtA';

console.log('=== CHECKING IRISH\'S LINKEDIN ACCOUNT ===\n');
console.log('Account ID:', ACCOUNT_ID);
console.log('Bradley LinkedIn URL: http://www.linkedin.com/in/bradleybreton\n');

// Step 1: Get Bradley's profile
function getBradleyProfile() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: UNIPILE_DSN.split(':')[0],
      port: UNIPILE_DSN.split(':')[1],
      path: '/api/v1/users/bradleybreton?account_id=' + ACCOUNT_ID + '&provider=LINKEDIN',
      method: 'GET',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Step 2: Get sent invitations
function getSentInvitations() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: UNIPILE_DSN.split(':')[0],
      port: UNIPILE_DSN.split(':')[1],
      path: '/api/v1/invitations/sent?account_id=' + ACCOUNT_ID,
      method: 'GET',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Execute checks
(async () => {
  try {
    console.log('STEP 1: Fetching Bradley Breton\'s LinkedIn profile...\n');
    const bradleyProfile = await getBradleyProfile();

    console.log('Bradley Breton Profile:');
    console.log('- Provider ID:', bradleyProfile.id);
    console.log('- Full Name:', bradleyProfile.display_name);
    console.log('- Network Distance:', bradleyProfile.network_distance);
    console.log('- Profile URL:', bradleyProfile.profile_url);
    console.log();

    console.log('STEP 2: Fetching Irish\'s sent invitations...\n');
    const sentInvitations = await getSentInvitations();

    console.log('Total Sent Invitations:', sentInvitations.items?.length || 0);
    console.log();

    // Check if Bradley is in sent invitations
    const bradleyInvitation = sentInvitations.items?.find(inv =>
      inv.attendee?.id === bradleyProfile.id ||
      (inv.attendee?.display_name?.toLowerCase().includes('bradley') &&
       inv.attendee?.display_name?.toLowerCase().includes('breton'))
    );

    console.log('=== RESULTS ===\n');
    console.log('Bradley Network Distance:', bradleyProfile.network_distance);
    console.log('Pending Invitation to Bradley:', bradleyInvitation ? 'YES' : 'NO');

    if (bradleyInvitation) {
      console.log('\nINVITATION DETAILS:');
      console.log('- Sent Date:', bradleyInvitation.date);
      console.log('- Status:', bradleyInvitation.status || 'PENDING');
      console.log('- Message:', bradleyInvitation.message || 'N/A');
    }

    const safeToSend = !bradleyInvitation && bradleyProfile.network_distance !== 'FIRST_DEGREE';
    console.log('\nSAFE TO SEND CONNECTION REQUEST:', safeToSend ? 'YES' : 'NO');

    if (bradleyProfile.network_distance === 'FIRST_DEGREE') {
      console.log('WARNING: Bradley is already a 1st degree connection');
    }
    if (bradleyInvitation) {
      console.log('WARNING: Pending invitation already exists');
    }

  } catch (error) {
    console.error('ERROR:', error.status || error.message);
    if (error.body) {
      console.error('Response:', error.body);
    }
    process.exit(1);
  }
})();
