-- Enhance campaigns table for Sam AI MCP integration
-- Add fields needed for Sam-first campaign orchestration

ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS target_criteria JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS execution_preferences JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES messaging_templates(id),
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_campaigns_template_id ON campaigns(template_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_type ON campaigns(type);

-- Update campaign types to include new Sam AI types
ALTER TABLE campaigns 
DROP CONSTRAINT IF EXISTS campaigns_type_check;

ALTER TABLE campaigns 
ADD CONSTRAINT campaigns_type_check 
CHECK (type IN ('sam_signature', 'event_invitation', 'product_launch', 'partnership', 'custom', 'linkedin', 'email'));

-- Add comment for documentation
COMMENT ON COLUMN campaigns.target_criteria IS 'JSON object containing targeting criteria: industry, role, company_size, location';
COMMENT ON COLUMN campaigns.execution_preferences IS 'JSON object containing execution settings: daily_limit, personalization_level, channels, start_date';
COMMENT ON COLUMN campaigns.template_id IS 'Reference to messaging template used for this campaign';
COMMENT ON COLUMN campaigns.started_at IS 'Timestamp when campaign execution began';
COMMENT ON COLUMN campaigns.completed_at IS 'Timestamp when campaign completed';