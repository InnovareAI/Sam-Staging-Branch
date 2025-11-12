#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

console.log('🔍 Charissa\'s Campaigns (IA4 Workspace)\n');

const WORKSPACE_ID = '7f0341da-88db-476b-ae0a-fc0da5b70861'; // IA4

// Get campaigns
const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name, status, campaign_type, created_at')
  .eq('workspace_id', WORKSPACE_ID)
  .order('created_at', { ascending: false });

console.log(`Campaigns (${campaigns.length} total):\n`);

if (campaigns.length === 0) {
  console.log('❌ No campaigns found\n');
  process.exit(0);
}

campaigns.forEach((c, i) => {
  console.log(`${i + 1}. ${c.name}`);
  console.log(`   ID: ${c.id}`);
  console.log(`   Type: ${c.campaign_type}`);
  console.log(`   Status: ${c.status}`);
  console.log(`   Created: ${new Date(c.created_at).toLocaleDateString()}`);
  console.log('');
});

// Get prospect status summary for each campaign
for (const campaign of campaigns) {
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('status')
    .eq('campaign_id', campaign.id);
  
  const statusCounts = {};
  prospects.forEach(p => {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
  });
  
  console.log(`${campaign.name}:`);
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });
  console.log('');
}

// Verify Unipile account
console.log('Verifying Unipile account...\n');

const charissaUnipileId = '4nt1J-blSnGUPBjH2Nfjpg';

const response = await fetch(`https://${process.env.UNIPILE_DSN}/api/v1/accounts/${charissaUnipileId}`, {
  headers: { 'X-API-KEY': process.env.UNIPILE_API_KEY }
});

if (response.ok) {
  const account = await response.json();
  console.log('✅ Charissa\'s Unipile account is ACTIVE');
  console.log(`   Name: ${account.name}`);
  console.log(`   ID: ${account.id}`);
} else {
  console.log('❌ Charissa\'s Unipile account NOT FOUND');
  console.log('   She needs to reconnect LinkedIn!\n');
}
