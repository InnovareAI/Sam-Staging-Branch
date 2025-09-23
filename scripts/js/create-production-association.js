// Script to create LinkedIn association for production tl@innovareai.com account
import { createClient } from '@supabase/supabase-js';

async function createProductionAssociation() {
  try {
    console.log('🔧 Creating LinkedIn association for production account...\n');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // First, check if there are any existing auth users to get the proper user ID format
    console.log('📋 Checking for existing users in auth schema...');
    
    // Since we can't directly access auth.users, let's check what user IDs exist
    // by looking at any other tables that might reference auth users
    
    // Let's try a different approach - create the association using a direct insert
    // with the user_id from the public.users table, but first we need to verify
    // if there are ANY working associations to understand the constraint
    
    console.log('📋 Checking current database state...');
    
    // Get the user from public.users
    const { data: publicUser, error: publicError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'tl@innovareai.com')
      .single();

    if (publicError) {
      console.error('❌ Error finding public user:', publicError);
      return;
    }

    console.log(`✅ Found public user: ${publicUser.email} (${publicUser.id})`);

    // Since the constraint is failing, let's try to understand what the constraint expects
    // by trying to create a test association with a UUID that follows the auth.users pattern
    
    // Generate a properly formatted UUID that might work with auth.users constraint
    // Most Supabase auth user IDs follow this format
    const testUserId = publicUser.id; // Start with the existing ID
    
    console.log('🔧 Attempting to create association with current approach...');
    
    const associationData = {
      user_id: testUserId,
      unipile_account_id: 'NLsTJRfCSg-WZAXCBo8w7A', // Your current Thorsten LinkedIn account
      platform: 'LINKEDIN',
      account_name: 'Thorsten Linz',
      account_email: 'tl@innovareai.com',
      linkedin_public_identifier: 'tvonlinz',
      linkedin_profile_url: 'https://www.linkedin.com/in/tvonlinz',
      connection_status: 'active'
    };

    // Try RLS bypass approach - since we're using service role key, let's disable RLS temporarily
    console.log('🔄 Attempting direct insert with RLS considerations...');
    
    const { data: result, error } = await supabase
      .from('user_unipile_accounts')
      .insert(associationData)
      .select();

    if (error) {
      console.error('❌ Direct insert failed:', error);
      
      // If the constraint is still failing, the issue is that the user_id needs to exist in auth.users
      // Let's create a workaround by checking if we can temporarily disable the constraint
      // or create the auth user record
      
      console.log('🔄 Trying alternative approach...');
      console.log('💡 The issue is that user_id must exist in auth.users table');
      console.log('💡 Since you\'re signed in to production, there should be an auth.users record');
      console.log('💡 The production app needs to create this association when you sign in');
      
      // Let's try to understand the production setup better
      console.log('\n📋 Recommendations:');
      console.log('1. Sign in to the production app at your domain');
      console.log('2. Go to LinkedIn integration page while signed in');
      console.log('3. The system should automatically detect your LinkedIn account');
      console.log('4. If not, use the "Connect to LinkedIn" button to re-authenticate');
      
    } else {
      console.log('✅ Association created successfully:', result);
      console.log('🎉 LinkedIn should now show as connected!');
    }

    // Also verify current Unipile account status
    console.log('\n📋 Current Unipile account status:');
    console.log(`Account ID: NLsTJRfCSg-WZAXCBo8w7A`);
    console.log(`Name: Thorsten Linz`);
    console.log(`Status: Running/Connected (from your screenshot)`);
    console.log(`Public ID: tvonlinz`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createProductionAssociation();