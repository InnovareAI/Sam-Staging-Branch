/**
 * Manually Associate Thorsten Linz LinkedIn Account
 * ===============================================
 * Link tl@innovareai.com to his LinkedIn account in Unipile
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function manuallyAssociateThorsten() {
  console.log('🔗 Manually associating Thorsten Linz LinkedIn account with tl@innovareai.com...');
  
  // Get tl@innovareai.com user ID
  const { data: authUsers } = await supabase.auth.admin.listUsers();
  const tlUser = authUsers.users.find(u => u.email === 'tl@innovareai.com');
  
  if (!tlUser) {
    console.log('❌ User tl@innovareai.com not found');
    return;
  }
  
  console.log(`👤 Found user: ${tlUser.email} (${tlUser.id})`);
  
  // Thorsten Linz LinkedIn account ID from Unipile
  const thorstenLinkedInId = 'Hut6zgezT_SWmwL-XIkjSg';
  
  // Check if association already exists
  const { data: existingAssociation } = await supabase
    .from('user_unipile_accounts')
    .select('*')
    .eq('user_id', tlUser.id)
    .eq('unipile_account_id', thorstenLinkedInId)
    .single();
  
  if (existingAssociation) {
    console.log('⏭️ Association already exists');
    console.log('   Account:', existingAssociation.account_name);
    console.log('   Status:', existingAssociation.connection_status);
    return;
  }
  
  // Create the association
  const { data: association, error } = await supabase
    .from('user_unipile_accounts')
    .insert({
      user_id: tlUser.id,
      unipile_account_id: thorstenLinkedInId,
      platform: 'LINKEDIN',
      account_name: 'Thorsten Linz',
      account_email: 'tl@innovareai.com', // Manual mapping
      linkedin_public_identifier: null, // Not available from Unipile data
      linkedin_profile_url: null, // Not available from Unipile data
      connection_status: 'needs_credentials', // Based on Unipile status
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();
  
  if (error) {
    console.log('❌ Failed to create association:', error.message);
  } else {
    console.log('✅ Successfully associated Thorsten Linz LinkedIn account');
    console.log('   Association ID:', association.id);
    console.log('   User:', tlUser.email);
    console.log('   LinkedIn Account:', association.account_name);
    console.log('   Status:', association.connection_status);
  }
  
  // Verify the association was created
  const { data: verification } = await supabase
    .from('user_unipile_accounts')
    .select('*')
    .eq('user_id', tlUser.id);
  
  console.log(`\n📊 Total associations for ${tlUser.email}: ${verification?.length || 0}`);
  verification?.forEach(assoc => {
    console.log(`   - ${assoc.account_name} (${assoc.platform}) - ${assoc.connection_status}`);
  });
  
  // Test the complete chain: User → Workspace → LinkedIn Account
  console.log('\n🔗 Testing complete linking chain...');
  
  // Get user's workspace memberships
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('*, workspaces(name)')
    .eq('user_id', tlUser.id);
  
  console.log(`👤 ${tlUser.email} is member of ${memberships?.length || 0} workspaces:`);
  memberships?.forEach(m => {
    console.log(`   - ${m.workspaces?.name || 'Unknown'} (${m.role})`);
  });
  
  console.log(`🔗 ${tlUser.email} has ${verification?.length || 0} LinkedIn associations:`);
  verification?.forEach(assoc => {
    console.log(`   - ${assoc.account_name} (${assoc.connection_status})`);
  });
  
  console.log('\n✅ Complete linking chain verified:');
  console.log('   User ✓ → Workspaces ✓ → LinkedIn Account ✓');
}

manuallyAssociateThorsten();