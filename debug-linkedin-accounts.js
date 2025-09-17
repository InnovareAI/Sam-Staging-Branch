// Debug script to check LinkedIn accounts in workspace_accounts table
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service role for read access
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugLinkedInAccounts() {
  console.log('🔍 DEBUG: Checking LinkedIn accounts in workspace_accounts table');
  console.log('=' .repeat(80));
  
  try {
    // Get all LinkedIn accounts in workspace_accounts table
    const { data: linkedinAccounts, error } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('account_type', 'linkedin')
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('❌ Error fetching LinkedIn accounts:', error);
      return;
    }
    
    console.log(`📊 Found ${linkedinAccounts.length} LinkedIn accounts in workspace_accounts table:`);
    console.log('');
    
    linkedinAccounts.forEach((account, index) => {
      console.log(`Account ${index + 1}:`);
      console.log(`  📧 User ID: ${account.user_id}`);
      console.log(`  🏢 Workspace ID: ${account.workspace_id}`);
      console.log(`  🏷️  Account Identifier: ${account.account_identifier}`);
      console.log(`  👤 Account Name: ${account.account_name}`);
      console.log(`  🆔 Unipile Account ID: ${account.unipile_account_id}`);
      console.log(`  🔗 Connection Status: ${account.connection_status}`);
      console.log(`  ✅ Is Active: ${account.is_active}`);
      console.log(`  ⭐ Is Primary: ${account.is_primary}`);
      console.log(`  📅 Created: ${account.created_at}`);
      console.log(`  📝 Connection Details:`, JSON.stringify(account.connection_details, null, 2));
      console.log('  ' + '-'.repeat(60));
    });
    
    // Get user email for the first account to help with testing
    if (linkedinAccounts.length > 0) {
      const firstAccount = linkedinAccounts[0];
      const { data: userData } = await supabase.auth.admin.getUserById(firstAccount.user_id);
      
      // Check user's current_workspace_id
      const { data: userProfile } = await supabase
        .from('users')
        .select('current_workspace_id')
        .eq('id', firstAccount.user_id)
        .single();
      
      console.log('');
      console.log('🧪 TEST USER INFO:');
      console.log(`   User Email: ${userData.user?.email || 'Unknown'}`);
      console.log(`   User ID: ${firstAccount.user_id}`);
      console.log(`   LinkedIn Accounts Workspace: ${firstAccount.workspace_id}`);
      console.log(`   User's Current Workspace: ${userProfile?.current_workspace_id || 'NULL'}`);
      
      const workspaceMatch = userProfile?.current_workspace_id === firstAccount.workspace_id;
      console.log(`   ✅ Workspace Match: ${workspaceMatch ? 'YES' : 'NO ❌'}`);
      
      if (!workspaceMatch) {
        console.log('');
        console.log('🚨 ISSUE FOUND:');
        console.log('   The user is not in the same workspace as their LinkedIn accounts!');
        console.log('   This is why the app shows "LinkedIn not connected"');
        console.log('');
        console.log('💡 SOLUTIONS:');
        console.log(`   1. Update user's current_workspace_id to: ${firstAccount.workspace_id}`);
        console.log('   2. OR move LinkedIn accounts to current workspace');
      }
      
      console.log('');
      console.log('📋 To test the API endpoint:');
      console.log(`   1. Login as user: ${userData.user?.email || 'the user above'}`);
      console.log(`   2. Make sure current_workspace_id = ${firstAccount.workspace_id}`);
      console.log(`   3. Call GET /api/linkedin/connect`);
      console.log('');
    }
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

// Run the debug function
debugLinkedInAccounts();