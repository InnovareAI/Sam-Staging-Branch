#!/usr/bin/env node

/**
 * Diagnostic script for Irish Maguad's Unipile connection request issues
 *
 * Context:
 * - Irish's Unipile account ID: ymtTx4xVQ6OVUFk83ctwtA
 * - Error: "Should delay new invitation to this recipient"
 * - Prospects: Adam Fry and Ruben Mayer
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const UNIPILE_BASE_URL = `https://${process.env.UNIPILE_DSN}`;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const IRISH_ACCOUNT_ID = 'ymtTx4xVQ6OVUFk83ctwtA';

// Test prospects that failed
const TEST_PROSPECTS = [
  {
    name: 'Adam Fry',
    linkedin_url: 'https://www.linkedin.com/in/adam-h-fry',
    mini_profile: 'urn:li:fs_miniProfile:ACoAAASEFSgBmAsKhHk1EZVHn93R--zoSI16F0c'
  },
  {
    name: 'Ruben Mayer',
    linkedin_url: 'https://www.linkedin.com/in/rubenmayer',
    mini_profile: 'urn:li:fs_miniProfile:ACoAABeQoWMBkLV9L4lY6dFY-wYg1E_9Upnj2II'
  }
];

async function unipileRequest(endpoint, options = {}) {
  const url = `${UNIPILE_BASE_URL}${endpoint}`;
  console.log(`\n🔍 Calling: ${options.method || 'GET'} ${url}`);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'X-Api-Key': UNIPILE_API_KEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ API Error:', {
        status: response.status,
        statusText: response.statusText,
        error: data
      });
      return { error: data, status: response.status };
    }

    return { data, status: response.status };
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    return { error: error.message };
  }
}

async function checkAccountStatus() {
  console.log('\n═════════════════════════════════════════════════════');
  console.log('1️⃣  CHECKING IRISH\'S ACCOUNT STATUS');
  console.log('═════════════════════════════════════════════════════');

  // Get account details
  const { data, error } = await unipileRequest(`/api/v1/accounts/${IRISH_ACCOUNT_ID}`);

  if (error) {
    console.error('Failed to fetch account:', error);
    return false;
  }

  console.log('\n📋 Account Details:');
  console.log('  - ID:', data.id);
  console.log('  - Name:', data.name);
  console.log('  - Provider:', data.provider);
  console.log('  - Type:', data.type);
  console.log('  - Status:', data.status);
  console.log('  - Created:', data.created_at);
  console.log('  - Updated:', data.updated_at);

  if (data.limits) {
    console.log('\n📊 Account Limits:');
    console.log('  - Daily CR limit:', data.limits.daily_connection_requests || 'N/A');
    console.log('  - Weekly CR limit:', data.limits.weekly_connection_requests || 'N/A');
    console.log('  - Monthly CR limit:', data.limits.monthly_connection_requests || 'N/A');
  }

  if (data.metrics) {
    console.log('\n📈 Current Usage:');
    console.log('  - CRs sent today:', data.metrics.connection_requests_today || 0);
    console.log('  - CRs sent this week:', data.metrics.connection_requests_week || 0);
    console.log('  - CRs sent this month:', data.metrics.connection_requests_month || 0);
  }

  return data.status === 'OK';
}

async function checkPendingInvitations() {
  console.log('\n═════════════════════════════════════════════════════');
  console.log('2️⃣  CHECKING PENDING INVITATIONS');
  console.log('═════════════════════════════════════════════════════');

  // Get all pending invitations
  const { data, error } = await unipileRequest(
    `/api/v1/messaging/invitations?account_id=${IRISH_ACCOUNT_ID}&status=PENDING`
  );

  if (error) {
    console.error('Failed to fetch invitations:', error);
    return;
  }

  console.log(`\n📬 Found ${data.items?.length || 0} pending invitations`);

  if (data.items && data.items.length > 0) {
    // Check if our test prospects are in the pending list
    for (const prospect of TEST_PROSPECTS) {
      const pending = data.items.find(inv =>
        inv.recipient?.name?.includes(prospect.name.split(' ')[0]) ||
        inv.recipient?.name?.includes(prospect.name.split(' ')[1])
      );

      if (pending) {
        console.log(`\n⚠️  ${prospect.name} has a PENDING invitation:`);
        console.log('  - Invitation ID:', pending.id);
        console.log('  - Sent at:', pending.sent_at);
        console.log('  - Status:', pending.status);
        console.log('  - Message:', pending.message?.substring(0, 100));
      } else {
        console.log(`\n✅ ${prospect.name} - No pending invitation found`);
      }
    }

    // Show recent pending invitations
    console.log('\n📝 Recent Pending Invitations (last 5):');
    data.items.slice(0, 5).forEach(inv => {
      console.log(`  - ${inv.recipient?.name || 'Unknown'} (${inv.sent_at})`);
    });
  }
}

async function checkRecentActivity() {
  console.log('\n═════════════════════════════════════════════════════');
  console.log('3️⃣  CHECKING RECENT CONNECTION REQUEST ACTIVITY');
  console.log('═════════════════════════════════════════════════════');

  // Get recent messages/invitations
  const { data, error } = await unipileRequest(
    `/api/v1/messaging/messages?account_id=${IRISH_ACCOUNT_ID}&limit=20`
  );

  if (error) {
    console.error('Failed to fetch messages:', error);
    return;
  }

  // Filter for connection requests
  const connectionRequests = (data.items || []).filter(msg =>
    msg.type === 'INVITATION' || msg.type === 'CONNECTION_REQUEST'
  );

  console.log(`\n📨 Found ${connectionRequests.length} recent connection requests`);

  // Check for our test prospects
  for (const prospect of TEST_PROSPECTS) {
    const request = connectionRequests.find(cr =>
      cr.participants?.some(p =>
        p.name?.includes(prospect.name.split(' ')[0]) ||
        p.name?.includes(prospect.name.split(' ')[1])
      )
    );

    if (request) {
      console.log(`\n⚠️  Found previous CR to ${prospect.name}:`);
      console.log('  - Message ID:', request.id);
      console.log('  - Sent at:', request.timestamp);
      console.log('  - Status:', request.status);
    }
  }

  // Show recent CRs
  if (connectionRequests.length > 0) {
    console.log('\n📝 Recent Connection Requests (last 5):');
    connectionRequests.slice(0, 5).forEach(cr => {
      const recipient = cr.participants?.find(p => p.id !== IRISH_ACCOUNT_ID);
      console.log(`  - ${recipient?.name || 'Unknown'} (${cr.timestamp})`);
    });
  }
}

async function testProfileFetch() {
  console.log('\n═════════════════════════════════════════════════════');
  console.log('4️⃣  TESTING PROFILE FETCH FOR ADAM FRY');
  console.log('═════════════════════════════════════════════════════');

  const adamUrl = TEST_PROSPECTS[0].linkedin_url;
  console.log(`\n📝 Fetching profile for: ${adamUrl}`);

  const { data, error } = await unipileRequest(
    `/api/v1/users/profile?account_id=${IRISH_ACCOUNT_ID}&identifier=${encodeURIComponent(adamUrl)}`
  );

  if (error) {
    console.error('❌ Failed to fetch profile:', error);

    // Check if it's the specific "delay" error
    if (error.message?.includes('delay') || error.title?.includes('delay')) {
      console.log('\n🔴 CRITICAL: Unipile is returning "delay" error even for profile fetch!');
      console.log('This suggests a cooldown or restriction at the account level.');
    }
    return;
  }

  console.log('\n✅ Profile fetched successfully:');
  console.log('  - Name:', data.name);
  console.log('  - Provider ID:', data.provider_id);
  console.log('  - Network Distance:', data.network_distance);
  console.log('  - Title:', data.title);
  console.log('  - Company:', data.company);

  if (data.network_distance === 'FIRST_DEGREE') {
    console.log('\n⚠️  Adam is already a 1st degree connection!');
  }

  // Check invitation status in profile
  if (data.invitation_status) {
    console.log('\n📬 Invitation Status:', data.invitation_status);
    if (data.invitation_status === 'PENDING') {
      console.log('⚠️  There\'s already a pending invitation to this person!');
    }
  }

  return data;
}

async function checkAccountRestrictions() {
  console.log('\n═════════════════════════════════════════════════════');
  console.log('5️⃣  CHECKING ACCOUNT RESTRICTIONS & RATE LIMITS');
  console.log('═════════════════════════════════════════════════════');

  // Try to get account restrictions/warnings
  const { data, error } = await unipileRequest(
    `/api/v1/accounts/${IRISH_ACCOUNT_ID}/restrictions`
  );

  if (error) {
    // This endpoint might not exist, that's OK
    console.log('ℹ️  No restrictions endpoint available');
  } else if (data) {
    console.log('\n⚠️  Account Restrictions Found:');
    console.log(JSON.stringify(data, null, 2));
  }

  // Check for rate limit headers in a test request
  console.log('\n📊 Checking Rate Limit Headers...');
  const testEndpoint = `/api/v1/accounts/${IRISH_ACCOUNT_ID}`;
  const response = await fetch(`${UNIPILE_BASE_URL}${testEndpoint}`, {
    headers: {
      'X-Api-Key': UNIPILE_API_KEY,
      'Accept': 'application/json'
    }
  });

  // Check rate limit headers
  const rateLimitHeaders = {
    'X-RateLimit-Limit': response.headers.get('x-ratelimit-limit'),
    'X-RateLimit-Remaining': response.headers.get('x-ratelimit-remaining'),
    'X-RateLimit-Reset': response.headers.get('x-ratelimit-reset'),
    'Retry-After': response.headers.get('retry-after')
  };

  const hasRateLimits = Object.values(rateLimitHeaders).some(v => v !== null);

  if (hasRateLimits) {
    console.log('\n📊 Rate Limit Information:');
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      if (value) console.log(`  - ${key}: ${value}`);
    });

    if (rateLimitHeaders['X-RateLimit-Remaining'] === '0') {
      console.log('\n🔴 CRITICAL: Account has hit rate limit!');
    }
  } else {
    console.log('ℹ️  No rate limit headers found');
  }
}

async function attemptConnectionRequest() {
  console.log('\n═════════════════════════════════════════════════════');
  console.log('6️⃣  ATTEMPTING TEST CONNECTION REQUEST');
  console.log('═════════════════════════════════════════════════════');

  console.log('\n⚠️  This will attempt to send a REAL connection request.');
  console.log('Proceeding with Adam Fry as test...\n');

  // First get the profile to get provider_id
  const profileResult = await unipileRequest(
    `/api/v1/users/profile?account_id=${IRISH_ACCOUNT_ID}&identifier=${encodeURIComponent(TEST_PROSPECTS[0].linkedin_url)}`
  );

  if (profileResult.error) {
    console.error('❌ Cannot proceed - profile fetch failed');
    return;
  }

  const providerId = profileResult.data.provider_id;
  console.log(`\n✅ Got provider_id: ${providerId}`);

  // Attempt to send connection request
  const payload = {
    account_id: IRISH_ACCOUNT_ID,
    provider_id: providerId,
    message: 'Hi Adam, I\'d like to connect and discuss potential opportunities.'
  };

  console.log('\n📤 Sending connection request...');
  console.log('Payload:', JSON.stringify(payload, null, 2));

  const { data, error } = await unipileRequest('/api/v1/users/invite', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (error) {
    console.error('\n❌ Connection request FAILED:');
    console.error('Error:', JSON.stringify(error, null, 2));

    // Analyze the error
    if (error.message?.includes('delay') || error.title?.includes('delay')) {
      console.log('\n🔍 DIAGNOSIS: "Should delay" error confirmed');
      console.log('Possible causes:');
      console.log('  1. LinkedIn has a cooldown on this recipient (they may have ignored/declined before)');
      console.log('  2. The account has sent too many CRs recently to similar profiles');
      console.log('  3. LinkedIn detected automated behavior and imposed restrictions');
      console.log('  4. The recipient has privacy settings blocking connection requests');
    }
  } else {
    console.log('\n✅ Connection request sent successfully!');
    console.log('Response:', JSON.stringify(data, null, 2));
  }
}

async function runDiagnostics() {
  console.log('\n🔧 UNIPILE DIAGNOSTICS FOR IRISH MAGUAD');
  console.log('Account ID:', IRISH_ACCOUNT_ID);
  console.log('Started at:', new Date().toISOString());
  console.log('════════════════════════════════════════════════════════');

  try {
    // 1. Check account status
    const accountOk = await checkAccountStatus();
    if (!accountOk) {
      console.log('\n🔴 Account status is not OK. This needs to be fixed first.');
    }

    // 2. Check pending invitations
    await checkPendingInvitations();

    // 3. Check recent activity
    await checkRecentActivity();

    // 4. Test profile fetch
    await testProfileFetch();

    // 5. Check restrictions
    await checkAccountRestrictions();

    // 6. Attempt a connection request
    await attemptConnectionRequest();

    console.log('\n═════════════════════════════════════════════════════');
    console.log('📊 DIAGNOSTIC SUMMARY');
    console.log('═════════════════════════════════════════════════════');
    console.log('\n🔍 Key Findings:');
    console.log('  - Check the output above for specific issues');
    console.log('  - Look for pending invitations to the same prospects');
    console.log('  - Check if account has rate limit restrictions');
    console.log('  - Verify if "delay" error is recipient-specific or account-wide');

  } catch (error) {
    console.error('\n❌ Diagnostic script failed:', error);
  }
}

// Run diagnostics
runDiagnostics();