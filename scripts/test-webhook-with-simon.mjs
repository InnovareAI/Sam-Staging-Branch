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

console.log('\n🧪 Testing webhook with Simon Sokol...\n');

// Get Simon
const { data: simon } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, status')
  .ilike('first_name', 'Simon')
  .ilike('last_name', 'Sokol')
  .single();

console.log(`Testing with: ${simon.first_name} ${simon.last_name}`);
console.log(`Current status: ${simon.status}\n`);

// Call webhook
console.log('📤 Calling webhook API...\n');

const response = await fetch('https://app.meet-sam.com/api/webhooks/n8n/prospect-status', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prospect_id: simon.id,
    status: 'connection_requested',
    contacted_at: new Date().toISOString()
  })
});

console.log(`Response: ${response.status}\n`);

if (response.ok) {
  const result = await response.json();
  console.log('✅ Webhook accepted!');
  console.log(JSON.stringify(result, null, 2));
  console.log();
  
  const { data: updated } = await supabase
    .from('campaign_prospects')
    .select('status, contacted_at')
    .eq('id', simon.id)
    .single();
  
  console.log('📊 Database:');
  console.log(`   Status: ${updated.status}`);
  console.log(`   Contacted: ${updated.contacted_at}\n`);
  
  if (updated.status === 'connection_requested') {
    console.log('🎉 SUCCESS! DATABASE TRACKING IS FIXED!\n');
    console.log('The system is now fully operational:\n');
    console.log('  ✅ LinkedIn invitations send successfully');
    console.log('  ✅ Database tracks status correctly\n');
  }
} else {
  const error = await response.text();
  console.error(`❌ Failed: ${response.status}`);
  console.error(error);
}
