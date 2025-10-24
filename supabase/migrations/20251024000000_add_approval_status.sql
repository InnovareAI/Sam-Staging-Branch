-- Add approval_status column to workspace_prospects
-- Migration: 20251024000000_add_approval_status.sql

ALTER TABLE workspace_prospects
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_workspace_prospects_approval_status ON workspace_prospects(approval_status);

-- Update existing records to 'pending' if null
UPDATE workspace_prospects SET approval_status = 'pending' WHERE approval_status IS NULL;
