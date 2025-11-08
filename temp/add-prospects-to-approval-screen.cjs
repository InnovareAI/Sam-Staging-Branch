const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addToApprovalScreen() {
  const wsId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('        ADDING 25 PROSPECTS TO APPROVAL SCREEN                         ');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // Get the campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name')
    .eq('workspace_id', wsId)
    .eq('name', '20251106-BLL-CISO Outreach - Mid Market')
    .single();

  if (!campaign) {
    console.log('❌ Campaign not found');
    return;
  }

  console.log(`Campaign: ${campaign.name}`);
  console.log(`Campaign ID: ${campaign.id}\n`);

  // Get all prospects from campaign
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', campaign.id)
    .eq('status', 'approved');

  console.log(`Found ${prospects.length} approved prospects\n`);

  // Create a new approval session
  const sessionId = uuidv4();
  const campaignName = '20251106-BLL-CISO Outreach - Mid Market';

  // Get user ID from workspace
  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', wsId)
    .limit(1)
    .single();

  const userId = members?.user_id || '6a927440-ebe1-49b4-ae5e-fbee5d27944d';  // fallback

  // Find next available batch number
  const { data: existingSessions } = await supabase
    .from('prospect_approval_sessions')
    .select('batch_number')
    .eq('workspace_id', wsId)
    .eq('user_id', userId)
    .order('batch_number', { ascending: false })
    .limit(1);

  const nextBatchNumber = existingSessions && existingSessions.length > 0
    ? existingSessions[0].batch_number + 1
    : 1;

  console.log(`Creating approval session: ${campaignName}`);
  console.log(`Session ID: ${sessionId}`);
  console.log(`Batch Number: ${nextBatchNumber}\n`);

  const { error: sessionError } = await supabase
    .from('prospect_approval_sessions')
    .insert({
      id: sessionId,
      workspace_id: wsId,
      user_id: userId,
      campaign_name: campaignName,
      campaign_tag: 'CISO Outreach',
      status: 'active',
      batch_number: nextBatchNumber,
      total_prospects: prospects.length,
      approved_count: 0,
      rejected_count: 0,
      pending_count: prospects.length,
      icp_criteria: {},
      prospect_source: 'linkedin_search',
      learning_insights: {},
      created_at: new Date().toISOString()
    });

  if (sessionError) {
    console.log(`❌ Error creating session: ${sessionError.message}`);
    return;
  }

  console.log(`✅ Session created\n`);

  // Add each prospect to prospect_approval_data
  console.log(`Adding ${prospects.length} prospects to approval data...\n`);

  let added = 0;
  for (const prospect of prospects) {
    const { error: prospectError } = await supabase
      .from('prospect_approval_data')
      .insert({
        id: uuidv4(),
        session_id: sessionId,
        prospect_id: prospect.id,
        workspace_id: wsId,
        name: `${prospect.first_name} ${prospect.last_name || ''}`.trim(),
        title: prospect.title || 'No title',
        location: prospect.location || '',
        company: {
          name: prospect.personalization_data?.company || 'your organization',
          industry: [prospect.personalization_data?.industry || 'cybersecurity']
        },
        contact: {
          firstName: prospect.first_name,
          lastName: prospect.last_name || '',
          email: prospect.email || '',
          linkedin_url: prospect.linkedin_url
        },
        connection_degree: 0,
        enrichment_score: 85,
        source: 'campaign',
        approval_status: 'pending',
        created_at: new Date().toISOString(),
        enriched_at: new Date().toISOString()
      });

    if (!prospectError) {
      added++;
      console.log(`  ${added}. Added: ${prospect.first_name} ${prospect.last_name || ''}`);
    } else {
      console.log(`  ❌ Error adding ${prospect.first_name}: ${prospectError.message}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('                              COMPLETE                                  ');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`✅ Added ${added}/${prospects.length} prospects to approval screen`);
  console.log(`📋 Campaign: ${campaignName}`);
  console.log(`🔗 Session ID: ${sessionId}`);
  console.log('═══════════════════════════════════════════════════════════════════════\n');
  console.log(`👉 Go to the approval screen in the UI to review these prospects\n`);
}

addToApprovalScreen().catch(console.error);
