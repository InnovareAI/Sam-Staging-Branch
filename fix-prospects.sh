#!/bin/bash

# Fix Campaign Prospects Status
# This script connects to Supabase via psql and checks/fixes prospect statuses

echo "🔍 Diagnosing Campaign: 20251102-IAI-Outreach Campaign"
echo "======================================================="
echo ""

# Supabase connection details
SUPABASE_PROJECT_REF="latxadqrvrrrcvkktrog"
SUPABASE_HOST="db.${SUPABASE_PROJECT_REF}.supabase.co"
SUPABASE_PORT="5432"
SUPABASE_DB="postgres"
SUPABASE_USER="postgres"

echo "📋 Step 1: Check current prospect statuses"
echo "-------------------------------------------"

psql "postgresql://${SUPABASE_USER}@${SUPABASE_HOST}:${SUPABASE_PORT}/${SUPABASE_DB}" <<'SQL'

-- Check current campaign and prospect statuses
SELECT
    c.id as campaign_id,
    c.name,
    c.status as campaign_status,
    COUNT(cp.id) as total_prospects,
    COUNT(CASE WHEN cp.status IN ('pending', 'queued_in_n8n') THEN 1 END) as ready_prospects,
    string_agg(DISTINCT cp.status, ', ') as all_statuses
FROM campaigns c
LEFT JOIN campaign_prospects cp ON c.id = cp.campaign_id
WHERE c.name LIKE '%20251102-IAI-Outreach%'
GROUP BY c.id, c.name, c.status;

-- Show detailed breakdown
\echo ''
\echo 'Detailed Prospect Statuses:'
\echo '----------------------------'

SELECT
    cp.status,
    COUNT(*) as count
FROM campaigns c
JOIN campaign_prospects cp ON c.id = cp.campaign_id
WHERE c.name LIKE '%20251102-IAI-Outreach%'
GROUP BY cp.status
ORDER BY count DESC;

-- Show individual prospects
\echo ''
\echo 'Individual Prospects:'
\echo '---------------------'

SELECT
    cp.id,
    cp.first_name,
    cp.last_name,
    cp.status,
    CASE WHEN cp.linkedin_url IS NOT NULL THEN 'Yes' ELSE 'No' END as has_linkedin,
    CASE WHEN cp.email IS NOT NULL THEN 'Yes' ELSE 'No' END as has_email,
    cp.contacted_at
FROM campaigns c
JOIN campaign_prospects cp ON c.id = cp.campaign_id
WHERE c.name LIKE '%20251102-IAI-Outreach%'
ORDER BY cp.created_at DESC;

SQL

echo ""
echo "======================================================="
echo ""
echo "📝 Analysis:"
echo "   - If 'ready_prospects' is 0, prospects need status update"
echo "   - Expected statuses: 'pending' or 'queued_in_n8n'"
echo ""
echo "🔧 To fix, run: ./fix-prospects.sh update"
echo ""
