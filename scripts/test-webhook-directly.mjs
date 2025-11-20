#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('\n🧪 Testing webhook endpoint directly...\n');

// Get John P. Perkins (we know he exists)
const { data: john } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, status')
  .ilike('first_name', 'John%')
  .ilike('last_name', '%Perkins%')
  .single();

console.log(`Testing with: ${john.first_name} ${john.last_name}`);
console.log(`Current status: ${john.status}\n`);

// Call webhook API directly
console.log('📤 Calling webhook API...\n');

const response = await fetch('https://app.meet-sam.com/api/webhooks/n8n/prospect-status', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prospect_id: john.id,
    status: 'connection_requested',
    contacted_at: new Date().toISOString()
  })
});

console.log(`Response: ${response.status}`);

if (response.ok) {
  const result = await response.json();
  console.log('✅ Webhook accepted!');
  console.log(JSON.stringify(result, null, 2));
  console.log();
  
  // Check database
  const { data: updated } = await supabase
    .from('campaign_prospects')
    .select('status, contacted_at')
    .eq('id', john.id)
    .single();
  
  console.log('📊 Updated status:');
  console.log(`   Status: ${updated.status}`);
  console.log(`   Contacted: ${updated.contacted_at}\n`);
  
  if (updated.status === 'connection_requested') {
    console.log('🎉 SUCCESS! Webhook works, database updated!\n');
  }
} else {
  const error = await response.text();
  console.error(`❌ Webhook failed: ${response.status}`);
  console.error(error);
  console.log('\nThe webhook endpoint might still have authentication issues.\n');
}
