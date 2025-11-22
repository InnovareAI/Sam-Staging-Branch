#!/usr/bin/env node

// Test basic Unipile API connectivity

// Load environment variables from .env.local if it exists
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  console.log('Loading environment from .env.local...');
  require('dotenv').config({ path: envPath });
}

async function testUnipileAPI() {
  const unipileDsn = process.env.UNIPILE_DSN || 'api6.unipile.com:13670';
  const unipileApiKey = process.env.UNIPILE_API_KEY;

  if (!unipileApiKey) {
    console.error('Error: UNIPILE_API_KEY not set');
    process.exit(1);
  }

  console.log('Testing Unipile API connectivity...');
  console.log('DSN:', unipileDsn);
  console.log('API Key:', unipileApiKey.substring(0, 10) + '...' + unipileApiKey.substring(unipileApiKey.length - 5));
  console.log('API Key length:', unipileApiKey.length);
  console.log('=' .repeat(80));

  // Test 1: List all accounts
  console.log('\nTest 1: Listing all accounts...');
  try {
    const url = `https://${unipileDsn}/api/v1/accounts`;
    console.log('URL:', url);

    const response = await fetch(url, {
      headers: {
        'X-API-KEY': unipileApiKey,
        'Accept': 'application/json'
      }
    });

    console.log('Response Status:', response.status, response.statusText);

    if (response.ok) {
      const data = await response.json();
      console.log('✓ Success! Found', Array.isArray(data) ? data.length : 0, 'accounts');

      if (Array.isArray(data) && data.length > 0) {
        console.log('\nAccounts found:');
        data.forEach(account => {
          console.log(`  - ${account.name || 'Unknown'} (${account.id}) - Status: ${account.status || 'Unknown'}`);
        });

        // Look for Irish's account
        const irishAccount = data.find(acc => acc.id === 'ymtTx4xVQ6OVUFk83ctwtA');
        if (irishAccount) {
          console.log('\n✓ Found Irish\'s account in the list!');
          console.log('Irish\'s account status:', irishAccount.status);
        } else {
          console.log('\n⚠️  Irish\'s account (ymtTx4xVQ6OVUFk83ctwtA) not found in the list');
        }
      }
    } else {
      const error = await response.text();
      console.error('✗ Failed:', error);
    }
  } catch (error) {
    console.error('✗ Error:', error.message);
  }

  // Test 2: Get specific account (Irish's)
  console.log('\n' + '=' .repeat(80));
  console.log('\nTest 2: Getting Irish\'s specific account...');
  try {
    const accountId = 'ymtTx4xVQ6OVUFk83ctwtA';
    const url = `https://${unipileDsn}/api/v1/accounts/${accountId}`;
    console.log('URL:', url);

    const response = await fetch(url, {
      headers: {
        'X-API-KEY': unipileApiKey,
        'Accept': 'application/json'
      }
    });

    console.log('Response Status:', response.status, response.statusText);

    const data = await response.json();
    if (response.ok) {
      console.log('✓ Success! Got account details');
      console.log('Account data:', JSON.stringify(data, null, 2));
    } else {
      console.error('✗ Failed:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('✗ Error:', error.message);
  }
}

testUnipileAPI();