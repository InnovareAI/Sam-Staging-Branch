-- Add Sam AI columns to existing campaigns table
-- The table exists with: id, workspace_id, name, description, campaign_type, status, 
-- channel_preferences, linkedin_config, email_config, n8n_execution_id, 
-- created_at, updated_at, started_at, completed_at

-- Add the columns that Sam AI MCP tools expect
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS type TEXT,
ADD COLUMN IF NOT EXISTS target_criteria JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS execution_preferences JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS template_id UUID;

-- Add foreign key constraint to messaging_templates
ALTER TABLE campaigns 
ADD CONSTRAINT fk_campaigns_template_id 
FOREIGN KEY (template_id) REFERENCES messaging_templates(id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_type ON campaigns(type);
CREATE INDEX IF NOT EXISTS idx_campaigns_template_id ON campaigns(template_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_target_criteria ON campaigns USING GIN(target_criteria);
CREATE INDEX IF NOT EXISTS idx_campaigns_execution_preferences ON campaigns USING GIN(execution_preferences);

-- Update existing campaigns to have a 'type' value based on campaign_type
UPDATE campaigns 
SET type = CASE 
  WHEN campaign_type = 'linkedin_only' THEN 'sam_signature'
  WHEN campaign_type = 'email_only' THEN 'email'
  WHEN campaign_type = 'both' THEN 'sam_signature'
  ELSE 'custom'
END
WHERE type IS NULL;

-- Add constraint for type column (allowing both old and new values)
ALTER TABLE campaigns 
ADD CONSTRAINT campaigns_type_check 
CHECK (type IN ('sam_signature', 'event_invitation', 'product_launch', 'partnership', 'custom', 'linkedin', 'email'));

-- Add helpful comments
COMMENT ON COLUMN campaigns.type IS 'Sam AI campaign type - maps to template selection and execution strategy';
COMMENT ON COLUMN campaigns.target_criteria IS 'JSON object containing targeting criteria: industry, role, company_size, location';
COMMENT ON COLUMN campaigns.execution_preferences IS 'JSON object containing execution settings: daily_limit, personalization_level, channels, start_date';
COMMENT ON COLUMN campaigns.template_id IS 'Reference to messaging template used for this campaign';

-- Migrate existing data to new format where possible
UPDATE campaigns 
SET 
  target_criteria = COALESCE(
    (SELECT jsonb_build_object(
      'channel_preferences', channel_preferences,
      'linkedin_config', linkedin_config,
      'email_config', email_config
    )),
    '{}'::jsonb
  ),
  execution_preferences = COALESCE(
    (SELECT jsonb_build_object(
      'campaign_type', campaign_type,
      'channels', CASE 
        WHEN campaign_type = 'linkedin_only' THEN '["linkedin"]'::jsonb
        WHEN campaign_type = 'email_only' THEN '["email"]'::jsonb  
        WHEN campaign_type = 'both' THEN '["linkedin", "email"]'::jsonb
        ELSE '[]'::jsonb
      END,
      'personalization_level', 'basic'
    )),
    '{}'::jsonb
  )
WHERE target_criteria = '{}'::jsonb OR execution_preferences = '{}'::jsonb;