// Script to debug user ID mismatch and fix association
import { createClient } from '@supabase/supabase-js';

async function debugUserMismatch() {
  try {
    console.log('🔍 Debugging user ID mismatch issue...\n');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check auth.users table
    console.log('📋 Checking auth.users table...');
    const { data: authUsers, error: authError } = await supabase
      .from('auth.users')
      .select('id, email, created_at')
      .eq('email', 'tl@innovareai.com');

    if (authError) {
      console.error('❌ Error checking auth.users:', authError);
      // Try alternative method using RPC
      console.log('🔄 Trying RPC method...');
      
      const { data: rpcResult, error: rpcError } = await supabase
        .rpc('get_user_by_email', { user_email: 'tl@innovareai.com' });
      
      if (rpcError) {
        console.error('❌ RPC also failed:', rpcError);
      } else {
        console.log('✅ RPC result:', rpcResult);
      }
    } else {
      console.log('✅ Auth users found:', authUsers);
    }

    // Check public.users table 
    console.log('\n📋 Checking public.users table...');
    const { data: publicUsers, error: publicError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'tl@innovareai.com');

    if (publicError) {
      console.error('❌ Error checking public.users:', publicError);
    } else {
      console.log('✅ Public users found:', publicUsers);
    }

    // Check existing associations
    console.log('\n📋 Checking existing associations...');
    const { data: associations, error: assocError } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('account_email', 'tl@innovareai.com');

    if (assocError) {
      console.error('❌ Error checking associations:', assocError);
    } else {
      console.log('✅ Existing associations:', associations);
    }

    // Check current Unipile accounts
    console.log('\n📋 Checking Unipile accounts...');
    
    const unipileDsn = process.env.UNIPILE_DSN;
    const unipileApiKey = process.env.UNIPILE_API_KEY;

    if (unipileDsn && unipileApiKey) {
      try {
        const response = await fetch(`https://${unipileDsn}/api/v1/accounts`, {
          headers: {
            'X-API-KEY': unipileApiKey,
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          const accounts = await response.json();
          console.log('✅ Current Unipile accounts:');
          accounts.forEach((account, index) => {
            console.log(`  ${index + 1}. ${account.name} (${account.type}) - ID: ${account.id}`);
            console.log(`     Status: ${account.connection_status || 'Unknown'}`);
            if (account.connection_params?.im) {
              console.log(`     Email: ${account.connection_params.im.email || 'N/A'}`);
              console.log(`     PublicID: ${account.connection_params.im.publicIdentifier || 'N/A'}`);
            }
          });
        } else {
          console.error('❌ Failed to fetch Unipile accounts:', response.status);
        }
      } catch (fetchError) {
        console.error('❌ Exception fetching Unipile accounts:', fetchError);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugUserMismatch();