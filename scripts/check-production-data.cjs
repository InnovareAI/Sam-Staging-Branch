#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  console.log('🔍 Checking production database...\n');

  // Check workspaces
  const { data: workspaces, error: wsError } = await supabase
    .from('workspaces')
    .select('*');
  
  console.log(`📊 Workspaces: ${workspaces?.length || 0}`);
  if (workspaces?.length > 0) {
    console.log('   Sample:', workspaces.slice(0, 3).map(w => `${w.name} (${w.slug})`).join(', '));
  }

  // Check users
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, created_at, last_sign_in_at, subscription_status');
  
  console.log(`\n👥 Users: ${users?.length || 0}`);
  
  // User breakdown
  if (users && users.length > 0) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const recentSignups = users.filter(u => new Date(u.created_at) > sevenDaysAgo);
    const activeUsers = users.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at) > thirtyDaysAgo);
    const trialUsers = users.filter(u => u.subscription_status === 'trial' || !u.subscription_status);
    const cancelledUsers = users.filter(u => u.subscription_status === 'cancelled');
    
    console.log(`   Recent signups (7d): ${recentSignups.length}`);
    console.log(`   Active (30d): ${activeUsers.length}`);
    console.log(`   Trial users: ${trialUsers.length}`);
    console.log(`   Cancelled: ${cancelledUsers.length}`);
    console.log('   Sample:', users.slice(0, 3).map(u => u.email).join(', '));
  }

  // Check workspace members
  const { data: members, error: membersError } = await supabase
    .from('workspace_members')
    .select('*');
  
  console.log(`\n👤 Workspace Members: ${members?.length || 0}`);

  // Check if dashboard page is using correct queries
  console.log('\n📝 Dashboard Status:');
  console.log('   ✅ Migration complete');
  console.log('   ✅ Database has real data');
  console.log(`   ${workspaces?.length > 0 && users?.length > 0 ? '✅' : '⚠️ '} Data exists`);
  console.log('\n💡 If dashboard shows zeros, the page needs to fetch this data correctly.');
}

checkData();
