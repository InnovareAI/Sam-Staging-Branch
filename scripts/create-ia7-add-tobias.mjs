#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TOBIAS_UNIPILE_ID = 'v8-RaHZzTD60o6EVwqcpvg';

console.log('\n🔍 Checking for IA7 workspace...\n');

// Check if IA7 exists
let { data: ia7 } = await supabase
  .from('workspaces')
  .select('id, name')
  .eq('name', 'IA7')
  .single();

if (!ia7) {
  console.log('IA7 not found. Creating it...\n');
  
  // Get a reference user from IA1 to copy structure
  const { data: ia1User } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', 'babdcab8-1a78-4b2f-913e-6e9fd9821009')
    .limit(1)
    .single();
  
  if (!ia1User) {
    console.error('❌ Could not find reference user');
    process.exit(1);
  }
  
  // Create IA7 workspace
  const { data: newWorkspace, error: wsError } = await supabase
    .from('workspaces')
    .insert([{
      name: 'IA7',
      slug: 'ia7'
    }])
    .select()
    .single();
  
  if (wsError) {
    console.error('❌ Error creating workspace:', wsError.message);
    process.exit(1);
  }
  
  ia7 = newWorkspace;
  console.log(`✅ Created IA7 workspace: ${ia7.id}\n`);
  
  // Add user as member
  await supabase
    .from('workspace_members')
    .insert([{
      workspace_id: ia7.id,
      user_id: ia1User.user_id,
      role: 'owner'
    }]);
  
  console.log('✅ Added workspace member\n');
} else {
  console.log(`✅ IA7 exists: ${ia7.id}\n`);
}

// Get a user from IA7 to use as account owner
const { data: members } = await supabase
  .from('workspace_members')
  .select('user_id')
  .eq('workspace_id', ia7.id)
  .limit(1);

if (!members || members.length === 0) {
  console.error('❌ No members in IA7');
  process.exit(1);
}

const userId = members[0].user_id;

// Add Tobias's account
console.log('➕ Adding Tobias Linz LinkedIn account to IA7...\n');

const { data: account, error } = await supabase
  .from('workspace_accounts')
  .insert([{
    workspace_id: ia7.id,
    user_id: userId,
    account_name: 'Tobias Linz',
    account_type: 'linkedin',
    unipile_account_id: TOBIAS_UNIPILE_ID,
    connection_status: 'connected'
  }])
  .select()
  .single();

if (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

console.log('✅ Tobias Linz added successfully!\n');
console.log(`   Workspace: IA7 (${ia7.id})`);
console.log(`   Account ID: ${account.id}`);
console.log(`   Unipile ID: ${TOBIAS_UNIPILE_ID}\n`);

console.log('🎯 Tobias Linz is ready to send campaigns!\n');
