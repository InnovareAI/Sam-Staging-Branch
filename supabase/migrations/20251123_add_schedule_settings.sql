-- Add schedule_settings column to campaigns table
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS schedule_settings JSONB DEFAULT NULL;

-- Comment on column
COMMENT ON COLUMN campaigns.schedule_settings IS 'Configuration for campaign schedule: timezone, working_hours, skip_weekends, etc.';
