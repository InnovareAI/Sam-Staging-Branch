/**
 * SIMPLE USER CHECK
 * =================
 * Check current user status and authentication setup
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUsers() {
  console.log('🔍 Checking current user status...');
  
  try {
    // Get all auth users
    const { data: authData } = await supabase.auth.admin.listUsers();
    console.log(`\n👥 Found ${authData.users.length} auth users:`);
    
    authData.users.forEach((user, i) => {
      console.log(`${i+1}. ${user.email} (${user.id})`);
      console.log(`   Created: ${user.created_at}`);
      console.log(`   Confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`);
      console.log(`   Role: ${user.role || 'None'}`);
      if (user.user_metadata?.first_name) {
        console.log(`   Name: ${user.user_metadata.first_name} ${user.user_metadata.last_name}`);
      }
      console.log('');
    });

    // Check organizations
    const { data: orgs } = await supabase.from('organizations').select('*');
    console.log(`🏢 Found ${orgs?.length || 0} organizations:`);
    orgs?.forEach(org => {
      console.log(`- ${org.name} (${org.slug})`);
    });

    // Check workspaces
    const { data: workspaces } = await supabase.from('workspaces').select('*');
    console.log(`\n🏗️ Found ${workspaces?.length || 0} workspaces:`);
    workspaces?.forEach(ws => {
      console.log(`- ${ws.name} (Org: ${ws.organization_id})`);
    });

    // Check workspace memberships
    const { data: memberships } = await supabase.from('workspace_members').select('*');
    console.log(`\n👔 Found ${memberships?.length || 0} workspace memberships:`);
    memberships?.forEach(m => {
      const user = authData.users.find(u => u.id === m.user_id);
      const workspace = workspaces?.find(w => w.id === m.workspace_id);
      console.log(`- ${user?.email || 'Unknown'} → ${workspace?.name || 'Unknown'} (${m.role})`);
    });

    console.log('\n✅ User check completed');

  } catch (error) {
    console.error('❌ User check failed:', error);
  }
}

checkUsers();