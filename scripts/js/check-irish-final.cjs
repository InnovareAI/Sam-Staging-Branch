#!/usr/bin/env node

// Final test - check Irish's account with all known API keys

async function checkIrishAccount() {
  const accountId = 'ymtTx4xVQ6OVUFk83ctwtA';
  const unipileDsn = 'api6.unipile.com:13670';

  // Load .env.local if available
  const fs = require('fs');
  const path = require('path');
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    console.log('Loading environment from .env.local...\n');
    require('dotenv').config({ path: envPath });
  }

  // All known API keys to try
  const apiKeys = [
    {
      name: 'From test-new-api-key.mjs',
      key: '/kdLciOD.5b8LbZkgBTK60Dubiv8ER49imjSwJV1cBCyZotKj70I='
    },
    {
      name: 'From environment',
      key: process.env.UNIPILE_API_KEY
    },
    {
      name: 'From documentation',
      key: 'aQzsD1+H.EJ60hU0LkPAxRaCU6nlvk3ypn9Rn9BUwqo9LGY24zZU='
    }
  ];

  console.log(`Checking Irish's Unipile account: ${accountId}`);
  console.log('=' .repeat(80));

  let workingKey = null;
  let accountData = null;

  // First, find a working API key
  for (const apiKeyInfo of apiKeys) {
    if (!apiKeyInfo.key) continue;

    console.log(`\nTrying API key: ${apiKeyInfo.name}`);
    console.log(`Key preview: ${apiKeyInfo.key.substring(0, 10)}...`);

    try {
      const response = await fetch(`https://${unipileDsn}/api/v1/accounts/${accountId}`, {
        headers: {
          'X-API-KEY': apiKeyInfo.key,
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        console.log('✓ SUCCESS! This API key works');
        workingKey = apiKeyInfo.key;
        accountData = await response.json();
        break;
      } else {
        const status = response.status;
        if (status === 404) {
          console.log('✗ Account not found with this key (404)');
        } else if (status === 401) {
          console.log('✗ Authentication failed (401)');
        } else {
          console.log(`✗ Failed with status ${status}`);
        }
      }
    } catch (error) {
      console.log('✗ Error:', error.message);
    }
  }

  if (!workingKey) {
    console.error('\n❌ ERROR: No working API key found!');
    console.log('Please check your Unipile API credentials.');
    return;
  }

  // Now analyze the account data
  console.log('\n' + '=' .repeat(80));
  console.log('IRISH\'S ACCOUNT STATUS REPORT');
  console.log('=' .repeat(80));

  console.log('\n📊 Basic Information:');
  console.log(`  Account ID: ${accountData.id}`);
  console.log(`  Name: ${accountData.name || 'Not set'}`);
  console.log(`  Email: ${accountData.email || 'Not set'}`);
  console.log(`  Provider: ${accountData.provider || 'Unknown'}`);
  console.log(`  Type: ${accountData.type || 'Unknown'}`);

  console.log('\n🔌 Connection Status:');
  const status = accountData.status;
  if (status === 'CONNECTED') {
    console.log(`  ✓ Status: ${status} (Good!)`);
  } else {
    console.log(`  ⚠️  Status: ${status} (Not fully connected!)`);
  }

  if (accountData.connection_status) {
    console.log(`  Connection Status Field: ${accountData.connection_status}`);
  }

  console.log('\n🚨 Critical Issues:');
  let hasIssues = false;

  // Check for checkpoint
  if (accountData.checkpoint) {
    hasIssues = true;
    console.log('  ⚠️  CHECKPOINT DETECTED!');
    console.log('     Type:', accountData.checkpoint.type || 'Unknown');
    console.log('     Description:', accountData.checkpoint.description || 'No description');

    if (accountData.checkpoint.required_action) {
      console.log('     Required Action:', accountData.checkpoint.required_action);
    }
    if (accountData.checkpoint.url) {
      console.log('     Checkpoint URL:', accountData.checkpoint.url);
    }
    if (accountData.checkpoint.can_be_solved_by_api !== undefined) {
      console.log('     Can be solved via API:', accountData.checkpoint.can_be_solved_by_api);
    }

    // Full checkpoint data
    console.log('\n     Full Checkpoint Data:');
    console.log('     ' + JSON.stringify(accountData.checkpoint, null, 2).split('\n').join('\n     '));
  }

  // Check if requires action
  if (accountData.requires_action) {
    hasIssues = true;
    console.log('  ⚠️  Account requires action!');
  }

  // Check for errors
  if (accountData.error) {
    hasIssues = true;
    console.log(`  ⚠️  Error: ${accountData.error}`);
  }

  // Check if suspended or disabled
  if (accountData.is_suspended) {
    hasIssues = true;
    console.log('  ⚠️  Account is suspended!');
  }
  if (accountData.is_disabled) {
    hasIssues = true;
    console.log('  ⚠️  Account is disabled!');
  }

  if (!hasIssues) {
    console.log('  ✓ No critical issues detected');
  }

  console.log('\n📅 Activity Information:');
  if (accountData.last_sync) {
    console.log(`  Last Sync: ${accountData.last_sync}`);
  }
  if (accountData.created_at) {
    console.log(`  Created: ${accountData.created_at}`);
  }
  if (accountData.updated_at) {
    console.log(`  Updated: ${accountData.updated_at}`);
  }

  // Show any other important fields
  const importantFields = ['is_active', 'can_send_message', 'rate_limit', 'daily_limit'];
  console.log('\n🔧 Additional Settings:');
  for (const field of importantFields) {
    if (accountData[field] !== undefined) {
      console.log(`  ${field}: ${accountData[field]}`);
    }
  }

  // Full data dump for debugging
  console.log('\n' + '=' .repeat(80));
  console.log('FULL ACCOUNT DATA (for debugging):');
  console.log('=' .repeat(80));
  console.log(JSON.stringify(accountData, null, 2));

  // Recommendations
  console.log('\n' + '=' .repeat(80));
  console.log('📋 RECOMMENDATIONS:');
  console.log('=' .repeat(80));

  if (accountData.checkpoint) {
    console.log('\n⚠️  CHECKPOINT NEEDS TO BE RESOLVED!');

    if (accountData.checkpoint.can_be_solved_by_api) {
      console.log('\n✓ This checkpoint can be solved via API.');
      console.log('Use the Unipile checkpoint solving endpoint:');
      console.log(`POST https://${unipileDsn}/api/v1/accounts/${accountId}/checkpoint/solve`);
      console.log('\nRefer to: https://developer.unipile.com/reference/accountscontroller_solvecheckpoint');
    } else {
      console.log('\n✗ This checkpoint requires manual intervention.');
      console.log('Irish needs to log into LinkedIn directly and resolve the checkpoint.');
      if (accountData.checkpoint.url) {
        console.log(`Checkpoint URL: ${accountData.checkpoint.url}`);
      }
    }
  } else if (status !== 'CONNECTED') {
    console.log('\n⚠️  Account is not in CONNECTED status.');
    console.log('Irish may need to reconnect her LinkedIn account.');
  } else {
    console.log('\n✓ Account appears to be working correctly!');
  }
}

checkIrishAccount();