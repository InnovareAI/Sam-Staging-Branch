-- Migration: Add connection_degree column to campaign_prospects
-- Purpose: Store LinkedIn connection status at import time to prevent campaign type mismatch errors
-- Date: 2025-12-02

-- Add connection_degree column
ALTER TABLE campaign_prospects
ADD COLUMN IF NOT EXISTS connection_degree VARCHAR(20);

-- Add comment for documentation
COMMENT ON COLUMN campaign_prospects.connection_degree IS
  'LinkedIn connection degree at time of import. Values: 1st, 2nd, 3rd, OUT_OF_NETWORK, NULL';

-- Create index for filtering by connection degree
CREATE INDEX IF NOT EXISTS idx_campaign_prospects_connection_degree
ON campaign_prospects(connection_degree)
WHERE connection_degree IS NOT NULL;

-- Update existing prospects based on status
-- If already connected, they were likely 1st degree
UPDATE campaign_prospects
SET connection_degree = '1st'
WHERE connection_degree IS NULL
  AND status IN ('connected', 'messaging', 'replied', 'completed');

-- If CR was sent but not connected, they were likely 2nd/3rd
UPDATE campaign_prospects
SET connection_degree = '2nd'
WHERE connection_degree IS NULL
  AND status IN ('connection_request_sent', 'already_invited', 'invitation_declined');
