-- Anti-Bot Detection Configuration
-- This solves PowerIn's fatal flaw: comments appearing first/too fast

-- Add anti-bot detection settings to campaign table
ALTER TABLE linkedin_comment_campaigns
ADD COLUMN IF NOT EXISTS min_existing_comments INT DEFAULT 2,
ADD COLUMN IF NOT EXISTS min_post_reactions INT DEFAULT 5,
ADD COLUMN IF NOT EXISTS min_post_age_minutes INT DEFAULT 30,
ADD COLUMN IF NOT EXISTS max_post_age_hours INT DEFAULT 24,
ADD COLUMN IF NOT EXISTS max_comments_threshold INT DEFAULT 50,
ADD COLUMN IF NOT EXISTS random_delay_min_minutes INT DEFAULT 15,
ADD COLUMN IF NOT EXISTS random_delay_max_minutes INT DEFAULT 90,
ADD COLUMN IF NOT EXISTS active_hours INT[] DEFAULT ARRAY[8,9,10,11,14,15,16,17,18],
ADD COLUMN IF NOT EXISTS hourly_comment_limit INT DEFAULT 3,
ADD COLUMN IF NOT EXISTS min_minutes_between_comments INT DEFAULT 20,
ADD COLUMN IF NOT EXISTS topic_cooldown_hours INT DEFAULT 4,
ADD COLUMN IF NOT EXISTS skip_probability DECIMAL DEFAULT 0.3 CHECK (skip_probability BETWEEN 0 AND 1);

-- Add comment position tracking to posts queue
ALTER TABLE linkedin_posts_queue
ADD COLUMN IF NOT EXISTS post_comment_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS post_reaction_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS post_age_minutes INT,
ADD COLUMN IF NOT EXISTS estimated_comment_position INT,
ADD COLUMN IF NOT EXISTS passes_bot_detection BOOLEAN DEFAULT FALSE;

-- Function to check if post passes anti-bot detection
CREATE OR REPLACE FUNCTION check_anti_bot_criteria(
  campaign_uuid UUID,
  post_comments INT,
  post_reactions INT,
  post_age_min INT,
  post_age_hours INT
) RETURNS BOOLEAN AS $$
DECLARE
  campaign_settings RECORD;
BEGIN
  -- Get campaign anti-bot settings
  SELECT
    min_existing_comments,
    min_post_reactions,
    min_post_age_minutes,
    max_post_age_hours,
    max_comments_threshold
  INTO campaign_settings
  FROM linkedin_comment_campaigns
  WHERE id = campaign_uuid;

  -- Check all criteria
  RETURN (
    post_comments >= campaign_settings.min_existing_comments AND
    post_comments < campaign_settings.max_comments_threshold AND
    post_reactions >= campaign_settings.min_post_reactions AND
    post_age_min >= campaign_settings.min_post_age_minutes AND
    post_age_hours <= campaign_settings.max_post_age_hours
  );
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-check bot detection criteria when post is added to queue
CREATE OR REPLACE FUNCTION trigger_check_bot_detection()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate post age in minutes and hours
  NEW.post_age_minutes = EXTRACT(EPOCH FROM (NOW() - NEW.post_date)) / 60;

  -- Estimate comment position (current comments + 1)
  NEW.estimated_comment_position = NEW.post_comment_count + 1;

  -- Check if passes anti-bot detection
  NEW.passes_bot_detection = check_anti_bot_criteria(
    NEW.campaign_id,
    NEW.post_comment_count,
    NEW.post_reaction_count,
    NEW.post_age_minutes::INT,
    (NEW.post_age_minutes / 60)::INT
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_post_queue_insert_check_bot
  BEFORE INSERT ON linkedin_posts_queue
  FOR EACH ROW
  EXECUTE FUNCTION trigger_check_bot_detection();

-- Add last comment timestamp to workspace to enforce spacing
CREATE TABLE IF NOT EXISTS linkedin_comment_rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES linkedin_comment_campaigns(id) ON DELETE CASCADE,

  last_comment_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_comment_topic TEXT,
  comments_this_hour INT DEFAULT 1,
  comments_today INT DEFAULT 1,

  UNIQUE(workspace_id, campaign_id, DATE(last_comment_at))
);

-- Function to check if can comment now (rate limiting)
CREATE OR REPLACE FUNCTION can_comment_now(
  ws_id UUID,
  camp_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  last_comment TIMESTAMP;
  comments_hour INT;
  comments_day INT;
  campaign_limits RECORD;
BEGIN
  -- Get campaign limits
  SELECT
    hourly_comment_limit,
    max_comments_per_day,
    min_minutes_between_comments
  INTO campaign_limits
  FROM linkedin_comment_campaigns
  WHERE id = camp_id;

  -- Get recent activity
  SELECT
    last_comment_at,
    SUM(CASE WHEN last_comment_at > NOW() - INTERVAL '1 hour' THEN 1 ELSE 0 END) as hour_count,
    SUM(CASE WHEN DATE(last_comment_at) = CURRENT_DATE THEN 1 ELSE 0 END) as day_count
  INTO last_comment, comments_hour, comments_day
  FROM linkedin_comment_rate_limits
  WHERE workspace_id = ws_id AND campaign_id = camp_id
  GROUP BY last_comment_at;

  -- Check constraints
  RETURN (
    (last_comment IS NULL OR
     EXTRACT(EPOCH FROM (NOW() - last_comment)) / 60 >= campaign_limits.min_minutes_between_comments) AND
    (comments_hour IS NULL OR comments_hour < campaign_limits.hourly_comment_limit) AND
    (comments_day IS NULL OR comments_day < campaign_limits.max_comments_per_day)
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_anti_bot_criteria IS 'Prevents bot-like behavior by ensuring posts have organic engagement before commenting';
COMMENT ON FUNCTION can_comment_now IS 'Rate limiting to prevent suspicious rapid-fire commenting patterns';
