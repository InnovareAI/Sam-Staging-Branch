// Check LinkedIn account associations and identify systematic issues
// This script will help diagnose the LinkedIn connection problem

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLinkedInAssociations() {
  console.log('🔍 Checking LinkedIn account associations...\n');

  try {
    // Get all auth users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
      console.error('Error fetching auth users:', authError);
      return;
    }

    console.log(`📊 Total authenticated users: ${authUsers.users.length}\n`);

    // Get all user associations from database
    const { data: userAccounts, error: accountError } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('platform', 'linkedin');

    if (accountError) {
      console.error('Error fetching user accounts:', accountError);
      return;
    }

    console.log(`🔗 Total LinkedIn associations in database: ${userAccounts?.length || 0}\n`);

    // Analyze the mismatch
    const usersWithLinkedIn = new Set(userAccounts?.map(acc => acc.user_id) || []);
    const allUserIds = authUsers.users.map(user => user.id);
    
    const usersWithoutLinkedIn = allUserIds.filter(userId => !usersWithLinkedIn.has(userId));

    console.log(`✅ Users with LinkedIn associations: ${usersWithLinkedIn.size}`);
    console.log(`❌ Users without LinkedIn associations: ${usersWithoutLinkedIn.length}\n`);

    // Show details of users without associations
    if (usersWithoutLinkedIn.length > 0) {
      console.log('👤 Users without LinkedIn associations:');
      for (const userId of usersWithoutLinkedIn) {
        const user = authUsers.users.find(u => u.id === userId);
        console.log(`  - ${user?.email || 'No email'} (ID: ${userId})`);
      }
      console.log();
    }

    // Show existing associations
    if (userAccounts && userAccounts.length > 0) {
      console.log('🔗 Existing LinkedIn associations:');
      for (const account of userAccounts) {
        const user = authUsers.users.find(u => u.id === account.user_id);
        console.log(`  - ${user?.email || 'Unknown user'}: ${account.account_name} (${account.account_email})`);
      }
      console.log();
    }

    // Check if there are unassociated LinkedIn accounts in Unipile
    console.log('📋 Summary:');
    console.log(`  • ${authUsers.users.length} total users in system`);
    console.log(`  • ${usersWithLinkedIn.size} users have LinkedIn associations`);
    console.log(`  • ${usersWithoutLinkedIn.length} users missing LinkedIn associations`);
    console.log(`  • This explains why users see "LinkedIn Not Connected"`);

    if (usersWithoutLinkedIn.length > 0) {
      console.log('\n🔧 Recommended fixes:');
      console.log('  1. Run auto-association script for email matches');
      console.log('  2. Create manual association UI for non-matching emails');
      console.log('  3. Implement domain-based association for corporate accounts');
    }

  } catch (error) {
    console.error('Error during check:', error);
  }
}

checkLinkedInAssociations();