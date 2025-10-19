-- Migration: Add indexes for efficient prospect pagination
-- Date: 2025-10-19
-- Purpose: Optimize Data Approval page queries for 1000+ prospects with server-side pagination
-- Status: APPLIED to production database

-- NOTE: Schema uses two tables:
-- - prospect_approval_data: stores prospect info (name, company, score, etc.)
-- - prospect_approval_decisions: stores approval status (approved/rejected)

-- Index for sorting prospects by quality score (most common sort)
CREATE INDEX IF NOT EXISTS idx_prospects_session_score
ON prospect_approval_data(session_id, enrichment_score DESC);

-- Index for filtering decisions by status
CREATE INDEX IF NOT EXISTS idx_decisions_session_decision
ON prospect_approval_decisions(session_id, decision);

-- Composite index for joining prospects with decisions efficiently
CREATE INDEX IF NOT EXISTS idx_prospects_session_prospect_id
ON prospect_approval_data(session_id, prospect_id);

-- Comments explaining indexes
COMMENT ON INDEX idx_prospects_session_score IS
'Optimizes paginated queries sorting by quality score';

COMMENT ON INDEX idx_decisions_session_decision IS
'Optimizes filtering prospects by approval status (approved/rejected/pending)';

COMMENT ON INDEX idx_prospects_session_prospect_id IS
'Optimizes JOIN between prospect_approval_data and prospect_approval_decisions';

-- Additional existing indexes (created by earlier migrations):
-- - idx_prospects_session_created: for sorting by created_at DESC
-- - idx_prospect_data_session: basic session lookup
-- - idx_prospect_decisions_session: basic session lookup for decisions
