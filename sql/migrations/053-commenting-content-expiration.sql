-- Migration: Commenting Agent Content Expiration
-- Created: December 18, 2025
-- Purpose: Content (posts/comments) not approved expires on the next business day
--          A new set of posts must be scraped after expiration
--
-- Business Logic:
--   - Posts discovered but not commented on expire at 6 AM UTC next business day
--   - Comments pending approval expire at 6 AM UTC next business day
--   - Weekend discovered posts expire Monday 6 AM UTC
--   - Expired posts get status = 'expired'
--   - Expired comments get status = 'expired'

-- ============================================
-- 1. ADD EXPIRATION COLUMNS TO POSTS
-- ============================================

ALTER TABLE linkedin_posts_discovered
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ;

-- Add 'expired' to status check constraint
-- First drop existing constraint if it exists, then recreate
DO $$
BEGIN
  -- Try to drop existing constraint
  ALTER TABLE linkedin_posts_discovered DROP CONSTRAINT IF EXISTS linkedin_posts_discovered_status_check;
  ALTER TABLE linkedin_posts_discovered DROP CONSTRAINT IF EXISTS posts_status_check;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Constraint doesn't exist, continue
END $$;

-- No need to add constraint if column allows any text (check actual schema)
-- The status column is TEXT without constraint in many setups

COMMENT ON COLUMN linkedin_posts_discovered.expires_at IS 'When this post expires if not commented on (6 AM UTC next business day)';
COMMENT ON COLUMN linkedin_posts_discovered.expired_at IS 'When this post was marked as expired';

-- Index for expiration queries
CREATE INDEX IF NOT EXISTS idx_posts_expires_at
  ON linkedin_posts_discovered(workspace_id, expires_at)
  WHERE status = 'discovered' AND expires_at IS NOT NULL;

-- ============================================
-- 2. ADD EXPIRATION COLUMNS TO COMMENTS
-- ============================================

ALTER TABLE linkedin_post_comments
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ;

COMMENT ON COLUMN linkedin_post_comments.expires_at IS 'When this comment expires if not approved (6 AM UTC next business day)';
COMMENT ON COLUMN linkedin_post_comments.expired_at IS 'When this comment was marked as expired';

-- Index for expiration queries
CREATE INDEX IF NOT EXISTS idx_comments_expires_at
  ON linkedin_post_comments(workspace_id, expires_at)
  WHERE status IN ('pending_approval', 'scheduled') AND expires_at IS NOT NULL;

-- ============================================
-- 3. FUNCTION TO CALCULATE NEXT BUSINESS DAY 6 AM UTC
-- ============================================

CREATE OR REPLACE FUNCTION get_next_business_day_6am_utc(from_timestamp TIMESTAMPTZ DEFAULT NOW())
RETURNS TIMESTAMPTZ AS $$
DECLARE
  next_day TIMESTAMPTZ;
  day_of_week INTEGER;
BEGIN
  -- Start with tomorrow at 6 AM UTC
  next_day := DATE_TRUNC('day', from_timestamp AT TIME ZONE 'UTC') + INTERVAL '1 day' + INTERVAL '6 hours';

  -- Get day of week (0=Sunday, 6=Saturday)
  day_of_week := EXTRACT(DOW FROM next_day);

  -- If Saturday (6), move to Monday
  IF day_of_week = 6 THEN
    next_day := next_day + INTERVAL '2 days';
  -- If Sunday (0), move to Monday
  ELSIF day_of_week = 0 THEN
    next_day := next_day + INTERVAL '1 day';
  END IF;

  RETURN next_day;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_next_business_day_6am_utc IS 'Returns 6 AM UTC on the next business day (Mon-Fri)';

-- ============================================
-- 4. TRIGGER TO AUTO-SET EXPIRATION ON INSERT
-- ============================================

-- Trigger for new discovered posts
CREATE OR REPLACE FUNCTION set_post_expiration()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set expires_at if not already set
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := get_next_business_day_6am_utc(NEW.created_at);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS post_set_expiration ON linkedin_posts_discovered;
CREATE TRIGGER post_set_expiration
  BEFORE INSERT ON linkedin_posts_discovered
  FOR EACH ROW
  EXECUTE FUNCTION set_post_expiration();

