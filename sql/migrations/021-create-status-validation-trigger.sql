-- Migration: Create trigger to validate prospect status updates
-- Date: November 24, 2025  
-- Purpose: Prevent status from being set to "connection_request_sent" without contacted_at

-- Trigger function to validate status updates
CREATE OR REPLACE FUNCTION validate_prospect_status_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Rule 1: If status is being set to "connection_request_sent", contacted_at MUST be set
  IF NEW.status = 'connection_request_sent' AND NEW.contacted_at IS NULL THEN
    RAISE EXCEPTION 'Cannot set status to connection_request_sent without contacted_at timestamp';
  END IF;

  -- Rule 2: If contacted_at is being set, status MUST be one of the "contacted" statuses
  IF NEW.contacted_at IS NOT NULL AND OLD.contacted_at IS NULL THEN
    IF NEW.status NOT IN ('connection_request_sent', 'connected', 'messaging', 'replied', 'failed') THEN
      RAISE EXCEPTION 'Setting contacted_at requires status to be connection_request_sent, connected, messaging, replied, or failed';
    END IF;
  END IF;

  -- Rule 3: Cannot remove contacted_at once set (data integrity)
  IF OLD.contacted_at IS NOT NULL AND NEW.contacted_at IS NULL THEN
    RAISE EXCEPTION 'Cannot remove contacted_at timestamp once set';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS validate_prospect_status ON campaign_prospects;
CREATE TRIGGER validate_prospect_status
  BEFORE UPDATE ON campaign_prospects
  FOR EACH ROW
  EXECUTE FUNCTION validate_prospect_status_update();

-- Test the trigger (should fail)
DO $$
BEGIN
  -- This should fail with our trigger
  UPDATE campaign_prospects 
  SET status = 'connection_request_sent' 
  WHERE id = (SELECT id FROM campaign_prospects WHERE status = 'pending' LIMIT 1);
  
  RAISE EXCEPTION 'Trigger test failed - update should have been blocked';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE '%Cannot set status to connection_request_sent%' THEN
      RAISE NOTICE '✅ Trigger working correctly - blocked invalid status update';
    ELSE
      RAISE EXCEPTION 'Unexpected error: %', SQLERRM;
    END IF;
END $$;
