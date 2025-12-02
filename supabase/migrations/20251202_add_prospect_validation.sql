-- Add prospect validation fields
-- Tracks data quality issues that prevent prospects from entering campaigns

ALTER TABLE campaign_prospects
ADD COLUMN IF NOT EXISTS validation_status VARCHAR(20) DEFAULT 'valid',
ADD COLUMN IF NOT EXISTS validation_errors JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS validation_warnings JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS has_previous_contact BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS previous_contact_status TEXT,
ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;

-- Add index for filtering valid prospects
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_validation
ON campaign_prospects(validation_status, status)
WHERE validation_status != 'valid';

-- Add check constraint for validation_status
ALTER TABLE campaign_prospects
DROP CONSTRAINT IF EXISTS campaign_prospects_validation_status_check;

ALTER TABLE campaign_prospects
ADD CONSTRAINT campaign_prospects_validation_status_check
CHECK (validation_status IN ('valid', 'warning', 'error', 'blocked'));

COMMENT ON COLUMN campaign_prospects.validation_status IS 'Data quality status: valid (can campaign), warning (missing optional data), error (missing required data), blocked (previous contact/failed)';
COMMENT ON COLUMN campaign_prospects.validation_errors IS 'Array of error messages preventing campaign inclusion';
COMMENT ON COLUMN campaign_prospects.validation_warnings IS 'Array of warning messages for incomplete data';
COMMENT ON COLUMN campaign_prospects.has_previous_contact IS 'TRUE if prospect was previously contacted in another campaign';
COMMENT ON COLUMN campaign_prospects.previous_contact_status IS 'Status from previous campaign contact attempt';
