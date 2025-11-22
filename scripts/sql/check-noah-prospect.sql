-- Check if Noah Ottmar exists in prospects and campaign_prospects tables

-- 1. Check in prospects table
SELECT
    id,
    first_name,
    last_name,
    linkedin_url,
    linkedin_id,
    workspace_id,
    created_at,
    updated_at,
    enriched_data
FROM prospects
WHERE
    (first_name = 'Noah' AND last_name = 'Ottmar')
    OR linkedin_url LIKE '%noah-ottmar%'
    OR linkedin_id = 'noah-ottmar-b59478295'
ORDER BY created_at DESC;

-- 2. Check in campaign_prospects table for campaign "20251122-IA3-test 6"
SELECT
    cp.id,
    cp.campaign_id,
    cp.prospect_id,
    cp.connection_status,
    cp.connection_sent_at,
    cp.connection_accepted_at,
    cp.connection_note,
    cp.created_at,
    cp.updated_at,
    cp.error_message,
    c.name as campaign_name,
    p.first_name,
    p.last_name,
    p.linkedin_url
FROM campaign_prospects cp
JOIN campaigns c ON c.id = cp.campaign_id
LEFT JOIN prospects p ON p.id = cp.prospect_id
WHERE
    c.name = '20251122-IA3-test 6'
    AND (
        (p.first_name = 'Noah' AND p.last_name = 'Ottmar')
        OR p.linkedin_url LIKE '%noah-ottmar%'
        OR p.linkedin_id = 'noah-ottmar-b59478295'
    );

-- 3. Also check all prospects in this campaign
SELECT
    cp.id,
    cp.connection_status,
    cp.connection_sent_at,
    cp.error_message,
    p.first_name,
    p.last_name,
    p.linkedin_url,
    p.linkedin_id
FROM campaign_prospects cp
JOIN campaigns c ON c.id = cp.campaign_id
LEFT JOIN prospects p ON p.id = cp.prospect_id
WHERE c.name = '20251122-IA3-test 6'
ORDER BY cp.created_at DESC;

-- 4. Check campaign details
SELECT
    id,
    name,
    workspace_id,
    unipile_account_id,
    status,
    created_at,
    updated_at,
    campaign_data
FROM campaigns
WHERE name = '20251122-IA3-test 6';