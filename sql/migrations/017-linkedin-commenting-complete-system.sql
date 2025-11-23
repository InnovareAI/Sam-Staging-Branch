-- LinkedIn Commenting System - Complete Database Schema
-- Replaces Airtable with Supabase for $0/month solution
-- Date: November 23, 2025

-- ============================================================================
-- Table 1: Monitored LinkedIn Profiles
-- ============================================================================
-- Stores the list of LinkedIn profiles we want to monitor and comment on
-- Replaces: Airtable "Profiles" table

CREATE TABLE IF NOT EXISTS linkedin_profiles_to_monitor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- LinkedIn profile identifiers
  vanity_name VARCHAR(255) NOT NULL, -- e.g., "tvonlinz", "sama", "andrewng"
  provider_id VARCHAR(255),          -- Cached from Unipile: "ACoAAACYv0MB5sgfg5P09EbKyGzp2OH-qwKEmgc"

  -- Profile metadata (from Unipile lookup)
  profile_name VARCHAR(255),         -- e.g., "Thorsten Linz"
  headline TEXT,                     -- e.g., "CEO @ InnovareAI..."
  follower_count INTEGER,
  location VARCHAR(255),

  -- Configuration
  is_active BOOLEAN DEFAULT true,
  keywords TEXT[],                   -- Filter posts by these keywords (e.g., ["#GenAI", "#AI"])

  -- Timestamps
  last_scraped_at TIMESTAMP,
  provider_id_updated_at TIMESTAMP,  -- When we last refreshed the provider_id
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  UNIQUE(workspace_id, vanity_name)
);

CREATE INDEX idx_profiles_workspace ON linkedin_profiles_to_monitor(workspace_id);
CREATE INDEX idx_profiles_active ON linkedin_profiles_to_monitor(workspace_id, is_active);

-- ============================================================================
-- Table 2: Discovered LinkedIn Posts
-- ============================================================================
-- Stores posts scraped from monitored profiles
-- Replaces: Airtable "Posts" table

CREATE TABLE IF NOT EXISTS linkedin_discovered_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES linkedin_profiles_to_monitor(id) ON DELETE CASCADE,

  -- LinkedIn post identifiers
  social_id VARCHAR(255) NOT NULL,   -- LinkedIn URN: "7386026924579397633"
  post_url TEXT NOT NULL,            -- Full LinkedIn post URL

  -- Post content
  post_text TEXT NOT NULL,           -- Full text of the post
  author_name VARCHAR(255),
  author_headline TEXT,
  posted_date VARCHAR(50),           -- e.g., "1mo", "2d", "3h"

  -- Engagement metrics
  comment_count INTEGER DEFAULT 0,
  reaction_count INTEGER DEFAULT 0,

  -- Comment generation
  ai_comment TEXT,                   -- Generated comment (before posting)
  comment_status VARCHAR(50) DEFAULT 'new', -- 'new', 'commented', 'skipped', 'failed'

  -- Metadata
  commented_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  UNIQUE(workspace_id, social_id)
);

CREATE INDEX idx_posts_workspace ON linkedin_discovered_posts(workspace_id);
CREATE INDEX idx_posts_profile ON linkedin_discovered_posts(profile_id);
CREATE INDEX idx_posts_status ON linkedin_discovered_posts(workspace_id, comment_status);
CREATE INDEX idx_posts_social_id ON linkedin_discovered_posts(social_id);

-- ============================================================================
-- Table 3: Brand Voice Guidelines
-- ============================================================================
-- Stores tone of voice and brand guidelines for AI comment generation
-- Replaces: Airtable "Brand" table

CREATE TABLE IF NOT EXISTS linkedin_brand_guidelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Brand voice guidelines
  tone_of_voice TEXT NOT NULL,       -- How to speak (friendly, professional, etc.)
  writing_style TEXT,                -- Style guidelines (short sentences, etc.)
  topics_and_perspective TEXT,       -- What you care about
  dos_and_donts TEXT,                -- Rules to follow/avoid

  -- Comment framework
  comment_framework TEXT DEFAULT 'ACA+I: Acknowledge, Add nuance, drop an I-statement, ask a warm question',
  max_characters INTEGER DEFAULT 300,

  -- System prompt
  system_prompt TEXT DEFAULT 'You are an AI agent replying as a real person to LinkedIn posts. Write replies that sound like a sharp, trusted friend—confident, human, and curious. Professional but warm.',

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints (one active guideline per workspace)
  UNIQUE(workspace_id, is_active)
);

