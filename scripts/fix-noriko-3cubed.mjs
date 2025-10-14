import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fix3cubed() {
  // Get all users
  const { data: { users } } = await supabase.auth.admin.listUsers();

  // Find Noriko
  const noriko = users.find(u => u.email && u.email.includes('ny@3cubed'));

  if (!noriko) {
    console.log('❌ Noriko not found in users');
    console.log('All 3cubed users:');
    users.filter(u => u.email && u.email.includes('3cubed')).forEach(u => {
      console.log('  -', u.email);
    });
    return;
  }

  console.log('✅ Found Noriko:', noriko.email, '(' + noriko.id + ')');

  // Get 3cubed workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
    .eq('tenant', '3cubed')
    .single();

  console.log('✅ Found workspace:', workspace.name, '(' + workspace.id + ')');

  // Check membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('user_id', noriko.id)
    .eq('workspace_id', workspace.id)
    .single();

  if (!membership) {
    console.log('❌ Not a member - adding now...');
    const { error } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspace.id,
        user_id: noriko.id,
        role: 'admin'
      });

    if (error) {
      console.log('❌ Error adding membership:', error.message);
    } else {
      console.log('✅ Added as admin');
    }
  } else {
    console.log('✅ Already member (role: ' + membership.role + ')');
  }

  // Update users table
  await supabase.from('users').upsert({
    id: noriko.id,
    email: noriko.email,
    current_workspace_id: workspace.id
  });

  // Check for LinkedIn account
  const { data: accounts } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('user_id', noriko.id);

  console.log('\nLinkedIn accounts:', accounts?.length || 0);

  if (accounts && accounts.length > 0) {
    accounts.forEach(a => {
      const { data: ws } = supabase
        .from('workspaces')
        .select('name')
        .eq('id', a.workspace_id)
        .single();
      console.log('  - ' + a.account_type + ': ' + (a.account_name || a.account_identifier));
      console.log('    Workspace:', a.workspace_id);
    });
  } else {
    console.log('  ❌ No accounts connected yet');
  }

  // Set temp password
  await supabase.auth.admin.updateUserById(noriko.id, {
    password: 'TempPass2024!',
    email_confirm: true
  });

  console.log('\n✅ ✅ ✅ NORIKO FIXED ✅ ✅ ✅');
  console.log('\n3cubed Workspace Admin:');
  console.log('   Email: ' + noriko.email);
  console.log('   Password: TempPass2024!');
  console.log('   URL: https://app.meet-sam.com/signin');
}

fix3cubed();
