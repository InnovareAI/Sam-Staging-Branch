-- EXECUTE THIS SQL IN SUPABASE SQL EDITOR
-- Add Sam AI columns to existing campaigns table

-- Add the missing columns that Sam AI MCP tools require
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

-- Update existing campaigns to have 'type' values based on campaign_type
UPDATE campaigns 
SET type = CASE 
  WHEN campaign_type = 'linkedin_only' THEN 'sam_signature'
  WHEN campaign_type = 'email_only' THEN 'email'
  WHEN campaign_type = 'both' THEN 'sam_signature'
  ELSE 'custom'
END
WHERE type IS NULL;

-- Add constraint for type column
ALTER TABLE campaigns 
ADD CONSTRAINT campaigns_type_check 
CHECK (type IN ('sam_signature', 'event_invitation', 'product_launch', 'partnership', 'custom', 'linkedin', 'email'));

-- Add helpful comments
COMMENT ON COLUMN campaigns.type IS 'Sam AI campaign type - maps to template selection';
COMMENT ON COLUMN campaigns.target_criteria IS 'JSON targeting criteria: industry, role, company_size, location';
COMMENT ON COLUMN campaigns.execution_preferences IS 'JSON execution settings: daily_limit, personalization_level, channels';
COMMENT ON COLUMN campaigns.template_id IS 'Reference to messaging template used for this campaign';