CREATE INDEX idx_brand_workspace ON linkedin_brand_guidelines(workspace_id);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE linkedin_profiles_to_monitor ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_discovered_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_brand_guidelines ENABLE ROW LEVEL SECURITY;

-- Profiles RLS
CREATE POLICY "Users can view profiles in their workspace"
  ON linkedin_profiles_to_monitor FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert profiles in their workspace"
  ON linkedin_profiles_to_monitor FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update profiles in their workspace"
  ON linkedin_profiles_to_monitor FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete profiles in their workspace"
  ON linkedin_profiles_to_monitor FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Posts RLS
CREATE POLICY "Users can view posts in their workspace"
  ON linkedin_discovered_posts FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert posts in their workspace"
  ON linkedin_discovered_posts FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update posts in their workspace"
  ON linkedin_discovered_posts FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Brand Guidelines RLS
CREATE POLICY "Users can view brand guidelines in their workspace"
  ON linkedin_brand_guidelines FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert brand guidelines in their workspace"
  ON linkedin_brand_guidelines FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update brand guidelines in their workspace"
  ON linkedin_brand_guidelines FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- Functions for N8N Workflow
-- ============================================================================

-- Get active profiles that need scraping
CREATE OR REPLACE FUNCTION get_profiles_to_scrape(p_workspace_id UUID)
RETURNS TABLE (
  id UUID,
  vanity_name VARCHAR(255),
  provider_id VARCHAR(255),
  keywords TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    lp.id,
    lp.vanity_name,
    lp.provider_id,
    lp.keywords
  FROM linkedin_profiles_to_monitor lp
  WHERE lp.workspace_id = p_workspace_id
    AND lp.is_active = true
  ORDER BY lp.last_scraped_at ASC NULLS FIRST
  LIMIT 20; -- Scrape max 20 profiles per run
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get posts that need comments
CREATE OR REPLACE FUNCTION get_posts_needing_comments(p_workspace_id UUID)
RETURNS TABLE (
  id UUID,
  social_id VARCHAR(255),
  post_url TEXT,
  post_text TEXT,
  author_name VARCHAR(255)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ldp.id,
    ldp.social_id,
    ldp.post_url,
    ldp.post_text,
    ldp.author_name
  FROM linkedin_discovered_posts ldp
  WHERE ldp.workspace_id = p_workspace_id
    AND ldp.comment_status = 'new'
    AND ldp.ai_comment IS NULL
  ORDER BY ldp.created_at ASC
  LIMIT 1; -- Comment on 1 post per run
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Sample Data (for testing)
-- ============================================================================

-- Insert sample brand guidelines
INSERT INTO linkedin_brand_guidelines (
  workspace_id,
  tone_of_voice,
  writing_style,
  topics_and_perspective,
  dos_and_donts
) VALUES (
  'babdcab8-1a78-4b2f-913e-6e9fd9821009', -- Replace with your workspace_id
  E'Talk like you\'re texting a smart friend who gets business. Be confident without being a know-it-all.',
  E'Cut the fluff. Say what you mean. Short, punchy sentences. Focus on what\'s possible, not what\'s broken.',
  E'AI, automation, B2B SaaS, sales processes, productivity, entrepreneurship',
  E'DO: Be optimistic, practical, curious\nDON\'T: Use emojis, hashtags, semicolons, em-dashes, "game changer", "here\'s the kicker"'
) ON CONFLICT (workspace_id, is_active) DO NOTHING;

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Update existing linkedin_post_monitors table to add profile_vanities if needed
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'linkedin_post_monitors') THEN
    ALTER TABLE linkedin_post_monitors ADD COLUMN IF NOT EXISTS profile_vanities TEXT[];
    ALTER TABLE linkedin_post_monitors ADD COLUMN IF NOT EXISTS profile_provider_ids TEXT[];
  END IF;
END $$;

COMMENT ON TABLE linkedin_profiles_to_monitor IS 'LinkedIn profiles we monitor for commenting opportunities (replaces Airtable Profiles)';
COMMENT ON TABLE linkedin_discovered_posts IS 'Posts scraped from monitored profiles (replaces Airtable Posts)';
COMMENT ON TABLE linkedin_brand_guidelines IS 'Brand voice and tone guidelines for AI comments (replaces Airtable Brand)';
