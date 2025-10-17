-- FIX: Prospect Approval Sessions - User Privacy
-- DATE: 2025-10-17
-- ISSUE: Users can see ALL workspace sessions instead of just their own
-- SOLUTION: Update RLS policy to filter by user_id

-- Drop old policy
DROP POLICY IF EXISTS "Users can view their workspace sessions" ON prospect_approval_sessions;

-- Create new policy - users can ONLY see their OWN sessions
CREATE POLICY "Users can view only their own sessions"
    ON prospect_approval_sessions FOR SELECT
    USING (
        user_id = auth.uid()
        AND workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- Verify the policy change
COMMENT ON POLICY "Users can view only their own sessions" ON prospect_approval_sessions IS
'Users can only see their own prospect approval sessions. This ensures search privacy within workspaces.';
