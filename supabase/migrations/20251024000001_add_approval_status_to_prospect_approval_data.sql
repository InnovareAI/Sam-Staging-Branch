-- Add approval_status column to prospect_approval_data
-- Migration: 20251024000001_add_approval_status_to_prospect_approval_data.sql

ALTER TABLE prospect_approval_data
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_prospect_approval_data_approval_status ON prospect_approval_data(approval_status);

-- Create index for session + status filtering
CREATE INDEX IF NOT EXISTS idx_prospect_approval_data_session_status ON prospect_approval_data(session_id, approval_status);

-- Update existing records to 'pending' if null
UPDATE prospect_approval_data SET approval_status = 'pending' WHERE approval_status IS NULL;
