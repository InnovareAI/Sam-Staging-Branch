#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TOBIAS_UNIPILE_ID = 'v8-RaHZzTD60o6EVwqcpvg';
const IA7_ID = randomUUID();

console.log('\n🔨 Creating IA7 workspace via RPC...\n');

// Get reference user from IA1
const { data: refUser } = await supabase
  .from('workspace_members')
  .select('user_id')
  .eq('workspace_id', 'babdcab8-1a78-4b2f-913e-6e9fd9821009')
  .limit(1)
  .single();

if (!refUser) {
  console.error('❌ No reference user');
  process.exit(1);
}

const userId = refUser.user_id;
console.log(`Using user: ${userId}\n`);

// Try direct SQL insert via RPC or use admin mode
console.log('Creating workspace IA7...\n');

const { data: ws, error: wsErr } = await supabase.rpc('create_workspace', {
  p_name: 'IA7',
  p_slug: 'ia7',
  p_user_id: userId
});

if (wsErr) {
  console.log('RPC failed, trying direct insert...\n');
  
  // Try direct insert
  const { error: insertErr } = await supabase
    .from('workspaces')
    .insert([{
      id: IA7_ID,
      name: 'IA7',
      slug: 'ia7',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }]);
  
  if (insertErr) {
    console.error('❌ Insert failed:', insertErr.message);
    console.log('\nManual steps needed:');
    console.log('1. Go to Supabase dashboard');
    console.log('2. Run this SQL:');
    console.log(`
INSERT INTO workspaces (id, name, slug)
VALUES ('${IA7_ID}', 'IA7', 'ia7');

INSERT INTO workspace_members (workspace_id, user_id, role)
VALUES ('${IA7_ID}', '${userId}', 'owner');

INSERT INTO workspace_accounts (
  workspace_id, user_id, account_type, account_identifier, 
  account_name, unipile_account_id, connection_status, 
  is_active, account_metadata, capabilities, limitations,
  daily_message_limit, messages_sent_today
) VALUES (
  '${IA7_ID}', '${userId}', 'linkedin', 'Tobias Linz',
  'Tobias Linz', '${TOBIAS_UNIPILE_ID}', 'connected',
  true, '{}', '{}', '{}', 20, 0
);
    `);
    process.exit(1);
  }
  
  // Add member
  await supabase
    .from('workspace_members')
    .insert([{
      workspace_id: IA7_ID,
      user_id: userId,
      role: 'owner'
    }]);
  
  console.log(`✅ IA7 created: ${IA7_ID}\n`);
}

// Add Tobias account
console.log('Adding Tobias Linz account...\n');

const { error: accErr } = await supabase
  .from('workspace_accounts')
  .insert([{
    workspace_id: ws?.workspace_id || IA7_ID,
    user_id: userId,
    account_type: 'linkedin',
    account_identifier: 'Tobias Linz',
    account_name: 'Tobias Linz',
    unipile_account_id: TOBIAS_UNIPILE_ID,
    connection_status: 'connected',
    is_active: true,
    account_metadata: {},
    capabilities: {},
    limitations: {},
    daily_message_limit: 20,
    messages_sent_today: 0
  }]);

if (accErr) {
  console.error('❌ Account error:', accErr.message);
  process.exit(1);
}

console.log('✅ Tobias Linz added to IA7!\n');
console.log(`   Workspace ID: ${ws?.workspace_id || IA7_ID}`);
console.log(`   Unipile ID: ${TOBIAS_UNIPILE_ID}\n`);

console.log('🎯 Ready to send ONE test from Tobias!\n');
