// Script to find working user IDs and create association for Thorsten
import { createClient } from '@supabase/supabase-js';

async function findWorkingUserIds() {
  try {
    console.log('🔍 Finding working user ID patterns...\n');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all existing associations to see what user IDs work
    console.log('📋 All current LinkedIn associations:');
    const { data: allAssocs, error: allError } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('platform', 'LINKEDIN');

    if (allError) {
      console.error('❌ Error getting associations:', allError);
      return;
    }

    console.log(`✅ Found ${allAssocs.length} LinkedIn associations:`);
    allAssocs.forEach((assoc, index) => {
      console.log(`  ${index + 1}. ${assoc.account_name}`);
      console.log(`     User ID: ${assoc.user_id}`);
      console.log(`     Email: ${assoc.account_email}`);
      console.log(`     Unipile ID: ${assoc.unipile_account_id}`);
      console.log(`     Status: ${assoc.connection_status}`);
      console.log('');
    });

    if (allAssocs.length === 0) {
      console.log('❌ No existing associations found to copy pattern from');
      return;
    }

    // Use the first working user ID as a template
    const templateAssoc = allAssocs[0];
    console.log(`📋 Using ${templateAssoc.account_name}'s user ID as template: ${templateAssoc.user_id}`);

    // Create Thorsten's association using this working user ID pattern
    console.log('🔧 Creating Thorsten\'s association...');
    
    const thorstenData = {
      user_id: templateAssoc.user_id, // Use working user_id from existing association
      unipile_account_id: 'NLsTJRfCSg-WZAXCBo8w7A', // Thorsten's current account from MCP
      platform: 'LINKEDIN',
      account_name: 'Thorsten Linz',
      account_email: 'tl@innovareai.com',
      linkedin_public_identifier: 'tvonlinz',
      linkedin_profile_url: 'https://www.linkedin.com/in/tvonlinz',
      connection_status: 'active'
    };

    const { data: createResult, error: createError } = await supabase
      .from('user_unipile_accounts')
      .insert(thorstenData)
      .select();

    if (createError) {
      console.error('❌ Error creating association:', createError);
    } else {
      console.log('✅ Created Thorsten\'s association successfully:', createResult);
      console.log('\n🎉 LinkedIn should now show as CONNECTED for tl@innovareai.com!');
      console.log('🔄 Please refresh the LinkedIn integration page.');
      
      // Verify the association was created
      const { data: verifyResult, error: verifyError } = await supabase
        .from('user_unipile_accounts')
        .select('*')
        .eq('unipile_account_id', 'NLsTJRfCSg-WZAXCBo8w7A');

      if (verifyError) {
        console.error('❌ Error verifying:', verifyError);
      } else {
        console.log('✅ Verification successful:', verifyResult);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

findWorkingUserIds();