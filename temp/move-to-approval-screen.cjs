require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function moveToApprovalScreen() {
  const campaignId = '0a56408b-be39-4144-870f-2b0dce45b620';
  const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

  console.log('🔄 MOVING PROSPECTS TO APPROVAL SCREEN\n');
  console.log('=' .repeat(70));

  // Get the 25 campaign prospects
  const { data: campaignProspects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .eq('campaign_id', campaignId);

  console.log(`\n📋 Found ${campaignProspects?.length || 0} prospects in campaign`);

  if (!campaignProspects || campaignProspects.length === 0) {
    console.log('❌ No prospects to move\n');
    return;
  }

  // Create a prospect_approval_data entry
  const approvalData = {
    workspace_id: workspaceId,
    search_criteria: {
      title: 'CISO',
      industry: 'cybersecurity',
      market: 'mid-market',
      exclude: ['sales', 'marketing'],
      description: '20251021-BLL-Mid-Market CISOs - Cybersecurity Focus'
    },
    status: 'completed',
    created_at: new Date().toISOString()
  };

  console.log('\n📝 Creating approval search entry...');

  const { data: approvalEntry, error: approvalError } = await supabase
    .from('prospect_approval_data')
    .insert(approvalData)
    .select()
    .single();

  if (approvalError) {
    console.log('❌ Error creating approval entry:', approvalError.message);
    return;
  }

  console.log(`✅ Created approval search: ${approvalEntry.id}`);

  // Now add each prospect to workspace_prospects with link to approval data
  console.log('\n📥 Adding prospects to approval queue...\n');

  let added = 0;
  let skipped = 0;

  for (const cp of campaignProspects) {
    // Check if prospect already exists in workspace_prospects
    const { data: existing } = await supabase
      .from('workspace_prospects')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('first_name', cp.first_name)
      .eq('last_name', cp.last_name)
      .eq('company', cp.company)
      .single();

    if (existing) {
      // Update existing prospect with approval_data_id
      await supabase
        .from('workspace_prospects')
        .update({
          approval_data_id: approvalEntry.id,
          approval_status: 'pending'
        })
        .eq('id', existing.id);

      console.log(`  ✅ Updated: ${cp.first_name} ${cp.last_name}`);
      added++;
    } else {
      // Create new workspace_prospect
      const newProspect = {
        workspace_id: workspaceId,
        approval_data_id: approvalEntry.id,
        first_name: cp.first_name,
        last_name: cp.last_name,
        email: cp.email,
        company: cp.company,
        title: cp.title,
        industry: cp.industry,
        linkedin_url: cp.linkedin_url,
        phone: cp.phone,
        location: cp.location,
        approval_status: 'pending',
        contact: cp.personalization_data || {}
      };

      const { error: insertError } = await supabase
        .from('workspace_prospects')
        .insert(newProspect);

      if (insertError) {
        console.log(`  ❌ Error adding ${cp.first_name} ${cp.last_name}:`, insertError.message);
        skipped++;
      } else {
        console.log(`  ✅ Added: ${cp.first_name} ${cp.last_name}`);
        added++;
      }
    }
  }

  console.log('\n' + '=' .repeat(70));
  console.log(`\n✅ COMPLETE!`);
  console.log(`   Added/Updated: ${added} prospects`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`\n📋 Approval Search ID: ${approvalEntry.id}`);
  console.log(`\n💡 Prospects are now in the approval screen!`);
  console.log(`   Go to: Prospect Approval → Review pending prospects\n`);
}

moveToApprovalScreen().catch(console.error);
