#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Checking latest campaign details\n');

const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name, status, created_at, workspace_id')
  .order('created_at', { ascending: false })
  .limit(1);

if (!campaigns || campaigns.length === 0) {
  console.log('No campaigns found');
  process.exit(0);
}

const campaign = campaigns[0];
console.log(`📊 Campaign: ${campaign.name}`);
console.log(`   ID: ${campaign.id}`);
console.log(`   Status: ${campaign.status}`);
console.log(`   Workspace: ${campaign.workspace_id}`);
console.log(`   Created: ${campaign.created_at}\n`);

// Check for prospects
const { data: prospects, count } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, status', { count: 'exact' })
  .eq('campaign_id', campaign.id);

console.log(`📈 Total prospects: ${count || 0}\n`);

if (prospects && prospects.length > 0) {
  console.log('Sample prospects:');
  prospects.slice(0, 5).forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.first_name} ${p.last_name} [${p.status}]`);
  });
} else {
  console.log('⚠️  NO PROSPECTS IN CAMPAIGN');
  console.log('\n💡 To upload prospects:');
  console.log('   1. Go to campaign page in UI');
  console.log('   2. Click "Add Prospects"');
  console.log('   3. Upload CSV or select from approved prospects');
}

// Check for approved prospects available to add
const { count: approvedCount } = await supabase
  .from('prospect_approval_data')
  .select('id', { count: 'exact', head: true })
  .eq('workspace_id', campaign.workspace_id);

console.log(`\n📋 Approved prospects available: ${approvedCount || 0}`);
