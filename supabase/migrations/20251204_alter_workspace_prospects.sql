-- Migration: Alter workspace_prospects to add approval workflow columns
-- Purpose: Upgrade existing table with new columns for database-driven approval system
-- PRESERVES ALL EXISTING DATA
-- Date: December 4, 2025

-- ============================================================================
-- STEP 1: Add new columns (if they don't exist)
-- ============================================================================

-- Add linkedin_url (copy from linkedin_profile_url)
ALTER TABLE workspace_prospects ADD COLUMN IF NOT EXISTS linkedin_url TEXT;

-- Add linkedin_url_hash for deduplication
ALTER TABLE workspace_prospects ADD COLUMN IF NOT EXISTS linkedin_url_hash TEXT;

-- Add email (copy from email_address)
ALTER TABLE workspace_prospects ADD COLUMN IF NOT EXISTS email TEXT;

-- Add email_hash for deduplication
ALTER TABLE workspace_prospects ADD COLUMN IF NOT EXISTS email_hash TEXT;

-- Add company (copy from company_name)
ALTER TABLE workspace_prospects ADD COLUMN IF NOT EXISTS company TEXT;

-- Add title (copy from job_title)
ALTER TABLE workspace_prospects ADD COLUMN IF NOT EXISTS title TEXT;

-- Add phone
ALTER TABLE workspace_prospects ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add linkedin_provider_id (Unipile's internal ID)
ALTER TABLE workspace_prospects ADD COLUMN IF NOT EXISTS linkedin_provider_id TEXT;

-- Add connection_degree
ALTER TABLE workspace_prospects ADD COLUMN IF NOT EXISTS connection_degree INTEGER;

-- Add approval workflow columns
ALTER TABLE workspace_prospects ADD COLUMN IF NOT EXISTS approval_status TEXT;
ALTER TABLE workspace_prospects ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE workspace_prospects ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE workspace_prospects ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add batch_id for grouping imports (replaces session concept)
ALTER TABLE workspace_prospects ADD COLUMN IF NOT EXISTS batch_id TEXT;

-- Add source tracking
ALTER TABLE workspace_prospects ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- Add enrichment data JSONB
ALTER TABLE workspace_prospects ADD COLUMN IF NOT EXISTS enrichment_data JSONB DEFAULT '{}';

-- Add active_campaign_id to track which campaign the prospect is in
ALTER TABLE workspace_prospects ADD COLUMN IF NOT EXISTS active_campaign_id UUID;

-- ============================================================================
-- STEP 2: Migrate data from old columns to new columns (preserve existing data)
-- ============================================================================

-- Copy linkedin_profile_url → linkedin_url (only where linkedin_url is NULL)
UPDATE workspace_prospects
SET linkedin_url = linkedin_profile_url
WHERE linkedin_url IS NULL AND linkedin_profile_url IS NOT NULL;

-- Copy email_address → email (only where email is NULL)
UPDATE workspace_prospects
SET email = email_address
WHERE email IS NULL AND email_address IS NOT NULL;

-- Copy company_name → company (only where company is NULL)
UPDATE workspace_prospects
SET company = company_name
WHERE company IS NULL AND company_name IS NOT NULL;

-- Copy job_title → title (only where title is NULL)
UPDATE workspace_prospects
SET title = job_title
WHERE title IS NULL AND job_title IS NOT NULL;

-- Set default approval_status for existing records
UPDATE workspace_prospects
SET approval_status = 'approved'
WHERE approval_status IS NULL;

-- Set default source for existing records
UPDATE workspace_prospects
SET source = 'migration'
WHERE source IS NULL OR source = 'manual';

-- ============================================================================
-- STEP 3: Generate hash values for existing records
-- ============================================================================

-- Generate linkedin_url_hash for existing records
UPDATE workspace_prospects
SET linkedin_url_hash = LOWER(TRIM(
  REGEXP_REPLACE(
    REGEXP_REPLACE(linkedin_url, '^https?://(www\.)?linkedin\.com/in/', '', 'i'),
    '/.*$', '', 'i'
  )
))
WHERE linkedin_url IS NOT NULL AND linkedin_url_hash IS NULL;

-- Remove any URL params from hash
UPDATE workspace_prospects
SET linkedin_url_hash = SPLIT_PART(linkedin_url_hash, '?', 1)
WHERE linkedin_url_hash IS NOT NULL AND linkedin_url_hash LIKE '%?%';

-- Generate email_hash for existing records
UPDATE workspace_prospects
SET email_hash = LOWER(TRIM(email))
WHERE email IS NOT NULL AND email_hash IS NULL;

-- ============================================================================
-- STEP 4: Add CHECK constraint for approval_status
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workspace_prospects_approval_status_check'
  ) THEN
    ALTER TABLE workspace_prospects
    ADD CONSTRAINT workspace_prospects_approval_status_check
    CHECK (approval_status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- ============================================================================
-- STEP 5: Create or replace trigger for auto-normalizing identifiers
-- ============================================================================

CREATE OR REPLACE FUNCTION normalize_prospect_identifiers()
RETURNS TRIGGER AS $$
BEGIN
  -- Normalize LinkedIn URL: extract vanity name only
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

-- Drop existing trigger if exists, then create
DROP TRIGGER IF EXISTS trigger_normalize_prospect_identifiers ON workspace_prospects;

CREATE TRIGGER trigger_normalize_prospect_identifiers
  BEFORE INSERT OR UPDATE ON workspace_prospects
  FOR EACH ROW
  EXECUTE FUNCTION normalize_prospect_identifiers();

-- ============================================================================
-- STEP 6: Add new indexes for approval workflow
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_workspace_prospects_linkedin_hash
  ON workspace_prospects(workspace_id, linkedin_url_hash)
  WHERE linkedin_url_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workspace_prospects_email_hash
  ON workspace_prospects(workspace_id, email_hash)
  WHERE email_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workspace_prospects_provider_id
  ON workspace_prospects(linkedin_provider_id)
  WHERE linkedin_provider_id IS NOT NULL;

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
-- STEP 7: Add unique constraints for deduplication (use partial indexes)
-- ============================================================================

-- Drop old unique constraint if it conflicts
DROP INDEX IF EXISTS workspace_prospects_workspace_id_linkedin_profile_url_key;

-- One prospect per LinkedIn URL per workspace
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_prospects_unique_linkedin
  ON workspace_prospects(workspace_id, linkedin_url_hash)
  WHERE linkedin_url_hash IS NOT NULL AND linkedin_url_hash != '';

-- One prospect per email per workspace
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_prospects_unique_email
  ON workspace_prospects(workspace_id, email_hash)
  WHERE email_hash IS NOT NULL AND email_hash != '';

-- ============================================================================
-- STEP 8: Update RLS policies for new columns
-- ============================================================================

-- Drop old policy if exists
DROP POLICY IF EXISTS "Users can access prospects in their workspace" ON workspace_prospects;

-- Users can only see prospects in workspaces they're members of
CREATE POLICY workspace_prospects_select_policy ON workspace_prospects
  FOR SELECT
  USING (
    workspace_id::uuid IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
    OR
    workspace_id::text IN (
      SELECT workspace_id::text FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Users can insert prospects into workspaces they're members of
DROP POLICY IF EXISTS workspace_prospects_insert_policy ON workspace_prospects;
CREATE POLICY workspace_prospects_insert_policy ON workspace_prospects
  FOR INSERT
  WITH CHECK (
    workspace_id::uuid IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
    OR
    workspace_id::text IN (
      SELECT workspace_id::text FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Users can update prospects in workspaces they're members of
DROP POLICY IF EXISTS workspace_prospects_update_policy ON workspace_prospects;
CREATE POLICY workspace_prospects_update_policy ON workspace_prospects
  FOR UPDATE
  USING (
    workspace_id::uuid IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
    OR
    workspace_id::text IN (
      SELECT workspace_id::text FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Users can delete prospects in workspaces they're members of
DROP POLICY IF EXISTS workspace_prospects_delete_policy ON workspace_prospects;
CREATE POLICY workspace_prospects_delete_policy ON workspace_prospects
  FOR DELETE
  USING (
    workspace_id::uuid IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
    OR
    workspace_id::text IN (
      SELECT workspace_id::text FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 9: Add comments for documentation
-- ============================================================================

COMMENT ON TABLE workspace_prospects IS 'Master table for all prospects in a workspace. Single source of truth with database-level deduplication.';
COMMENT ON COLUMN workspace_prospects.linkedin_url_hash IS 'Normalized LinkedIn vanity URL (e.g., "john-doe"). Used for deduplication.';
COMMENT ON COLUMN workspace_prospects.email_hash IS 'Normalized email (lowercase, trimmed). Used for deduplication.';
COMMENT ON COLUMN workspace_prospects.source IS 'How the prospect was added: csv_upload, linkedin_search, manual, or migration';
COMMENT ON COLUMN workspace_prospects.approval_status IS 'Approval workflow status: pending, approved, rejected';
COMMENT ON COLUMN workspace_prospects.batch_id IS 'Groups prospects from same import (replaces session concept)';
COMMENT ON COLUMN workspace_prospects.active_campaign_id IS 'If set, prospect is currently in this campaign';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- All existing data preserved
-- New columns added for approval workflow
-- Hash values generated for deduplication
-- Trigger installed for auto-normalization
-- Indexes created for performance
