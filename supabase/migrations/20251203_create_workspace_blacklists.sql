-- Create workspace_blacklists table
-- Blacklist entries to exclude companies, people, or profiles from outreach

CREATE TABLE IF NOT EXISTS workspace_blacklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Optional: scope to specific LinkedIn account (null = workspace-wide)
  linkedin_account_id TEXT,

  -- Blacklist type: what field to match against
  blacklist_type TEXT NOT NULL CHECK (blacklist_type IN (
    'company_name',
    'first_name',
    'last_name',
    'job_title',
    'profile_link'
  )),

  -- Comparison type: how to match
  comparison_type TEXT NOT NULL DEFAULT 'contains' CHECK (comparison_type IN (
    'contains',
    'equals',
    'starts_with',
    'ends_with'
  )),

  -- The keyword/value to match
  keyword TEXT NOT NULL,

  -- Optional notes/reason for blacklisting
  notes TEXT,

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_workspace_blacklists_workspace_id
  ON workspace_blacklists(workspace_id);

CREATE INDEX IF NOT EXISTS idx_workspace_blacklists_type
  ON workspace_blacklists(blacklist_type);

CREATE INDEX IF NOT EXISTS idx_workspace_blacklists_keyword
  ON workspace_blacklists(keyword);

CREATE INDEX IF NOT EXISTS idx_workspace_blacklists_linkedin_account
  ON workspace_blacklists(linkedin_account_id);

-- Enable RLS
ALTER TABLE workspace_blacklists ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "workspace_blacklists_select_policy" ON workspace_blacklists
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_blacklists_insert_policy" ON workspace_blacklists
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_blacklists_update_policy" ON workspace_blacklists
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_blacklists_delete_policy" ON workspace_blacklists
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Grant permissions
GRANT ALL ON workspace_blacklists TO authenticated;
GRANT ALL ON workspace_blacklists TO service_role;

-- Add comment
COMMENT ON TABLE workspace_blacklists IS 'Blacklist entries to exclude companies, people, or profiles from LinkedIn outreach. Checked before sending connection requests.';

-- Create a function to check if a prospect is blacklisted
CREATE OR REPLACE FUNCTION is_prospect_blacklisted(
  p_workspace_id UUID,
  p_company_name TEXT DEFAULT NULL,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_job_title TEXT DEFAULT NULL,
  p_profile_link TEXT DEFAULT NULL,
  p_linkedin_account_id TEXT DEFAULT NULL
) RETURNS TABLE (
  is_blacklisted BOOLEAN,
  matching_rule_id UUID,
  matching_type TEXT,
  matching_keyword TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    TRUE as is_blacklisted,
    bl.id as matching_rule_id,
    bl.blacklist_type as matching_type,
    bl.keyword as matching_keyword
  FROM workspace_blacklists bl
  WHERE bl.workspace_id = p_workspace_id
    AND (bl.linkedin_account_id IS NULL OR bl.linkedin_account_id = p_linkedin_account_id)
    AND (
      -- Company name checks
      (bl.blacklist_type = 'company_name' AND p_company_name IS NOT NULL AND (
        (bl.comparison_type = 'contains' AND LOWER(p_company_name) LIKE '%' || LOWER(bl.keyword) || '%') OR
        (bl.comparison_type = 'equals' AND LOWER(p_company_name) = LOWER(bl.keyword)) OR
        (bl.comparison_type = 'starts_with' AND LOWER(p_company_name) LIKE LOWER(bl.keyword) || '%') OR
        (bl.comparison_type = 'ends_with' AND LOWER(p_company_name) LIKE '%' || LOWER(bl.keyword))
      ))
      OR
      -- First name checks
      (bl.blacklist_type = 'first_name' AND p_first_name IS NOT NULL AND (
        (bl.comparison_type = 'contains' AND LOWER(p_first_name) LIKE '%' || LOWER(bl.keyword) || '%') OR
        (bl.comparison_type = 'equals' AND LOWER(p_first_name) = LOWER(bl.keyword)) OR
        (bl.comparison_type = 'starts_with' AND LOWER(p_first_name) LIKE LOWER(bl.keyword) || '%') OR
        (bl.comparison_type = 'ends_with' AND LOWER(p_first_name) LIKE '%' || LOWER(bl.keyword))
      ))
      OR
      -- Last name checks
      (bl.blacklist_type = 'last_name' AND p_last_name IS NOT NULL AND (
        (bl.comparison_type = 'contains' AND LOWER(p_last_name) LIKE '%' || LOWER(bl.keyword) || '%') OR
        (bl.comparison_type = 'equals' AND LOWER(p_last_name) = LOWER(bl.keyword)) OR
        (bl.comparison_type = 'starts_with' AND LOWER(p_last_name) LIKE LOWER(bl.keyword) || '%') OR
        (bl.comparison_type = 'ends_with' AND LOWER(p_last_name) LIKE '%' || LOWER(bl.keyword))
      ))
      OR
      -- Job title checks
      (bl.blacklist_type = 'job_title' AND p_job_title IS NOT NULL AND (
        (bl.comparison_type = 'contains' AND LOWER(p_job_title) LIKE '%' || LOWER(bl.keyword) || '%') OR
        (bl.comparison_type = 'equals' AND LOWER(p_job_title) = LOWER(bl.keyword)) OR
        (bl.comparison_type = 'starts_with' AND LOWER(p_job_title) LIKE LOWER(bl.keyword) || '%') OR
        (bl.comparison_type = 'ends_with' AND LOWER(p_job_title) LIKE '%' || LOWER(bl.keyword))
      ))
      OR
      -- Profile link checks
      (bl.blacklist_type = 'profile_link' AND p_profile_link IS NOT NULL AND (
        (bl.comparison_type = 'contains' AND LOWER(p_profile_link) LIKE '%' || LOWER(bl.keyword) || '%') OR
        (bl.comparison_type = 'equals' AND LOWER(p_profile_link) = LOWER(bl.keyword)) OR
        (bl.comparison_type = 'starts_with' AND LOWER(p_profile_link) LIKE LOWER(bl.keyword) || '%') OR
        (bl.comparison_type = 'ends_with' AND LOWER(p_profile_link) LIKE '%' || LOWER(bl.keyword))
      ))
    )
  LIMIT 1;

  -- If no match found, return false
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
