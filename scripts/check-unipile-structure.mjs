#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read environment
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const SUPABASE_URL = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const SERVICE_ROLE_KEY = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkStructure() {
  console.log('\n🔍 CHECKING UNIPILE & DATABASE STRUCTURE\n');
  console.log('='.repeat(70) + '\n');

  // Check 1: Current workspace_accounts schema
  console.log('📊 PART 1: workspace_accounts current schema\n');
  try {
    const { data, error } = await supabase
      .from('workspace_accounts')
      .select('*')
      .limit(3);

    if (error) {
      console.log('❌ Error:', error.message);
    } else {
      console.log(`✅ Found ${data?.length || 0} records\n`);
      if (data && data.length > 0) {
        console.log('Sample record structure:');
        console.log(JSON.stringify(data[0], null, 2));
        console.log('\nworkspace_id analysis:');
        console.log(`  Value: ${data[0].workspace_id}`);
        console.log(`  Type: ${typeof data[0].workspace_id}`);
        console.log(`  Is UUID format: ${/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data[0].workspace_id)}`);
      }
    }
  } catch (err) {
    console.log('❌ Error:', err.message);
  }

  console.log('\n' + '='.repeat(70) + '\n');

  // Check 2: Current user_unipile_accounts schema
  console.log('📊 PART 2: user_unipile_accounts current schema\n');
  try {
    const { data, error } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .limit(3);

    if (error) {
      console.log('❌ Error:', error.message);
    } else {
      console.log(`✅ Found ${data?.length || 0} records\n`);
      if (data && data.length > 0) {
        console.log('Sample record structure:');
        console.log(JSON.stringify(data[0], null, 2));
        console.log('\nFields present:');
        console.log(`  - Has workspace_id: ${'workspace_id' in data[0]}`);
        console.log(`  - unipile_account_id type: ${typeof data[0].unipile_account_id}`);
        console.log(`  - user_id type: ${typeof data[0].user_id}`);
      }
    }
  } catch (err) {
    console.log('❌ Error:', err.message);
  }

  console.log('\n' + '='.repeat(70) + '\n');

  // Check 3: Workspaces table to understand workspace_id format
  console.log('📊 PART 3: workspaces table ID format\n');
  try {
    const { data, error } = await supabase
      .from('workspaces')
      .select('id, name, slug')
      .limit(3);

    if (error) {
      console.log('❌ Error:', error.message);
    } else {
      console.log(`✅ Found ${data?.length || 0} workspaces\n`);
      if (data && data.length > 0) {
        data.forEach((ws, i) => {
          console.log(`Workspace ${i + 1}:`);
          console.log(`  ID: ${ws.id}`);
          console.log(`  Type: ${typeof ws.id}`);
          console.log(`  Is UUID: ${/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ws.id)}`);
          console.log(`  Name: ${ws.name}`);
          console.log('');
        });
      }
    }
  } catch (err) {
    console.log('❌ Error:', err.message);
  }

  console.log('='.repeat(70) + '\n');

  // Check 4: Check for type mismatches
  console.log('⚠️  PART 4: Checking for type mismatches\n');
  try {
    const { data: wsAccounts } = await supabase
      .from('workspace_accounts')
      .select('workspace_id, id')
      .limit(10);

    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id')
      .limit(10);

    if (wsAccounts && workspaces) {
      console.log('Checking if workspace_accounts.workspace_id can join to workspaces.id:\n');

      const wsAccountIds = wsAccounts.map(a => a.workspace_id);
      const workspaceIds = workspaces.map(w => w.id);

      console.log(`workspace_accounts.workspace_id samples: ${wsAccountIds.slice(0, 3).join(', ')}`);
      console.log(`workspaces.id samples: ${workspaceIds.slice(0, 3).join(', ')}`);

      const typeMatch = typeof wsAccountIds[0] === typeof workspaceIds[0];
      console.log(`\nType match: ${typeMatch ? '✅ YES' : '❌ NO'}`);
      console.log(`  workspace_accounts.workspace_id type: ${typeof wsAccountIds[0]}`);
      console.log(`  workspaces.id type: ${typeof workspaceIds[0]}`);
    }
  } catch (err) {
    console.log('❌ Error:', err.message);
  }

  console.log('\n' + '='.repeat(70) + '\n');

  // Check 5: Unipile account ID format from actual data
  console.log('📊 PART 5: Unipile account ID format from database\n');
  try {
    const { data, error } = await supabase
      .from('user_unipile_accounts')
      .select('unipile_account_id, platform')
      .limit(5);

    if (error) {
      console.log('❌ Error:', error.message);
    } else {
      console.log(`✅ Found ${data?.length || 0} Unipile accounts\n`);
      if (data && data.length > 0) {
        data.forEach((acc, i) => {
          console.log(`Account ${i + 1}:`);
          console.log(`  unipile_account_id: ${acc.unipile_account_id}`);
          console.log(`  Platform: ${acc.platform}`);
          console.log(`  ID format: ${acc.unipile_account_id?.startsWith('acc_') ? 'Unipile format (acc_...)' : 'Unknown'}`);
          console.log('');
        });
      }
    }
  } catch (err) {
    console.log('❌ Error:', err.message);
  }

  console.log('='.repeat(70) + '\n');
}

checkStructure().catch(console.error);
