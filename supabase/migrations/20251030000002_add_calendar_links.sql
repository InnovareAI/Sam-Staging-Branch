-- =====================================================
-- Add Calendar Link Support to Workspaces
-- For Reply Agent to auto-include calendar links
-- Created: October 30, 2025
-- =====================================================

-- Add calendar_settings to workspaces
ALTER TABLE workspaces
ADD COLUMN IF NOT EXISTS calendar_settings JSONB DEFAULT '{}'::jsonb;

-- Update existing workspaces with default calendar settings
UPDATE workspaces
SET calendar_settings = jsonb_build_object(
  'calendar_enabled', false,
  'calendar_provider', 'calendly',
  'calendar_link', '',
  'booking_instructions', 'Feel free to book a time that works for you:',
  'auto_include_on_intent', true
)
WHERE calendar_settings IS NULL OR calendar_settings = '{}'::jsonb;

-- Add index for quick lookup
CREATE INDEX IF NOT EXISTS idx_workspaces_calendar_enabled
ON workspaces ((calendar_settings->>'calendar_enabled'))
WHERE (calendar_settings->>'calendar_enabled')::boolean = true;

-- Example calendar_settings structure:
COMMENT ON COLUMN workspaces.calendar_settings IS
'Calendar configuration for Reply Agent
Example structure:
{
  "calendar_enabled": true,
  "calendar_provider": "calendly" | "cal.com" | "google" | "outlook",
  "calendar_link": "https://calendly.com/username",
  "booking_instructions": "Feel free to book a time that works for you:",
  "auto_include_on_intent": true,
  "team_calendar_links": {
    "user_id_1": "https://calendly.com/user1",
    "user_id_2": "https://calendly.com/user2"
  },
  "calendar_intent_keywords": ["schedule", "call", "meeting", "book", "available"],
  "exclude_keywords": ["not interested", "no thanks"]
}';

-- Function to get calendar link for workspace
CREATE OR REPLACE FUNCTION get_workspace_calendar_link(workspace_uuid UUID)
RETURNS TEXT AS $$
DECLARE
  calendar_link TEXT;
  calendar_enabled BOOLEAN;
BEGIN
  SELECT
    (calendar_settings->>'calendar_link')::TEXT,
    (calendar_settings->>'calendar_enabled')::BOOLEAN
  INTO calendar_link, calendar_enabled
  FROM workspaces
  WHERE id = workspace_uuid;

  IF calendar_enabled AND calendar_link IS NOT NULL AND calendar_link != '' THEN
    RETURN calendar_link;
  ELSE
    RETURN NULL;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_workspace_calendar_link IS 'Returns calendar link if enabled for workspace';
