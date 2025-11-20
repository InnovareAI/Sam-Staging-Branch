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
const IA5_ID = 'cd57981a-e63b-401c-bde1-ac71752c2293';

console.log('\n➕ Adding Tobias Linz to IA5...\n');

// Get user from IA5
const { data: members } = await supabase
  .from('workspace_members')
  .select('user_id')
  .eq('workspace_id', IA5_ID)
  .limit(1);

if (!members || members.length === 0) {
  console.error('❌ No members in IA5');
  process.exit(1);
}

const userId = members[0].user_id;

// Add Tobias
const { error } = await supabase
  .from('workspace_accounts')
  .insert([{
    workspace_id: IA5_ID,
    user_id: userId,
    account_name: 'Tobias Linz',
    account_type: 'linkedin',
    unipile_account_id: TOBIAS_UNIPILE_ID,
    connection_status: 'connected'
  }]);

if (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

console.log('✅ Tobias Linz added to IA5!\n');
console.log(`   Workspace: IA5`);
console.log(`   Unipile ID: ${TOBIAS_UNIPILE_ID}\n`);

console.log('🎯 Tobias is ready to send ONE test campaign!\n');
