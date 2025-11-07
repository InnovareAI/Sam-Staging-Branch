require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function uploadToApprovalSystem() {
  const campaignId = '0a56408b-be39-4144-870f-2b0dce45b620';
  const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

  console.log('📤 UPLOADING 25 PROSPECTS TO APPROVAL SYSTEM\n');
  console.log('=' .repeat(70));

  // Get the 25 prospects
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('last_name');

  if (!prospects || prospects.length === 0) {
    console.log('\n❌ No prospects found\n');
    return;
  }

  console.log(`\n✅ Found ${prospects.length} prospects\n`);

  // Get user ID for this workspace
  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .limit(1);

  if (!members || members.length === 0) {
    console.log('❌ No workspace members found\n');
    return;
  }

  const userId = members[0].user_id;
  console.log(`User ID: ${userId}\n`);

  // Create approval session
  console.log('📝 Creating approval session...');
  const { data: session, error: sessionError } = await supabase
    .from('prospect_approval_sessions')
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      campaign_name: 'BLL CISO Campaign - 25 Prospects',
      campaign_tag: 'ciso-mid-market',
      prospect_source: 'linkedin',
      total_prospects: prospects.length,
      pending_count: prospects.length,
      approved_count: 0,
      rejected_count: 0,
      session_status: 'active',
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (sessionError) {
    console.log('❌ Error creating session:', sessionError.message);
    console.log('   Code:', sessionError.code);
    console.log('   Details:', sessionError.details);
    return;
  }

  console.log(`✅ Created session: ${session.id}\n`);

  // Add prospects to approval data
  console.log('📥 Adding prospects to approval queue...\n');

  let added = 0;
  const errors = [];

  for (const p of prospects) {
    const approvalData = {
      session_id: session.id,
      workspace_id: workspaceId,
      prospect_id: p.id,
      name: `${p.first_name} ${p.last_name}`,
      title: p.title || '',
      company: { name: p.company || '' },
      location: p.location || '',
      contact: {
        email: p.email,
        phone: p.phone,
        linkedin_url: p.linkedin_url,
        first_name: p.first_name,
        last_name: p.last_name
      },
      source: 'linkedin',
      enrichment_score: 85,
      approval_status: 'pending',
      created_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('prospect_approval_data')
      .insert(approvalData);

    if (error) {
      console.log(`  ❌ ${p.first_name} ${p.last_name}: ${error.message}`);
      errors.push({ name: `${p.first_name} ${p.last_name}`, error: error.message });
    } else {
      console.log(`  ✅ ${p.first_name} ${p.last_name}`);
      added++;
    }
  }

  console.log('\n' + '=' .repeat(70));
  console.log(`\n✅ COMPLETE!`);
  console.log(`   Added: ${added} prospects`);
  console.log(`   Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.slice(0, 5).forEach(e => {
      console.log(`   - ${e.name}: ${e.error}`);
    });
  }

  console.log(`\n📋 Session ID: ${session.id}`);
  console.log(`\n💡 Go to Prospect Approval to review these prospects!\n`);
}

uploadToApprovalSystem().catch(console.error);
