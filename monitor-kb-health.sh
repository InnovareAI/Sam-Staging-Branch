#!/bin/bash

# KB Health Monitoring Script
# Run this periodically during the 24-hour monitoring window

PROD_DB_URL="postgresql://postgres:QFe75XZ2kqhy2AyH@db.latxadqrvrrrcvkktrog.supabase.co:5432/postgres"

echo "=========================================="
echo "KB Health Check - $(date)"
echo "=========================================="
echo ""

# Check 1: Orphaned Records
echo "1. Checking for orphaned records..."
psql "$PROD_DB_URL" -t -c "
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ No orphaned KB content'
        ELSE '⚠️  Found ' || COUNT(*) || ' orphaned KB content records'
    END
FROM knowledge_base_content kb
LEFT JOIN workspaces w ON w.id = kb.workspace_id
WHERE kb.workspace_id IS NOT NULL AND w.id IS NULL;
"

# Check 2: Content Growth
echo ""
echo "2. KB Content by Workspace:"
psql "$PROD_DB_URL" -c "
SELECT 
    w.name as workspace,
    COUNT(kbc.id) as content_count
FROM workspaces w
LEFT JOIN knowledge_base_content kbc ON kbc.workspace_id = w.id
GROUP BY w.id, w.name
ORDER BY content_count DESC;
"

# Check 3: Section Integrity
echo ""
echo "3. Section Count by Workspace:"
psql "$PROD_DB_URL" -c "
SELECT 
    w.name as workspace,
    COUNT(kbs.id) as section_count
FROM workspaces w
LEFT JOIN knowledge_base_sections kbs ON kbs.workspace_id = w.id
GROUP BY w.id, w.name
ORDER BY w.name;
"

# Check 4: Recent Activity
echo ""
echo "4. Recent KB Activity (last hour):"
psql "$PROD_DB_URL" -c "
SELECT 
    'Created' as activity,
    COUNT(*) as count
FROM knowledge_base_content
WHERE created_at > NOW() - INTERVAL '1 hour'
UNION ALL
SELECT 
    'Updated',
    COUNT(*)
FROM knowledge_base_content
WHERE updated_at > NOW() - INTERVAL '1 hour'
  AND updated_at > created_at;
"

# Check 5: RLS Status
echo ""
echo "5. RLS Policy Status:"
psql "$PROD_DB_URL" -c "
SELECT 
    tablename,
    CASE 
        WHEN COUNT(*) = 0 THEN '⚠️  NO POLICIES'
        ELSE '✅ ' || COUNT(*) || ' policies active'
    END as status
FROM pg_policies
WHERE tablename IN ('knowledge_base_content', 'knowledge_base_sections')
GROUP BY tablename
UNION ALL
SELECT 
    'knowledge_base_content' as tablename,
    '⚠️  NO POLICIES' as status
WHERE NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'knowledge_base_content'
)
UNION ALL
SELECT 
    'knowledge_base_sections',
    '⚠️  NO POLICIES'
WHERE NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'knowledge_base_sections'
);
"

echo ""
echo "=========================================="
echo "Health check complete"
echo "=========================================="