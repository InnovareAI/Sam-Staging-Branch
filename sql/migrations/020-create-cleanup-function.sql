-- Migration: Create automated cleanup function for corrupted prospect statuses
-- Date: November 24, 2025
-- Purpose: Automatically fix prospects marked as "sent" without contacted_at timestamp

-- Function to clean up corrupted prospect statuses
CREATE OR REPLACE FUNCTION cleanup_corrupted_prospect_statuses()
RETURNS TABLE(
  fixed_count BIGINT,
  campaign_ids TEXT[]
) AS $$
DECLARE
  v_fixed_count BIGINT;
  v_campaign_ids TEXT[];
BEGIN
  -- Get list of affected campaigns before fix
  SELECT ARRAY_AGG(DISTINCT campaign_id::TEXT)
  INTO v_campaign_ids
  FROM campaign_prospects
  WHERE status = 'connection_request_sent'
  AND contacted_at IS NULL;

  -- Fix prospects marked as "sent" but never actually sent
  UPDATE campaign_prospects
  SET 
    status = 'pending',
    updated_at = NOW()
  WHERE status = 'connection_request_sent'
  AND contacted_at IS NULL;

  GET DIAGNOSTICS v_fixed_count = ROW_COUNT;

  RETURN QUERY SELECT v_fixed_count, v_campaign_ids;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION cleanup_corrupted_prospect_statuses() TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_corrupted_prospect_statuses() TO service_role;

-- Create a view to monitor data integrity
CREATE OR REPLACE VIEW prospect_data_integrity AS
SELECT 
  COUNT(*) FILTER (WHERE status = 'connection_request_sent' AND contacted_at IS NULL) as corrupted_sent,
  COUNT(*) FILTER (WHERE status = 'failed' AND contacted_at IS NOT NULL) as corrupted_failed,
  COUNT(*) FILTER (WHERE status = 'pending' AND contacted_at IS NOT NULL) as corrupted_pending,
  COUNT(*) as total_prospects,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'connection_request_sent' AND contacted_at IS NULL) / NULLIF(COUNT(*), 0), 2) as corruption_percentage
FROM campaign_prospects;

GRANT SELECT ON prospect_data_integrity TO authenticated;
GRANT SELECT ON prospect_data_integrity TO service_role;

-- Verification
SELECT * FROM prospect_data_integrity;
