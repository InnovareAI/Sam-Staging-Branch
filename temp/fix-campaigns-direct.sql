-- 1. Unpause Sebastian Henkel campaign
UPDATE campaigns
SET status = 'active'
WHERE name ILIKE '%Sebastian%'
RETURNING id, name, status;

-- 2. Populate send_queue for ASP - Company Follow
WITH asp_campaign AS (
  SELECT id FROM campaigns WHERE name ILIKE '%ASP%Company%Follow%' LIMIT 1
),
pending_prospects AS (
  SELECT
    cp.id as campaign_prospect_id,
    cp.prospect_id,
    cp.campaign_id
  FROM campaign_prospects cp
  CROSS JOIN asp_campaign
  WHERE cp.campaign_id = asp_campaign.id
    AND cp.status = 'pending'
)
INSERT INTO send_queue (
  campaign_id,
  prospect_id,
  campaign_prospect_id,
  scheduled_for,
  status,
  message_type
)
SELECT
  campaign_id,
  prospect_id,
  campaign_prospect_id,
  NOW(),
  'pending',
  'connection_request'
FROM pending_prospects
ON CONFLICT DO NOTHING
RETURNING id, campaign_id, prospect_id, status;
