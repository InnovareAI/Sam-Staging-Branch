#!/usr/bin/env node
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const N8N_API_URL = process.env.N8N_API_URL || 'https://workflows.innovareai.com/api/v1';
const N8N_API_KEY = process.env.N8N_API_KEY;

if (!N8N_API_KEY) {
  console.error('❌ N8N_API_KEY required');
  process.exit(1);
}

const envVars = {
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  UNIPILE_DSN: 'api6.unipile.com:13670',
  UNIPILE_API_KEY: '39qOAzhn.7ks6QfCYBMSYSEx4op78j57lD5ZItVooPcsN1Fu1EbE=',
  UNIPILE_ACCOUNT_ID: 'ymtTx4xVQ6OVUFk83ctwtA',
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  APP_URL: 'https://app.meet-sam.com'
};

async function setN8NVariable(key, value) {
  console.log(`Setting ${key}...`);

  const response = await fetch(`${N8N_API_URL}/variables`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': N8N_API_KEY
    },
    body: JSON.stringify({
      key,
      value
    })
  });

  if (!response.ok) {
    // Variable might already exist, try updating instead
    const allVars = await fetch(`${N8N_API_URL}/variables`, {
      headers: { 'X-N8N-API-KEY': N8N_API_KEY }
    }).then(r => r.json());

    const existing = allVars.data?.find(v => v.key === key);

    if (existing) {
      console.log(`  Updating existing variable ${key}...`);
      const updateResponse = await fetch(`${N8N_API_URL}/variables/${existing.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-N8N-API-KEY': N8N_API_KEY
        },
        body: JSON.stringify({ value })
      });

      if (!updateResponse.ok) {
        console.error(`  ❌ Failed to update ${key}:`, await updateResponse.text());
      } else {
        console.log(`  ✅ Updated ${key}`);
      }
    } else {
      console.error(`  ❌ Failed to create ${key}:`, await response.text());
    }
  } else {
    console.log(`  ✅ Created ${key}`);
  }
}

(async () => {
  console.log('🔧 Setting up N8N environment variables...\n');

  for (const [key, value] of Object.entries(envVars)) {
    if (!value) {
      console.log(`⚠️  Skipping ${key} (not set in .env.local)`);
      continue;
    }
    await setN8NVariable(key, value);
  }

  console.log('\n✅ N8N environment variables configured!\n');
  console.log('You can now activate the workflow in N8N.');
})();
