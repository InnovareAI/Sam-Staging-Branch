-- Migration: Add Daily Digest Email for LinkedIn Commenting Agent
-- Date: December 4, 2025
-- Purpose: Enable email-based approve/reject workflow for AI-generated comments

-- ============================================================================
-- 1. Add digest email settings to linkedin_brand_guidelines
-- ============================================================================

ALTER TABLE linkedin_brand_guidelines
  ADD COLUMN IF NOT EXISTS digest_email TEXT,
  ADD COLUMN IF NOT EXISTS digest_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS digest_time TIME DEFAULT '08:00:00',
  ADD COLUMN IF NOT EXISTS digest_timezone TEXT DEFAULT 'America/Los_Angeles',
  ADD COLUMN IF NOT EXISTS last_digest_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN linkedin_brand_guidelines.digest_email IS 'Email address to send daily comment digest to';
COMMENT ON COLUMN linkedin_brand_guidelines.digest_enabled IS 'Whether to send daily digest emails';
COMMENT ON COLUMN linkedin_brand_guidelines.digest_time IS 'Time of day to send digest (in digest_timezone)';
COMMENT ON COLUMN linkedin_brand_guidelines.digest_timezone IS 'Timezone for digest_time';
COMMENT ON COLUMN linkedin_brand_guidelines.last_digest_sent_at IS 'When the last digest was sent';

-- ============================================================================
-- 2. Add approval workflow columns to linkedin_posts_discovered
-- ============================================================================

ALTER TABLE linkedin_posts_discovered
  ADD COLUMN IF NOT EXISTS approval_token TEXT,
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS digest_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS posted_via_email BOOLEAN DEFAULT false;

-- Generate approval tokens for posts that need comments
-- Token format: random 32-char hex string, used for secure approve/reject links
CREATE INDEX IF NOT EXISTS idx_posts_approval_token ON linkedin_posts_discovered(approval_token);
CREATE INDEX IF NOT EXISTS idx_posts_approval_status ON linkedin_posts_discovered(approval_status);
CREATE INDEX IF NOT EXISTS idx_posts_digest_sent ON linkedin_posts_discovered(digest_sent_at);

-- Add check constraint for approval_status
ALTER TABLE linkedin_posts_discovered
  DROP CONSTRAINT IF EXISTS valid_approval_status,
  ADD CONSTRAINT valid_approval_status
    CHECK (approval_status IN ('pending', 'approved', 'rejected', 'posted', 'expired'));

COMMENT ON COLUMN linkedin_posts_discovered.approval_token IS 'Secure token for email-based approve/reject actions';
COMMENT ON COLUMN linkedin_posts_discovered.approval_status IS 'pending=awaiting review, approved=will post, rejected=skip, posted=comment sent';
COMMENT ON COLUMN linkedin_posts_discovered.digest_sent_at IS 'When this post was included in a digest email';

-- ============================================================================
-- 3. Function to generate secure approval tokens
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_approval_token()
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT encode(gen_random_bytes(16), 'hex');
$$;

-- ============================================================================
-- 4. Function to get pending posts for digest
-- ============================================================================

CREATE OR REPLACE FUNCTION get_pending_digest_posts(p_workspace_id UUID)
RETURNS TABLE (
  id UUID,
  post_url TEXT,
  post_text TEXT,
  author_name TEXT,
  ai_comment TEXT,
  approval_token TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.post_url,
    p.post_text,
    p.author_name::TEXT,
    p.ai_comment,
    p.approval_token,
    p.created_at
  FROM linkedin_posts_discovered p
  WHERE p.workspace_id = p_workspace_id
    AND p.ai_comment IS NOT NULL
    AND p.approval_status = 'pending'
    AND p.digest_sent_at IS NULL
  ORDER BY p.created_at DESC
  LIMIT 25;
END;
$$;

-- ============================================================================
-- 5. Function to approve a comment via token
-- ============================================================================

CREATE OR REPLACE FUNCTION approve_comment_by_token(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_post RECORD;
BEGIN
  -- Find the post by token
  SELECT id, approval_status, ai_comment, post_url
  INTO v_post
  FROM linkedin_posts_discovered
  WHERE approval_token = p_token;

  IF v_post IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid token');
  END IF;

  IF v_post.approval_status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Comment already processed', 'status', v_post.approval_status);
  END IF;

  -- Approve the comment
  UPDATE linkedin_posts_discovered
  SET approval_status = 'approved',
      approved_at = NOW(),
      updated_at = NOW()
  WHERE approval_token = p_token;

  RETURN json_build_object(
    'success', true,
    'post_id', v_post.id,
    'comment', v_post.ai_comment,
    'post_url', v_post.post_url
  );
END;
$$;

-- ============================================================================
-- 6. Function to reject a comment via token
-- ============================================================================

CREATE OR REPLACE FUNCTION reject_comment_by_token(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_post RECORD;
BEGIN
  -- Find the post by token
  SELECT id, approval_status
  INTO v_post
  FROM linkedin_posts_discovered
  WHERE approval_token = p_token;

  IF v_post IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid token');
  END IF;

  IF v_post.approval_status != 'pending' THEN
    RETURN json_build_object('success', false, 'error', 'Comment already processed', 'status', v_post.approval_status);
  END IF;

  -- Reject the comment
  UPDATE linkedin_posts_discovered
  SET approval_status = 'rejected',
      rejected_at = NOW(),
      updated_at = NOW()
  WHERE approval_token = p_token;

  RETURN json_build_object('success', true, 'post_id', v_post.id);
END;
$$;

-- ============================================================================
-- 7. Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION generate_approval_token() TO service_role;
GRANT EXECUTE ON FUNCTION get_pending_digest_posts(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION approve_comment_by_token(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION reject_comment_by_token(TEXT) TO service_role;

-- Also allow anon for approve/reject endpoints (token-based auth)
GRANT EXECUTE ON FUNCTION approve_comment_by_token(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION reject_comment_by_token(TEXT) TO anon;
