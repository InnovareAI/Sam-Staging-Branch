SELECT 
  id,
  campaign_id,
  first_name,
  last_name,
  status,
  notes,
  created_at,
  updated_at
FROM campaign_prospects
WHERE first_name ILIKE 'noah' AND last_name ILIKE 'ottmar'
ORDER BY created_at DESC
LIMIT 10;
