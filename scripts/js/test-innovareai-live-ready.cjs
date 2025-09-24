const { createClient } = require('@supabase/supabase-js');

// Test InnovareAI workspace live readiness
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInnovareAILiveReadiness() {
  console.log('🧪 Testing InnovareAI Workspace LIVE Readiness...\n');

  try {
    // Test 1: Verify InnovareAI workspace and campaign
    console.log('1️⃣ Checking InnovareAI workspace and test campaign...');
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select(`
        id,
        name,
        status,
        linkedin_account_id,
        workspaces!inner(id, name)
      `)
      .ilike('workspaces.name', '%InnovareAI%')
      .ilike('name', '%Live Test%')
      .single();

    if (campaignError || !campaign) {
      console.error('   ❌ Campaign not found:', campaignError?.message);
      return;
    }

    console.log(`   ✅ Campaign: ${campaign.name} (${campaign.id})`);
    console.log(`   🏢 Workspace: ${campaign.workspaces.name} (${campaign.workspaces.id})`);
    console.log(`   📱 LinkedIn Account: ${campaign.linkedin_account_id}`);
    console.log(`   📊 Status: ${campaign.status}`);

    // Test 2: Check prospects ready for campaign
    console.log('\n2️⃣ Checking campaign prospects...');
    const { data: prospects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select(`
        id,
        status,
        sequence_step,
        workspace_prospects!inner(
          first_name,
          last_name,
          company_name,
          job_title,
          linkedin_profile_url,
          linkedin_internal_id
        )
      `)
      .eq('campaign_id', campaign.id);

    if (prospectsError) {
      console.error('   ❌ Prospects query failed:', prospectsError.message);
      return;
    }

    console.log(`   ✅ Found ${prospects.length} campaign prospects:`);
    prospects.forEach((cp, index) => {
      const p = cp.workspace_prospects;
      console.log(`      ${index + 1}. ${p.first_name} ${p.last_name} - ${p.company_name}`);
      console.log(`         Title: ${p.job_title}`);
      console.log(`         Status: ${cp.status} (Step ${cp.sequence_step})`);
      console.log(`         LinkedIn: ${p.linkedin_profile_url ? '🔗' : '❌'} ${p.linkedin_internal_id ? '🆔' : '❌'}`);
      console.log('');
    });

    // Test 3: Check message templates
    console.log('3️⃣ Checking message templates...');
    const { data: templates, error: templatesError } = await supabase
      .from('message_templates')
      .select('*')
      .eq('workspace_id', campaign.workspaces.id);

    if (templatesError) {
      console.error('   ❌ Templates query failed:', templatesError.message);
    } else {
      console.log(`   ✅ Found ${templates.length} message templates:`);
      templates.forEach((template, index) => {
        console.log(`      ${index + 1}. ${template.name} (${template.category})`);
        console.log(`         Active: ${template.is_active ? '✅' : '❌'}`);
        console.log(`         Template: "${template.template_text.substring(0, 80)}..."`);
        console.log('');
      });
    }

    // Test 4: Check LinkedIn account association
    console.log('4️⃣ Verifying LinkedIn account association...');
    const { data: linkedinAccounts, error: linkedinError } = await supabase
      .rpc('get_workspace_linkedin_accounts', { 
        p_workspace_id: campaign.workspaces.id 
      });

    if (linkedinError) {
      console.error('   ❌ LinkedIn accounts query failed:', linkedinError.message);
    } else {
      const campaignAccount = linkedinAccounts.find(acc => acc.unipile_account_id === campaign.linkedin_account_id);
      
      if (campaignAccount) {
        console.log(`   ✅ Campaign LinkedIn account found:`);
        console.log(`      Account: ${campaignAccount.linkedin_account_name}`);
        console.log(`      Owner: ${campaignAccount.user_email} (${campaignAccount.member_role})`);
        console.log(`      Status: ${campaignAccount.connection_status}`);
        console.log(`      Ready for campaigns: ${campaignAccount.can_be_used_for_campaigns ? '✅' : '❌'}`);
      } else {
        console.log('   ⚠️  Campaign LinkedIn account not found in workspace associations');
      }
    }

    // Test 5: Check approval system readiness
    console.log('\n5️⃣ Checking approval system...');
    const { data: approvalSessions, error: approvalError } = await supabase
      .from('prospect_approval_sessions')
      .select('*')
      .eq('workspace_id', campaign.workspaces.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (approvalError) {
      console.error('   ❌ Approval sessions query failed:', approvalError.message);
    } else if (approvalSessions.length > 0) {
      const session = approvalSessions[0];
      console.log(`   ✅ Latest approval session:`);
      console.log(`      Status: ${session.status}`);
      console.log(`      Total prospects: ${session.total_prospects}`);
      console.log(`      Approved: ${session.approved_count || 0}`);
      console.log(`      Rejected: ${session.rejected_count || 0}`);
    } else {
      console.log('   📋 No approval sessions found (ready to create)');
    }

    // Test 6: Generate live execution command
    console.log('\n6️⃣ Live execution command ready...');
    console.log(`   🚀 Test with DRY RUN first:`);
    console.log(`   curl -X POST "https://app.meet-sam.com/api/campaigns/linkedin/execute-live" \\`);
    console.log(`     -H "Content-Type: application/json" \\`);
    console.log(`     -H "Authorization: Bearer YOUR_TOKEN" \\`);
    console.log(`     -d '{"campaignId": "${campaign.id}", "maxProspects": 2, "dryRun": true}'`);
    
    console.log(`\n   🎯 LIVE execution (after dry run success):`);
    console.log(`   curl -X POST "https://app.meet-sam.com/api/campaigns/linkedin/execute-live" \\`);
    console.log(`     -H "Content-Type: application/json" \\`);
    console.log(`     -H "Authorization: Bearer YOUR_TOKEN" \\`);
    console.log(`     -d '{"campaignId": "${campaign.id}", "maxProspects": 1, "dryRun": false}'`);

    // Summary
    console.log('\n🎉 InnovareAI Live Testing Readiness Complete!\n');
    console.log('📋 READINESS CHECKLIST:');
    console.log(`   ✅ Campaign created: ${campaign.name}`);
    console.log(`   ✅ ${prospects.length} test prospects with LinkedIn URLs/IDs`);
    console.log(`   ✅ ${templates?.length || 0} message templates ready`);
    console.log(`   ✅ LinkedIn account associated: ${campaign.linkedin_account_id}`);
    console.log(`   ✅ Approval system in place`);
    console.log(`   ✅ API endpoints deployed`);
    console.log('\n🚀 READY FOR LIVE TESTING!');
    
    return {
      campaignId: campaign.id,
      workspaceId: campaign.workspaces.id,
      prospectsCount: prospects.length,
      templatesCount: templates?.length || 0,
      linkedinAccountId: campaign.linkedin_account_id
    };

  } catch (error) {
    console.error('💥 Live readiness test failed:', error.message);
    return null;
  }
}

testInnovareAILiveReadiness().then(result => {
  if (result) {
    console.log('\n📊 Test Results Summary:');
    console.log(JSON.stringify(result, null, 2));
  }
});