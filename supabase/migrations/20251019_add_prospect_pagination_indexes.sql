-- Migration: Add indexes for efficient prospect pagination
-- Date: 2025-10-19
-- Purpose: Optimize Data Approval page queries for 1000+ prospects with server-side pagination

-- Index for paginated queries with status filter and enrichment score sorting
-- Covers: session_id, approval_status filter, enrichment_score DESC sort
CREATE INDEX IF NOT EXISTS idx_prospects_session_status_score
ON prospect_approval_data(session_id, approval_status, enrichment_score DESC)
WHERE approval_status IS NOT NULL;

-- Index for paginated queries with timestamp sorting (newest first)
-- Covers: session_id, created_at DESC sort
CREATE INDEX IF NOT EXISTS idx_prospects_session_created
ON prospect_approval_data(session_id, created_at DESC);

-- Index for workspace-level queries (admin views, reporting)
-- Covers: workspace_id, created_at DESC
CREATE INDEX IF NOT EXISTS idx_prospects_workspace_created
ON prospect_approval_data(workspace_id, created_at DESC);

-- Partial index for pending prospects only (most common query)
-- Smaller index = faster queries for pending status
CREATE INDEX IF NOT EXISTS idx_prospects_session_pending
ON prospect_approval_data(session_id, enrichment_score DESC)
WHERE approval_status = 'pending';

-- Comment explaining indexes
COMMENT ON INDEX idx_prospects_session_status_score IS
'Optimizes paginated queries filtering by status and sorting by quality score';

COMMENT ON INDEX idx_prospects_session_created IS
'Optimizes paginated queries sorting by creation date (newest first)';

COMMENT ON INDEX idx_prospects_workspace_created IS
'Optimizes workspace-level queries and admin reporting';

COMMENT ON INDEX idx_prospects_session_pending IS
'Partial index for common pending-only queries - faster and smaller';
