require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addToApprovalQueue() {
  const campaignId = '0a56408b-be39-4144-870f-2b0dce45b620';
  const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

  // Create a single session ID for all these prospects
  const sessionId = crypto.randomUUID();

  console.log('📥 ADDING PROSPECTS TO APPROVAL SCREEN\n');
  console.log('=' .repeat(70));
  console.log(`\nSession ID: ${sessionId}\n`);

  // Get the 25 campaign prospects
  const { data: campaignProspects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', campaignId);

  console.log(`📋 Found ${campaignProspects?.length || 0} prospects in campaign\n`);

  if (!campaignProspects || campaignProspects.length === 0) {
    console.log('❌ No prospects to add\n');
    return;
  }

  let added = 0;
  let skipped = 0;

  for (const cp of campaignProspects) {
    // Check if prospect already exists in approval queue
    const { data: existing } = await supabase
      .from('prospect_approval_data')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('name', `${cp.first_name} ${cp.last_name}`)
      .eq('company', cp.company)
      .single();

    if (existing) {
      console.log(`  ⏭️  Skipped (already exists): ${cp.first_name} ${cp.last_name}`);
      skipped++;
      continue;
    }

    // Add to approval queue
    const approvalData = {
      workspace_id: workspaceId,
      session_id: sessionId,
      prospect_id: cp.id,
      name: `${cp.first_name} ${cp.last_name}`,
      title: cp.title,
      company: cp.company,
      location: cp.location,
      contact: {
        email: cp.email,
        phone: cp.phone,
        linkedin_url: cp.linkedin_url,
        first_name: cp.first_name,
        last_name: cp.last_name,
        ...cp.personalization_data
      },
      approval_status: 'pending',
      source: 'campaign_import',
      created_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('prospect_approval_data')
      .insert(approvalData);

    if (error) {
      console.log(`  ❌ Error adding ${cp.first_name} ${cp.last_name}:`, error.message);
      skipped++;
    } else {
      console.log(`  ✅ Added: ${cp.first_name} ${cp.last_name}`);
      added++;
    }
  }

  console.log('\n' + '=' .repeat(70));
  console.log(`\n✅ COMPLETE!`);
  console.log(`   Added: ${added} prospects`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`\n📋 Session ID: ${sessionId}`);
  console.log(`\n💡 Prospects are now in the approval screen!`);
  console.log(`   Go to: Prospect Approval → Review pending prospects\n`);
}

addToApprovalQueue().catch(console.error);
