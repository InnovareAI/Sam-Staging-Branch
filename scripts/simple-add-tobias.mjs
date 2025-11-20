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

console.log('\n➕ Creating IA7 workspace...\n');

// Get reference user
const { data: refUser } = await supabase
  .from('workspace_members')
  .select('user_id')
  .eq('workspace_id', 'babdcab8-1a78-4b2f-913e-6e9fd9821009')
  .limit(1);

if (!refUser || refUser.length === 0) {
  console.error('❌ No reference user found');
  process.exit(1);
}

const userId = refUser[0].user_id;
const ia7Id = randomUUID();

// Create workspace
const { error: wsError } = await supabase
  .from('workspaces')
  .insert([{
    id: ia7Id,
    name: 'IA7',
    slug: 'ia7'
  }]);

if (wsError) {
  console.error('❌ Workspace error:', wsError.message);
  process.exit(1);
}

console.log(`✅ Created IA7: ${ia7Id}\n`);

// Add member
await supabase
  .from('workspace_members')
  .insert([{
    workspace_id: ia7Id,
    user_id: userId,
    role: 'owner'
  }]);

console.log('✅ Added workspace member\n');

// Add Tobias account
console.log('➕ Adding Tobias Linz account...\n');

const { error: accError } = await supabase
  .from('workspace_accounts')
  .insert([{
    workspace_id: ia7Id,
    user_id: userId,
    account_name: 'Tobias Linz',
    account_type: 'linkedin',
    unipile_account_id: TOBIAS_UNIPILE_ID,
    connection_status: 'connected'
  }]);

if (accError) {
  console.error('❌ Account error:', accError.message);
  process.exit(1);
}

console.log('✅ Tobias Linz added to IA7!\n');
console.log(`   Workspace ID: ${ia7Id}`);
console.log(`   Unipile ID: ${TOBIAS_UNIPILE_ID}\n`);

console.log('🎯 Ready to send ONE test campaign from Tobias!\n');
