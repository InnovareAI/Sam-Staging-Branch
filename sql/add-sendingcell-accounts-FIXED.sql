-- Add SendingCell email accounts to workspace_accounts
-- FIXED VERSION - correct unique constraint

-- First check what workspace and users exist
SELECT 'Workspaces:' as info, id::text as id, name FROM workspaces WHERE name ILIKE '%sendingcell%'
UNION ALL
SELECT 'Users:' as info, id::text, email FROM auth.users WHERE email LIKE '%sendingcell.com%';

-- Get workspace ID
DO $$
DECLARE
  v_workspace_id UUID;
  v_cathy_user_id UUID;
  v_dave_user_id UUID;
BEGIN
  -- Get SendingCell workspace (cast to UUID for compatibility)
  SELECT id::uuid INTO v_workspace_id FROM workspaces WHERE name ILIKE '%sendingcell%' LIMIT 1;

  IF v_workspace_id IS NULL THEN
    RAISE NOTICE 'ERROR: SendingCell workspace not found!';
    RETURN;
  END IF;

  RAISE NOTICE 'Workspace ID: %', v_workspace_id;

  -- Get Cathy user
  SELECT id INTO v_cathy_user_id FROM auth.users WHERE email = 'cathy.smith@sendingcell.com';

  -- Get Dave user
  SELECT id INTO v_dave_user_id FROM auth.users WHERE email = 'dave.stuteville@sendingcell.com';

  -- Insert Cathy's account
  IF v_cathy_user_id IS NOT NULL THEN
    INSERT INTO workspace_accounts (
      workspace_id,
      user_id,
      account_type,
      account_identifier,
      account_name,
      connection_status,
      is_active,
      account_metadata
    ) VALUES (
      v_workspace_id,
      v_cathy_user_id,
      'email',
      'cathy.smith@sendingcell.com',
      'Cathy Smith',
      'pending',
      true,
      jsonb_build_object(
        'provider', 'google',
        'manually_added', true,
        'added_by', 'admin',
        'added_at', NOW(),
        'reason', 'OAuth callback failure - manually recovered'
      )
    ) ON CONFLICT (workspace_id, account_type, account_identifier) DO UPDATE
    SET
      connection_status = 'pending',
      account_metadata = workspace_accounts.account_metadata || jsonb_build_object('manually_added', true, 'updated_at', NOW());

    RAISE NOTICE 'Added Cathy Smith account';
  ELSE
    RAISE NOTICE 'WARNING: Cathy user not found!';
  END IF;

  -- Insert Dave's account
  IF v_dave_user_id IS NOT NULL THEN
    INSERT INTO workspace_accounts (
      workspace_id,
      user_id,
      account_type,
      account_identifier,
      account_name,
      connection_status,
      is_active,
      account_metadata
    ) VALUES (
      v_workspace_id,
      v_dave_user_id,
      'email',
      'dave.stuteville@sendingcell.com',
      'Dave Stuteville',
      'pending',
      true,
      jsonb_build_object(
        'provider', 'google',
        'manually_added', true,
        'added_by', 'admin',
        'added_at', NOW(),
        'reason', 'OAuth callback failure - manually recovered'
      )
    ) ON CONFLICT (workspace_id, account_type, account_identifier) DO UPDATE
    SET
      connection_status = 'pending',
      account_metadata = workspace_accounts.account_metadata || jsonb_build_object('manually_added', true, 'updated_at', NOW());

    RAISE NOTICE 'Added Dave Stuteville account';
  ELSE
    RAISE NOTICE 'WARNING: Dave user not found!';
  END IF;

END $$;

-- Verify insertion
SELECT
  wa.account_identifier,
  wa.account_name,
  wa.connection_status,
  w.name as workspace_name,
  wa.created_at
FROM workspace_accounts wa
JOIN workspaces w ON w.id::uuid = wa.workspace_id::uuid
WHERE wa.account_identifier LIKE '%sendingcell.com'
ORDER BY wa.created_at DESC;
