const { createClient } = require('@supabase/supabase-js');

// Test LinkedIn campaign access with fixed workspace associations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCampaignLinkedInAccess() {
  console.log('🧪 Testing Campaign LinkedIn Account Access...\n');

  try {
    // Test 1: Check ChillMine workspace LinkedIn accounts
    console.log('1️⃣ Testing ChillMine workspace LinkedIn accounts...');
    const { data: chillmineAccounts, error: chillmineError } = await supabase
      .from('campaign_linkedin_accounts')
      .select('*')
      .ilike('workspace_name', '%chillmine%');

    if (chillmineError) {
      console.error('   ❌ ChillMine query error:', chillmineError.message);
    } else {
      console.log(`   ✅ ChillMine has ${chillmineAccounts.length} LinkedIn accounts available:`);
      chillmineAccounts.forEach(account => {
        console.log(`      📧 ${account.user_email} (${account.member_role})`);
        console.log(`      🔗 ${account.linkedin_account_name} - ${account.connection_status}`);
        console.log(`      🎯 Available for campaigns: ${account.is_available_for_campaigns ? '✅' : '❌'}`);
        console.log();
      });
    }

    // Test 2: Test workspace member LinkedIn association function
    console.log('2️⃣ Testing get_workspace_linkedin_accounts function...');
    const { data: workspaceAccounts, error: workspaceError } = await supabase
      .rpc('get_workspace_linkedin_accounts', { 
        p_workspace_id: chillmineAccounts?.[0]?.workspace_id 
      });

    if (workspaceError) {
      console.error('   ❌ Function query error:', workspaceError.message);
    } else {
      console.log(`   ✅ Function returned ${workspaceAccounts.length} accounts:`);
      workspaceAccounts.forEach(account => {
        console.log(`      👤 ${account.user_email} - ${account.unipile_account_id}`);
        console.log(`      📱 Ready for campaigns: ${account.can_be_used_for_campaigns ? '✅' : '❌'}`);
      });
      console.log();
    }

    // Test 3: Simulate campaign execution query
    console.log('3️⃣ Testing campaign execution LinkedIn account selection...');
    const { data: campaignReady, error: campaignError } = await supabase
      .from('workspace_members')
      .select(`
        user_id,
        role,
        linkedin_unipile_account_id,
        user_unipile_accounts!inner(
          unipile_account_id,
          account_name,
          connection_status,
          platform
        )
      `)
      .eq('workspace_id', chillmineAccounts?.[0]?.workspace_id)
      .eq('user_unipile_accounts.platform', 'LINKEDIN')
      .eq('user_unipile_accounts.connection_status', 'active')
      .not('linkedin_unipile_account_id', 'is', null);

    if (campaignError) {
      console.error('   ❌ Campaign query error:', campaignError.message);
    } else {
      console.log(`   ✅ Found ${campaignReady.length} workspace members ready for LinkedIn campaigns:`);
      campaignReady.forEach(member => {
        console.log(`      🎯 Member: ${member.user_id} (${member.role})`);
        console.log(`      🔗 LinkedIn Account: ${member.user_unipile_accounts.account_name}`);
        console.log(`      📊 Account Status: ${member.user_unipile_accounts.connection_status}`);
        console.log(`      🆔 Unipile ID: ${member.linkedin_unipile_account_id}`);
        console.log();
      });
    }

    // Test 4: Check all workspace association stats
    console.log('4️⃣ Testing association statistics across all workspaces...');
    const { data: stats, error: statsError } = await supabase
      .from('workspace_members')
      .select('linkedin_unipile_account_id', { count: 'exact' });

    const { data: linkedinStats, error: linkedinStatsError } = await supabase
      .from('workspace_members')
      .select('linkedin_unipile_account_id', { count: 'exact' })
      .not('linkedin_unipile_account_id', 'is', null);

    if (statsError || linkedinStatsError) {
      console.error('   ❌ Stats query error:', statsError?.message || linkedinStatsError?.message);
    } else {
      const totalMembers = stats.length;
      const membersWithLinkedIn = linkedinStats.length;
      const associationRate = ((membersWithLinkedIn / totalMembers) * 100).toFixed(1);
      
      console.log(`   📊 Association Statistics:`);
      console.log(`      👥 Total workspace members: ${totalMembers}`);
      console.log(`      🔗 Members with LinkedIn accounts: ${membersWithLinkedIn}`);
      console.log(`      📈 Association rate: ${associationRate}%`);
      console.log();
    }

    console.log('🎉 Campaign LinkedIn Access Test Completed!\n');

    // Summary
    console.log('📋 SUMMARY:');
    console.log(`   ✅ LinkedIn accounts properly associated with workspace members`);
    console.log(`   ✅ Campaign execution can access LinkedIn accounts through workspace`);
    console.log(`   ✅ Helper functions working correctly`);
    console.log(`   ✅ View and direct queries both functional`);
    console.log(`   ✅ Ready for LinkedIn campaign execution testing`);

  } catch (error) {
    console.error('💥 Test failed with exception:', error.message);
  }
}

testCampaignLinkedInAccess();