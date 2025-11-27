-- Migration: Fix LinkedIn Commenting Agent RLS Policies
-- Date: November 27, 2025
-- Purpose: Add missing DELETE policies and fix RLS configuration
--
-- CHANGES:
-- 1. Add DELETE policies to 4 tables (linkedin_posts_discovered, linkedin_comment_queue,
--    linkedin_comments_posted, linkedin_brand_guidelines)
-- 2. Ensure RLS is enabled on all commenting agent tables
-- 3. Clean up any duplicate policies

-- ============================================================================
-- PART 1: Ensure RLS is enabled on all tables
-- ============================================================================

ALTER TABLE linkedin_posts_discovered ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_comment_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_comments_posted ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_brand_guidelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_post_monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_post_comments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 2: Add DELETE policies to tables missing them
-- ============================================================================

-- 2.1 linkedin_posts_discovered - Add DELETE policy
DROP POLICY IF EXISTS "posts_discovered_workspace_delete" ON linkedin_posts_discovered;
DROP POLICY IF EXISTS "linkedin_posts_delete_workspace" ON linkedin_posts_discovered;
DROP POLICY IF EXISTS "Users can delete posts in their workspace" ON linkedin_posts_discovered;

CREATE POLICY "posts_discovered_workspace_delete"
  ON linkedin_posts_discovered
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = linkedin_posts_discovered.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- 2.2 linkedin_comment_queue - Add DELETE policy
DROP POLICY IF EXISTS "comment_queue_workspace_delete" ON linkedin_comment_queue;
DROP POLICY IF EXISTS "linkedin_queue_delete_workspace" ON linkedin_comment_queue;
DROP POLICY IF EXISTS "Users can delete comments in queue" ON linkedin_comment_queue;

CREATE POLICY "comment_queue_workspace_delete"
  ON linkedin_comment_queue
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = linkedin_comment_queue.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- 2.3 linkedin_comments_posted - Add DELETE policy
DROP POLICY IF EXISTS "comments_posted_workspace_delete" ON linkedin_comments_posted;
DROP POLICY IF EXISTS "linkedin_posted_delete_workspace" ON linkedin_comments_posted;
DROP POLICY IF EXISTS "Users can delete posted comments" ON linkedin_comments_posted;

CREATE POLICY "comments_posted_workspace_delete"
  ON linkedin_comments_posted
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = linkedin_comments_posted.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- 2.4 linkedin_brand_guidelines - Add DELETE policy
DROP POLICY IF EXISTS "brand_guidelines_workspace_delete" ON linkedin_brand_guidelines;
DROP POLICY IF EXISTS "linkedin_brand_delete_workspace" ON linkedin_brand_guidelines;
DROP POLICY IF EXISTS "Users can delete brand guidelines" ON linkedin_brand_guidelines;

CREATE POLICY "brand_guidelines_workspace_delete"
  ON linkedin_brand_guidelines
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = linkedin_brand_guidelines.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- ============================================================================
-- PART 3: Verify linkedin_proxy_assignments has correct RLS
-- ============================================================================

-- Ensure RLS is enabled (it should be based on migrations, but verify)
ALTER TABLE linkedin_proxy_assignments ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies to ensure they work with current auth
DROP POLICY IF EXISTS "Users can access own linkedin proxy assignments" ON linkedin_proxy_assignments;
DROP POLICY IF EXISTS "linkedin_proxy_assignments_user_access" ON linkedin_proxy_assignments;
DROP POLICY IF EXISTS "service_role_access_linkedin_proxy_assignments" ON linkedin_proxy_assignments;

-- User can access their own proxy assignments
CREATE POLICY "linkedin_proxy_user_access"
  ON linkedin_proxy_assignments
  FOR ALL
  USING (user_id = auth.uid());

-- Service role has full access (for API operations)
CREATE POLICY "linkedin_proxy_service_access"
  ON linkedin_proxy_assignments
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- PART 4: Grant necessary permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON linkedin_posts_discovered TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON linkedin_comment_queue TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON linkedin_comments_posted TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON linkedin_brand_guidelines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON linkedin_post_monitors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON linkedin_post_comments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON linkedin_proxy_assignments TO authenticated;

-- ============================================================================
-- PART 5: Verification query (run after migration)
-- ============================================================================

-- Run this query to verify all policies are in place:
--
-- SELECT
--   schemaname,
--   tablename,
--   policyname,
--   cmd
-- FROM pg_policies
-- WHERE tablename IN (
--   'linkedin_posts_discovered',
--   'linkedin_comment_queue',
--   'linkedin_comments_posted',
--   'linkedin_brand_guidelines',
--   'linkedin_post_monitors',
--   'linkedin_post_comments',
--   'linkedin_proxy_assignments'
-- )
-- ORDER BY tablename, cmd;
--
-- Expected result: Each table should have SELECT, INSERT, UPDATE, DELETE policies

-- ============================================================================
-- PART 6: Clean up deprecated tables (OPTIONAL - run separately after verification)
-- ============================================================================

-- CAUTION: Only run these if you've verified the tables have 0 rows and are not used
--
-- -- Check row counts first:
-- SELECT 'linkedin_discovered_posts' as table_name, COUNT(*) as row_count
-- FROM linkedin_discovered_posts
-- UNION ALL
-- SELECT 'linkedin_profiles_to_monitor', COUNT(*)
-- FROM linkedin_profiles_to_monitor;
--
-- -- If both are 0, you can drop them:
-- DROP TABLE IF EXISTS linkedin_discovered_posts CASCADE;
-- DROP TABLE IF EXISTS linkedin_profiles_to_monitor CASCADE;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Migration complete
-- ============================================================================

COMMENT ON POLICY "posts_discovered_workspace_delete" ON linkedin_posts_discovered IS 'Allow workspace members to delete discovered posts';
COMMENT ON POLICY "comment_queue_workspace_delete" ON linkedin_comment_queue IS 'Allow workspace members to delete queued comments';
COMMENT ON POLICY "comments_posted_workspace_delete" ON linkedin_comments_posted IS 'Allow workspace members to delete posted comments';
COMMENT ON POLICY "brand_guidelines_workspace_delete" ON linkedin_brand_guidelines IS 'Allow workspace members to delete brand guidelines';
