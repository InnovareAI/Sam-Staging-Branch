-- Migration: 059-add-funnel-columns.sql
-- Purpose: Add sales funnel tracking columns to campaign_prospects
-- Date: December 18, 2025

-- Add reply sentiment tracking
ALTER TABLE campaign_prospects
ADD COLUMN IF NOT EXISTS reply_sentiment TEXT CHECK (reply_sentiment IN ('positive', 'negative', 'neutral'));

-- Add meeting tracking (we already have meeting_status, meeting_scheduled_at, meeting_id)
ALTER TABLE campaign_prospects
ADD COLUMN IF NOT EXISTS meeting_booked BOOLEAN DEFAULT FALSE;

ALTER TABLE campaign_prospects
ADD COLUMN IF NOT EXISTS meeting_booked_at TIMESTAMPTZ;

-- Add trial signup tracking
ALTER TABLE campaign_prospects
ADD COLUMN IF NOT EXISTS trial_signup BOOLEAN DEFAULT FALSE;

ALTER TABLE campaign_prospects
ADD COLUMN IF NOT EXISTS trial_signup_at TIMESTAMPTZ;

-- Add MRR client tracking
ALTER TABLE campaign_prospects
ADD COLUMN IF NOT EXISTS converted_to_mrr BOOLEAN DEFAULT FALSE;

ALTER TABLE campaign_prospects
ADD COLUMN IF NOT EXISTS mrr_converted_at TIMESTAMPTZ;

ALTER TABLE campaign_prospects
ADD COLUMN IF NOT EXISTS mrr_value NUMERIC(10,2);

-- Create indexes for funnel reporting
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_reply_sentiment ON campaign_prospects(reply_sentiment) WHERE reply_sentiment IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_meeting_booked ON campaign_prospects(meeting_booked) WHERE meeting_booked = TRUE;
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_trial_signup ON campaign_prospects(trial_signup) WHERE trial_signup = TRUE;
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_converted_to_mrr ON campaign_prospects(converted_to_mrr) WHERE converted_to_mrr = TRUE;

-- Comment on columns
COMMENT ON COLUMN campaign_prospects.reply_sentiment IS 'Sentiment of prospect reply: positive, negative, neutral';
COMMENT ON COLUMN campaign_prospects.meeting_booked IS 'Whether a meeting was booked with this prospect';
COMMENT ON COLUMN campaign_prospects.meeting_booked_at IS 'Timestamp when meeting was booked';
COMMENT ON COLUMN campaign_prospects.trial_signup IS 'Whether prospect signed up for trial';
COMMENT ON COLUMN campaign_prospects.trial_signup_at IS 'Timestamp when prospect signed up for trial';
COMMENT ON COLUMN campaign_prospects.converted_to_mrr IS 'Whether prospect converted to paying customer';
COMMENT ON COLUMN campaign_prospects.mrr_converted_at IS 'Timestamp when prospect became paying customer';
COMMENT ON COLUMN campaign_prospects.mrr_value IS 'Monthly recurring revenue from this customer';
