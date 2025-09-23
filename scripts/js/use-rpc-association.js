// Script to use the RPC function to create association (same as callback route)
import { createClient } from '@supabase/supabase-js';

async function useRPCAssociation() {
  try {
    console.log('🔧 Using RPC function to create LinkedIn association...\n');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // First, clean up any existing associations for this account
    console.log('🧹 Cleaning up existing associations...');
    const { error: deleteError } = await supabase
      .from('user_unipile_accounts')
      .delete()
      .eq('account_email', 'tl@innovareai.com');

    if (deleteError) {
      console.log('⚠️ Warning deleting existing associations:', deleteError);
    } else {
      console.log('✅ Cleaned up existing associations');
    }

    // Get the correct user ID from public.users (this should work)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', 'tl@innovareai.com')
      .single();

    if (userError) {
      console.error('❌ Error finding user:', userError);
      return;
    }

    console.log(`✅ Found user: ${user.email} (${user.id})`);

    // Use the same RPC function as the callback route
    console.log('🔄 Creating association using RPC function...');
    
    const { data, error } = await supabase.rpc('create_user_association', {
      p_user_id: user.id,
      p_unipile_account_id: 'NLsTJRfCSg-WZAXCBo8w7A', // Current active Thorsten account
      p_platform: 'LINKEDIN',
      p_account_name: 'Thorsten Linz',
      p_account_email: 'tl@innovareai.com',
      p_linkedin_public_identifier: 'tvonlinz',
      p_linkedin_profile_url: 'https://www.linkedin.com/in/tvonlinz',
      p_connection_status: 'active'
    });

    if (error) {
      console.error('❌ RPC function failed:', error);
      
      // If RPC fails, try direct insert as fallback (same as callback route)
      console.log('🔄 Trying fallback direct insert...');
      
      const fallbackData = {
        user_id: user.id,
        unipile_account_id: 'NLsTJRfCSg-WZAXCBo8w7A',
        platform: 'LINKEDIN',
        account_name: 'Thorsten Linz',
        account_email: 'tl@innovareai.com',
        linkedin_public_identifier: 'tvonlinz',
        linkedin_profile_url: 'https://www.linkedin.com/in/tvonlinz',
        connection_status: 'active'
      };

      const { data: fallbackResult, error: fallbackError } = await supabase
        .from('user_unipile_accounts')
        .upsert(fallbackData, { 
          onConflict: 'unipile_account_id',
          ignoreDuplicates: false 
        })
        .select();

      if (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError);
        
        // Let's try checking what the actual constraint expects
        console.log('\n🔍 Debugging constraint issue...');
        
        // Check if there's a user in auth.users with this ID
        const { data: authUserCheck, error: authCheckError } = await supabase
          .from('auth.users')
          .select('id, email')
          .eq('id', user.id);
          
        if (authCheckError) {
          console.error('❌ Cannot check auth.users:', authCheckError);
        } else {
          console.log('📋 Auth users with this ID:', authUserCheck);
        }
        
      } else {
        console.log('✅ Fallback association successful:', fallbackResult);
      }
    } else {
      console.log('✅ RPC association successful:', data);
    }

    // Verify final state
    console.log('\n📊 Checking final state...');
    const { data: finalCheck, error: finalError } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('account_email', 'tl@innovareai.com');

    if (finalError) {
      console.error('❌ Error in final check:', finalError);
    } else if (finalCheck && finalCheck.length > 0) {
      console.log('✅ Final associations:');
      finalCheck.forEach((assoc, index) => {
        console.log(`  ${index + 1}. ${assoc.account_name} - Status: ${assoc.connection_status}`);
        console.log(`     Account ID: ${assoc.unipile_account_id}`);
        console.log(`     User ID: ${assoc.user_id}`);
      });
      console.log('\n🎉 LinkedIn status should now show as CONNECTED!');
    } else {
      console.log('❌ No associations found after creation attempt');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

useRPCAssociation();