-- Agent Support Tables
-- Created Nov 29, 2025

-- Reply classifications
ALTER TABLE campaign_replies ADD COLUMN IF NOT EXISTS classification VARCHAR(50);
ALTER TABLE campaign_replies ADD COLUMN IF NOT EXISTS classification_confidence DECIMAL(3,2);
ALTER TABLE campaign_replies ADD COLUMN IF NOT EXISTS classification_metadata JSONB;
ALTER TABLE campaign_replies ADD COLUMN IF NOT EXISTS requires_human_review BOOLEAN DEFAULT false;

-- Campaign optimizations
CREATE TABLE IF NOT EXISTS campaign_optimizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  metrics JSONB NOT NULL DEFAULT '{}',
  suggestions JSONB NOT NULL DEFAULT '[]',
  applied_suggestions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_optimizations_campaign ON campaign_optimizations(campaign_id);

-- Prospect scoring
ALTER TABLE campaign_prospects ADD COLUMN IF NOT EXISTS engagement_score INTEGER;
ALTER TABLE campaign_prospects ADD COLUMN IF NOT EXISTS priority_level VARCHAR(20);
ALTER TABLE campaign_prospects ADD COLUMN IF NOT EXISTS scoring_metadata JSONB;

-- Rate limit tracking
CREATE TABLE IF NOT EXISTS account_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  date DATE NOT NULL,
  daily_cr_sent INTEGER DEFAULT 0,
  weekly_cr_sent INTEGER DEFAULT 0,
  daily_messages_sent INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'healthy',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, date)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_account_date ON account_rate_limits(account_id, date DESC);

-- Workspace analytics reports
CREATE TABLE IF NOT EXISTS workspace_analytics_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}',
  ai_insights JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_workspace ON workspace_analytics_reports(workspace_id);
CREATE INDEX IF NOT EXISTS idx_analytics_period ON workspace_analytics_reports(period_start DESC);

-- Grant access
GRANT ALL ON campaign_optimizations TO authenticated;
GRANT ALL ON account_rate_limits TO authenticated;
GRANT ALL ON workspace_analytics_reports TO authenticated;
