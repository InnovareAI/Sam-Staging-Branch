-- Function to create user associations robustly
-- This function handles schema issues and provides robust user-account linking

CREATE OR REPLACE FUNCTION create_user_association(
  p_user_id UUID,
  p_unipile_account_id TEXT,
  p_platform TEXT DEFAULT 'LINKEDIN',
  p_account_name TEXT DEFAULT NULL,
  p_account_email TEXT DEFAULT NULL,
  p_linkedin_public_identifier TEXT DEFAULT NULL,
  p_linkedin_profile_url TEXT DEFAULT NULL,
  p_connection_status TEXT DEFAULT 'active'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_record RECORD;
  result_json JSON;
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
    connection_status,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_unipile_account_id,
    p_platform,
    p_account_name,
    p_account_email,
    p_linkedin_public_identifier,
    p_linkedin_profile_url,
    p_connection_status,
    NOW(),
    NOW()
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
    updated_at = NOW()
  RETURNING * INTO result_record;

  -- Convert record to JSON
  result_json := row_to_json(result_record);
  
  RETURN result_json;
EXCEPTION
  WHEN OTHERS THEN
    -- Return error information as JSON
    RETURN json_build_object(
      'error', true,
      'message', SQLERRM,
      'detail', SQLSTATE
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_user_association TO authenticated;

-- Test the function works
SELECT create_user_association(
  '00000000-0000-0000-0000-000000000000'::UUID,
  'test-account-123',
  'LINKEDIN',
  'Test User',
  'test@example.com',
  'testuser',
  'https://linkedin.com/in/testuser',
  'active'
);