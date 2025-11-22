#!/usr/bin/env node

// Try to use native fetch if available (Node 18+), otherwise use node-fetch
let fetch;
try {
  // For Node 18+ native fetch is available
  fetch = globalThis.fetch;
} catch {
  // Fallback to node-fetch if available
  try {
    fetch = require('node-fetch');
  } catch {
    console.error('Error: fetch not available. Please install node-fetch or use Node 18+');
    process.exit(1);
  }
}

async function checkIrishAccount() {
  const accountId = 'ymtTx4xVQ6OVUFk83ctwtA';
  const unipileDsn = process.env.UNIPILE_DSN || 'api6.unipile.com:13670';
  const unipileApiKey = process.env.UNIPILE_API_KEY;

  if (!unipileApiKey) {
    console.error('Error: UNIPILE_API_KEY not set');
    process.exit(1);
  }

  console.log('Checking Irish\'s Unipile account status...');
  console.log('Account ID:', accountId);
  console.log('API URL:', `https://${unipileDsn}/api/v1/accounts/${accountId}`);
  console.log('API Key length:', unipileApiKey.length, 'characters');
  console.log('=' .repeat(80));

  try {
    const response = await fetch(`https://${unipileDsn}/api/v1/accounts/${accountId}`, {
      headers: {
        'X-API-KEY': unipileApiKey,
        'Accept': 'application/json'
      }
    });

    console.log('Response Status:', response.status, response.statusText);
    console.log('-'.repeat(80));

    const data = await response.json();

    if (response.ok) {
      console.log('Full Account Response:');
      console.log(JSON.stringify(data, null, 2));
      console.log('\n' + '='.repeat(80) + '\n');

      // Analyze key fields
      console.log('KEY STATUS INFORMATION:');
      console.log('-'.repeat(40));

      // Check for checkpoint
      if (data.checkpoint) {
        console.log('⚠️  CHECKPOINT FOUND!');
        console.log('Checkpoint data:', JSON.stringify(data.checkpoint, null, 2));

        // Check checkpoint type
        if (data.checkpoint.type) {
          console.log('Checkpoint Type:', data.checkpoint.type);
        }
        if (data.checkpoint.required_action) {
          console.log('Required Action:', data.checkpoint.required_action);
        }
        if (data.checkpoint.url) {
          console.log('Checkpoint URL:', data.checkpoint.url);
        }
      } else {
        console.log('✓ No checkpoint found');
      }

      // Check status
      if (data.status) {
        console.log(`\nAccount Status: ${data.status}`);
        if (data.status !== 'CONNECTED') {
          console.log('  ⚠️  Account is not in CONNECTED status!');
        }
      }

      // Check connection_status
      if (data.connection_status) {
        console.log(`Connection Status: ${data.connection_status}`);
      }

      // Check requires_action
      if (data.requires_action !== undefined) {
        console.log(`Requires Action: ${data.requires_action}`);
        if (data.requires_action) {
          console.log('  ⚠️  Account requires action!');
        }
      }

      // Check error
      if (data.error) {
        console.log(`⚠️  Error: ${data.error}`);
      }

      // Check if suspended or disabled
      if (data.is_suspended) {
        console.log('⚠️  Account is suspended!');
      }
      if (data.is_disabled) {
        console.log('⚠️  Account is disabled!');
      }

      // Check last_sync
      if (data.last_sync) {
        console.log(`\nLast Sync: ${data.last_sync}`);
      }

      // Check provider details
      if (data.provider) {
        console.log(`Provider: ${data.provider}`);
      }
      if (data.provider_type) {
        console.log(`Provider Type: ${data.provider_type}`);
      }

      // Check user info
      if (data.name) {
        console.log(`\nAccount Name: ${data.name}`);
      }
      if (data.email) {
        console.log(`Account Email: ${data.email}`);
      }

    } else {
      console.error('API Error Response:');
      console.error(JSON.stringify(data, null, 2));
    }

  } catch (error) {
    console.error('Error making request:', error.message);
    console.error('Stack:', error.stack);
  }
}

checkIrishAccount();