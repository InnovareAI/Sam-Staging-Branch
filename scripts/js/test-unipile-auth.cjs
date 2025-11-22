#!/usr/bin/env node

// Test Unipile API with different authentication methods

async function testAuth() {
  const unipileDsn = 'api6.unipile.com:13670';

  // Try different API keys
  const apiKeys = [
    {
      name: 'From environment',
      key: process.env.UNIPILE_API_KEY
    },
    {
      name: 'From documentation',
      key: 'aQzsD1+H.EJ60hU0LkPAxRaCU6nlvk3ypn9Rn9BUwqo9LGY24zZU='
    }
  ];

  for (const apiKeyInfo of apiKeys) {
    if (!apiKeyInfo.key) {
      console.log(`\n⚠️  Skipping ${apiKeyInfo.name} - not available`);
      continue;
    }

    console.log('\n' + '=' .repeat(80));
    console.log(`Testing with API key: ${apiKeyInfo.name}`);
    console.log(`Key preview: ${apiKeyInfo.key.substring(0, 10)}...${apiKeyInfo.key.substring(apiKeyInfo.key.length - 5)}`);
    console.log(`Key length: ${apiKeyInfo.key.length}`);

    try {
      // Test listing accounts
      const url = `https://${unipileDsn}/api/v1/accounts`;
      console.log(`\nTesting: GET ${url}`);

      const response = await fetch(url, {
        headers: {
          'X-API-KEY': apiKeyInfo.key,
          'Accept': 'application/json'
        }
      });

      console.log('Response Status:', response.status, response.statusText);

      if (response.ok) {
        const data = await response.json();
        console.log('✓ SUCCESS! API key is valid');
        console.log('Found', Array.isArray(data) ? data.length : (data.items ? data.items.length : 0), 'accounts');

        // Check for Irish's account
        const accounts = data.items || data;
        if (Array.isArray(accounts)) {
          const irishAccount = accounts.find(acc => acc.id === 'ymtTx4xVQ6OVUFk83ctwtA');
          if (irishAccount) {
            console.log('\n✓ Found Irish\'s account!');
            console.log('Account details:');
            console.log(JSON.stringify(irishAccount, null, 2));

            // Now get full details
            console.log('\nFetching full account details...');
            const detailUrl = `https://${unipileDsn}/api/v1/accounts/ymtTx4xVQ6OVUFk83ctwtA`;
            const detailResponse = await fetch(detailUrl, {
              headers: {
                'X-API-KEY': apiKeyInfo.key,
                'Accept': 'application/json'
              }
            });

            if (detailResponse.ok) {
              const detailData = await detailResponse.json();
              console.log('\nFull account data:');
              console.log(JSON.stringify(detailData, null, 2));

              // Check for checkpoint
              if (detailData.checkpoint) {
                console.log('\n⚠️  CHECKPOINT DETECTED!');
                console.log('Checkpoint details:', JSON.stringify(detailData.checkpoint, null, 2));
              }
              if (detailData.status !== 'CONNECTED') {
                console.log('\n⚠️  Account status is not CONNECTED:', detailData.status);
              }
              if (detailData.requires_action) {
                console.log('\n⚠️  Account requires action!');
              }
            }
          } else {
            console.log('\n⚠️  Irish\'s account (ymtTx4xVQ6OVUFk83ctwtA) not found in list');
          }
        }

        // If this key works, stop testing others
        break;
      } else {
        const error = await response.text();
        console.log('✗ FAILED:', error);
      }
    } catch (error) {
      console.error('✗ Error:', error.message);
    }
  }
}

// Load .env.local if available
const fs = require('fs');
const path = require('path');
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  console.log('Loading environment from .env.local...');
  require('dotenv').config({ path: envPath });
}

testAuth();