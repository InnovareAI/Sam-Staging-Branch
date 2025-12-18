-- Part 2: Create functions and triggers
-- Run this in Supabase SQL Editor AFTER Part 1

-- Function to calculate next business day 6 AM UTC
CREATE OR REPLACE FUNCTION get_next_business_day_6am_utc(from_timestamp TIMESTAMPTZ DEFAULT NOW())
RETURNS TIMESTAMPTZ AS $$
DECLARE
  next_day TIMESTAMPTZ;
  day_of_week INTEGER;
BEGIN
  next_day := DATE_TRUNC('day', from_timestamp AT TIME ZONE 'UTC') + INTERVAL '1 day' + INTERVAL '6 hours';
  day_of_week := EXTRACT(DOW FROM next_day);
  IF day_of_week = 6 THEN
    next_day := next_day + INTERVAL '2 days';
  ELSIF day_of_week = 0 THEN
    next_day := next_day + INTERVAL '1 day';
  END IF;
  RETURN next_day;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger function for posts
CREATE OR REPLACE FUNCTION set_post_expiration()
RETURNS TRIGGER AS $$
BEGIN
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

-- Trigger function for comments
CREATE OR REPLACE FUNCTION set_comment_expiration()
RETURNS TRIGGER AS $$
BEGIN
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

-- Function to expire old content (called by cron)
CREATE OR REPLACE FUNCTION expire_commenting_content()
RETURNS TABLE(posts_expired INTEGER, comments_expired INTEGER) AS $$
DECLARE
  p_count INTEGER := 0;
  c_count INTEGER := 0;
BEGIN
  WITH expired_posts AS (
    UPDATE linkedin_posts_discovered
    SET status = 'expired', expired_at = NOW()
    WHERE status = 'discovered'
      AND expires_at IS NOT NULL
      AND expires_at <= NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO p_count FROM expired_posts;

  WITH expired_comments AS (
    UPDATE linkedin_post_comments
    SET status = 'expired', expired_at = NOW()
    WHERE status IN ('pending_approval', 'scheduled')
      AND expires_at IS NOT NULL
      AND expires_at <= NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO c_count FROM expired_comments;

  RETURN QUERY SELECT p_count, c_count;
END;
$$ LANGUAGE plpgsql;
