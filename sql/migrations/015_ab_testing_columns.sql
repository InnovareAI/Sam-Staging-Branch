-- A/B Testing Columns Migration
-- Adds variant tracking to send_queue, email_send_queue, and campaign_prospects tables
-- Supports A/B testing for all campaign types: Connector, Messenger, Email

-- Add variant column to send_queue (LinkedIn campaigns: Connector/Messenger)
-- This tracks which variant (A or B) was sent for each message
ALTER TABLE send_queue
ADD COLUMN IF NOT EXISTS variant VARCHAR(10);

COMMENT ON COLUMN send_queue.variant IS 'A/B test variant: A or B (null if no A/B testing)';

-- Add variant column to email_send_queue (Email campaigns)
-- This tracks which variant (A or B) was sent for each email
ALTER TABLE email_send_queue
ADD COLUMN IF NOT EXISTS variant VARCHAR(10);

COMMENT ON COLUMN email_send_queue.variant IS 'A/B test variant: A or B (null if no A/B testing)';

-- Add variant column to campaign_prospects
-- This tracks the assigned variant for each prospect
ALTER TABLE campaign_prospects
ADD COLUMN IF NOT EXISTS ab_variant VARCHAR(10);

COMMENT ON COLUMN campaign_prospects.ab_variant IS 'A/B test variant assigned to this prospect: A or B';

-- Index for efficient A/B test result queries (LinkedIn)
CREATE INDEX IF NOT EXISTS idx_send_queue_variant
ON send_queue(campaign_id, variant)
WHERE variant IS NOT NULL;

-- Index for efficient A/B test result queries (Email)
CREATE INDEX IF NOT EXISTS idx_email_send_queue_variant
ON email_send_queue(campaign_id, variant)
WHERE variant IS NOT NULL;

-- Index for prospect variant queries
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_ab_variant
ON campaign_prospects(campaign_id, ab_variant)
WHERE ab_variant IS NOT NULL;

-- Note: A/B test configuration is stored in campaigns.message_templates JSONB:
-- {
--   "connection_request": "Variant A message...",
--   "connection_request_b": "Variant B message...",
--   "initial_message": "Variant A for messenger...",
--   "initial_message_b": "Variant B for messenger...",
--   "email_body": "Variant A for email...",
--   "email_body_b": "Variant B for email...",
--   "ab_testing_enabled": true
-- }
