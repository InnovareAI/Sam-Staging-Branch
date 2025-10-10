import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function backfill() {
  const userId = 'f6885ff3-deef-4781-8721-93011c990b1b';
  const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

  console.log('\n🔄 BACKFILLING APPROVAL SESSION FOR EXISTING PROSPECTS\n');

  // 1. Get all existing prospects from workspace_prospects
  console.log('1️⃣ Fetching existing prospects from workspace_prospects...');
  const { data: existingProspects, error: fetchError } = await supabase
    .from('workspace_prospects')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (fetchError) {
    console.error('❌ Failed to fetch prospects:', fetchError);
    return;
  }

  console.log(`✅ Found ${existingProspects?.length || 0} existing prospects\n`);

  if (!existingProspects || existingProspects.length === 0) {
    console.log('⚠️  No prospects to backfill');
    return;
  }

  // Show what we found
  console.log('📋 Prospects to add to approval:');
  existingProspects.forEach((p, i) => {
    console.log(`   ${i+1}. ${p.first_name} ${p.last_name} - ${p.job_title} at ${p.company_name}`);
  });

  // 2. Create approval session
  console.log('\n2️⃣ Creating approval session...');

  // Get next batch number (unique constraint on user_id, workspace_id, batch_number)
  const { data: existingSessions } = await supabase
    .from('prospect_approval_sessions')
    .select('batch_number')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .order('batch_number', { ascending: false })
    .limit(1);

  const nextBatchNumber = existingSessions && existingSessions.length > 0
    ? existingSessions[0].batch_number + 1
    : 1;

  console.log(`Next batch number: ${nextBatchNumber}`);

  const sessionId = crypto.randomUUID(); // Use proper UUID

  const sessionData = {
    id: sessionId,
    batch_number: nextBatchNumber, // REQUIRED: UNIQUE(user_id, workspace_id, batch_number)
    user_id: userId,
    workspace_id: workspaceId,
    prospect_source: 'linkedin_search_backfill',
    total_prospects: existingProspects.length,
    pending_count: existingProspects.length,
    approved_count: 0,
    rejected_count: 0,
    status: 'active', // CORRECT: Valid values are 'active' or 'completed'
    icp_criteria: {}, // Default empty object
    learning_insights: {}, // Default empty object
    created_at: new Date().toISOString()
  };

  console.log('Session data:', JSON.stringify(sessionData, null, 2));

  const { data: session, error: sessionError } = await supabase
    .from('prospect_approval_sessions')
    .insert(sessionData)
    .select();

  if (sessionError) {
    console.error('\n❌ SESSION CREATION FAILED:', sessionError);
    console.error('Error details:', JSON.stringify(sessionError, null, 2));
    return;
  }

  console.log('✅ Session created:', sessionId);

  // 3. Add prospects to approval data
  console.log('\n3️⃣ Adding prospects to approval data...');

  const approvalProspects = existingProspects.map((p) => ({
    session_id: sessionId,
    prospect_id: p.id || `prospect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: `${p.first_name} ${p.last_name}`,
    title: p.job_title || '',
    company: {  // CORRECTED: company is JSONB object
      name: p.company_name || '',
      size: '',
      website: '',
      industry: p.industry || ''
    },
    contact: {  // CORRECTED: contact is JSONB object
      email: p.email_address || '',
      linkedin_url: p.linkedin_profile_url || ''
    },
    location: p.location || '',
    profile_image: '',
    recent_activity: '',
    connection_degree: 2,  // CORRECTED: number not string
    enrichment_score: 85,  // CORRECTED: number not decimal
    source: 'linkedin_sales_navigator',
    enriched_at: p.created_at || new Date().toISOString(),
    created_at: new Date().toISOString()
    // NO approval_status column!
  }));

  console.log('First approval prospect:', JSON.stringify(approvalProspects[0], null, 2));

  const { data: inserted, error: insertError } = await supabase
    .from('prospect_approval_data')
    .insert(approvalProspects)
    .select();

  if (insertError) {
    console.error('\n❌ INSERT FAILED:', insertError);
    console.error('Error details:', JSON.stringify(insertError, null, 2));
    return;
  }

  console.log(`✅ Added ${inserted?.length || 0} prospects to approval data\n`);

  // 4. Verify
  console.log('4️⃣ Verifying data in approval tables...');

  const { data: verifySession } = await supabase
    .from('prospect_approval_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  const { data: verifyProspects } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('session_id', sessionId);

  console.log('\n✅ VERIFICATION:');
  console.log(`   Session: ${verifySession?.id?.slice(0, 20)}...`);
  console.log(`   Status: ${verifySession?.status}`);
  console.log(`   Total prospects: ${verifySession?.total_prospects}`);
  console.log(`   Pending count: ${verifySession?.pending_count}`);
  console.log(`   Prospects in approval_data: ${verifyProspects?.length || 0}`);

  console.log('\n🎉 BACKFILL COMPLETE!');
  console.log('\n📋 Next steps:');
  console.log('   1. Refresh the Data Approval tab');
  console.log('   2. You should see all prospects with "pending" status');
  console.log(`   3. Total to review: ${existingProspects.length}\n`);
}

backfill();
