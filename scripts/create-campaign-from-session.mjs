// Create campaign directly from approval session
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createCampaign() {
  const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';
  const userId = 'f6885ff3-deef-4781-8721-93011c990b1b';
  const sessionId = '270be91d-ec66-48d1-9efd-df2b540c466b';

  console.log('🚀 Creating campaign from approval session...\n');

  // 1. Get session details
  const { data: session } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  console.log(`📋 Session: ${session.campaign_name}`);

  // 2. Get prospects from session (any status)
  const { data: prospects } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('session_id', sessionId);

  console.log(`✅ Found ${prospects?.length || 0} prospects\n`);

  if (!prospects || prospects.length === 0) {
    console.log('⚠️  No prospects to add to campaign');
    return;
  }

  // 3. First approve the prospects
  console.log('Approving prospects...');
  const { error: approveError } = await supabase
    .from('prospect_approval_data')
    .update({ approval_status: 'approved' })
    .eq('session_id', sessionId);

  if (approveError) {
    console.error('❌ Failed to approve:', approveError);
    return;
  }

  // 4. Create campaign
  const campaignName = session.campaign_name || `Test Campaign ${Date.now()}`;

  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .insert({
      workspace_id: workspaceId,
      name: campaignName,
      status: 'draft',
      created_by: userId
    })
    .select()
    .single();

  if (campaignError) {
    console.error('❌ Failed to create campaign:', campaignError);
    return;
  }

  console.log(`✅ Campaign created: ${campaign.id}`);
  console.log(`   Name: ${campaign.name}`);

  // 5. Add prospects to campaign
  const campaignProspects = prospects.map(p => ({
    campaign_id: campaign.id,
    workspace_id: workspaceId,
    first_name: p.contact?.firstName || p.name?.split(' ')[0] || 'Unknown',
    last_name: p.contact?.lastName || p.name?.split(' ').slice(1).join(' ') || '',
    email: p.contact?.email || '',
    company_name: p.company?.name || '',
    title: p.title || '',
    linkedin_url: p.contact?.linkedin_url || '',
    status: 'approved',
    personalization_data: {
      source: 'approval_session',
      session_id: sessionId,
      original_data: p
    }
  }));

  const { data: insertedProspects, error: prospectsError } = await supabase
    .from('campaign_prospects')
    .insert(campaignProspects)
    .select();

  if (prospectsError) {
    console.error('❌ Failed to add prospects:', prospectsError);
    return;
  }

  console.log(`✅ Added ${insertedProspects.length} prospects to campaign\n`);

  // 6. Show results
  console.log('🎉 Campaign ready!');
  console.log(`\nCampaign Details:`);
  console.log(`  ID: ${campaign.id}`);
  console.log(`  Name: ${campaign.name}`);
  console.log(`  Prospects: ${insertedProspects.length}`);

  console.log(`\nProspects:`);
  insertedProspects.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.first_name} ${p.last_name} - ${p.title} at ${p.company_name}`);
    console.log(`     LinkedIn: ${p.linkedin_url || 'N/A'}`);
  });

  console.log(`\n✅ Campaign created successfully!`);
  console.log(`Now you can test the "Approve & Launch" flow with this campaign.`);
}

createCampaign().catch(console.error);
