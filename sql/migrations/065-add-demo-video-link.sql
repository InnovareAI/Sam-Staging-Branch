-- Add resource link columns to reply_agent_settings
-- This allows each workspace to configure their own resource links

ALTER TABLE reply_agent_settings
ADD COLUMN IF NOT EXISTS demo_video_link TEXT,
ADD COLUMN IF NOT EXISTS pdf_overview_link TEXT,
ADD COLUMN IF NOT EXISTS case_studies_link TEXT,
ADD COLUMN IF NOT EXISTS landing_page_link TEXT,
ADD COLUMN IF NOT EXISTS signup_link TEXT;

-- Set the InnovareAI workspace links
UPDATE reply_agent_settings
SET
  demo_video_link = 'https://links.innovareai.com/SamAIDemoVideo',
  landing_page_link = 'https://innovareai.com/sam',
  signup_link = 'https://app.meet-sam.com/signup/innovareai'
WHERE workspace_id = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

COMMENT ON COLUMN reply_agent_settings.demo_video_link IS 'Link to demo video';
COMMENT ON COLUMN reply_agent_settings.pdf_overview_link IS 'Link to PDF overview/one-pager';
COMMENT ON COLUMN reply_agent_settings.case_studies_link IS 'Link to case studies';
COMMENT ON COLUMN reply_agent_settings.landing_page_link IS 'Link to product landing page';
COMMENT ON COLUMN reply_agent_settings.signup_link IS 'Link to signup page';
