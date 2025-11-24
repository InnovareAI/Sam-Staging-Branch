#!/usr/bin/env node

/**
 * Setup workspace_accounts for IA1 with Thorsten's LinkedIn
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009'; // IA1
const unipileAccountId = 'mERQmojtSZq5GeomZZazlw'; // Thorsten
const unipileDsn = 'api6.unipile.com:13670';
const unipileApiKey = '85ZMr7iE.Pw5mVHOgvpPXOl47GXXXoW0uLPvOUK23bWXD+hHuziA=';

async function setupWorkspaceAccount() {
  try {
    console.log('🔍 Checking existing workspace_accounts...\n');

    // Check if exists
    const { data: existing, error: checkError } = await supabase
      .from('workspace_accounts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('account_type', 'linkedin')
      .maybeSingle();

    if (checkError) {
      console.error('❌ Error checking:', checkError.message);
      process.exit(1);
    }

    if (existing) {
      console.log('✅ workspace_accounts record already exists:');
      console.log(JSON.stringify(existing, null, 2));
      console.log('\n🔄 Updating with correct values...');

      const { data: updated, error: updateError } = await supabase
        .from('workspace_accounts')
        .update({
          unipile_account_id: unipileAccountId,
          connection_status: 'connected',
          last_verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Update failed:', updateError.message);
        process.exit(1);
      }

      console.log('✅ Updated successfully:');
      console.log(JSON.stringify(updated, null, 2));
    } else {
      console.log('⚠️  No workspace_accounts record found. Creating...');

      const { data: created, error: createError } = await supabase
        .from('workspace_accounts')
        .insert({
          workspace_id: workspaceId,
          provider: 'linkedin',
          unipile_account_id: unipileAccountId,
          unipile_dsn: unipileDsn,
          unipile_api_key: unipileApiKey,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Create failed:', createError.message);
        process.exit(1);
      }

      console.log('✅ Created successfully:');
      console.log(JSON.stringify(created, null, 2));
    }

    console.log('\n🎉 Workspace IA1 is now configured with Thorsten\'s LinkedIn account!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

setupWorkspaceAccount();
