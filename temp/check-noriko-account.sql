-- Query to check Noriko Yokoi's account_id
-- Looking for account_id: aJcX-idiQryacq2zOrDs9g

-- First, find the user by name or email
SELECT
  u.id as user_id,
  u.email,
  u.raw_user_meta_data->>'full_name' as full_name,
  u.created_at
FROM auth.users u
WHERE
  u.raw_user_meta_data->>'full_name' ILIKE '%Noriko%'
  OR u.email ILIKE '%noriko%'
  OR u.email ILIKE '%yokoi%';

-- Then check their Unipile account associations
SELECT
  ua.id,
  ua.user_id,
  ua.unipile_account_id,
  ua.account_name,
  ua.account_email,
  ua.linkedin_public_identifier,
  ua.platform,
  ua.connection_status,
  ua.created_at,
  u.email as user_email,
  u.raw_user_meta_data->>'full_name' as user_full_name
FROM user_unipile_accounts ua
LEFT JOIN auth.users u ON ua.user_id = u.id
WHERE
  ua.account_name ILIKE '%Noriko%'
  OR ua.account_email ILIKE '%noriko%'
  OR ua.account_email ILIKE '%yokoi%'
  OR u.raw_user_meta_data->>'full_name' ILIKE '%Noriko%'
  OR u.email ILIKE '%noriko%'
  OR u.email ILIKE '%yokoi%';

-- Check if the specific account_id exists
SELECT
  ua.id,
  ua.user_id,
  ua.unipile_account_id,
  ua.account_name,
  ua.account_email,
  ua.connection_status,
  u.email as user_email,
  u.raw_user_meta_data->>'full_name' as user_full_name,
  CASE
    WHEN ua.unipile_account_id = 'aJcX-idiQryacq2zOrDs9g' THEN '✅ MATCH'
    ELSE '❌ NO MATCH'
  END as match_status
FROM user_unipile_accounts ua
LEFT JOIN auth.users u ON ua.user_id = u.id
WHERE
  ua.unipile_account_id = 'aJcX-idiQryacq2zOrDs9g'
  OR ua.account_name ILIKE '%Noriko%'
  OR ua.account_email ILIKE '%noriko%'
  OR u.raw_user_meta_data->>'full_name' ILIKE '%Noriko%';
