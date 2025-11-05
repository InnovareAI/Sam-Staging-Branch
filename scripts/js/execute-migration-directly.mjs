import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

console.log('🔧 Creating associate_linkedin_account_atomic function...\n');

// Instead of reading the file, let's just execute the SQL directly
// The Supabase client doesn't support raw SQL execution for DDL statements
// So we'll provide instructions for manual application

const migrationSQL = `-- Create RPC function for atomic LinkedIn account association
CREATE OR REPLACE FUNCTION associate_linkedin_account_atomic(
  p_user_id UUID,
  p_workspace_id UUID,
  p_unipile_account_id TEXT,
  p_account_data JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_account_name TEXT;
  v_account_email TEXT;
  v_linkedin_account_type TEXT;
BEGIN
  -- Validate required inputs
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'workspace_id cannot be null - account connections require workspace context';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id cannot be null';
  END IF;

  IF p_unipile_account_id IS NULL OR p_unipile_account_id = '' THEN
    RAISE EXCEPTION 'unipile_account_id cannot be null or empty';
  END IF;

  -- Extract account details from JSON
  v_account_name := COALESCE(
    p_account_data->>'name',
    p_account_data->>'display_name',
    p_account_data->>'email',
    'LinkedIn Account'
  );

  v_account_email := COALESCE(
    p_account_data->'connection_params'->'im'->>'email',
    p_account_data->>'email',
    p_account_data->>'identifier'
  );

  v_linkedin_account_type := COALESCE(
    p_account_data->>'account_type',
    'personal'
  );

  -- ATOMIC OPERATION: Insert/update both tables in single transaction

  -- 1. Insert into user_unipile_accounts (user's personal account list)
  INSERT INTO user_unipile_accounts (
    user_id,
    unipile_account_id,
    platform,
    account_name,
    account_email,
    linkedin_account_type,
    connection_status,
    account_metadata,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_unipile_account_id,
    'LINKEDIN',
    v_account_name,
    v_account_email,
    v_linkedin_account_type,
    'active',
    p_account_data,
    NOW(),
    NOW()
  )
  ON CONFLICT (unipile_account_id) DO UPDATE SET
    connection_status = 'active',
    account_name = EXCLUDED.account_name,
    account_email = EXCLUDED.account_email,
    linkedin_account_type = EXCLUDED.linkedin_account_type,
    account_metadata = EXCLUDED.account_metadata,
    updated_at = NOW();

  -- 2. Insert into workspace_accounts (workspace's accessible accounts for campaigns)
  INSERT INTO workspace_accounts (
    workspace_id,
    user_id,
    account_type,
    account_identifier,
    account_name,
    unipile_account_id,
    connection_status,
    connected_at,
    is_active,
    account_metadata,
    created_at,
    updated_at
  ) VALUES (
    p_workspace_id,
    p_user_id,
    'linkedin',
    COALESCE(v_account_email, p_unipile_account_id),
    v_account_name,
    p_unipile_account_id,
    'connected',
    NOW(),
    TRUE,
    p_account_data,
    NOW(),
    NOW()
  )
  ON CONFLICT (workspace_id, user_id, account_type, account_identifier) DO UPDATE SET
    unipile_account_id = EXCLUDED.unipile_account_id,
    connection_status = 'connected',
    connected_at = NOW(),
    is_active = TRUE,
    account_name = EXCLUDED.account_name,
    account_metadata = EXCLUDED.account_metadata,
    updated_at = NOW();

  -- Return success result
  RETURN jsonb_build_object(
    'success', TRUE,
    'user_id', p_user_id,
    'workspace_id', p_workspace_id,
    'unipile_account_id', p_unipile_account_id,
    'account_name', v_account_name,
    'message', 'LinkedIn account associated successfully with both user and workspace'
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Automatic rollback on ANY error
    RAISE EXCEPTION 'Failed to associate LinkedIn account: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION associate_linkedin_account_atomic TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION associate_linkedin_account_atomic IS
'Atomically associates a LinkedIn account with both user_unipile_accounts and workspace_accounts tables.
Prevents silent failures and table drift by ensuring both operations succeed or both fail.
Used by OAuth callback handlers to ensure data consistency.';`;

console.log('📋 SQL to execute:\n');
console.log('─'.repeat(80));
console.log(migrationSQL);
console.log('─'.repeat(80));
console.log('\n⚠️  The Supabase JS client cannot execute DDL statements (CREATE FUNCTION).\n');
console.log('📋 TO APPLY THIS MIGRATION:\n');
console.log('Option 1: Supabase Dashboard (EASIEST)');
console.log('  1. Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql/new');
console.log('  2. Copy the SQL above (or from supabase/migrations/20251022_create_atomic_account_association.sql)');
console.log('  3. Paste into SQL editor');
console.log('  4. Click "Run"\n');

console.log('Option 2: Save to file and provide download link');
console.log('  The SQL is saved in: supabase/migrations/20251022_create_atomic_account_association.sql\n');

console.log('✅ Once applied, run: node scripts/js/verify-reconnection-migration.mjs');
