#!/usr/bin/env node

/**
 * Test Unipile LinkedIn search API directly
 * This script tests various search scenarios to diagnose issues
 */

// Load from .env first (has the correct key), then .env.local as fallback
require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });

const UNIPILE_DSN = process.env.UNIPILE_DSN || 'api6.unipile.com:13670';
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const IRISH_ACCOUNT_ID = 'ymtTx4xVQ6OVUFk83ctwtA'; // Irish's LinkedIn account

if (!UNIPILE_API_KEY) {
  console.error('❌ Missing UNIPILE_API_KEY in environment');
  process.exit(1);
}

console.log('🔵 Testing Unipile LinkedIn Search API');
console.log('🔵 DSN:', UNIPILE_DSN);
console.log('🔵 API Key (first 10 chars):', UNIPILE_API_KEY.substring(0, 10) + '...');
console.log('🔵 Account ID (Irish):', IRISH_ACCOUNT_ID);
console.log('');

async function testParameterLookup(type, keywords) {
  console.log(`\n📍 Testing ${type} lookup for: "${keywords}"`);

  const url = `https://${UNIPILE_DSN}/api/v1/linkedin/search/parameters`;
  const params = new URLSearchParams({
    account_id: IRISH_ACCOUNT_ID,
    type: type,
    keywords: keywords,
    limit: '5'
  });

  try {
    const response = await fetch(`${url}?${params}`, {
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    console.log(`   Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`   ❌ Error:`, errorText);
      return null;
    }

    const data = await response.json();
    console.log(`   ✅ Results:`, JSON.stringify(data, null, 2).substring(0, 500));

    // Extract IDs
    const items = data.items || data;
    if (Array.isArray(items) && items.length > 0) {
      const ids = items.map(item => item.id || item.urn || item.value).filter(Boolean);
      console.log(`   ✅ Found ${ids.length} IDs:`, ids);
      return ids;
    } else {
      console.log(`   ⚠️ No results found`);
      return null;
    }
  } catch (error) {
    console.log(`   ❌ Exception:`, error.message);
    return null;
  }
}

async function testSearch(payload, description) {
  console.log(`\n🔍 Testing Search: ${description}`);
  console.log('   Payload:', JSON.stringify(payload, null, 2));

  const url = `https://${UNIPILE_DSN}/api/v1/linkedin/search`;
  const params = new URLSearchParams({
    account_id: IRISH_ACCOUNT_ID,
    limit: '10'
  });

  try {
    const response = await fetch(`${url}?${params}`, {
      method: 'POST',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log(`   Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`   ❌ Error:`, errorText);

      // Try to parse error details
      try {
        const errorJson = JSON.parse(errorText);
        console.log(`   ❌ Parsed Error:`, errorJson);
      } catch {}

      return;
    }

    const data = await response.json();
    const resultCount = data.items?.length || 0;
    console.log(`   ✅ Success! Found ${resultCount} results`);

    if (resultCount > 0) {
      console.log(`   First result:`, {
        name: data.items[0].name || `${data.items[0].first_name} ${data.items[0].last_name}`,
        headline: data.items[0].headline?.substring(0, 50),
        location: data.items[0].location
      });
    }
  } catch (error) {
    console.log(`   ❌ Exception:`, error.message);
  }
}

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('STEP 1: TEST PARAMETER LOOKUPS');
  console.log('═══════════════════════════════════════════════════════════════');

  // Test location lookup
  const berlinIds = await testParameterLookup('LOCATION', 'Berlin, Germany');
  const londonIds = await testParameterLookup('LOCATION', 'London');

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('STEP 2: TEST SIMPLE SEARCHES');
  console.log('═══════════════════════════════════════════════════════════════');

  // Test 1: Keywords only (simplest possible search)
  await testSearch({
    api: 'classic',
    category: 'people',
    keywords: 'marketing'
  }, 'Keywords only - "marketing"');

  // Test 2: Keywords with network filter
  await testSearch({
    api: 'classic',
    category: 'people',
    keywords: 'marketing',
    network: ['S'] // 2nd degree only
  }, 'Keywords + 2nd degree filter');

  // Test 3: Keywords with location text (will fail, but let's see the error)
  await testSearch({
    api: 'classic',
    category: 'people',
    keywords: 'marketing Berlin Germany',
    network: ['S']
  }, 'Keywords with location in text');

  // Test 4: If we got location IDs, test with structured location
  if (berlinIds && berlinIds.length > 0) {
    await testSearch({
      api: 'classic',
      category: 'people',
      keywords: 'marketing',
      location: [berlinIds[0]], // Use first Berlin ID
      network: ['S']
    }, 'Keywords + Berlin location ID');
  }

  // Test 5: Title filter
  await testSearch({
    api: 'classic',
    category: 'people',
    title: 'marketing manager',
    network: ['S']
  }, 'Title filter - "marketing manager"');

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('STEP 3: TEST ACCOUNT CAPABILITIES');
  console.log('═══════════════════════════════════════════════════════════════');

  // Get account details to check premium features
  const accountUrl = `https://${UNIPILE_DSN}/api/v1/accounts/${IRISH_ACCOUNT_ID}`;
  try {
    const response = await fetch(accountUrl, {
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (response.ok) {
      const account = await response.json();
      console.log('Account Type:', account.type);
      console.log('Account Name:', account.name);
      console.log('Premium Features:', account.connection_params?.im?.premiumFeatures || 'none');
      console.log('Account Status:', account.status);
    } else {
      console.log('❌ Could not fetch account details');
    }
  } catch (error) {
    console.log('❌ Error fetching account:', error.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('✅ TESTS COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════');
}

// Run tests
runTests().catch(console.error);