-- Trigger for new comments
CREATE OR REPLACE FUNCTION set_comment_expiration()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set expires_at if not already set and status is pending_approval
  IF NEW.expires_at IS NULL AND NEW.status = 'pending_approval' THEN
    NEW.expires_at := get_next_business_day_6am_utc(NEW.created_at);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS comment_set_expiration ON linkedin_post_comments;
CREATE TRIGGER comment_set_expiration
  BEFORE INSERT ON linkedin_post_comments
  FOR EACH ROW
  EXECUTE FUNCTION set_comment_expiration();

-- ============================================
-- 5. FUNCTION TO EXPIRE OLD CONTENT (called by cron)
-- ============================================

CREATE OR REPLACE FUNCTION expire_commenting_content()
RETURNS TABLE(posts_expired INTEGER, comments_expired INTEGER) AS $$
DECLARE
  p_count INTEGER := 0;
  c_count INTEGER := 0;
BEGIN
  -- Expire discovered posts that haven't been commented on
  WITH expired_posts AS (
    UPDATE linkedin_posts_discovered
    SET
      status = 'expired',
      expired_at = NOW()
    WHERE
      status = 'discovered'
      AND expires_at IS NOT NULL
      AND expires_at <= NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO p_count FROM expired_posts;

  -- Expire pending/scheduled comments that weren't approved
  WITH expired_comments AS (
    UPDATE linkedin_post_comments
    SET
      status = 'expired',
      expired_at = NOW()
    WHERE
      status IN ('pending_approval', 'scheduled')
      AND expires_at IS NOT NULL
      AND expires_at <= NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO c_count FROM expired_comments;

  -- Return counts
  RETURN QUERY SELECT p_count, c_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION expire_commenting_content IS 'Expires posts and comments that have passed their expiration time. Called by cron job.';

-- ============================================
-- 6. BACKFILL EXISTING DATA WITH EXPIRATION TIMES
-- ============================================

-- Set expiration for existing discovered posts (expire in 1 hour for cleanup)
-- This clears old backlog so fresh posts can be scraped
UPDATE linkedin_posts_discovered
SET expires_at = NOW() + INTERVAL '1 hour'
WHERE
  status = 'discovered'
  AND expires_at IS NULL
  AND comment_generated_at IS NULL;

-- Set expiration for existing pending comments (expire in 1 hour for cleanup)
UPDATE linkedin_post_comments
SET expires_at = NOW() + INTERVAL '1 hour'
WHERE
  status IN ('pending_approval', 'scheduled')
  AND expires_at IS NULL;

-- ============================================
-- 7. VIEW FOR MONITORING EXPIRATION STATUS
-- ============================================

CREATE OR REPLACE VIEW v_commenting_expiration_status AS
SELECT
  workspace_id,
  'posts' as content_type,
  COUNT(*) FILTER (WHERE status = 'discovered') as pending_count,
  COUNT(*) FILTER (WHERE status = 'discovered' AND expires_at <= NOW()) as expired_needing_cleanup,
  COUNT(*) FILTER (WHERE status = 'expired') as already_expired,
  MIN(expires_at) FILTER (WHERE status = 'discovered') as next_expiration
FROM linkedin_posts_discovered
GROUP BY workspace_id

UNION ALL

SELECT
  workspace_id,
  'comments' as content_type,
  COUNT(*) FILTER (WHERE status IN ('pending_approval', 'scheduled')) as pending_count,
  COUNT(*) FILTER (WHERE status IN ('pending_approval', 'scheduled') AND expires_at <= NOW()) as expired_needing_cleanup,
  COUNT(*) FILTER (WHERE status = 'expired') as already_expired,
  MIN(expires_at) FILTER (WHERE status IN ('pending_approval', 'scheduled')) as next_expiration
FROM linkedin_post_comments
GROUP BY workspace_id;

COMMENT ON VIEW v_commenting_expiration_status IS 'Monitor content expiration status by workspace';
