#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

console.log('🔍 Finding Charissa\n');

// Search users
const { data: users } = await supabase
  .from('users')
  .select('id, email, full_name')
  .or('email.ilike.%charissa%,full_name.ilike.%charissa%');

console.log(`Users matching "Charissa" (${users?.length || 0}):\n`);
users?.forEach(u => {
  console.log(`  - ${u.full_name || u.email}`);
  console.log(`    Email: ${u.email}`);
  console.log(`    ID: ${u.id}\n`);
});

if (users && users.length > 0) {
  const userId = users[0].id;
  
  // Get their workspace memberships
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(id, name)')
    .eq('user_id', userId);
  
  console.log(`Workspaces (${memberships?.length || 0}):\n`);
  memberships?.forEach(m => {
    console.log(`  - ${m.workspaces.name}`);
    console.log(`    ID: ${m.workspaces.id}`);
    console.log(`    Role: ${m.role}\n`);
  });
}

// Also check if there's a Unipile account
console.log('Checking Unipile for Charissa Saniel...\n');

const response = await fetch(`https://${process.env.UNIPILE_DSN}/api/v1/accounts`, {
  headers: { 'X-API-KEY': process.env.UNIPILE_API_KEY }
});

if (response.ok) {
  const accounts = await response.json();
  const charissaAccount = accounts.items?.find(a => a.name?.includes('Charissa'));
  
  if (charissaAccount) {
    console.log('✅ Found Charissa in Unipile:');
    console.log(`   ID: ${charissaAccount.id}`);
    console.log(`   Name: ${charissaAccount.name}`);
  }
}
