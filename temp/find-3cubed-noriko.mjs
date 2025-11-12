#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

console.log('🔍 Finding 3cubed workspace and Noriko Yokoi\n');

// Find 3cubed workspace
const { data: workspaces } = await supabase
  .from('workspaces')
  .select('*')
  .ilike('name', '%3cubed%');

console.log('Workspaces matching "3cubed":');
if (workspaces && workspaces.length > 0) {
  workspaces.forEach(ws => {
    console.log(`\n📊 Workspace: ${ws.name}`);
    console.log(`   ID: ${ws.id}`);
    console.log(`   Created: ${ws.created_at}`);
  });
} else {
  console.log('   None found');
}

// Find Noriko Yokoi user
console.log('\n\nSearching for Noriko Yokoi in auth users...');
const { data: authData } = await supabase.auth.admin.listUsers();
const norikoUsers = authData.users.filter(u =>
  u.email?.toLowerCase().includes('noriko') ||
  u.email?.toLowerCase().includes('yokoi') ||
  u.user_metadata?.full_name?.toLowerCase().includes('noriko') ||
  u.user_metadata?.full_name?.toLowerCase().includes('yokoi')
);

console.log('\nUsers matching "Noriko" or "Yokoi":');
if (norikoUsers.length > 0) {
  norikoUsers.forEach(user => {
    console.log(`\n👤 User: ${user.email}`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Created: ${user.created_at}`);
    console.log(`   Name: ${user.user_metadata?.full_name || 'N/A'}`);
  });
} else {
  console.log('   None found');
}

// Check for workspace memberships
if (norikoUsers.length > 0) {
  console.log('\n\nChecking workspace memberships...');
  for (const user of norikoUsers) {
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('*, workspaces(name)')
      .eq('user_id', user.id);

    console.log(`\n${user.email} is member of:`);
    if (memberships && memberships.length > 0) {
      memberships.forEach(m => {
        console.log(`   - ${m.workspaces.name} (role: ${m.role})`);
      });
    } else {
      console.log('   No workspace memberships');
    }
  }
}

console.log('\n');
