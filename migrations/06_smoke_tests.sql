-- Migration: Smoke Tests for Production KB Migration
-- Description: Comprehensive test suite to verify migration success
-- Author: Production Migration Script
-- Date: 2025-09-30

-- ==============================================================================
-- SMOKE TEST SUITE - Execute after migration
-- ==============================================================================

\echo '=========================================='
\echo 'Starting Production Smoke Tests'
\echo '=========================================='

-- ==============================================================================
-- TEST 1: Verify Table Structure
-- ==============================================================================

\echo ''
\echo 'TEST 1: Verifying table structure...'

DO $$
DECLARE
    kb_exists BOOLEAN;
    sections_exists BOOLEAN;
BEGIN
    -- Check knowledge_base table exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'knowledge_base'
    ) INTO kb_exists;
    
    -- Check knowledge_base_sections table exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'knowledge_base_sections'
    ) INTO sections_exists;
    
    IF kb_exists AND sections_exists THEN
        RAISE NOTICE '✅ All required tables exist';
    ELSE
        RAISE EXCEPTION '❌ Missing required tables';
    END IF;
END $$;

-- Verify workspace_id column exists
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'knowledge_base'
AND column_name = 'workspace_id';

-- ==============================================================================
-- TEST 2: Verify Data Integrity
-- ==============================================================================

\echo ''
\echo 'TEST 2: Verifying data integrity...'

DO $$
DECLARE
    total_kb_records INTEGER;
    orphaned_kb_records INTEGER;
    total_sections INTEGER;
    workspaces_without_sections INTEGER;
BEGIN
    -- Count total KB records
    SELECT COUNT(*) INTO total_kb_records FROM knowledge_base;
    RAISE NOTICE 'Total KB records: %', total_kb_records;
    
    -- Check for orphaned KB records (no valid workspace)
    SELECT COUNT(*) INTO orphaned_kb_records
    FROM knowledge_base kb
    LEFT JOIN workspaces w ON w.id = kb.workspace_id
    WHERE kb.workspace_id IS NOT NULL
    AND w.id IS NULL;
    
    IF orphaned_kb_records > 0 THEN
        RAISE WARNING '⚠️  Found % KB records with invalid workspace_id', orphaned_kb_records;
    ELSE
        RAISE NOTICE '✅ No orphaned KB records';
    END IF;
    
    -- Count total sections
    SELECT COUNT(*) INTO total_sections FROM knowledge_base_sections;
    RAISE NOTICE 'Total KB sections: %', total_sections;
    
    -- Check for workspaces without sections
    SELECT COUNT(*) INTO workspaces_without_sections
    FROM workspaces w
    LEFT JOIN knowledge_base_sections kbs ON kbs.workspace_id = w.id
    WHERE w.is_active = true
    AND kbs.id IS NULL;
    
    IF workspaces_without_sections > 0 THEN
        RAISE WARNING '⚠️  Found % active workspaces without sections', workspaces_without_sections;
    ELSE
        RAISE NOTICE '✅ All active workspaces have sections';
    END IF;
END $$;

-- ==============================================================================
-- TEST 3: Verify RLS Policies
-- ==============================================================================

\echo ''
\echo 'TEST 3: Verifying RLS policies...'

DO $$
DECLARE
    kb_rls_enabled BOOLEAN;
    sections_rls_enabled BOOLEAN;
    kb_policy_count INTEGER;
    sections_policy_count INTEGER;
BEGIN
    -- Check if RLS is enabled on knowledge_base
    SELECT relrowsecurity INTO kb_rls_enabled
    FROM pg_class
    WHERE relname = 'knowledge_base';
    
    -- Check if RLS is enabled on knowledge_base_sections
    SELECT relrowsecurity INTO sections_rls_enabled
    FROM pg_class
    WHERE relname = 'knowledge_base_sections';
    
    -- Count policies on knowledge_base
    SELECT COUNT(*) INTO kb_policy_count
    FROM pg_policies
    WHERE tablename = 'knowledge_base';
    
    -- Count policies on knowledge_base_sections
    SELECT COUNT(*) INTO sections_policy_count
    FROM pg_policies
    WHERE tablename = 'knowledge_base_sections';
    
    RAISE NOTICE 'RLS enabled on knowledge_base: %', kb_rls_enabled;
    RAISE NOTICE 'Policies on knowledge_base: %', kb_policy_count;
    RAISE NOTICE 'RLS enabled on knowledge_base_sections: %', sections_rls_enabled;
    RAISE NOTICE 'Policies on knowledge_base_sections: %', sections_policy_count;
    
    IF kb_rls_enabled AND sections_rls_enabled AND kb_policy_count > 0 AND sections_policy_count > 0 THEN
        RAISE NOTICE '✅ RLS is properly configured';
    ELSE
        RAISE WARNING '⚠️  RLS configuration may be incomplete';
    END IF;
END $$;

-- Show active policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename IN ('knowledge_base', 'knowledge_base_sections')
ORDER BY tablename, policyname;

-- ==============================================================================
-- TEST 4: Test RLS with Sample User Context
-- ==============================================================================

\echo ''
\echo 'TEST 4: Testing RLS with user context...'

-- Note: Replace 'sample-user-uuid' and 'sample-workspace-uuid' with actual values
DO $$
DECLARE
    test_user_id UUID;
    test_workspace_id UUID;
    visible_kb_count INTEGER;
    visible_section_count INTEGER;
