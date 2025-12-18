-- Migration 063: Prevent URLs in linkedin_user_id columns
-- Date: December 18, 2025
--
-- This constraint prevents full LinkedIn URLs from being stored in linkedin_user_id columns.
-- The linkedin_user_id should contain either:
--   1. A LinkedIn provider_id (e.g., "ACoAABhJW8ABC123...")
--   2. A LinkedIn vanity slug (e.g., "john-doe")
--
-- Full URLs like "https://www.linkedin.com/in/john-doe" should be stored in linkedin_url column instead.
-- This prevents "User ID does not match provider's expected format" errors from Unipile API.

-- Add constraint to send_queue table
ALTER TABLE send_queue
ADD CONSTRAINT send_queue_linkedin_user_id_no_urls
CHECK (linkedin_user_id NOT LIKE '%linkedin.com%');

-- Add constraint to campaign_prospects table
ALTER TABLE campaign_prospects
ADD CONSTRAINT campaign_prospects_linkedin_user_id_no_urls
CHECK (linkedin_user_id NOT LIKE '%linkedin.com%');

-- Add constraint to email_queue table (if it has linkedin_user_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_queue' AND column_name = 'linkedin_user_id'
  ) THEN
    ALTER TABLE email_queue
    ADD CONSTRAINT email_queue_linkedin_user_id_no_urls
    CHECK (linkedin_user_id NOT LIKE '%linkedin.com%');
  END IF;
END $$;

-- Comment explaining the constraint
COMMENT ON CONSTRAINT send_queue_linkedin_user_id_no_urls ON send_queue IS
'Prevents full LinkedIn URLs from being stored. Use extractLinkedInSlug() to convert URLs to slugs before inserting.';

COMMENT ON CONSTRAINT campaign_prospects_linkedin_user_id_no_urls ON campaign_prospects IS
'Prevents full LinkedIn URLs from being stored. Use extractLinkedInSlug() to convert URLs to slugs before inserting.';
