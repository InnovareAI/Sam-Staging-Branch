#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🚀 ADDING PROSPECTS TO DEMO CAMPAIGN\n');

// Get user
const { data: user } = await supabase
  .from('users')
  .select('*')
  .eq('email', 'tl@innovareai.com')
  .single();

console.log(`User: ${user.email}`);
console.log(`Workspace: ${user.current_workspace_id}\n`);

// Get all pending prospects from the latest search
const { data: prospects } = await supabase
  .from('prospect_approval_data')
  .select('*')
  .eq('workspace_id', user.current_workspace_id)
  .eq('approval_status', 'pending')
  .order('created_at', { ascending: false })
  .limit(8);

if (!prospects || prospects.length === 0) {
  console.log('❌ No pending prospects found');
  process.exit(0);
}

console.log(`📊 Found ${prospects.length} pending prospects:\n`);
prospects.forEach((p, i) => {
  console.log(`${i + 1}. ${p.name} - ${p.title} at ${p.company?.name || 'N/A'}`);
});

// Step 1: Approve all prospects
console.log('\n✅ STEP 1: Approving prospects...');
const prospectIds = prospects.map(p => p.prospect_id);

const { error: approveError } = await supabase
  .from('prospect_approval_data')
  .update({ approval_status: 'approved' })
  .in('prospect_id', prospectIds);

if (approveError) {
  console.error('❌ Error approving:', approveError);
  process.exit(1);
}

console.log('✅ All prospects approved!\n');

// Step 2: Get or create campaign
console.log('🎯 STEP 2: Setting up campaign...');

const campaignName = 'Demo Campaign - Live Test';

let { data: campaign } = await supabase
  .from('campaigns')
  .select('*')
  .eq('workspace_id', user.current_workspace_id)
  .eq('name', campaignName)
  .single();

if (!campaign) {
  console.log('Creating new campaign...');
  
  const { data: newCampaign, error: createError } = await supabase
    .from('campaigns')
    .insert({
      workspace_id: user.current_workspace_id,
      name: campaignName,
      description: 'Live demo campaign to test execution',
      status: 'active',
      connection_message: 'Hi {first_name}, I noticed your work at {company_name} and would love to connect to discuss {title} opportunities.',
      alternative_message: null,
      message_templates: {
        connection_request: 'Hi {first_name}, impressed by your work at {company_name}. Would love to connect!'
      },
      channel: 'linkedin'
    })
    .select()
    .single();

  if (createError) {
    console.error('❌ Error creating campaign:', createError);
    process.exit(1);
  }

  campaign = newCampaign;
  console.log('✅ Campaign created!');
} else {
  console.log('✅ Using existing campaign');
}

console.log(`Campaign: ${campaign.name} (${campaign.id})\n`);

// Step 3: Add prospects to campaign
console.log('📥 STEP 3: Adding prospects to campaign...');

const campaignProspects = prospects.map(p => {
  const nameParts = (p.name || '').split(' ');
  return {
    campaign_id: campaign.id,
    workspace_id: user.current_workspace_id,
    prospect_id: p.prospect_id,
    first_name: nameParts[0] || '',
    last_name: nameParts.slice(1).join(' ') || '',
    email: p.contact?.email || null,
    company_name: p.company?.name || '',
    linkedin_url: p.contact?.linkedin_url || p.linkedin_url || null,
    title: p.title || '',
    location: p.location || null,
    industry: p.company?.industry?.[0] || 'Not specified',
    status: 'approved',
    personalization_data: {
      source: 'demo_campaign',
      campaign_tag: 'demo',
      connection_degree: p.connection_degree
    }
  };
});

// Delete existing prospects for this campaign first
await supabase
  .from('campaign_prospects')
  .delete()
  .eq('campaign_id', campaign.id);

const { data: inserted, error: insertError } = await supabase
  .from('campaign_prospects')
  .insert(campaignProspects)
  .select();

if (insertError) {
  console.error('❌ Error adding to campaign:', insertError);
  process.exit(1);
}

console.log(`✅ Added ${inserted.length} prospects to campaign!\n`);

// Show summary
console.log('📊 CAMPAIGN SUMMARY:\n');
console.log(`Campaign: ${campaign.name}`);
console.log(`Status: ${campaign.status}`);
console.log(`Prospects: ${inserted.length}`);
console.log(`\nProspects in campaign:`);

inserted.forEach((p, i) => {
  console.log(`${i + 1}. ${p.first_name} ${p.last_name}`);
  console.log(`   LinkedIn: ${p.linkedin_url}`);
  console.log(`   Status: ${p.status}`);
});

console.log('\n🎉 READY TO EXECUTE!');
console.log('\nNext steps:');
console.log('1. Go to Campaign Hub in SAM');
console.log(`2. Find campaign: "${campaign.name}"`);
console.log('3. Click "Start Campaign" to execute');
console.log('\n⚠️  NOTE: Will use cached provider_id if available, saving Sales Nav quota');
