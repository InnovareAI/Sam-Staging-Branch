// Script to debug Thorsten's LinkedIn association
import { createClient } from '@supabase/supabase-js';

async function debugThorstenAssociation() {
  try {
    console.log('🔍 Debugging Thorsten LinkedIn association...\n');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find all users with thorsten in email
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .ilike('email', '%thorsten%');

    if (userError) {
      console.error('❌ Error finding users:', userError);
      return;
    }

    console.log('👤 Found users:', users);

    if (!users || users.length === 0) {
      console.error('❌ No Thorsten user found');
      return;
    }

    // Check all associations for each user
    for (const user of users) {
      console.log(`\n🔍 Checking associations for ${user.email} (${user.id}):`);
      
      const { data: associations, error: assocError } = await supabase
        .from('user_unipile_accounts')
        .select('*')
        .eq('user_id', user.id);

      if (assocError) {
        console.error('❌ Error checking associations:', assocError);
        continue;
      }

      console.log(`📊 Found ${associations?.length || 0} associations:`);
      if (associations && associations.length > 0) {
        associations.forEach((assoc, index) => {
          console.log(`  ${index + 1}. ${assoc.account_name} (${assoc.platform})`);
          console.log(`     Account ID: ${assoc.unipile_account_id}`);
          console.log(`     Status: ${assoc.connection_status}`);
          console.log(`     Created: ${assoc.created_at}`);
        });
      }
    }

    // Also check if there are any associations with the specific Unipile account ID
    console.log('\n🔍 Checking associations for Thorsten LinkedIn account ID...');
    const { data: accountAssociations, error: accountError } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('unipile_account_id', 'NLsTJRfCSg-WZAXCBo8w7A');

    if (accountError) {
      console.error('❌ Error checking account associations:', accountError);
      return;
    }

    console.log(`📊 Found ${accountAssociations?.length || 0} associations for account NLsTJRfCSg-WZAXCBo8w7A:`);
    if (accountAssociations && accountAssociations.length > 0) {
      accountAssociations.forEach((assoc, index) => {
        console.log(`  ${index + 1}. User: ${assoc.user_id}`);
        console.log(`     Account: ${assoc.account_name} (${assoc.platform})`);
        console.log(`     Status: ${assoc.connection_status}`);
        console.log(`     Created: ${assoc.created_at}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugThorstenAssociation();