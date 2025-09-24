-- Add Sam AI fields to existing campaigns table
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS target_criteria JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS execution_preferences JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS template_id UUID,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Add foreign key constraint to messaging_templates
ALTER TABLE campaigns 
ADD CONSTRAINT fk_campaigns_template_id 
FOREIGN KEY (template_id) REFERENCES messaging_templates(id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_template_id ON campaigns(template_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_target_criteria ON campaigns USING GIN(target_criteria);
CREATE INDEX IF NOT EXISTS idx_campaigns_execution_preferences ON campaigns USING GIN(execution_preferences);

-- Update campaign type constraint to include Sam AI types
ALTER TABLE campaigns 
DROP CONSTRAINT IF EXISTS campaigns_type_check;

ALTER TABLE campaigns 
ADD CONSTRAINT campaigns_type_check 
CHECK (type IN ('sam_signature', 'event_invitation', 'product_launch', 'partnership', 'custom', 'linkedin', 'email'));

-- Add helpful comments
COMMENT ON COLUMN campaigns.target_criteria IS 'JSON object containing targeting criteria: industry, role, company_size, location';
COMMENT ON COLUMN campaigns.execution_preferences IS 'JSON object containing execution settings: daily_limit, personalization_level, channels, start_date';
COMMENT ON COLUMN campaigns.template_id IS 'Reference to messaging template used for this campaign';