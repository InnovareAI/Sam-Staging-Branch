// Script to cleanup duplicate Thorsten Linz accounts and fix association
import { createClient } from '@supabase/supabase-js';

async function cleanupDuplicateThorsten() {
  try {
    console.log('🧹 Cleaning up duplicate Thorsten Linz accounts...\n');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const unipileDsn = process.env.UNIPILE_DSN;
    const unipileApiKey = process.env.UNIPILE_API_KEY;

    if (!supabaseUrl || !supabaseKey || !unipileDsn || !unipileApiKey) {
      console.error('❌ Missing credentials');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current Unipile accounts
    console.log('📋 Fetching current Unipile accounts...');
    const response = await fetch(`https://${unipileDsn}/api/v1/accounts`, {
      headers: {
        'X-API-KEY': unipileApiKey,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('❌ Failed to fetch Unipile accounts:', response.status);
      return;
    }

    const accounts = await response.json();
    console.log(`✅ Found ${accounts.length} total accounts\n`);

    // Find Thorsten Linz accounts
    const thorstenAccounts = accounts.filter(account => 
      account.name && account.name.toLowerCase().includes('thorsten linz')
    );

    console.log(`🔍 Found ${thorstenAccounts.length} Thorsten Linz accounts:`);
    thorstenAccounts.forEach((account, index) => {
      console.log(`  ${index + 1}. Account ID: ${account.id}`);
      console.log(`     Name: ${account.name}`);
      console.log(`     Type: ${account.type}`);
      console.log(`     Status: ${account.connection_status || 'Unknown'}`);
      console.log(`     Created: ${account.created_at || 'Unknown'}`);
      
      if (account.connection_params?.im) {
        const im = account.connection_params.im;
        console.log(`     Email: ${im.email || 'N/A'}`);
        console.log(`     PublicID: ${im.publicIdentifier || 'N/A'}`);
      }
      console.log('');
    });

    if (thorstenAccounts.length <= 1) {
      console.log('✅ No duplicates found - only one Thorsten account exists');
      
      // Check if we need to fix the association
      if (thorstenAccounts.length === 1) {
        const account = thorstenAccounts[0];
        console.log('🔧 Fixing association for the single Thorsten account...');
        
        // Find the correct user ID
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('email', 'tl@innovareai.com')
          .single();

        if (userError) {
          console.error('❌ Error finding user:', userError);
          return;
        }

        console.log(`✅ Found user ID: ${user.id}`);

        // Update the existing association to correct user ID
        const { data: updateResult, error: updateError } = await supabase
          .from('user_unipile_accounts')
          .update({
            user_id: user.id,
            unipile_account_id: account.id,
            platform: 'LINKEDIN',
            account_name: account.name,
            linkedin_public_identifier: account.connection_params?.im?.publicIdentifier || 'tvonlinz',
            linkedin_profile_url: account.connection_params?.im?.publicIdentifier ? 
              `https://www.linkedin.com/in/${account.connection_params.im.publicIdentifier}` : 
              'https://www.linkedin.com/in/tvonlinz',
            connection_status: 'active'
          })
          .eq('account_email', 'tl@innovareai.com')
          .select();

        if (updateError) {
          console.error('❌ Error updating association:', updateError);
        } else {
          console.log('✅ Association updated successfully:', updateResult);
        }
      }
      return;
    }

    // Sort by creation date to keep the most recent one
    thorstenAccounts.sort((a, b) => {
      const dateA = new Date(a.created_at || '2000-01-01');
      const dateB = new Date(b.created_at || '2000-01-01');
      return dateB - dateA; // Most recent first
    });

    const keepAccount = thorstenAccounts[0];
    const deleteAccounts = thorstenAccounts.slice(1);

    console.log(`✅ Will keep: ${keepAccount.id} (${keepAccount.name}) - Created: ${keepAccount.created_at}`);
    console.log(`🗑️ Will delete ${deleteAccounts.length} duplicate(s):`);
    deleteAccounts.forEach(account => {
      console.log(`   - ${account.id} (Created: ${account.created_at})`);
    });

    // Delete duplicate accounts from Unipile
    for (const account of deleteAccounts) {
      console.log(`\n🗑️ Deleting duplicate account: ${account.id}`);
      
      try {
        const deleteResponse = await fetch(`https://${unipileDsn}/api/v1/accounts/${account.id}`, {
          method: 'DELETE',
          headers: {
            'X-API-KEY': unipileApiKey,
            'Accept': 'application/json'
          }
        });

        if (deleteResponse.ok) {
          console.log(`✅ Successfully deleted ${account.id} from Unipile`);
        } else {
          const errorText = await deleteResponse.text();
          console.error(`❌ Failed to delete ${account.id}: ${deleteResponse.status} ${errorText}`);
        }
      } catch (deleteError) {
        console.error(`❌ Exception deleting ${account.id}:`, deleteError);
      }
    }

    // Now fix the association with the correct user ID and the kept account
    console.log('\n🔧 Fixing database association...');
    
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', 'tl@innovareai.com')
      .single();

    if (userError) {
      console.error('❌ Error finding user:', userError);
      return;
    }

    console.log(`✅ Found correct user ID: ${user.id}`);

    // Create or update the association
    const associationData = {
      user_id: user.id,
      unipile_account_id: keepAccount.id,
      platform: 'LINKEDIN',
      account_name: keepAccount.name,
      account_email: 'tl@innovareai.com',
      linkedin_public_identifier: keepAccount.connection_params?.im?.publicIdentifier || 'tvonlinz',
      linkedin_profile_url: keepAccount.connection_params?.im?.publicIdentifier ? 
        `https://www.linkedin.com/in/${keepAccount.connection_params.im.publicIdentifier}` : 
        'https://www.linkedin.com/in/tvonlinz',
      connection_status: 'active'
    };

    const { data: upsertResult, error: upsertError } = await supabase
      .from('user_unipile_accounts')
      .upsert(associationData, {
        onConflict: 'unipile_account_id'
      })
      .select();

    if (upsertError) {
      console.error('❌ Error creating association:', upsertError);
    } else {
      console.log('✅ Association created/updated successfully:', upsertResult);
    }

    console.log('\n🎉 Cleanup complete! LinkedIn status should now show as CONNECTED.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

cleanupDuplicateThorsten();