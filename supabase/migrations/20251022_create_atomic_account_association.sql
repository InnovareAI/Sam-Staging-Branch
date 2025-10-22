-- Create RPC function for atomic LinkedIn account association
-- This ensures both user_unipile_accounts and workspace_accounts are updated atomically
-- Prevents silent failures and table drift

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
Used by OAuth callback handlers to ensure data consistency.';
