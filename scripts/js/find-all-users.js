// Script to find all users in the system
import { createClient } from '@supabase/supabase-js';

async function findAllUsers() {
  try {
    console.log('🔍 Finding all users in the system...\n');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find all users 
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email, created_at')
      .limit(20);

    if (userError) {
      console.error('❌ Error finding users:', userError);
      return;
    }

    console.log(`👤 Found ${users?.length || 0} users:`);
    
    if (users && users.length > 0) {
      users.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.email} (${user.id}) - Created: ${user.created_at}`);
      });
    }

    // Also check for any linkedin associations
    console.log('\n🔗 Checking all LinkedIn associations...');
    const { data: associations, error: assocError } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('platform', 'LINKEDIN');

    if (assocError) {
      console.error('❌ Error checking associations:', assocError);
      return;
    }

    console.log(`📊 Found ${associations?.length || 0} LinkedIn associations:`);
    if (associations && associations.length > 0) {
      associations.forEach((assoc, index) => {
        console.log(`  ${index + 1}. ${assoc.account_name} - User: ${assoc.user_id}`);
        console.log(`     Account ID: ${assoc.unipile_account_id}`);
        console.log(`     Status: ${assoc.connection_status}`);
        console.log(`     Email: ${assoc.account_email}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

findAllUsers();