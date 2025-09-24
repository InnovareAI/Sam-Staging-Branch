-- Create Campaign Tables for Charissa Campaign System
-- This migration creates the missing campaigns and campaign_prospects tables

-- Create campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  campaign_type TEXT DEFAULT 'linkedin_only',
  status TEXT DEFAULT 'draft',
  channel_preferences JSONB DEFAULT '{"email": false, "linkedin": true}',
  linkedin_config JSONB,
  email_config JSONB,
  n8n_execution_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create campaign_prospects table
CREATE TABLE IF NOT EXISTS campaign_prospects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  company_name TEXT,
  linkedin_url TEXT,
  linkedin_user_id TEXT,
  title TEXT,
  phone TEXT,
  location TEXT,
  industry TEXT,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  personalization_data JSONB DEFAULT '{}',
  n8n_execution_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  contacted_at TIMESTAMP WITH TIME ZONE,
  responded_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_campaigns_workspace_id ON campaigns(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_campaign_id ON campaign_prospects(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_status ON campaign_prospects(status);
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_linkedin_user_id ON campaign_prospects(linkedin_user_id);

-- Enable Row Level Security
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_prospects ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (can be customized later)
CREATE POLICY "Enable all operations for service role" ON campaigns
  FOR ALL USING (true);

CREATE POLICY "Enable all operations for service role" ON campaign_prospects
  FOR ALL USING (true);