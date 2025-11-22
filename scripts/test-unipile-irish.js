#!/usr/bin/env node

const UNIPILE_DSN = 'api6.unipile.com:13670';
const UNIPILE_API_KEY = '8QrwPJ9i.1dX5352mYYWLctVvd1QWgh4/krY+wWg1tJE87IavwGc=';
const IRISH_ACCOUNT_ID = 'ymtTx4xVQ6OVUFk83ctwtA';

// Test prospects
const ADAM_FRY_URL = 'https://www.linkedin.com/in/adam-h-fry';
const RUBEN_MAYER_URL = 'https://www.linkedin.com/in/rubenmayer';

async function unipileRequest(endpoint, options = {}) {
  const url = `https://${UNIPILE_DSN}${endpoint}`;
  console.log(`\n📡 Request: ${options.method || 'GET'} ${url}`);

  if (options.body) {
    console.log('📦 Body:', JSON.stringify(options.body, null, 2));
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'X-Api-Key': UNIPILE_API_KEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!response.ok) {
      console.log(`❌ HTTP ${response.status} ${response.statusText}`);
      console.log('🔴 Error Response:', JSON.stringify(data, null, 2));
      return { error: data, status: response.status };
    }

    console.log('✅ Success Response:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('🔥 Network Error:', error.message);
    return { error: error.message };
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('🔍 DIAGNOSING IRISH MAGUAD\'S UNIPILE CONNECTION REQUEST ISSUES');
  console.log('='.repeat(80));

  // Step 1: Check account status
  console.log('\n📌 STEP 1: CHECK IRISH\'S ACCOUNT STATUS');
  console.log('-'.repeat(80));

  const accountInfo = await unipileRequest(`/api/v1/accounts/${IRISH_ACCOUNT_ID}`);

  if (accountInfo.error) {
    console.log('⚠️  Could not fetch account info. Trying list accounts...');
    const accounts = await unipileRequest('/api/v1/accounts');
    if (!accounts.error && accounts.items) {
      const irish = accounts.items.find(a => a.id === IRISH_ACCOUNT_ID);
      if (irish) {
        console.log('\n✅ Found Irish\'s account in list:');
        console.log('  - Name:', irish.name);
        console.log('  - Provider:', irish.provider);
        console.log('  - Status:', irish.status);
        console.log('  - Created:', irish.created_at);
        console.log('  - Updated:', irish.updated_at);
      } else {
        console.log('❌ Irish\'s account not found in account list');
      }
    }
  } else {
    console.log('\n✅ Account Details:');
    console.log('  - Name:', accountInfo.name);
    console.log('  - Provider:', accountInfo.provider);
    console.log('  - Status:', accountInfo.status);
    console.log('  - Created:', accountInfo.created_at);
    console.log('  - Updated:', accountInfo.updated_at);
  }

  // Step 2: Check pending invitations
  console.log('\n📌 STEP 2: CHECK PENDING INVITATIONS');
  console.log('-'.repeat(80));

  const pendingInvites = await unipileRequest(
    `/api/v1/users/relations?account_id=${IRISH_ACCOUNT_ID}&type=PENDING`
  );

  if (!pendingInvites.error && pendingInvites.items) {
    console.log(`\n📊 Found ${pendingInvites.items.length} pending invitations`);

    if (pendingInvites.items.length > 0) {
      console.log('\n⚠️  RECENT PENDING INVITATIONS:');
      pendingInvites.items.slice(0, 5).forEach(invite => {
        console.log(`  - ${invite.name || 'Unknown'} (${invite.provider_id})`);
        console.log(`    Created: ${invite.created_at}`);
        console.log(`    Profile: ${invite.profile_url || 'N/A'}`);
      });

      // Check if Adam or Ruben are in pending
      const adamPending = pendingInvites.items.find(i =>
        i.profile_url?.includes('adam-h-fry') ||
        i.name?.toLowerCase().includes('adam fry')
      );
      const rubenPending = pendingInvites.items.find(i =>
        i.profile_url?.includes('rubenmayer') ||
        i.name?.toLowerCase().includes('ruben mayer')
      );

      if (adamPending) {
        console.log('\n🔴 ADAM FRY IS IN PENDING INVITATIONS!');
        console.log('  This explains the "Should delay new invitation" error');
      }
      if (rubenPending) {
        console.log('\n🔴 RUBEN MAYER IS IN PENDING INVITATIONS!');
        console.log('  This explains the "Should delay new invitation" error');
      }
    }
  }

  // Step 3: Test fetching Adam Fry's profile
  console.log('\n📌 STEP 3: FETCH ADAM FRY\'S PROFILE');
  console.log('-'.repeat(80));

  const adamProfile = await unipileRequest(
    `/api/v1/users/profile?account_id=${IRISH_ACCOUNT_ID}&identifier=${encodeURIComponent(ADAM_FRY_URL)}`
  );

  if (!adamProfile.error) {
    console.log('\n✅ Adam Fry Profile:');
    console.log('  - Name:', adamProfile.name);
    console.log('  - Provider ID:', adamProfile.provider_id);
    console.log('  - Network Distance:', adamProfile.network_distance);
    console.log('  - Headline:', adamProfile.headline);
    console.log('  - Location:', adamProfile.location);

    if (adamProfile.network_distance === 'FIRST_DEGREE') {
      console.log('\n⚠️  Adam is already a 1st degree connection!');
    }

    // Step 4: Try sending connection request (will likely fail)
    console.log('\n📌 STEP 4: ATTEMPT CONNECTION REQUEST TO ADAM');
    console.log('-'.repeat(80));

    const inviteResult = await unipileRequest('/api/v1/users/invite', {
      method: 'POST',
      body: {
        account_id: IRISH_ACCOUNT_ID,
        provider_id: adamProfile.provider_id,
        message: "Hi Adam, I'd like to connect with you."
      }
    });

    if (inviteResult.error) {
      console.log('\n🔴 CONNECTION REQUEST FAILED');
      console.log('  Error details:', JSON.stringify(inviteResult.error, null, 2));

      // Analyze the error
      const errorStr = JSON.stringify(inviteResult.error).toLowerCase();
      if (errorStr.includes('delay')) {
        console.log('\n📋 ERROR ANALYSIS: "Should delay new invitation"');
        console.log('  Possible causes:');
        console.log('  1. Already have a pending invitation to this person');
        console.log('  2. Recently withdrew an invitation to this person');
        console.log('  3. LinkedIn rate limiting on the account');
        console.log('  4. Account flagged for too many pending invitations');
      }
    } else {
      console.log('\n✅ Connection request sent successfully!');
      console.log('  Response:', JSON.stringify(inviteResult, null, 2));
    }
  }

  // Step 5: Check account limits and health
  console.log('\n📌 STEP 5: CHECK ACCOUNT LIMITS');
  console.log('-'.repeat(80));

  // Try to get account limits (may not be available in all Unipile versions)
  const limits = await unipileRequest(`/api/v1/accounts/${IRISH_ACCOUNT_ID}/limits`);
  if (!limits.error) {
    console.log('\n📊 Account Limits:');
    console.log(JSON.stringify(limits, null, 2));
  } else {
    console.log('\n⚠️  Account limits endpoint not available');
  }

  // Step 6: Check recent activity
  console.log('\n📌 STEP 6: CHECK RECENT SENT INVITATIONS');
  console.log('-'.repeat(80));

  const sentInvites = await unipileRequest(
    `/api/v1/messaging/messages?account_id=${IRISH_ACCOUNT_ID}&type=INVITE&limit=10`
  );

  if (!sentInvites.error && sentInvites.items) {
    console.log(`\n📊 Found ${sentInvites.items.length} recent sent invitations`);
    sentInvites.items.forEach(invite => {
      console.log(`  - Sent: ${invite.created_at}`);
      console.log(`    To: ${invite.recipient?.name || 'Unknown'}`);
    });
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📋 DIAGNOSIS SUMMARY');
  console.log('='.repeat(80));

  console.log('\n🔍 Key Findings:');
  console.log('1. Account Status:', accountInfo.status || 'Connected (sources OK)');
  console.log('2. Pending Invitations:', pendingInvites.items?.length || 0);
  if (adamProfile && !adamProfile.error) {
    console.log('3. Adam Fry:');
    console.log('   - Network Distance:', adamProfile.network_distance || 'Unknown');
    console.log('   - Invitation Status:', adamProfile.invitation?.status || 'None');
    console.log('   - Profile Retrieved:', adamProfile.first_name !== 'Adam' ? '⚠️  WRONG PROFILE!' : 'Correct');
  }

  console.log('\n💡 RECOMMENDED ACTIONS:');
  console.log('1. If pending invitations > 100, withdraw old ones');
  console.log('2. Check if targets already have pending invitations');
  console.log('3. Verify account is not restricted by LinkedIn');
  console.log('4. Consider implementing a 24-48 hour delay between attempts to same person');
}

main().catch(console.error);