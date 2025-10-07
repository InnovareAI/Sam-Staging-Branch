-- Fix missing workspace_account entry for Google OAuth account
-- This manually creates the workspace_account entry for the connected Google account

-- Insert workspace_account for the Google account
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
  'babdcab8-1a78-4b2f-913e-6e9fd9821009', -- InnovareAI Workspace
  'f6885ff3-deef-4781-8721-93011c990b1b', -- Auth user ID
  'email',
  'tl@innovareai.com',
  'tl@innovareai.com',
  'nefy7jYjS5K6X3U7ORxHNQ', -- Unipile account ID
  'connected',
  true,
  jsonb_build_object(
    'provider', 'GOOGLE_OAUTH',
    'unipile_instance', 'innovareai-mkdqhc.unipile.com'
  )
)
ON CONFLICT (workspace_id, user_id, account_type, account_identifier)
DO UPDATE SET
  connection_status = 'connected',
  is_active = true,
  updated_at = now();
