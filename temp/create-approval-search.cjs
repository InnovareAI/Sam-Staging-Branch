require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createApprovalSearch() {
  const campaignId = '0a56408b-be39-4144-870f-2b0dce45b620';
  const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

  console.log('🔍 CREATING APPROVAL SEARCH FOR 25 PROSPECTS\n');
  console.log('=' .repeat(70));

  // Step 1: Get the 25 campaign prospects
  const { data: campaignProspects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('last_name');

  console.log(`\n📋 Found ${campaignProspects?.length || 0} prospects in campaign\n`);

  if (!campaignProspects || campaignProspects.length === 0) {
    console.log('❌ No prospects found\n');
    return;
  }

  // Step 2: Get user for this workspace to create session
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
  console.log(`✅ Using user ID: ${userId}\n`);

  // Step 3: Create SAM session
  const { data: session, error: sessionError } = await supabase
    .from('sam_sessions')
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      title: 'BLL CISO Campaign - 25 Prospects',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (sessionError) {
    console.log('❌ Error creating session:', sessionError.message);
    console.log('   Details:', sessionError.details);
    console.log('   Hint:', sessionError.hint);
    return;
  }

  console.log(`✅ Created session: ${session.id}\n`);

  // Step 4: Add each prospect to approval queue
  console.log('📥 Adding prospects to approval queue...\n');

  let added = 0;
  const errors = [];

  for (const cp of campaignProspects) {
    const approvalData = {
      workspace_id: workspaceId,
      session_id: session.id,
      prospect_id: cp.id,
      name: `${cp.first_name} ${cp.last_name}`,
      title: cp.title || '',
      company: cp.company || '',
      location: cp.location || '',
      contact: {
        email: cp.email,
        phone: cp.phone,
        linkedin_url: cp.linkedin_url,
        first_name: cp.first_name,
        last_name: cp.last_name,
        company: cp.company,
        title: cp.title,
        ...cp.personalization_data
      },
      approval_status: 'pending',
      source: 'linkedin',
      created_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('prospect_approval_data')
      .insert(approvalData);

    if (error) {
      console.log(`  ❌ ${cp.first_name} ${cp.last_name}: ${error.message}`);
      errors.push({ name: `${cp.first_name} ${cp.last_name}`, error: error.message });
    } else {
      console.log(`  ✅ ${cp.first_name} ${cp.last_name}`);
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
    if (errors.length > 5) {
      console.log(`   ... and ${errors.length - 5} more`);
    }
  }

  console.log(`\n📋 Session ID: ${session.id}`);
  console.log(`\n💡 Go to Prospect Approval to review these 25 prospects!\n`);
}

createApprovalSearch().catch(console.error);
