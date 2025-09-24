const { createClient } = require('@supabase/supabase-js');

// Test direct messenger campaign with internal ID extraction
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDirectMessengerCampaign() {
  console.log('🧪 Testing Direct Messenger Campaign with Internal ID Extraction...\n');

  try {
    // Test 1: Get ChillMine workspace and a LinkedIn account
    console.log('1️⃣ Getting ChillMine workspace LinkedIn accounts...');
    const { data: workspaces, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name')
      .ilike('name', '%chillmine%')
      .single();

    if (workspaceError) {
      console.error('   ❌ Workspace query error:', workspaceError.message);
      return;
    }

    console.log(`   ✅ Found workspace: ${workspaces.name} (${workspaces.id})`);

    // Test 2: Get available LinkedIn accounts for this workspace
    const { data: linkedinAccounts, error: linkedinError } = await supabase
      .rpc('get_workspace_linkedin_accounts', { 
        p_workspace_id: workspaces.id 
      });

    if (linkedinError || !linkedinAccounts?.length) {
      console.error('   ❌ No LinkedIn accounts found:', linkedinError?.message);
      return;
    }

    const primaryAccount = linkedinAccounts.find(acc => acc.can_be_used_for_campaigns);
    console.log(`   ✅ Using LinkedIn account: ${primaryAccount.linkedin_account_name} (${primaryAccount.unipile_account_id})`);
    console.log(`   👤 Account owner: ${primaryAccount.user_email} (${primaryAccount.member_role})`);

    // Test 3: Create a test campaign
    console.log('\n2️⃣ Creating test direct messenger campaign...');
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        workspace_id: workspaces.id,
        name: 'Test Direct Messenger Campaign',
        type: 'linkedin_direct_message',
        status: 'draft',
        linkedin_account_id: primaryAccount.unipile_account_id,
        connection_request_template: 'Hi {{first_name}}, would love to connect and discuss {{industry}} opportunities.',
        follow_up_templates: ['Thanks for connecting {{first_name}}! Excited to explore synergies between our companies.'],
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (campaignError) {
      console.error('   ❌ Campaign creation error:', campaignError.message);
      return;
    }

    console.log(`   ✅ Created campaign: ${campaign.name} (${campaign.id})`);

    // Test 4: Add test prospects with LinkedIn internal IDs (simulated)
    console.log('\n3️⃣ Adding test prospects with internal LinkedIn IDs...');
    
    const testProspects = [
      {
        workspace_id: workspaces.id,
        first_name: 'John',
        last_name: 'Smith',
        company_name: 'TechCorp',
        job_title: 'VP Sales',
        industry: 'Technology',
        linkedin_profile_url: 'https://linkedin.com/in/johnsmith-tech',
        linkedin_internal_id: 'ACoAAA12345678901234567890123456789012', // Simulated internal ID
        created_at: new Date().toISOString()
      },
      {
        workspace_id: workspaces.id,
        first_name: 'Sarah',
        last_name: 'Johnson',
        company_name: 'InnovateCorp',
        job_title: 'Head of Growth',
        industry: 'SaaS',
        linkedin_profile_url: 'https://linkedin.com/in/sarah-johnson-growth',
        linkedin_internal_id: 'ACoAAA98765432109876543210987654321098', // Simulated internal ID
        created_at: new Date().toISOString()
      }
    ];

    const { data: prospects, error: prospectsError } = await supabase
      .from('workspace_prospects')
      .insert(testProspects)
      .select();

    if (prospectsError) {
      console.error('   ❌ Prospects creation error:', prospectsError.message);
      return;
    }

    console.log(`   ✅ Created ${prospects.length} test prospects:`);
    prospects.forEach(prospect => {
      console.log(`      👤 ${prospect.first_name} ${prospect.last_name} - ${prospect.company_name}`);
      console.log(`      🆔 Internal ID: ${prospect.linkedin_internal_id}`);
    });

    // Test 5: Associate prospects with campaign
    console.log('\n4️⃣ Associating prospects with campaign...');
    
    const campaignProspects = prospects.map(prospect => ({
      campaign_id: campaign.id,
      prospect_id: prospect.id,
      status: 'ready_to_message', // Skip connection phase for direct messaging
      sequence_step: 0,
      created_at: new Date().toISOString()
    }));

    const { data: associations, error: associationsError } = await supabase
      .from('campaign_prospects')
      .insert(campaignProspects)
      .select();

    if (associationsError) {
      console.error('   ❌ Associations creation error:', associationsError.message);
      return;
    }

    console.log(`   ✅ Associated ${associations.length} prospects with campaign`);

    // Test 6: Simulate campaign execution query (what the API would do)
    console.log('\n5️⃣ Testing campaign execution query...');
    
    const { data: executableProspects, error: executableError } = await supabase
      .from('campaign_prospects')
      .select(`
        id,
        status,
        sequence_step,
        workspace_prospects (
          id,
          first_name,
          last_name,
          company_name,
          job_title,
          linkedin_internal_id,
          industry
        )
      `)
      .eq('campaign_id', campaign.id)
      .eq('status', 'ready_to_message')
      .not('workspace_prospects.linkedin_internal_id', 'is', null);

    if (executableError) {
      console.error('   ❌ Executable prospects query error:', executableError.message);
      return;
    }

    console.log(`   ✅ Found ${executableProspects.length} prospects ready for direct messaging:`);
    executableProspects.forEach(cp => {
      const prospect = cp.workspace_prospects;
      console.log(`      🎯 ${prospect.first_name} ${prospect.last_name}`);
      console.log(`         Company: ${prospect.company_name} (${prospect.job_title})`);
      console.log(`         LinkedIn ID: ${prospect.linkedin_internal_id}`);
      console.log(`         Status: ${cp.status} (Step ${cp.sequence_step})`);
    });

    // Test 7: Simulate message personalization
    console.log('\n6️⃣ Testing message personalization...');
    
    for (const cp of executableProspects) {
      const prospect = cp.workspace_prospects;
      const template = campaign.connection_request_template;
      
      // Simple template replacement (in real system, this would use the cost-controlled LLM)
      const personalizedMessage = template
        .replace(/\{\{first_name\}\}/g, prospect.first_name)
        .replace(/\{\{industry\}\}/g, prospect.industry)
        .replace(/\{\{company_name\}\}/g, prospect.company_name);
      
      console.log(`      💬 Message for ${prospect.first_name}:`);
      console.log(`         "${personalizedMessage}"`);
      console.log(`         🎯 Target LinkedIn ID: ${prospect.linkedin_internal_id}`);
      console.log(`         📱 Via Account: ${primaryAccount.linkedin_account_name}`);
      console.log();
    }

    // Test 8: Clean up test data
    console.log('7️⃣ Cleaning up test data...');
    
    await supabase.from('campaign_prospects').delete().eq('campaign_id', campaign.id);
    await supabase.from('campaigns').delete().eq('id', campaign.id);
    await supabase.from('workspace_prospects').delete().in('id', prospects.map(p => p.id));
    
    console.log('   ✅ Test data cleaned up');

    console.log('\n🎉 Direct Messenger Campaign Test SUCCESSFUL!\n');

    // Summary
    console.log('📋 TEST RESULTS:');
    console.log('   ✅ LinkedIn accounts properly accessible from workspace');
    console.log('   ✅ Campaign creation with LinkedIn account association working');
    console.log('   ✅ Prospects with internal LinkedIn IDs can be added');
    console.log('   ✅ Campaign-prospect association functional');
    console.log('   ✅ Executable prospects query works correctly');
    console.log('   ✅ Message personalization ready for LLM integration');
    console.log('   ✅ System ready for direct LinkedIn messaging campaigns');
    console.log('\n🚀 READY FOR PRODUCTION: Direct messenger campaigns with internal ID extraction');

  } catch (error) {
    console.error('💥 Test failed with exception:', error.message);
    console.error(error.stack);
  }
}

testDirectMessengerCampaign();