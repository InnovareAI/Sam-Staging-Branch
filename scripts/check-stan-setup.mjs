#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkStanSetup() {
  console.log('🔍 Checking Stan Bournev setup...\n');

  // 1. Find Stan's user account
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, email, first_name, last_name, current_workspace_id')
    .or('email.ilike.%stan%,email.ilike.%bournev%,first_name.ilike.%stan%,last_name.ilike.%bournev%');

  if (userError) {
    console.error('❌ Error finding user:', userError);
    return;
  }

  if (!users || users.length === 0) {
    console.log('❌ No user found matching "Stan" or "Bournev"');
    return;
  }

  console.log('👤 User Found:');
  users.forEach(user => {
    console.log(`   - Email: ${user.email}`);
    console.log(`   - Name: ${user.first_name || ''} ${user.last_name || ''} `.trim() || 'Not set');
    console.log(`   - User ID: ${user.id}`);
    console.log(`   - Current Workspace ID: ${user.current_workspace_id || 'None'}\n`);
  });

  // 2. Check workspace memberships
  for (const user of users) {
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('workspace_id, role, workspaces(id, name, tenant)')
      .eq('user_id', user.id);

    console.log(`📁 Workspaces for ${user.email}:`);
    if (memberships && memberships.length > 0) {
      memberships.forEach(m => {
        console.log(`   - ${m.workspaces.name} (${m.role})`);
        console.log(`     Tenant: ${m.workspaces.tenant || 'None'}`);
        console.log(`     ID: ${m.workspace_id}`);
      });
    } else {
      console.log('   ❌ No workspaces found!');
    }
    console.log('');

    // 3. Check LinkedIn accounts for each workspace
    if (memberships && memberships.length > 0) {
      for (const membership of memberships) {
        const { data: linkedinAccounts } = await supabase
          .from('workspace_accounts')
          .select('*')
          .eq('workspace_id', membership.workspace_id)
          .eq('account_type', 'linkedin');

        console.log(`🔗 LinkedIn Accounts for ${membership.workspaces.name}:`);
        if (linkedinAccounts && linkedinAccounts.length > 0) {
          linkedinAccounts.forEach(acc => {
            console.log(`   - Account: ${acc.account_name || 'Unknown'}`);
            console.log(`     Status: ${acc.connection_status}`);
            console.log(`     Unipile ID: ${acc.unipile_account_id || 'None'}`);
            console.log(`     Connected: ${acc.connected_at || 'Never'}`);
          });
        } else {
          console.log('   ❌ NO LINKEDIN ACCOUNT CONNECTED!');
          console.log('   👉 This is why the search failed!');
        }
        console.log('');
      }
    }

    // 4. Check recent searches/campaigns
    const { data: searches } = await supabase
      .from('prospect_approval_sessions')
      .select('id, campaign_name, source, total_prospects, session_status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    console.log(`🔎 Recent Searches for ${user.email}:`);
    if (searches && searches.length > 0) {
      searches.forEach(s => {
        console.log(`   - ${s.campaign_name}`);
        console.log(`     Status: ${s.session_status}, Prospects: ${s.total_prospects}`);
        console.log(`     Created: ${new Date(s.created_at).toLocaleString()}`);

        // Check if using IAI shortcode (WRONG)
        if (s.campaign_name.includes('-IAI-')) {
          console.log('     ⚠️  WARNING: Using IAI shortcode (should use own company code!)');
        }
      });
    } else {
      console.log('   No searches found');
    }
    console.log('');
  }

  // 5. Recommendations
  console.log('📋 RECOMMENDATIONS:\n');
  for (const user of users) {
    const { data: linkedinCheck } = await supabase
      .from('workspace_accounts')
      .select('id')
      .in('workspace_id',
        (await supabase
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', user.id)
        ).data?.map(m => m.workspace_id) || []
      )
      .eq('account_type', 'linkedin');

    if (!linkedinCheck || linkedinCheck.length === 0) {
      console.log(`❌ ${user.email} needs to connect LinkedIn:`);
      console.log('   1. Go to: https://app.meet-sam.com/linkedin-integration');
      console.log('   2. Click "Connect LinkedIn Account"');
      console.log('   3. Authorize via Unipile');
      console.log('   4. Verify connection status\n');
    }
  }
}

checkStanSetup();
