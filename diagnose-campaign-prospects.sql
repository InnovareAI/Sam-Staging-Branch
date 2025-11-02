-- Diagnose Campaign Prospects Status
-- Run this in Supabase SQL Editor or your database client

-- Find the campaign
SELECT
    c.id as campaign_id,
    c.name,
    c.status as campaign_status,
    c.campaign_type,
    COUNT(cp.id) as total_prospects,
    COUNT(CASE WHEN cp.status IN ('pending', 'queued_in_n8n') THEN 1 END) as ready_prospects,
    jsonb_object_agg(cp.status, count(*)) as status_breakdown
FROM campaigns c
LEFT JOIN campaign_prospects cp ON c.id = cp.campaign_id
WHERE c.name LIKE '%20251102-IAI-Outreach%'
GROUP BY c.id, c.name, c.status, c.campaign_type;

-- Show detailed prospect statuses
SELECT
    cp.id,
    cp.first_name,
    cp.last_name,
    cp.status,
    cp.linkedin_url,
    cp.email,
    cp.contacted_at,
    cp.created_at
FROM campaigns c
JOIN campaign_prospects cp ON c.id = cp.campaign_id
WHERE c.name LIKE '%20251102-IAI-Outreach%'
ORDER BY cp.created_at DESC;

-- Fix: Update prospects to 'pending' status if they're 'approved' or similar
-- UNCOMMENT AND RUN THIS ONLY IF NEEDED:
/*
UPDATE campaign_prospects cp
SET status = 'pending'
FROM campaigns c
WHERE cp.campaign_id = c.id
  AND c.name LIKE '%20251102-IAI-Outreach%'
  AND cp.status IN ('approved', 'ready_to_message', 'active')
  AND cp.contacted_at IS NULL;
*/
