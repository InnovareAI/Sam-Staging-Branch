#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function insertAccount() {
  console.log('📧 Inserting workspace_account directly via RPC...\n');

  // Use raw SQL via RPC
  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      INSERT INTO workspace_accounts (
        workspace_id,
        user_id,
        account_type,
        account_identifier,
        account_name,
        unipile_account_id,
        connection_status,
        is_active,
        account_metadata
      )
      VALUES (
        'babdcab8-1a78-4b2f-913e-6e9fd9821009',
        'f6885ff3-deef-4781-8721-93011c990b1b',
        'email',
        'tl@innovareai.com',
        'tl@innovareai.com',
        'nefy7jYjS5K6X3U7ORxHNQ',
        'connected',
        true,
        '{"provider": "GOOGLE_OAUTH", "unipile_instance": "innovareai-mkdqhc.unipile.com"}'::jsonb
      )
      ON CONFLICT (workspace_id, user_id, account_type, account_identifier)
      DO UPDATE SET
        connection_status = 'connected',
        is_active = true,
        updated_at = now()
      RETURNING *;
    `
  });

  if (error) {
    console.error('❌ Error:', error);
  } else {
    console.log('✅ Success:', data);
  }
}

insertAccount().catch(console.error);
