-- Migration: Add master_prospect_id FK to campaign_prospects
-- Purpose: Link campaign prospects to the master workspace_prospects table
-- Date: December 4, 2025

-- ============================================================================
-- ADD FOREIGN KEY TO CAMPAIGN_PROSPECTS
-- ============================================================================

-- Add column for linking to master prospect table
-- Optional FK to maintain backwards compatibility with existing data
ALTER TABLE campaign_prospects
  ADD COLUMN IF NOT EXISTS master_prospect_id UUID REFERENCES workspace_prospects(id);

-- Index for efficient joins
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_master_prospect
  ON campaign_prospects(master_prospect_id)
  WHERE master_prospect_id IS NOT NULL;

-- ============================================================================
-- ADD LINKEDIN URL HASH FOR CONDITIONAL UNIQUE CONSTRAINT
-- ============================================================================

-- Add hash column for deduplication
ALTER TABLE campaign_prospects
  ADD COLUMN IF NOT EXISTS linkedin_url_hash TEXT;

-- Trigger to auto-compute hash
CREATE OR REPLACE FUNCTION compute_campaign_prospect_linkedin_hash()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.linkedin_url IS NOT NULL THEN
    NEW.linkedin_url_hash := LOWER(TRIM(
      REGEXP_REPLACE(
        REGEXP_REPLACE(NEW.linkedin_url, '^https?://(www\.)?linkedin\.com/in/', '', 'i'),
        '/.*$', '', 'i'
      )
    ));
    NEW.linkedin_url_hash := SPLIT_PART(NEW.linkedin_url_hash, '?', 1);
  ELSE
    NEW.linkedin_url_hash := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_compute_campaign_prospect_linkedin_hash ON campaign_prospects;
CREATE TRIGGER trigger_compute_campaign_prospect_linkedin_hash
  BEFORE INSERT OR UPDATE OF linkedin_url ON campaign_prospects
  FOR EACH ROW
  EXECUTE FUNCTION compute_campaign_prospect_linkedin_hash();

-- Backfill existing data
UPDATE campaign_prospects
SET linkedin_url_hash = LOWER(TRIM(
  REGEXP_REPLACE(
    REGEXP_REPLACE(linkedin_url, '^https?://(www\.)?linkedin\.com/in/', '', 'i'),
    '/.*$', '', 'i'
  )
))
WHERE linkedin_url IS NOT NULL AND linkedin_url_hash IS NULL;

-- Index on hash for lookups
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_linkedin_hash
  ON campaign_prospects(workspace_id, linkedin_url_hash)
  WHERE linkedin_url_hash IS NOT NULL;

-- ============================================================================
-- CONDITIONAL UNIQUE CONSTRAINT
-- One prospect can only be in ONE active campaign at a time
-- ============================================================================

-- Active statuses that should block duplicate additions
-- Excludes: completed, failed, withdrawn, connection_failed
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_prospects_unique_active_prospect
  ON campaign_prospects(workspace_id, linkedin_url_hash)
  WHERE linkedin_url_hash IS NOT NULL
    AND status NOT IN ('completed', 'failed', 'withdrawn', 'connection_failed', 'not_found');

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN campaign_prospects.master_prospect_id IS 'FK to workspace_prospects master table. NULL for legacy data.';
COMMENT ON COLUMN campaign_prospects.linkedin_url_hash IS 'Normalized LinkedIn vanity URL for deduplication.';
