-- Add name column to linkedin_post_monitors table
ALTER TABLE linkedin_post_monitors
ADD COLUMN IF NOT EXISTS name TEXT;

-- Add index for faster name searches
CREATE INDEX IF NOT EXISTS idx_linkedin_post_monitors_name
ON linkedin_post_monitors(name);

-- Update existing monitors to have default names based on their type
UPDATE linkedin_post_monitors
SET name = CASE
  WHEN array_length(hashtags, 1) > 0 AND NOT (hashtags[1] LIKE 'PROFILE:%')
    THEN 'Hashtag Monitor - ' || to_char(created_at, 'Mon DD, YYYY')
  WHEN array_length(keywords, 1) > 0
    THEN 'Keyword Monitor - ' || to_char(created_at, 'Mon DD, YYYY')
  WHEN array_length(hashtags, 1) > 0 AND hashtags[1] LIKE 'PROFILE:%'
    THEN 'Profile Monitor - ' || REPLACE(hashtags[1], 'PROFILE:', '')
  ELSE 'Monitor - ' || to_char(created_at, 'Mon DD, YYYY')
END
WHERE name IS NULL;
