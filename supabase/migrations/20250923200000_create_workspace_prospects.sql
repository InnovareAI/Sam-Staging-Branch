-- Create workspace_prospects table for CSV upload functionality
-- Migration: 20250923200000_create_workspace_prospects.sql

CREATE TABLE IF NOT EXISTS workspace_prospects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  company_name TEXT,
  job_title TEXT,
  linkedin_profile_url TEXT NOT NULL,
  email_address TEXT,
  location TEXT,
  industry TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, linkedin_profile_url)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspace_prospects_workspace_id ON workspace_prospects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_prospects_linkedin_url ON workspace_prospects(linkedin_profile_url);

-- Enable RLS
ALTER TABLE workspace_prospects ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for workspace access
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'workspace_prospects' 
    AND policyname = 'Users can access prospects in their workspace'
  ) THEN
    CREATE POLICY "Users can access prospects in their workspace" ON workspace_prospects
      FOR ALL USING (workspace_id = current_setting('app.current_workspace_id', true));
  END IF;
END $$;

-- Create or replace function for adding prospects to campaigns
CREATE OR REPLACE FUNCTION add_prospects_to_campaign(
  p_campaign_id UUID,
  p_prospect_ids UUID[]
) RETURNS VOID AS $$
BEGIN
  INSERT INTO campaign_prospects (campaign_id, prospect_id, status)
  SELECT p_campaign_id, unnest(p_prospect_ids), 'pending'
  ON CONFLICT (campaign_id, prospect_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Create or replace function for resolving LinkedIn IDs
CREATE OR REPLACE FUNCTION resolve_campaign_linkedin_ids(
  p_campaign_id UUID,
  p_user_id UUID
) RETURNS TABLE (
  prospect_id UUID,
  linkedin_profile_url TEXT,
  linkedin_internal_id TEXT,
  resolution_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cp.prospect_id,
    wp.linkedin_profile_url,
    lc.linkedin_internal_id,
    CASE 
      WHEN lc.linkedin_internal_id IS NOT NULL THEN 'found'
      ELSE 'not_found'
    END as resolution_status
  FROM campaign_prospects cp
  JOIN workspace_prospects wp ON cp.prospect_id = wp.id
  LEFT JOIN linkedin_contacts lc ON wp.linkedin_profile_url = lc.linkedin_profile_url
  WHERE cp.campaign_id = p_campaign_id;
END;
$$ LANGUAGE plpgsql;