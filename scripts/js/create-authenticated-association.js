// Script to create LinkedIn association for authenticated user
import { createClient } from '@supabase/supabase-js';

async function createAuthenticatedAssociation() {
  try {
    console.log('🔧 Creating LinkedIn association for authenticated user...\n');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Since the user is authenticated in production, let's find their user record
    // by looking for the tl@innovareai.com email in auth.users
    console.log('🔍 Finding authenticated user...');
    
    // Get all auth users to find the correct user ID
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error listing auth users:', authError);
      return;
    }

    const authUser = authUsers.users.find(user => user.email === 'tl@innovareai.com');
    
    if (!authUser) {
      console.error('❌ No authenticated user found for tl@innovareai.com');
      return;
    }

    console.log(`✅ Found authenticated user: ${authUser.email} (${authUser.id})`);

    // Clean up any existing associations first
    console.log('🧹 Cleaning up existing associations...');
    const { error: deleteError } = await supabase
      .from('user_unipile_accounts')
      .delete()
      .eq('account_email', 'tl@innovareai.com');

    if (deleteError) {
      console.log('⚠️ Warning deleting existing associations:', deleteError);
    }

    // Create the association using the authenticated user's ID
    console.log('🔗 Creating LinkedIn association...');
    
    const associationData = {
      user_id: authUser.id, // Use the auth user ID
      unipile_account_id: 'NLsTJRfCSg-WZAXCBo8w7A', // Your Thorsten LinkedIn account
      platform: 'LINKEDIN',
      account_name: 'Thorsten Linz',
      account_email: 'tl@innovareai.com',
      linkedin_public_identifier: 'tvonlinz',
      linkedin_profile_url: 'https://www.linkedin.com/in/tvonlinz',
      connection_status: 'active'
    };

    const { data: result, error: insertError } = await supabase
      .from('user_unipile_accounts')
      .insert(associationData)
      .select();

    if (insertError) {
      console.error('❌ Error creating association:', insertError);
      return;
    }

    console.log('✅ LinkedIn association created successfully:', result);

    // Verify the association
    console.log('\n📊 Verifying association...');
    const { data: verification, error: verifyError } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('user_id', authUser.id)
      .eq('platform', 'LINKEDIN');

    if (verifyError) {
      console.error('❌ Error verifying association:', verifyError);
    } else {
      console.log('✅ Verification successful:');
      verification.forEach((assoc, index) => {
        console.log(`  ${index + 1}. ${assoc.account_name} - Status: ${assoc.connection_status}`);
        console.log(`     Account ID: ${assoc.unipile_account_id}`);
        console.log(`     User ID: ${assoc.user_id}`);
      });
    }

    console.log('\n🎉 LinkedIn should now show as CONNECTED!');
    console.log('🔄 Please refresh the LinkedIn integration page.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createAuthenticatedAssociation();