-- Fix LinkedIn Account to Workspace Member Association
-- This allows campaigns to access LinkedIn accounts through workspace membership

-- Add LinkedIn account reference to workspace_members table
ALTER TABLE workspace_members 
ADD COLUMN IF NOT EXISTS linkedin_unipile_account_id TEXT;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_workspace_members_linkedin_account 
ON workspace_members(linkedin_unipile_account_id);

-- Create function to associate LinkedIn accounts with workspace members
CREATE OR REPLACE FUNCTION associate_linkedin_with_workspace_member(
  p_workspace_id UUID,
  p_user_id UUID,
  p_unipile_account_id TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  -- Verify the user has this LinkedIn account
  IF NOT EXISTS (
    SELECT 1 FROM user_unipile_accounts 
    WHERE user_id = p_user_id 
    AND unipile_account_id = p_unipile_account_id 
    AND platform = 'LINKEDIN'
    AND connection_status = 'active'
  ) THEN
    RAISE EXCEPTION 'LinkedIn account % not found for user %', p_unipile_account_id, p_user_id;
  END IF;

  -- Update workspace member with LinkedIn account association
  UPDATE workspace_members 
  SET 
    linkedin_unipile_account_id = p_unipile_account_id,
    updated_at = NOW()
  WHERE workspace_id = p_workspace_id 
  AND user_id = p_user_id;

  -- Verify update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace member not found for user % in workspace %', p_user_id, p_workspace_id;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get available LinkedIn accounts for a workspace
CREATE OR REPLACE FUNCTION get_workspace_linkedin_accounts(p_workspace_id UUID)
RETURNS TABLE (
  user_id UUID,
  user_email TEXT,
  member_role TEXT,
  unipile_account_id TEXT,
  linkedin_account_name TEXT,
  linkedin_public_identifier TEXT,
  linkedin_profile_url TEXT,
  connection_status TEXT,
  can_be_used_for_campaigns BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wm.user_id,
    u.email::TEXT as user_email,
    wm.role::TEXT as member_role,
    ua.unipile_account_id,
    ua.account_name::TEXT as linkedin_account_name,
    ua.linkedin_public_identifier,
    ua.linkedin_profile_url,
    ua.connection_status,
    (ua.connection_status = 'active' AND wm.linkedin_unipile_account_id IS NOT NULL) as can_be_used_for_campaigns
  FROM workspace_members wm
  JOIN auth.users u ON wm.user_id = u.id
  LEFT JOIN user_unipile_accounts ua ON wm.user_id = ua.user_id AND ua.platform = 'LINKEDIN'
  WHERE wm.workspace_id = p_workspace_id
  ORDER BY wm.role, ua.connection_status, ua.account_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-associate LinkedIn accounts for existing workspace members
-- This runs for ChillMine workspace and other existing workspaces
DO $$
DECLARE
  workspace_record RECORD;
  member_record RECORD;
  linkedin_record RECORD;
BEGIN
  -- Loop through each workspace
  FOR workspace_record IN 
    SELECT id, name FROM workspaces
  LOOP
    RAISE NOTICE 'Processing workspace: % (ID: %)', workspace_record.name, workspace_record.id;
    
    -- Loop through each member in this workspace
    FOR member_record IN 
      SELECT wm.user_id, wm.role, u.email
      FROM workspace_members wm
      JOIN auth.users u ON wm.user_id = u.id
      WHERE wm.workspace_id = workspace_record.id
      AND wm.linkedin_unipile_account_id IS NULL -- Only process members without LinkedIn association
    LOOP
      RAISE NOTICE '  Checking member: % (%)', member_record.email, member_record.role;
      
      -- Find the first active LinkedIn account for this user
      SELECT unipile_account_id, account_name INTO linkedin_record
      FROM user_unipile_accounts 
      WHERE user_id = member_record.user_id 
      AND platform = 'LINKEDIN' 
      AND connection_status = 'active'
      ORDER BY created_at ASC
      LIMIT 1;
      
      -- If LinkedIn account found, associate it
      IF linkedin_record.unipile_account_id IS NOT NULL THEN
        RAISE NOTICE '    Associating LinkedIn account: % (%)', 
          linkedin_record.account_name, linkedin_record.unipile_account_id;
        
        PERFORM associate_linkedin_with_workspace_member(
          workspace_record.id,
          member_record.user_id,
          linkedin_record.unipile_account_id
        );
        
        RAISE NOTICE '    ✅ Successfully associated LinkedIn account';
      ELSE
        RAISE NOTICE '    ⚠️  No active LinkedIn accounts found for user';
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Create view for easy campaign LinkedIn account access
CREATE OR REPLACE VIEW campaign_linkedin_accounts AS
SELECT 
  w.id as workspace_id,
  w.name as workspace_name,
  wm.user_id,
  u.email as user_email,
  wm.role as member_role,
  ua.unipile_account_id,
  ua.account_name as linkedin_account_name,
  ua.linkedin_public_identifier,
  ua.linkedin_profile_url,
  ua.connection_status,
  (ua.connection_status = 'active') as is_available_for_campaigns
FROM workspaces w
JOIN workspace_members wm ON w.id = wm.workspace_id
JOIN auth.users u ON wm.user_id = u.id
JOIN user_unipile_accounts ua ON wm.user_id = ua.user_id 
WHERE ua.platform = 'LINKEDIN'
AND wm.linkedin_unipile_account_id = ua.unipile_account_id;

-- Add comments for documentation
COMMENT ON COLUMN workspace_members.linkedin_unipile_account_id IS 'Links workspace member to their primary LinkedIn account for campaigns';
COMMENT ON FUNCTION associate_linkedin_with_workspace_member IS 'Associates a LinkedIn account with a workspace member for campaign use';
COMMENT ON FUNCTION get_workspace_linkedin_accounts IS 'Returns all LinkedIn accounts available to a workspace for campaigns';
COMMENT ON VIEW campaign_linkedin_accounts IS 'Easy access to LinkedIn accounts available for campaign execution by workspace';

-- Test the association with a sample query
SELECT 
  'Association Status' as status,
  COUNT(*) as total_workspace_members,
  COUNT(linkedin_unipile_account_id) as members_with_linkedin,
  ROUND(COUNT(linkedin_unipile_account_id)::numeric / COUNT(*) * 100, 1) as association_percentage
FROM workspace_members;

-- Show results for ChillMine workspace
SELECT 
  'ChillMine LinkedIn Status' as status,
  w.name as workspace_name,
  u.email as member_email,
  wm.role as member_role,
  ua.account_name as linkedin_account,
  ua.connection_status as linkedin_status,
  CASE WHEN wm.linkedin_unipile_account_id IS NOT NULL THEN '✅ Associated' ELSE '❌ Not Associated' END as campaign_ready
FROM workspaces w
JOIN workspace_members wm ON w.id = wm.workspace_id  
JOIN auth.users u ON wm.user_id = u.id
LEFT JOIN user_unipile_accounts ua ON wm.linkedin_unipile_account_id = ua.unipile_account_id
WHERE w.name ILIKE '%chillmine%'
ORDER BY wm.role, u.email;