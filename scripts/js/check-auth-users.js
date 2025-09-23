// Script to check what users exist in auth schema
import { createClient } from '@supabase/supabase-js';

async function checkAuthUsers() {
  try {
    console.log('🔍 Checking auth users...\n');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Try to check the constraint details
    console.log('📋 Checking constraint information...');
    
    const { data: constraints, error: constraintError } = await supabase
      .from('information_schema.table_constraints')
      .select('*')
      .eq('table_name', 'user_unipile_accounts')
      .eq('constraint_type', 'FOREIGN KEY');

    if (constraintError) {
      console.error('❌ Error checking constraints:', constraintError);
    } else {
      console.log('✅ Constraints found:', constraints);
    }

    // Check foreign key column usage
    const { data: keyUsage, error: keyError } = await supabase
      .from('information_schema.key_column_usage')
      .select('*')
      .eq('table_name', 'user_unipile_accounts')
      .eq('column_name', 'user_id');

    if (keyError) {
      console.error('❌ Error checking key usage:', keyError);
    } else {
      console.log('✅ Key usage found:', keyUsage);
    }

    // Try to get some user data to understand the structure
    console.log('\n📋 Checking existing associations to understand user_id pattern...');
    const { data: existingAssocs, error: assocError } = await supabase
      .from('user_unipile_accounts')
      .select('user_id, account_email')
      .limit(5);

    if (assocError) {
      console.error('❌ Error checking associations:', assocError);
    } else {
      console.log('✅ Existing associations with user IDs:');
      existingAssocs.forEach(assoc => {
        console.log(`  User ID: ${assoc.user_id} - Email: ${assoc.account_email}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkAuthUsers();