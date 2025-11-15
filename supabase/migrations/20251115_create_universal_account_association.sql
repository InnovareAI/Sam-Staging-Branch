-- Create universal RPC function for account association (LinkedIn + Email)
-- Replaces LinkedIn-only function with universal handler
-- This ensures both user_unipile_accounts and workspace_accounts are updated atomically

CREATE OR REPLACE FUNCTION associate_account_atomic(
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
  v_account_type TEXT;
  v_platform TEXT;
  v_linkedin_account_type TEXT;
  v_unipile_type TEXT;
  v_account_identifier TEXT;
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

  -- Detect account type from Unipile data
  v_unipile_type := UPPER(COALESCE(p_account_data->>'type', ''));

  -- Map Unipile type to our account_type and platform
  IF v_unipile_type = 'LINKEDIN' THEN
    v_account_type := 'linkedin';
    v_platform := 'LINKEDIN';
  ELSIF v_unipile_type LIKE '%GOOGLE%' OR v_unipile_type LIKE '%GMAIL%' THEN
    v_account_type := 'email';
    v_platform := 'GOOGLE';
  ELSIF v_unipile_type LIKE '%OUTLOOK%' OR v_unipile_type LIKE '%MICROSOFT%' OR v_unipile_type LIKE '%OFFICE365%' THEN
    v_account_type := 'email';
    v_platform := 'OUTLOOK';
  ELSIF v_unipile_type = 'MESSAGING' OR v_unipile_type = 'SMTP' THEN
    v_account_type := 'email';
    v_platform := 'SMTP';
  ELSE
    -- Default to email for unknown types
    v_account_type := 'email';
    v_platform := v_unipile_type;
  END IF;

  -- Extract account details from JSON
  v_account_name := COALESCE(
    p_account_data->>'name',
    p_account_data->>'display_name',
    p_account_data->'connection_params'->'im'->>'email',
    p_account_data->'connection_params'->>'email',
    p_account_data->>'email',
    'Account'
  );

  v_account_email := COALESCE(
    p_account_data->'connection_params'->'im'->>'email',
    p_account_data->'connection_params'->>'email',
    p_account_data->>'email',
    p_account_data->>'identifier'
  );

  -- Account identifier (email or LinkedIn URL)
  v_account_identifier := COALESCE(v_account_email, p_unipile_account_id);

  -- LinkedIn-specific type
  v_linkedin_account_type := CASE
    WHEN v_account_type = 'linkedin' THEN COALESCE(p_account_data->>'account_type', 'personal')
    ELSE NULL
  END;

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
    v_platform,
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
    v_account_type,
    v_account_identifier,
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
    'account_type', v_account_type,
    'platform', v_platform,
    'account_name', v_account_name,
    'message', format('%s account associated successfully with both user and workspace', UPPER(v_account_type))
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Automatic rollback on ANY error
    RAISE EXCEPTION 'Failed to associate account: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION associate_account_atomic TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION associate_account_atomic IS
'Atomically associates a Unipile account (LinkedIn or Email) with both user_unipile_accounts and workspace_accounts tables.
Supports LinkedIn, Google, Outlook, and SMTP accounts.
Prevents silent failures and table drift by ensuring both operations succeed or both fail.
Used by OAuth callback handlers to ensure data consistency.';
