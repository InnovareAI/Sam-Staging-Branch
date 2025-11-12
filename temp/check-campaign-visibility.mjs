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

console.log('🔍 Checking Campaign Visibility Issue\n');

const CAMPAIGN_ID = '0a56408b-be39-4144-870f-2b0dce45b620';
const WORKSPACE_ID = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

// Get full campaign details
const { data: campaign } = await supabase
  .from('campaigns')
  .select('*')
  .eq('id', CAMPAIGN_ID)
  .single();

console.log('Campaign Details:\n');
console.log('  Name:', campaign.name);
console.log('  ID:', campaign.id);
console.log('  Status:', campaign.status);
console.log('  Campaign Type:', campaign.campaign_type);
console.log('  Created:', new Date(campaign.created_at).toLocaleString());
console.log('  Updated:', new Date(campaign.updated_at).toLocaleString());
console.log('  Workspace ID:', campaign.workspace_id);
console.log('  Created By:', campaign.created_by);
console.log('  Is Active:', campaign.is_active);
console.log('  Is Deleted:', campaign.is_deleted || false);
console.log('  Is Archived:', campaign.is_archived || false);
console.log('');

// Check if there's a deleted_at or archived_at field
if (campaign.deleted_at) {
  console.log(`⚠️  Campaign was deleted at: ${campaign.deleted_at}\n`);
}

if (campaign.archived_at) {
  console.log(`⚠️  Campaign was archived at: ${campaign.archived_at}\n`);
}

// Check all campaigns for this workspace
const { data: allCampaigns } = await supabase
  .from('campaigns')
  .select('id, name, status, campaign_type, created_at, is_deleted, is_archived')
  .eq('workspace_id', WORKSPACE_ID)
  .order('created_at', { ascending: false });

console.log(`All Campaigns in Blue Label Labs (${allCampaigns.length} total):\n`);

allCampaigns.forEach((c, i) => {
  const flags = [];
  if (c.is_deleted) flags.push('DELETED');
  if (c.is_archived) flags.push('ARCHIVED');
  if (c.status === 'inactive') flags.push('INACTIVE');
  
  const flagStr = flags.length > 0 ? ` [${flags.join(', ')}]` : '';
  
  console.log(`${i + 1}. ${c.name}${flagStr}`);
  console.log(`   ID: ${c.id}`);
  console.log(`   Status: ${c.status}`);
  console.log(`   Type: ${c.campaign_type}`);
  console.log(`   Created: ${new Date(c.created_at).toLocaleDateString()}`);
  console.log('');
});

console.log('='.repeat(60));
console.log('DIAGNOSIS:');
console.log('='.repeat(60));
console.log('');

if (campaign.is_deleted) {
  console.log('❌ Campaign is marked as DELETED - not visible in UI');
} else if (campaign.is_archived) {
  console.log('📦 Campaign is ARCHIVED - may be hidden by default in UI');
} else if (campaign.status === 'inactive') {
  console.log('⚠️  Campaign status is INACTIVE');
  console.log('   This may be filtered out in the UI by default');
} else {
  console.log('✅ Campaign should be visible');
  console.log('   Check UI filters (status, date range, etc.)');
}

console.log('');
console.log('To make campaign visible:');
console.log('1. Update status from "inactive" to "active"');
console.log('2. Or check UI filter settings to show inactive campaigns\n');
