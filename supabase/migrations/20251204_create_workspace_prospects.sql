-- Migration: Create workspace_prospects master table
-- Purpose: Single source of truth for all prospect data with database-level deduplication
-- Date: December 4, 2025

-- ============================================================================
-- WORKSPACE_PROSPECTS: Master prospect table
-- ============================================================================
-- All prospects are stored here first, then referenced from:
--   - prospect_approval_data (for approval workflow)
--   - campaign_prospects (for campaign execution)
-- This enables workspace-level deduplication and prevents duplicate outreach.

CREATE TABLE IF NOT EXISTS workspace_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- ========================================
  -- IDENTITY FIELDS (used for deduplication)
  -- ========================================
  linkedin_url TEXT,
  -- Normalized hash for matching (strips protocol, www, trailing slash)
  -- Example: "https://www.linkedin.com/in/john-doe/" → "john-doe"
  linkedin_url_hash TEXT,

  email TEXT,
  -- Normalized email for matching (lowercase, trimmed)
  email_hash TEXT,

  -- ========================================
  -- PROFILE DATA
  -- ========================================
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  title TEXT,
  location TEXT,
  phone TEXT,

  -- ========================================
  -- LINKEDIN-SPECIFIC DATA
  -- ========================================
  linkedin_provider_id TEXT,  -- Unipile's internal ID for the profile
  connection_degree INTEGER,  -- 1st, 2nd, 3rd degree connection

  -- ========================================
  -- APPROVAL STATUS (Database-driven, no sessions)
  -- ========================================
  approval_status TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Batch ID for grouping imports (replaces session concept)
  -- Generated as: source_workspaceId_timestamp
  batch_id TEXT,

  -- ========================================
  -- METADATA
  -- ========================================
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('csv_upload', 'linkedin_search', 'manual', 'migration')),
  enrichment_data JSONB DEFAULT '{}',

  -- ========================================
  -- CAMPAIGN TRACKING
  -- ========================================
  -- Track which campaigns this prospect has been added to
  -- Prevents adding same prospect to multiple active campaigns
  active_campaign_id UUID REFERENCES campaigns(id),

  -- ========================================
  -- TIMESTAMPS
  -- ========================================
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TRIGGER: Auto-generate hash fields on insert/update
-- ============================================================================

CREATE OR REPLACE FUNCTION normalize_prospect_identifiers()
RETURNS TRIGGER AS $$
BEGIN
  -- Normalize LinkedIn URL: extract vanity name only
  -- Handles: https://linkedin.com/in/john-doe/, http://www.linkedin.com/in/john-doe, etc.
  IF NEW.linkedin_url IS NOT NULL THEN
    NEW.linkedin_url_hash := LOWER(TRIM(
      REGEXP_REPLACE(
        REGEXP_REPLACE(NEW.linkedin_url, '^https?://(www\.)?linkedin\.com/in/', '', 'i'),
        '/.*$', '', 'i'
      )
    ));
    -- Remove any remaining URL params
    NEW.linkedin_url_hash := SPLIT_PART(NEW.linkedin_url_hash, '?', 1);
  ELSE
    NEW.linkedin_url_hash := NULL;
  END IF;

  -- Normalize email: lowercase and trim
  IF NEW.email IS NOT NULL THEN
    NEW.email_hash := LOWER(TRIM(NEW.email));
  ELSE
    NEW.email_hash := NULL;
  END IF;

  -- Update timestamp
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_normalize_prospect_identifiers
  BEFORE INSERT OR UPDATE ON workspace_prospects
  FOR EACH ROW
  EXECUTE FUNCTION normalize_prospect_identifiers();

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_workspace_prospects_workspace
  ON workspace_prospects(workspace_id);

CREATE INDEX IF NOT EXISTS idx_workspace_prospects_linkedin_hash
  ON workspace_prospects(workspace_id, linkedin_url_hash)
  WHERE linkedin_url_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workspace_prospects_email_hash
  ON workspace_prospects(workspace_id, email_hash)
  WHERE email_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workspace_prospects_provider_id
  ON workspace_prospects(linkedin_provider_id)
  WHERE linkedin_provider_id IS NOT NULL;

-- Approval workflow indexes
CREATE INDEX IF NOT EXISTS idx_workspace_prospects_approval_status
  ON workspace_prospects(workspace_id, approval_status)
  WHERE approval_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workspace_prospects_batch
  ON workspace_prospects(workspace_id, batch_id)
  WHERE batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workspace_prospects_active_campaign
  ON workspace_prospects(active_campaign_id)
  WHERE active_campaign_id IS NOT NULL;

-- Approved prospects waiting to be added to campaigns
CREATE INDEX IF NOT EXISTS idx_workspace_prospects_approved_available
  ON workspace_prospects(workspace_id, approval_status)
  WHERE approval_status = 'approved' AND active_campaign_id IS NULL;

-- ============================================================================
-- UNIQUE CONSTRAINTS (Database-level deduplication)
-- ============================================================================

-- One prospect per LinkedIn URL per workspace
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_prospects_unique_linkedin
  ON workspace_prospects(workspace_id, linkedin_url_hash)
  WHERE linkedin_url_hash IS NOT NULL AND linkedin_url_hash != '';

-- One prospect per email per workspace (optional - email can be shared)
-- Note: Using partial index so NULL emails don't conflict
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_prospects_unique_email
  ON workspace_prospects(workspace_id, email_hash)
  WHERE email_hash IS NOT NULL AND email_hash != '';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE workspace_prospects ENABLE ROW LEVEL SECURITY;

-- Users can only see prospects in workspaces they're members of
CREATE POLICY workspace_prospects_select_policy ON workspace_prospects
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Users can insert prospects into workspaces they're members of
CREATE POLICY workspace_prospects_insert_policy ON workspace_prospects
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Users can update prospects in workspaces they're members of
CREATE POLICY workspace_prospects_update_policy ON workspace_prospects
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Users can delete prospects in workspaces they're members of
CREATE POLICY workspace_prospects_delete_policy ON workspace_prospects
  FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE workspace_prospects IS 'Master table for all prospects in a workspace. Single source of truth with database-level deduplication.';
COMMENT ON COLUMN workspace_prospects.linkedin_url_hash IS 'Normalized LinkedIn vanity URL (e.g., "john-doe"). Used for deduplication.';
COMMENT ON COLUMN workspace_prospects.email_hash IS 'Normalized email (lowercase, trimmed). Used for deduplication.';
COMMENT ON COLUMN workspace_prospects.source IS 'How the prospect was added: csv_upload, linkedin_search, manual, or migration';
