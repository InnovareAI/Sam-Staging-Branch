-- Add domain-based workspace matching function
-- This allows users with the same email domain to automatically join the same workspace

-- Function to find workspace by email domain
CREATE OR REPLACE FUNCTION find_workspace_by_email_domain(
  user_email TEXT
)
RETURNS TABLE (
  workspace_id UUID,
  workspace_name TEXT,
  workspace_company_url TEXT,
  member_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  email_domain TEXT;
BEGIN
  -- Extract domain from email
  email_domain := LOWER(SPLIT_PART(user_email, '@', 2));

  -- Return nothing if domain is empty or is a common free email provider
  IF email_domain IS NULL
     OR email_domain = ''
     OR email_domain IN ('gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'protonmail.com', 'mail.com')
  THEN
    RETURN;
  END IF;

  -- Find workspaces where at least one member has the same email domain
  RETURN QUERY
  SELECT DISTINCT
    w.id AS workspace_id,
    w.name AS workspace_name,
    w.company_url AS workspace_company_url,
    COUNT(wm.user_id) OVER (PARTITION BY w.id) AS member_count
  FROM workspaces w
  INNER JOIN workspace_members wm ON wm.workspace_id = w.id
  INNER JOIN users u ON u.id = wm.user_id
  WHERE LOWER(SPLIT_PART(u.email, '@', 2)) = email_domain
  ORDER BY member_count DESC, w.created_at ASC
  LIMIT 1;
END;
$$;

-- Add comment
COMMENT ON FUNCTION find_workspace_by_email_domain IS 'Finds existing workspace with matching email domain to enable automatic team member joining';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION find_workspace_by_email_domain TO authenticated;
