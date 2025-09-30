-- Migration: Backfill Workspace IDs for Knowledge Base
-- Description: Assigns workspace_id to existing KB entries based on user associations
-- Author: Production Migration Script
-- Date: 2025-09-30

-- ==============================================================================
-- STEP 1: Verify Current State (Pre-migration Check)
-- ==============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Pre-migration state of knowledge_base table:';
END $$;

SELECT 
    COUNT(*) as total_records,
    COUNT(CASE WHEN workspace_id IS NULL THEN 1 END) as null_workspace_ids,
    COUNT(CASE WHEN workspace_id IS NOT NULL THEN 1 END) as has_workspace_ids
FROM knowledge_base;

-- ==============================================================================
-- STEP 2: Backfill Workspace IDs Based on User Workspace Associations
-- ==============================================================================

-- Strategy: Assign workspace_id based on the user who created the KB entry
-- This assumes users have a primary workspace association

DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Update KB entries with workspace_id from user's workspace
    WITH user_primary_workspace AS (
        SELECT DISTINCT ON (wa.user_id) 
            wa.user_id,
            wa.workspace_id,
            wa.created_at
        FROM workspace_accounts wa
        ORDER BY wa.user_id, wa.created_at ASC -- First workspace joined
    )
    UPDATE knowledge_base kb
    SET workspace_id = upw.workspace_id,
        updated_at = NOW()
    FROM user_primary_workspace upw
    WHERE kb.created_by = upw.user_id
    AND kb.workspace_id IS NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % KB entries with workspace_id from user associations', updated_count;
END $$;

-- ==============================================================================
-- STEP 3: Handle Shared/Global Content
-- ==============================================================================

DO $$
DECLARE
    shared_count INTEGER;
BEGIN
    -- Keep workspace_id as NULL for explicitly shared content
    -- Adjust these conditions based on your business logic
    UPDATE knowledge_base
    SET workspace_id = NULL,
        updated_at = NOW()
    WHERE (
        metadata->>'is_shared' = 'true' 
        OR metadata->>'visibility' = 'global'
        OR title ILIKE '%[GLOBAL]%'
    )
    AND workspace_id IS NOT NULL;
    
    GET DIAGNOSTICS shared_count = ROW_COUNT;
    RAISE NOTICE 'Marked % KB entries as shared/global (workspace_id = NULL)', shared_count;
END $$;

-- ==============================================================================
-- STEP 4: Handle Orphaned Records (No User Association)
-- ==============================================================================

DO $$
DECLARE
    orphaned_count INTEGER;
BEGIN
    -- Option A: Assign to a default/system workspace
    -- Uncomment if you have a system workspace:
    -- UPDATE knowledge_base
    -- SET workspace_id = (SELECT id FROM workspaces WHERE name = 'System' LIMIT 1),
    --     updated_at = NOW()
    -- WHERE workspace_id IS NULL
    -- AND created_by IS NOT NULL;
    
    -- Option B: Log orphaned records for manual review
    SELECT COUNT(*) INTO orphaned_count
    FROM knowledge_base
    WHERE workspace_id IS NULL
    AND created_by IS NOT NULL;
    
    IF orphaned_count > 0 THEN
        RAISE WARNING 'Found % orphaned KB entries without workspace assignment', orphaned_count;
        RAISE NOTICE 'Run the following to review: SELECT id, title, created_by FROM knowledge_base WHERE workspace_id IS NULL;';
    END IF;
END $$;

-- ==============================================================================
-- STEP 5: Post-Migration Verification
-- ==============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Post-migration state of knowledge_base table:';
END $$;

SELECT 
    COUNT(*) as total_records,
    COUNT(CASE WHEN workspace_id IS NULL THEN 1 END) as null_workspace_ids,
    COUNT(CASE WHEN workspace_id IS NOT NULL THEN 1 END) as has_workspace_ids,
    ROUND(100.0 * COUNT(CASE WHEN workspace_id IS NOT NULL THEN 1 END) / COUNT(*), 2) as percent_assigned
FROM knowledge_base;

-- Show distribution by workspace
SELECT 
    COALESCE(w.name, 'NULL/Shared') as workspace_name,
    COUNT(kb.id) as kb_entry_count
FROM knowledge_base kb
LEFT JOIN workspaces w ON w.id = kb.workspace_id
GROUP BY w.name
ORDER BY kb_entry_count DESC;

-- ==============================================================================
-- STEP 6: Create Audit Log Entry
-- ==============================================================================

-- If you have an audit/migration log table:
-- INSERT INTO migration_logs (migration_name, executed_at, notes)
-- VALUES ('backfill_workspace_ids', NOW(), 'Assigned workspace_id to existing KB entries');

RAISE NOTICE '✅ Workspace ID backfill completed successfully';