// Manual association script for new LinkedIn accounts connected today
// Use this when domain-based auto-association doesn't work (personal emails)

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to get all unassociated LinkedIn accounts
async function getUnassociatedLinkedInAccounts() {
  console.log('🔍 Fetching unassociated LinkedIn accounts from MCP...');
  
  // This would need to be populated with actual MCP call results
  // For now, manual input required
  console.log('ℹ️  Run this to get latest accounts:');
  console.log('   mcp__unipile__unipile_get_accounts');
  console.log('   Then update the accounts array below\n');
  
  return []; // Will be populated manually
}

// Helper function to associate account with user
async function associateLinkedInAccount(userEmail, linkedinAccountId, accountName, accountEmail = null) {
  console.log(`🔗 Associating ${accountName} with ${userEmail}...`);

  try {
    // Get user ID from email
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
      console.error('❌ Error fetching users:', authError);
      return false;
    }

    const user = authUsers.users.find(u => u.email === userEmail);
    if (!user) {
      console.error(`❌ User not found: ${userEmail}`);
      return false;
    }

    // Create association
    const { data, error } = await supabase.rpc('create_user_association', {
      p_user_id: user.id,
      p_unipile_account_id: linkedinAccountId,
      p_platform: 'LINKEDIN',
      p_account_name: accountName,
      p_account_email: accountEmail || accountName,
      p_connection_status: 'connected',
      p_linkedin_profile_url: `https://linkedin.com/in/${accountName.toLowerCase().replace(/\s+/g, '-')}`,
      p_linkedin_public_identifier: accountName.toLowerCase().replace(/\s+/g, '-')
    });

    if (error) {
      console.error(`❌ Association error:`, error);
      return false;
    }

    console.log(`✅ Successfully associated ${accountName} with ${userEmail}`);
    return true;

  } catch (error) {
    console.error(`🚨 Unexpected error:`, error);
    return false;
  }
}

// Main function for today's associations
async function associateNewAccounts() {
  console.log('🚀 Manual LinkedIn Association Tool\n');
  console.log('📋 Instructions:');
  console.log('1. First get unassociated accounts with MCP');
  console.log('2. Update the associationQueue below with new account details');
  console.log('3. Run this script to create associations\n');

  // 🎯 UPDATE THIS QUEUE WITH TODAY'S NEW ACCOUNTS
  const associationQueue = [
    // Example format:
    // {
    //   userEmail: 'ny@3cubed.ai',
    //   accountId: 'NEW_ACCOUNT_ID_FROM_MCP',
    //   accountName: 'NY Name',
    //   accountEmail: 'ny.personal@gmail.com' // Optional
    // }
  ];

  if (associationQueue.length === 0) {
    console.log('⚠️  No accounts in queue. Please update associationQueue array.');
    console.log('   Add new LinkedIn accounts that were connected today.');
    return;
  }

  console.log(`🔄 Processing ${associationQueue.length} association(s)...\n`);

  let successCount = 0;
  for (const association of associationQueue) {
    const success = await associateLinkedInAccount(
      association.userEmail,
      association.accountId,
      association.accountName,
      association.accountEmail
    );
    
    if (success) successCount++;
    console.log(); // Empty line between accounts
  }

  console.log(`🎉 Completed: ${successCount}/${associationQueue.length} associations successful`);
  
  if (successCount > 0) {
    console.log('\n✅ Users should now see "LinkedIn Connected" in the interface');
  }
}

// Quick function to show current unassociated accounts
async function showUnassociatedAccounts() {
  console.log('🔍 Checking for existing unassociated LinkedIn accounts...\n');
  
  // Get all existing associations
  const { data: existingAssocs, error: assocError } = await supabase
    .from('user_unipile_accounts')
    .select('unipile_account_id')
    .eq('platform', 'LINKEDIN');

  if (assocError) {
    console.error('❌ Error checking associations:', assocError);
    return;
  }

  const associatedIds = new Set(existingAssocs?.map(a => a.unipile_account_id) || []);
  console.log(`📊 Currently associated accounts: ${associatedIds.size}`);
  console.log('\nTo find unassociated accounts:');
  console.log('1. Run: mcp__unipile__unipile_get_accounts');
  console.log('2. Compare account IDs against the associated list above');
  console.log('3. Add unassociated ones to the associationQueue in this script');
  
  if (associatedIds.size > 0) {
    console.log('\n📋 Currently associated account IDs:');
    associatedIds.forEach(id => console.log(`  • ${id}`));
  }
}

// Run based on command line argument
const action = process.argv[2];

if (action === 'show') {
  showUnassociatedAccounts();
} else {
  associateNewAccounts();
}

console.log('\n💡 Usage:');
console.log('  node scripts/js/associate-new-linkedin.js        # Run associations');
console.log('  node scripts/js/associate-new-linkedin.js show   # Show current state');