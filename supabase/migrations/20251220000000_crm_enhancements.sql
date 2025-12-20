-- Migration: 20251220000000_crm_enhancements.sql
-- Purpose: Add company_size and country fields for better CRM/Airtable sync
-- Also creates oauth_states table for calendar integrations

-- Add company_size to workspace_prospects
ALTER TABLE workspace_prospects ADD COLUMN IF NOT EXISTS company_size TEXT;

-- Add company_size to campaign_prospects
ALTER TABLE campaign_prospects ADD COLUMN IF NOT EXISTS company_size TEXT;
ALTER TABLE campaign_prospects ADD COLUMN IF NOT EXISTS country TEXT;

-- Create oauth_states table for Calendly/Cal.com OAuth
CREATE TABLE IF NOT EXISTS public.oauth_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state TEXT UNIQUE NOT NULL,
    provider TEXT NOT NULL, -- 'calendly' or 'calcom'
    workspace_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour')
);

-- Enable RLS on oauth_states
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- Simple RLS policy for oauth_states
CREATE POLICY "Enable all operations for service role" ON public.oauth_states
  FOR ALL USING (true);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON public.oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_workspace_prospects_company_size ON workspace_prospects(company_size);
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_company_size ON campaign_prospects(company_size);
