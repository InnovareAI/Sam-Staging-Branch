-- Supabase function to create user associations reliably
-- This bypasses any schema cache issues by using pure SQL

CREATE OR REPLACE FUNCTION create_user_association(
  p_user_id UUID,
  p_unipile_account_id TEXT,
  p_platform TEXT,
  p_account_name TEXT DEFAULT NULL,
  p_account_email TEXT DEFAULT NULL,
  p_linkedin_public_identifier TEXT DEFAULT NULL,
  p_linkedin_profile_url TEXT DEFAULT NULL,
  p_connection_status TEXT DEFAULT 'active'
)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  unipile_account_id TEXT,
  platform TEXT,
  account_name TEXT,
  account_email TEXT,
  linkedin_public_identifier TEXT,
  linkedin_profile_url TEXT,
  connection_status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert or update the association
  INSERT INTO user_unipile_accounts (
    user_id,
    unipile_account_id,
    platform,
    account_name,
    account_email,
    linkedin_public_identifier,
    linkedin_profile_url,
    connection_status
  ) VALUES (
    p_user_id,
    p_unipile_account_id,
    p_platform,
    p_account_name,
    p_account_email,
    p_linkedin_public_identifier,
    p_linkedin_profile_url,
    p_connection_status
  )
  ON CONFLICT (unipile_account_id) 
  DO UPDATE SET
    user_id = EXCLUDED.user_id,
    platform = EXCLUDED.platform,
    account_name = EXCLUDED.account_name,
    account_email = EXCLUDED.account_email,
    linkedin_public_identifier = EXCLUDED.linkedin_public_identifier,
    linkedin_profile_url = EXCLUDED.linkedin_profile_url,
    connection_status = EXCLUDED.connection_status,
    updated_at = NOW();

  -- Return the created/updated record
  RETURN QUERY
  SELECT 
    ua.id,
    ua.user_id,
    ua.unipile_account_id,
    ua.platform,
    ua.account_name,
    ua.account_email,
    ua.linkedin_public_identifier,
    ua.linkedin_profile_url,
    ua.connection_status,
    ua.created_at,
    ua.updated_at
  FROM user_unipile_accounts ua
  WHERE ua.unipile_account_id = p_unipile_account_id;
END;
$$;