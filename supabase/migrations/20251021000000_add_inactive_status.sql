-- Add 'inactive' to campaigns status constraint
-- Fix: Database was rejecting 'inactive' status updates because it wasn't in the CHECK constraint

DO $$
BEGIN
    -- Drop existing status constraint
    ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_status_check;

    -- Add updated status constraint including 'inactive'
    ALTER TABLE campaigns
    ADD CONSTRAINT campaigns_status_check
    CHECK (status IN ('draft', 'inactive', 'active', 'paused', 'completed', 'archived'));

    RAISE NOTICE 'Added inactive status to campaigns table constraint';
END $$;

COMMENT ON CONSTRAINT campaigns_status_check ON campaigns IS 'Valid campaign statuses: draft (being created), inactive (ready to activate), active (running), paused (temporarily stopped), completed (finished), archived (historical)';
