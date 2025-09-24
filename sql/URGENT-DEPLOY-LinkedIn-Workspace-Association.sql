-- 🚨 URGENT: LinkedIn Account to Workspace Member Association Fix
-- Deploy this IMMEDIATELY in Supabase Dashboard > SQL Editor
-- This fixes the core issue preventing LinkedIn campaigns from working

-- STEP 1: Add LinkedIn account reference to workspace_members table
ALTER TABLE workspace_members 
ADD COLUMN IF NOT EXISTS linkedin_unipile_account_id TEXT;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_workspace_members_linkedin_account 
ON workspace_members(linkedin_unipile_account_id);

-- STEP 2: Create function to associate LinkedIn accounts with workspace members
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

-- STEP 3: Auto-associate existing LinkedIn accounts with workspace members
DO $$
DECLARE
  workspace_record RECORD;
  member_record RECORD;
  linkedin_record RECORD;
  association_count INTEGER := 0;
BEGIN
  RAISE NOTICE '🔗 Starting LinkedIn-Workspace Association Process...';
  
  -- Loop through each workspace
  FOR workspace_record IN 
    SELECT id, name FROM workspaces ORDER BY name
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
      RAISE NOTICE '  📋 Checking member: % (%)', member_record.email, member_record.role;
      
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
        RAISE NOTICE '    🔗 Associating LinkedIn account: % (ID: %)', 
          linkedin_record.account_name, linkedin_record.unipile_account_id;
        
        PERFORM associate_linkedin_with_workspace_member(
          workspace_record.id,
          member_record.user_id,
          linkedin_record.unipile_account_id
        );
        
        association_count := association_count + 1;
        RAISE NOTICE '    ✅ Successfully associated LinkedIn account';
      ELSE
        RAISE NOTICE '    ⚠️  No active LinkedIn accounts found for user';
      END IF;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE '🎉 Association process completed! Total associations created: %', association_count;
END $$;

-- STEP 4: Create helper functions for campaign execution
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

-- STEP 5: Create view for easy campaign LinkedIn account access
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

-- STEP 6: Verification queries to confirm success
SELECT 
  '📊 Association Status' as status,
  COUNT(*) as total_workspace_members,
  COUNT(linkedin_unipile_account_id) as members_with_linkedin,
  ROUND(COUNT(linkedin_unipile_account_id)::numeric / COUNT(*) * 100, 1) as association_percentage
FROM workspace_members;

-- Show ChillMine workspace LinkedIn status
SELECT 
  '🎯 ChillMine Campaign Readiness' as status,
  w.name as workspace_name,
  u.email as member_email,
  wm.role as member_role,
  ua.account_name as linkedin_account,
  ua.connection_status as linkedin_status,
  CASE 
    WHEN wm.linkedin_unipile_account_id IS NOT NULL THEN '✅ Ready for Campaigns' 
    ELSE '❌ No LinkedIn Association' 
  END as campaign_ready
FROM workspaces w
JOIN workspace_members wm ON w.id = wm.workspace_id  
JOIN auth.users u ON wm.user_id = u.id
LEFT JOIN user_unipile_accounts ua ON wm.linkedin_unipile_account_id = ua.unipile_account_id
WHERE w.name ILIKE '%chillmine%'
ORDER BY wm.role, u.email;

-- Show all workspaces with LinkedIn accounts available
SELECT 
  '🚀 All Workspace LinkedIn Status' as status,
  w.name as workspace_name,
  COUNT(wm.user_id) as total_members,
  COUNT(ua.unipile_account_id) as linkedin_accounts,
  COUNT(CASE WHEN ua.connection_status = 'active' THEN 1 END) as active_linkedin_accounts
FROM workspaces w
JOIN workspace_members wm ON w.id = wm.workspace_id
LEFT JOIN user_unipile_accounts ua ON wm.user_id = ua.user_id AND ua.platform = 'LINKEDIN'
GROUP BY w.id, w.name
ORDER BY active_linkedin_accounts DESC, w.name;

-- Add documentation comments
COMMENT ON COLUMN workspace_members.linkedin_unipile_account_id IS 'Primary LinkedIn account for this workspace member to use in campaigns';
COMMENT ON FUNCTION associate_linkedin_with_workspace_member IS 'Associates a LinkedIn account with workspace member for campaign execution';
COMMENT ON FUNCTION get_workspace_linkedin_accounts IS 'Returns all LinkedIn accounts available to a workspace for campaigns';
COMMENT ON VIEW campaign_linkedin_accounts IS 'Simplified access to LinkedIn accounts available for campaign execution by workspace';

-- Final success message
DO $$ BEGIN
  RAISE NOTICE '🎉 DEPLOYMENT SUCCESSFUL!';
  RAISE NOTICE '✅ LinkedIn accounts are now properly associated with workspace members';
  RAISE NOTICE '✅ Campaigns can now access LinkedIn accounts through workspace membership';
  RAISE NOTICE '✅ All helper functions and views created successfully';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Next Steps:';
  RAISE NOTICE '1. Verify association results in the query output above';
  RAISE NOTICE '2. Test campaign execution with LinkedIn account access';
  RAISE NOTICE '3. Monitor campaign execution logs for successful LinkedIn API calls';
END $$;