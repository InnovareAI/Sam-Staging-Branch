-- Fix prospect names by pulling from source approval_data

UPDATE campaign_prospects cp
SET 
  first_name = CASE 
    WHEN split_part(pad.name, ' ', 1) != '' 
    THEN split_part(pad.name, ' ', 1)
    ELSE cp.first_name 
  END,
  last_name = CASE
    WHEN split_part(pad.name, ' ', 2) != ''
    THEN regexp_replace(pad.name, '^[^ ]+ ', '')
    ELSE cp.last_name
  END,
  updated_at = NOW()
FROM prospect_approval_data pad
WHERE cp.personalization_data->>'approval_data_id' = pad.id::text
  AND cp.campaign_id = '05f8d385-0b7c-45b8-a6d6-3e7c8224f9bc'
  AND (cp.last_name = 'User' OR cp.first_name ~ '^[a-z]+$');

-- Show updated results
SELECT first_name, last_name, email 
FROM campaign_prospects 
WHERE campaign_id = '05f8d385-0b7c-45b8-a6d6-3e7c8224f9bc'
ORDER BY created_at;
