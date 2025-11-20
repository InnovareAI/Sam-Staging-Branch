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
let { data: workspaces } = await supabase
  .from('workspaces')
  .select('id, name')
  .eq('name', 'IA7');

let ia7;
if (!workspaces || workspaces.length === 0) {
  console.log('IA7 not found. Creating it...\n');
  
  // Get reference user from IA1
  const { data: refMembers } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', 'babdcab8-1a78-4b2f-913e-6e9fd9821009')
    .limit(1);
  
  if (!refMembers || refMembers.length === 0) {
    console.error('❌ Could not find reference user');
    process.exit(1);
  }
  
  const userId = refMembers[0].user_id;
  
  // Create IA7 workspace
  const { data: newWs, error: wsError } = await supabase
    .from('workspaces')
    .insert([{
      name: 'IA7',
      slug: 'ia7'
    }])
    .select();
  
  if (wsError) {
    console.error('❌ Error creating workspace:', wsError.message);
    process.exit(1);
  }
  
  ia7 = newWs[0];
  console.log(`✅ Created IA7: ${ia7.id}\n`);
  
  // Add member
  await supabase
    .from('workspace_members')
    .insert([{
      workspace_id: ia7.id,
      user_id: userId,
      role: 'owner'
    }]);
  
  console.log('✅ Added workspace owner\n');
} else {
  ia7 = workspaces[0];
  console.log(`✅ IA7 exists: ${ia7.id}\n`);
}

// Get user from IA7
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

// Check if Tobias already exists
const { data: existing } = await supabase
  .from('workspace_accounts')
  .select('id')
  .eq('unipile_account_id', TOBIAS_UNIPILE_ID);

if (existing && existing.length > 0) {
  console.log('⚠️  Tobias account already exists\n');
  process.exit(0);
}

// Add Tobias
console.log('➕ Adding Tobias Linz to IA7...\n');

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
  .select();

if (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

console.log('✅ Tobias Linz added to IA7!\n');
console.log(`   Workspace: IA7 (${ia7.id})`);
console.log(`   Account ID: ${account[0].id}`);
console.log(`   Unipile ID: ${TOBIAS_UNIPILE_ID}\n`);

console.log('🎯 Ready to send test campaign from Tobias!\n');
