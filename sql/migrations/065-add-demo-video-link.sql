-- Add demo_video_link column to reply_agent_settings
-- This allows each workspace to configure their own demo video link

ALTER TABLE reply_agent_settings
ADD COLUMN IF NOT EXISTS demo_video_link TEXT;

-- Set the InnovareAI workspace demo link
UPDATE reply_agent_settings
SET demo_video_link = 'https://links.innovareai.com/SAM_Demo'
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

COMMENT ON COLUMN reply_agent_settings.demo_video_link IS 'Link to demo video for this workspace';
