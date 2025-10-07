-- Add SendingCell email accounts to workspace_accounts
-- These accounts were invited but lost due to OAuth callback bugs

-- First, find the SendingCell workspace ID
SELECT id, name FROM workspaces WHERE name ILIKE '%sendingcell%';

-- Insert Cathy Smith's account
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
  (SELECT id FROM workspaces WHERE name ILIKE '%sendingcell%' LIMIT 1),
  (SELECT id FROM auth.users WHERE email = 'cathy.smith@sendingcell.com' LIMIT 1),
  'email',
  'cathy.smith@sendingcell.com',
  'cathy.smith@sendingcell.com',
  'pending_oauth',
  true,
  jsonb_build_object(
    'provider', 'google',
    'manually_added', true,
    'added_by', 'admin',
    'added_at', NOW(),
    'reason', 'OAuth callback failure - manually recovered'
  )
) ON CONFLICT (workspace_id, user_id, account_type, account_identifier) DO UPDATE
SET
  connection_status = 'pending_oauth',
  account_metadata = workspace_accounts.account_metadata || jsonb_build_object('manually_added', true);

-- Insert Dave Stuteville's account
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
  (SELECT id FROM workspaces WHERE name ILIKE '%sendingcell%' LIMIT 1),
  (SELECT id FROM auth.users WHERE email = 'dave.stuteville@sendingcell.com' LIMIT 1),
  'email',
  'dave.stuteville@sendingcell.com',
  'dave.stuteville@sendingcell.com',
  'pending_oauth',
  true,
  jsonb_build_object(
    'provider', 'google',
    'manually_added', true,
    'added_by', 'admin',
    'added_at', NOW(),
    'reason', 'OAuth callback failure - manually recovered'
  )
) ON CONFLICT (workspace_id, user_id, account_type, account_identifier) DO UPDATE
SET
  connection_status = 'pending_oauth',
  account_metadata = workspace_accounts.account_metadata || jsonb_build_object('manually_added', true);

-- Verify insertion
SELECT
  wa.account_identifier,
  wa.connection_status,
  w.name as workspace_name,
  u.email as user_email
FROM workspace_accounts wa
JOIN workspaces w ON w.id = wa.workspace_id
LEFT JOIN auth.users u ON u.id = wa.user_id
WHERE wa.account_identifier LIKE '%sendingcell.com'
ORDER BY wa.created_at DESC;
