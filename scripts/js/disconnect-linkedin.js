#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function disconnectLinkedIn(email) {
  console.log(`🔌 Disconnecting LinkedIn for: ${email}\n`);
  
  try {
    // Get user
    const { data: users } = await supabase.auth.admin.listUsers();
    const user = users.users.find(u => u.email === email);
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log('✅ User found:', user.id);
    console.log('   Email:', user.email);
    
    // Check integrations table
    const { data: integrations } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'linkedin');
    
    console.log('\n📊 Found in integrations table:', integrations?.length || 0);
    if (integrations && integrations.length > 0) {
      integrations.forEach(int => {
        console.log('   -', int.credentials?.account_name || 'LinkedIn Account');
        console.log('     ID:', int.id);
        console.log('     Unipile ID:', int.credentials?.unipile_account_id);
      });
    }
    
    // Check workspace_accounts table
    const { data: workspaceAccounts } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('account_type', 'linkedin');
    
    console.log('\n📊 Found in workspace_accounts table:', workspaceAccounts?.length || 0);
    if (workspaceAccounts && workspaceAccounts.length > 0) {
      workspaceAccounts.forEach(acc => {
        console.log('   -', acc.account_name || 'LinkedIn Account');
        console.log('     ID:', acc.id);
        console.log('     Unipile ID:', acc.unipile_account_id);
      });
    }
    
    // Delete from integrations
    if (integrations && integrations.length > 0) {
      console.log('\n🗑️  Deleting from integrations table...');
      const { error: deleteIntegrationsError } = await supabase
        .from('integrations')
        .delete()
        .eq('user_id', user.id)
        .eq('provider', 'linkedin');
      
      if (deleteIntegrationsError) {
        console.error('❌ Error deleting integrations:', deleteIntegrationsError);
      } else {
        console.log('✅ Deleted', integrations.length, 'integration(s)');
      }
    }
    
    // Delete from workspace_accounts
    if (workspaceAccounts && workspaceAccounts.length > 0) {
      console.log('\n🗑️  Deleting from workspace_accounts table...');
      const { error: deleteWorkspaceError } = await supabase
        .from('workspace_accounts')
        .delete()
        .eq('user_id', user.id)
        .eq('account_type', 'linkedin');
      
      if (deleteWorkspaceError) {
        console.error('❌ Error deleting workspace accounts:', deleteWorkspaceError);
      } else {
        console.log('✅ Deleted', workspaceAccounts.length, 'workspace account(s)');
      }
    }
    
    // Also check for user_unipile_accounts table (if it exists)
    const { data: unipileAccounts } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'LINKEDIN');
    
    if (unipileAccounts && unipileAccounts.length > 0) {
      console.log('\n📊 Found in user_unipile_accounts table:', unipileAccounts.length);
      console.log('🗑️  Deleting from user_unipile_accounts table...');
      
      const { error: deleteUnipileError } = await supabase
        .from('user_unipile_accounts')
        .delete()
        .eq('user_id', user.id)
        .eq('platform', 'LINKEDIN');
      
      if (deleteUnipileError) {
        console.error('❌ Error deleting unipile accounts:', deleteUnipileError);
      } else {
        console.log('✅ Deleted', unipileAccounts.length, 'unipile account(s)');
      }
    }
    
    console.log('\n✅ LinkedIn disconnect complete!');
    console.log('💡 Note: This only removes the connection in SAM AI database.');
    console.log('💡 The Unipile account may still exist - you can delete it via Unipile dashboard if needed.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Get email from command line or use default
const email = process.argv[2] || 'tl@innovareai.com';
disconnectLinkedIn(email).catch(console.error);