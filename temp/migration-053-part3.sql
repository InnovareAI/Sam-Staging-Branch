-- Part 3: Backfill existing data and create view
-- Run this in Supabase SQL Editor AFTER Parts 1 and 2

-- Set expiration for existing discovered posts (expire in 1 hour)
UPDATE linkedin_posts_discovered
SET expires_at = NOW() + INTERVAL '1 hour'
WHERE status = 'discovered'
  AND expires_at IS NULL
  AND comment_generated_at IS NULL;

-- Set expiration for existing pending comments (expire in 1 hour)
UPDATE linkedin_post_comments
SET expires_at = NOW() + INTERVAL '1 hour'
WHERE status IN ('pending_approval', 'scheduled')
  AND expires_at IS NULL;

-- View for monitoring expiration status
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
