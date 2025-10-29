#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔄 Adding approved prospects to campaign\n');

// Get latest campaign (test 3)
const { data: campaign } = await supabase
  .from('campaigns')
  .select('id, name, workspace_id')
  .eq('name', '20251029-IAI-test 3')
  .single();

console.log(`📊 Campaign: ${campaign.name}`);
console.log(`   ID: ${campaign.id.substring(0, 8)}...\n`);

// Get latest approval session (test 4)
const { data: session } = await supabase
  .from('prospect_approval_sessions')
  .select('id, campaign_name')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

console.log(`📋 Latest session: ${session.campaign_name}`);
console.log(`   ID: ${session.id.substring(0, 8)}...\n`);

// Get approved prospects
const { data: approvedProspects } = await supabase
  .from('prospect_approval_data')
  .select('*')
  .eq('session_id', session.id)
  .limit(10);

console.log(`✅ Found ${approvedProspects?.length || 0} approved prospects\n`);

if (!approvedProspects || approvedProspects.length === 0) {
  console.log('❌ No approved prospects to add');
  process.exit(0);
}

// Prepare for insertion
const campaignProspects = approvedProspects.map(p => ({
  campaign_id: campaign.id,
  workspace_id: campaign.workspace_id,
  first_name: p.name?.split(' ')[0] || '',
  last_name: p.name?.split(' ').slice(1).join(' ') || '',
  company_name: p.company?.name || '',
  title: p.title || '',
  linkedin_url: p.contact?.linkedin_url || null,
  email: p.contact?.email || null,
  location: p.location || '',
  industry: p.company?.industry || null,
  status: 'pending',
  personalization_data: {
    source: 'prospect_approval',
    session_id: session.id,
    campaign_name: campaign.name,  // IMPORTANT: Include campaign name!
    approved_at: new Date().toISOString()
  }
}));

console.log('💾 Inserting prospects into campaign...\n');

const { data: inserted, error } = await supabase
  .from('campaign_prospects')
  .insert(campaignProspects)
  .select();

if (error) {
  console.log(`❌ Error: ${error.message}`);
} else {
  console.log(`✅ Successfully added ${inserted?.length || 0} prospects to campaign!`);
  
  inserted?.slice(0, 3).forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.first_name} ${p.last_name} at ${p.company_name}`);
  });
}
