// Script to understand Charissa's user ID pattern and apply to Thorsten
import { createClient } from '@supabase/supabase-js';

async function copyCharissaPattern() {
  try {
    console.log('🔍 Analyzing Charissa\'s user ID pattern...\n');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find Charissa's association
    console.log('📋 Finding Charissa\'s LinkedIn association...');
    const { data: charissaAssoc, error: charissaError } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .ilike('account_name', '%charissa%')
      .eq('platform', 'LINKEDIN')
      .single();

    if (charissaError) {
      console.error('❌ Error finding Charissa:', charissaError);
      return;
    }

    console.log('✅ Found Charissa\'s association:');
    console.log(`   User ID: ${charissaAssoc.user_id}`);
    console.log(`   Account Name: ${charissaAssoc.account_name}`);
    console.log(`   Unipile ID: ${charissaAssoc.unipile_account_id}`);
    console.log(`   Status: ${charissaAssoc.connection_status}`);

    // Check if there's a user with this ID in public.users
    const { data: charissaUser, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', charissaAssoc.user_id);

    if (userError) {
      console.error('❌ Error checking Charissa\'s user record:', userError);
    } else if (charissaUser.length > 0) {
      console.log('✅ Found Charissa in public.users:', charissaUser[0]);
    } else {
      console.log('❌ Charissa\'s user ID not found in public.users');
    }

    // Get all current associations to see the pattern
    console.log('\n📋 All current associations:');
    const { data: allAssocs, error: allError } = await supabase
      .from('user_unipile_accounts')
      .select('user_id, account_name, account_email, unipile_account_id, connection_status');

    if (allError) {
      console.error('❌ Error getting all associations:', allError);
    } else {
      allAssocs.forEach((assoc, index) => {
        console.log(`  ${index + 1}. ${assoc.account_name} (${assoc.account_email})`);
        console.log(`     User ID: ${assoc.user_id}`);
        console.log(`     Unipile ID: ${assoc.unipile_account_id}`);
        console.log(`     Status: ${assoc.connection_status}`);
        console.log('');
      });
    }

    // Now let's try to create Thorsten's association using the same pattern as Charissa
    console.log('🔧 Creating Thorsten\'s association using Charissa\'s pattern...');
    
    // First, let's try to find if there's already a user with email tl@innovareai.com
    // that has the same user ID format as Charissa
    const charissaUserIdFormat = charissaAssoc.user_id;
    console.log(`📋 Charissa's user ID format: ${charissaUserIdFormat}`);
    
    // Try to create the association with the Thorsten LinkedIn account
    const thorstenData = {
      user_id: charissaAssoc.user_id, // Use Charissa's user_id temporarily to test constraint
      unipile_account_id: 'NLsTJRfCSg-WZAXCBo8w7A', // Thorsten's current account
      platform: 'LINKEDIN',
      account_name: 'Thorsten Linz',
      account_email: 'tl@innovareai.com',
      linkedin_public_identifier: 'tvonlinz',
      linkedin_profile_url: 'https://www.linkedin.com/in/tvonlinz',
      connection_status: 'active'
    };

    console.log('🧪 Testing constraint with Charissa\'s user_id...');
    const { data: testResult, error: testError } = await supabase
      .from('user_unipile_accounts')
      .insert(thorstenData)
      .select();

    if (testError) {
      console.error('❌ Test failed:', testError);
    } else {
      console.log('✅ Test successful! Constraint accepts this user_id format');
      console.log('📋 Created test association:', testResult);
      
      // Now delete the test and we'll need to figure out how to get the right user_id
      console.log('🧹 Cleaning up test association...');
      await supabase
        .from('user_unipile_accounts')
        .delete()
        .eq('id', testResult[0].id);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

copyCharissaPattern();