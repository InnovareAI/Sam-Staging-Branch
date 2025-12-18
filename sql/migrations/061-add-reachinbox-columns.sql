-- Migration: 061-add-reachinbox-columns.sql
-- Purpose: Add ReachInbox tracking columns to campaigns table
-- Date: December 18, 2025

-- ReachInbox campaign ID
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS reachinbox_campaign_id TEXT;

-- Email metrics from ReachInbox
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS total_emails_sent INTEGER DEFAULT 0;

ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS total_emails_opened INTEGER DEFAULT 0;

ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS total_emails_replied INTEGER DEFAULT 0;

ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS total_emails_bounced INTEGER DEFAULT 0;

ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS total_link_clicked INTEGER DEFAULT 0;

ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS leads_count INTEGER DEFAULT 0;

-- Index for ReachInbox lookup
CREATE INDEX IF NOT EXISTS idx_campaigns_reachinbox_id ON campaigns(reachinbox_campaign_id) WHERE reachinbox_campaign_id IS NOT NULL;

-- Comment
COMMENT ON COLUMN campaigns.reachinbox_campaign_id IS 'ReachInbox campaign ID for email-only campaigns';
COMMENT ON COLUMN campaigns.total_emails_sent IS 'Total emails sent via ReachInbox';
COMMENT ON COLUMN campaigns.total_emails_opened IS 'Total emails opened (from ReachInbox tracking)';
COMMENT ON COLUMN campaigns.total_emails_replied IS 'Total email replies received';
COMMENT ON COLUMN campaigns.total_emails_bounced IS 'Total emails bounced';
COMMENT ON COLUMN campaigns.total_link_clicked IS 'Total links clicked in emails';
COMMENT ON COLUMN campaigns.leads_count IS 'Total leads in campaign';
