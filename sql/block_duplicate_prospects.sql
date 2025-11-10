-- Database Function: Block Duplicate Prospects Before N8N Execution
-- This function marks prospects as 'duplicate_blocked' if their LinkedIn URL or email
-- has already been contacted in ANY campaign within the workspace
-- Run this BEFORE triggering N8N workflows to prevent duplicate LinkedIn API calls

CREATE OR REPLACE FUNCTION block_duplicate_prospects(
  p_campaign_id UUID,
  p_workspace_id UUID
)
RETURNS TABLE (
  blocked_count INTEGER,
  blocked_prospects JSONB
) AS $$
DECLARE
  v_blocked_count INTEGER := 0;
  v_blocked_list JSONB := '[]'::JSONB;
  v_contacted_urls TEXT[];
  v_contacted_emails TEXT[];
BEGIN
  -- Step 1: Get all LinkedIn URLs and emails that have been contacted in this workspace
  SELECT
    ARRAY_AGG(DISTINCT LOWER(TRIM(TRAILING '/' FROM linkedin_url))) FILTER (WHERE linkedin_url IS NOT NULL),
    ARRAY_AGG(DISTINCT LOWER(TRIM(email))) FILTER (WHERE email IS NOT NULL)
  INTO v_contacted_urls, v_contacted_emails
  FROM campaign_prospects
  WHERE workspace_id = p_workspace_id
    AND (status = 'connection_requested' OR contacted_at IS NOT NULL)
    AND campaign_id != p_campaign_id; -- Exclude current campaign (allow retries within same campaign)

  -- Step 2: Find prospects in current campaign that match already-contacted URLs/emails
  WITH duplicates AS (
    SELECT
      id,
      first_name,
      last_name,
      linkedin_url,
      email,
      CASE
        WHEN LOWER(TRIM(TRAILING '/' FROM linkedin_url)) = ANY(v_contacted_urls) THEN 'linkedin_url'
        WHEN LOWER(TRIM(email)) = ANY(v_contacted_emails) THEN 'email'
        ELSE NULL
      END as duplicate_reason
    FROM campaign_prospects
    WHERE campaign_id = p_campaign_id
      AND status IN ('pending', 'approved', 'ready_to_message')
      AND (
        LOWER(TRIM(TRAILING '/' FROM linkedin_url)) = ANY(v_contacted_urls)
        OR LOWER(TRIM(email)) = ANY(v_contacted_emails)
      )
  )
  -- Step 3: Update duplicates to 'duplicate_blocked' status
  UPDATE campaign_prospects cp
  SET
    status = 'duplicate_blocked',
    updated_at = NOW(),
    personalization_data = COALESCE(cp.personalization_data, '{}'::JSONB) ||
      jsonb_build_object(
        'blocked_reason', d.duplicate_reason,
        'blocked_at', NOW()::TEXT,
        'blocked_by', 'duplicate_prevention_system'
      )
  FROM duplicates d
  WHERE cp.id = d.id
  RETURNING cp.id, cp.first_name, cp.last_name, cp.linkedin_url, d.duplicate_reason
  INTO v_blocked_count, v_blocked_list;

  -- Step 4: Return count and list of blocked prospects
  RETURN QUERY
  SELECT
    COALESCE(v_blocked_count, 0)::INTEGER as blocked_count,
    COALESCE(v_blocked_list, '[]'::JSONB) as blocked_prospects;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION block_duplicate_prospects(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION block_duplicate_prospects(UUID, UUID) TO service_role;

-- Example usage:
-- SELECT * FROM block_duplicate_prospects(
--   'campaign-uuid-here'::UUID,
--   'workspace-uuid-here'::UUID
-- );

COMMENT ON FUNCTION block_duplicate_prospects IS
'Marks prospects as duplicate_blocked if their LinkedIn URL or email has already been contacted in another campaign.
Call this BEFORE triggering N8N workflows to prevent duplicate LinkedIn API calls and rate limiting.';