BEGIN
    -- Get a test user (first user in the system)
    SELECT id INTO test_user_id FROM users LIMIT 1;
    
    -- Get their workspace
    SELECT workspace_id INTO test_workspace_id 
    FROM workspace_accounts 
    WHERE user_id = test_user_id 
    LIMIT 1;
    
    IF test_user_id IS NULL OR test_workspace_id IS NULL THEN
        RAISE NOTICE '⚠️  No test user/workspace found - skipping RLS context test';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Testing with user: %, workspace: %', test_user_id, test_workspace_id;
    
    -- Simulate user context
    PERFORM set_config('request.jwt.claims', json_build_object('sub', test_user_id)::text, true);
    PERFORM set_config('request.workspace_id', test_workspace_id::text, true);
    
    -- Count visible KB entries
    SELECT COUNT(*) INTO visible_kb_count FROM knowledge_base;
    RAISE NOTICE 'Visible KB entries for test user: %', visible_kb_count;
    
    -- Count visible sections
    SELECT COUNT(*) INTO visible_section_count FROM knowledge_base_sections;
    RAISE NOTICE 'Visible sections for test user: %', visible_section_count;
    
    -- Reset context
    PERFORM set_config('request.jwt.claims', NULL, true);
    PERFORM set_config('request.workspace_id', NULL, true);
    
    RAISE NOTICE '✅ RLS context test completed';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING '⚠️  RLS context test failed: %', SQLERRM;
END $$;

-- ==============================================================================
-- TEST 5: Verify Workspace Distribution
-- ==============================================================================

\echo ''
\echo 'TEST 5: Verifying workspace distribution...'

-- Show KB entries per workspace
SELECT 
    COALESCE(w.name, 'NULL/Shared') as workspace,
    COUNT(kb.id) as kb_entries,
    COUNT(DISTINCT kb.section_id) as sections_used
FROM knowledge_base kb
LEFT JOIN workspaces w ON w.id = kb.workspace_id
GROUP BY w.name
ORDER BY kb_entries DESC;

-- Show sections per workspace
SELECT 
    w.name as workspace,
    COUNT(kbs.id) as section_count,
    array_agg(kbs.name ORDER BY kbs.display_order) as sections
FROM workspaces w
LEFT JOIN knowledge_base_sections kbs ON kbs.workspace_id = w.id
WHERE w.is_active = true
GROUP BY w.id, w.name
ORDER BY w.name;

-- ==============================================================================
-- TEST 6: Verify Foreign Key Constraints
-- ==============================================================================

\echo ''
\echo 'TEST 6: Verifying foreign key constraints...'

DO $$
DECLARE
    invalid_workspace_refs INTEGER;
    invalid_section_refs INTEGER;
    invalid_user_refs INTEGER;
BEGIN
    -- Check for invalid workspace references
    SELECT COUNT(*) INTO invalid_workspace_refs
    FROM knowledge_base kb
    WHERE kb.workspace_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id = kb.workspace_id);
    
    -- Check for invalid section references
    SELECT COUNT(*) INTO invalid_section_refs
    FROM knowledge_base kb
    WHERE kb.section_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM knowledge_base_sections kbs WHERE kbs.id = kb.section_id);
    
    -- Check for invalid user references
    SELECT COUNT(*) INTO invalid_user_refs
    FROM knowledge_base kb
    WHERE kb.created_by IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = kb.created_by);
    
    IF invalid_workspace_refs = 0 AND invalid_section_refs = 0 AND invalid_user_refs = 0 THEN
        RAISE NOTICE '✅ All foreign key references are valid';
    ELSE
        RAISE WARNING '⚠️  Found invalid references - workspace: %, section: %, user: %', 
            invalid_workspace_refs, invalid_section_refs, invalid_user_refs;
    END IF;
END $$;

-- ==============================================================================
-- TEST 7: Performance Check
-- ==============================================================================

\echo ''
\echo 'TEST 7: Checking index performance...'

-- Show index usage statistics
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename IN ('knowledge_base', 'knowledge_base_sections')
ORDER BY tablename, indexname;

-- Explain query performance for common queries
EXPLAIN ANALYZE
SELECT * FROM knowledge_base
WHERE workspace_id = (SELECT id FROM workspaces LIMIT 1)
LIMIT 10;

EXPLAIN ANALYZE
SELECT * FROM knowledge_base_sections
WHERE workspace_id = (SELECT id FROM workspaces LIMIT 1)
ORDER BY display_order;

-- ==============================================================================
-- TEST 8: Final Summary
-- ==============================================================================

\echo ''
\echo '=========================================='
\echo 'Smoke Test Summary'
\echo '=========================================='

SELECT 
    'Total Workspaces' as metric,
    COUNT(*)::text as value
FROM workspaces
WHERE is_active = true
UNION ALL
SELECT 
    'Total KB Entries',
    COUNT(*)::text
FROM knowledge_base
UNION ALL
SELECT 
    'KB Entries with Workspace',
    COUNT(*)::text
FROM knowledge_base
WHERE workspace_id IS NOT NULL
UNION ALL
SELECT 
    'Shared/Global KB Entries',
    COUNT(*)::text
FROM knowledge_base
WHERE workspace_id IS NULL
UNION ALL
SELECT 
    'Total Sections',
    COUNT(*)::text
FROM knowledge_base_sections
UNION ALL
SELECT 
    'Avg Sections per Workspace',
    ROUND(AVG(section_count), 2)::text
FROM (
    SELECT workspace_id, COUNT(*) as section_count
    FROM knowledge_base_sections
    GROUP BY workspace_id
) sub;

\echo ''
\echo '=========================================='
\echo '✅ Smoke Tests Completed'
\echo '=========================================='
\echo ''
\echo 'Review any warnings above before considering migration complete.'
\echo 'Test application functionality manually to ensure everything works.'