// Script to pull registered users from Supabase
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://latxadqrvrrrcvkktrog.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function getUsers() {
  console.log('🔍 Fetching registered users from Supabase...\n');
  
  try {
    // 1. Get users from auth.users (Supabase Auth)
    console.log('📋 Users from Supabase Auth:');
    console.log('─'.repeat(80));
    
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error fetching auth users:', authError);
    } else {
      console.log(`Found ${authUsers.users.length} users in auth.users table:\n`);
      
      authUsers.users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Created: ${new Date(user.created_at).toLocaleDateString()}`);
        console.log(`   Last Sign In: ${user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : 'Never'}`);
        console.log(`   Email Confirmed: ${user.email_confirmed_at ? '✅ Yes' : '❌ No'}`);
        console.log(`   Name: ${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || 'Not provided');
        console.log('');
      });
    }
    
    // 2. Get users from public.users table (if exists)
    console.log('\n📊 Users from public.users table:');
    console.log('─'.repeat(80));
    
    const { data: publicUsers, error: publicError } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (publicError) {
      console.error('❌ Error fetching public users:', publicError);
    } else {
      console.log(`Found ${publicUsers.length} users in public.users table:\n`);
      
      publicUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Created: ${new Date(user.created_at).toLocaleDateString()}`);
        console.log(`   Name: ${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Not provided');
        console.log(`   Workspace: ${user.default_workspace_id || 'None assigned'}`);
        console.log('');
      });
    }
    
    // 3. Get workspace information
    console.log('\n🏢 Workspaces:');
    console.log('─'.repeat(80));
    
    const { data: workspaces, error: workspaceError } = await supabase
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (workspaceError) {
      console.error('❌ Error fetching workspaces:', workspaceError);
    } else {
      console.log(`Found ${workspaces.length} workspaces:\n`);
      
      workspaces.forEach((workspace, index) => {
        console.log(`${index + 1}. ${workspace.name}`);
        console.log(`   ID: ${workspace.id}`);
        console.log(`   Created: ${new Date(workspace.created_at).toLocaleDateString()}`);
        console.log('');
      });
    }
    
    // 4. Get workspace members
    console.log('\n👥 Workspace Members:');
    console.log('─'.repeat(80));
    
    const { data: members, error: membersError } = await supabase
      .from('workspace_members')
      .select(`
        *,
        users!inner(email, first_name, last_name),
        workspaces!inner(name)
      `)
      .order('created_at', { ascending: false });
    
    if (membersError) {
      console.error('❌ Error fetching workspace members:', membersError);
    } else {
      console.log(`Found ${members.length} workspace memberships:\n`);
      
      members.forEach((member, index) => {
        console.log(`${index + 1}. ${member.users.email} → ${member.workspaces.name}`);
        console.log(`   Role: ${member.role}`);
        console.log(`   Joined: ${new Date(member.created_at).toLocaleDateString()}`);
        console.log('');
      });
    }
    
    // 5. Summary
    console.log('\n📈 Summary:');
    console.log('─'.repeat(80));
    console.log(`Total Auth Users: ${authUsers?.users.length || 0}`);
    console.log(`Total Profile Users: ${publicUsers?.length || 0}`);
    console.log(`Total Workspaces: ${workspaces?.length || 0}`);
    console.log(`Total Memberships: ${members?.length || 0}`);
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

getUsers();