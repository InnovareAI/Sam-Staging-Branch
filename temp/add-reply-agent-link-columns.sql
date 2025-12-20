-- Add demo video, one-pager, and free trial link columns to reply_agent_settings
-- These links are used by the Reply Agent to respond to "send me more info" requests

ALTER TABLE reply_agent_settings 
ADD COLUMN IF NOT EXISTS demo_video_link TEXT,
ADD COLUMN IF NOT EXISTS one_pager_link TEXT,
ADD COLUMN IF NOT EXISTS free_trial_link TEXT;

-- Add comment explaining these columns
COMMENT ON COLUMN reply_agent_settings.demo_video_link IS 'Link to demo video for "send me more info" requests';
COMMENT ON COLUMN reply_agent_settings.one_pager_link IS 'Link to one-pager/PDF for detailed info requests';
COMMENT ON COLUMN reply_agent_settings.free_trial_link IS 'Link to free trial signup';

-- Update InnovareAI workspace with default links
UPDATE reply_agent_settings
SET 
  demo_video_link = 'https://links.innovareai.com/SAM_Demo',
  one_pager_link = 'https://innovareai.notion.site/SAM-One-Pager',
  free_trial_link = 'https://app.meet-sam.com/signup/innovareai'
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';
