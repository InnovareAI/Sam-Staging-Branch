/**
 * Test script to verify Unipile API is returning LinkedIn connections
 * Run with: node scripts/test-unipile-connections.js
 */

require('dotenv').config({ path: '.env.local' });

const UNIPILE_DSN = process.env.UNIPILE_DSN;
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;

if (!UNIPILE_DSN || !UNIPILE_API_KEY) {
  console.error('❌ Missing UNIPILE_DSN or UNIPILE_API_KEY in .env.local');
  process.exit(1);
}

const UNIPILE_BASE_URL = `https://${UNIPILE_DSN}`;

async function testUnipileConnections() {
  console.log('🔍 Testing Unipile API...');
  console.log(`Base URL: ${UNIPILE_BASE_URL}`);

  try {
    // Step 1: Get all accounts
    console.log('\n📋 Step 1: Fetching Unipile accounts...');
    const accountsResponse = await fetch(`${UNIPILE_BASE_URL}/api/v1/accounts`, {
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!accountsResponse.ok) {
      const errorText = await accountsResponse.text();
      throw new Error(`Failed to fetch accounts: ${accountsResponse.status} - ${errorText}`);
    }

    const accountsData = await accountsResponse.json();
    console.log(`✅ Found ${accountsData.items?.length || 0} accounts`);

    // Debug: Show full account structure
    if (accountsData.items?.length > 0) {
      console.log('\n📊 First account structure:');
      console.log(JSON.stringify(accountsData.items[0], null, 2));
    }

    // Find LinkedIn account (try different field names)
    const linkedinAccount = accountsData.items?.find(acc =>
      acc.provider === 'LINKEDIN' ||
      acc.type === 'LINKEDIN' ||
      acc.provider?.toUpperCase() === 'LINKEDIN'
    );

    if (!linkedinAccount) {
      console.log('❌ No LinkedIn account found in Unipile');
      console.log('Available accounts:', accountsData.items?.map(a => a.provider));
      return;
    }

    console.log(`✅ Found LinkedIn account: ${linkedinAccount.id}`);
    console.log(`   Account name: ${linkedinAccount.name || 'N/A'}`);
    console.log(`   Account email: ${linkedinAccount.email || 'N/A'}`);

    // Step 2: Try different endpoints to find connections
    console.log('\n📋 Step 2: Testing different Unipile endpoints...');

    const endpoints = [
      `/api/v1/accounts/${linkedinAccount.id}/contacts`,
      `/api/v1/accounts/${linkedinAccount.id}/network`,
      `/api/v1/accounts/${linkedinAccount.id}/connections`,
      `/api/v1/linkedin/connections`,
      `/api/v1/accounts/${linkedinAccount.id}/chats`,
      `/api/v1/accounts/${linkedinAccount.id}/messages`,
      `/api/v1/hosted/messaging/accounts/${linkedinAccount.id}/chats`,
      `/api/v1/hosted/messaging/accounts/${linkedinAccount.id}/messages`
    ];

    let connectionsData = null;
    for (const endpoint of endpoints) {
      console.log(`\n🔍 Trying: ${endpoint}`);
      const response = await fetch(`${UNIPILE_BASE_URL}${endpoint}?limit=10`, {
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        console.log(`✅ Success! Status: ${response.status}`);
        connectionsData = await response.json();
        console.log('Response keys:', Object.keys(connectionsData));
        break;
      } else {
        console.log(`❌ Failed: ${response.status}`);
      }
    }

    if (!connectionsData) {
      console.log('\n❌ Could not find working endpoint for connections');
      return;
    }

    const connections = connectionsData.items || connectionsData.data || connectionsData || [];

    console.log(`✅ Found ${connections.length} connections`);

    if (connections.length > 0) {
      console.log('\n📊 Sample connections (first 3):');
      connections.slice(0, 3).forEach((conn, idx) => {
        console.log(`\n${idx + 1}. ${conn.name || conn.full_name || 'N/A'}`);
        console.log(`   Profile URL: ${conn.profile_url || conn.public_profile_url || 'N/A'}`);
        console.log(`   Internal ID: ${conn.id || conn.linkedin_id || conn.internal_id || 'N/A'}`);
        console.log(`   Headline: ${conn.headline || conn.title || 'N/A'}`);
        console.log(`   Company: ${conn.company || conn.company_name || 'N/A'}`);
      });

      // Check for specific prospect
      console.log('\n\n🔍 Looking for prospect: Edoardo Maggini');
      const testProspect = connections.find(c =>
        (c.name || c.full_name || '').toLowerCase().includes('edoardo maggini')
      );

      if (testProspect) {
        console.log('✅ FOUND prospect in connections!');
        console.log('   Full data:', JSON.stringify(testProspect, null, 2));
      } else {
        console.log('❌ Prospect NOT found in first 10 connections');
        console.log('   Try fetching more connections (increase limit)');
      }
    } else {
      console.log('❌ No connections returned from Unipile');
    }

    // Step 3: Check full response structure
    console.log('\n📊 Full response structure:');
    console.log('Keys:', Object.keys(connectionsData));
    console.log('Total available:', connectionsData.total || connectionsData.count || 'unknown');

  } catch (error) {
    console.error('❌ Error testing Unipile:', error.message);
    console.error(error.stack);
  }
}

testUnipileConnections();
