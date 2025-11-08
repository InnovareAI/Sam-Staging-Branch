const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function recreate() {
  const wsId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';
  const oldSessionId = '0ac9d110-4da6-4f2d-83e2-1b696b8e5829';
  const stanUserId = '6a927440-ebe1-49b4-ae5e-fbee5d27944d';

  console.log('Step 1: Finding next batch number for Stan...\n');

  const { data: existingSessions } = await supabase
    .from('prospect_approval_sessions')
    .select('batch_number')
    .eq('workspace_id', wsId)
    .eq('user_id', stanUserId)
    .order('batch_number', { ascending: false })
    .limit(1);

  const nextBatch = existingSessions && existingSessions.length > 0
    ? existingSessions[0].batch_number + 1
    : 1;

  console.log(`Next batch number: ${nextBatch}\n`);

  console.log('Step 2: Getting prospects from old session...\n');

  const { data: prospects } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('session_id', oldSessionId);

  console.log(`Found ${prospects?.length || 0} prospects\n`);

  console.log('Step 3: Creating new session for Stan...\n');

  const newSessionId = uuidv4();
  const campaignName = '20251106-BLL-CISO Outreach - Mid Market';

  const { error: sessionError } = await supabase
    .from('prospect_approval_sessions')
    .insert({
      id: newSessionId,
      workspace_id: wsId,
      user_id: stanUserId,
      campaign_name: campaignName,
      campaign_tag: 'CISO Outreach',
      status: 'active',
      batch_number: nextBatch,
      total_prospects: prospects?.length || 0,
      approved_count: 0,
      rejected_count: 0,
      pending_count: prospects?.length || 0,
      icp_criteria: {},
      prospect_source: 'linkedin_search',
      learning_insights: {},
      created_at: new Date().toISOString()
    });

  if (sessionError) {
    console.log(`❌ Error creating session: ${sessionError.message}`);
    return;
  }

  console.log(`✅ New session created: ${newSessionId}\n`);

  console.log('Step 4: Copying prospects to new session...\n');

  let copied = 0;
  for (const prospect of prospects || []) {
    const { error } = await supabase
      .from('prospect_approval_data')
      .insert({
        id: uuidv4(),
        session_id: newSessionId,
        prospect_id: prospect.prospect_id,
        workspace_id: wsId,
        name: prospect.name,
        title: prospect.title,
        location: prospect.location,
        company: prospect.company,
        contact: prospect.contact,
        connection_degree: prospect.connection_degree,
        enrichment_score: prospect.enrichment_score,
        source: prospect.source,
        approval_status: 'pending',
        created_at: new Date().toISOString(),
        enriched_at: new Date().toISOString()
      });

    if (!error) copied++;
  }

  console.log(`✅ Copied ${copied}/${prospects?.length || 0} prospects\n`);

  console.log('Step 5: Deleting old session...\n');

  // Delete old prospects
  await supabase
    .from('prospect_approval_data')
    .delete()
    .eq('session_id', oldSessionId);

  // Delete old session
  await supabase
    .from('prospect_approval_sessions')
    .delete()
    .eq('id', oldSessionId);

  console.log('✅ Old session deleted\n');

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('                              SUCCESS                                   ');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`✅ Session recreated for Stan`);
  console.log(`   Email: stan01@signali.ai`);
  console.log(`   Session ID: ${newSessionId}`);
  console.log(`   Batch: ${nextBatch}`);
  console.log(`   Campaign: ${campaignName}`);
  console.log(`   Prospects: ${copied}`);
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('\n👉 Stan should now see this session in the approval screen!\n');
}

recreate().catch(console.error);
