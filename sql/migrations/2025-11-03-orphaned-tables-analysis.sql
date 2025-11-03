-- =====================================================================
-- ANALYSIS: Orphaned Tables (Not Referenced in Code)
-- Date: 2025-11-03
-- Purpose: Identify tables with zero code references for potential removal
-- Status: ANALYSIS ONLY - NO DESTRUCTIVE OPERATIONS
-- =====================================================================

-- Based on codebase scan results, the following table has ZERO references:
--
-- Table: email_verification_tokens
-- - Code References: 0
-- - Row Count: 0
-- - Size: 56 kB
-- - Has workspace_id: NO
-- - RLS Enabled: YES
-- - Last Activity: No data
--
-- ANALYSIS:
-- This table was likely replaced by a different email verification mechanism
-- or is leftover from a previous authentication system. Since it has:
-- 1. Zero code references
-- 2. Zero rows
-- 3. No recent activity
-- It is a strong candidate for removal.
--
-- RECOMMENDATION: SAFE TO DROP
-- Reason: Empty table with no code references suggests it's unused infrastructure

-- =====================================================================
-- VERIFICATION BEFORE DROPPING
-- =====================================================================

-- 1. Verify zero rows
SELECT
    'email_verification_tokens' as table_name,
    COUNT(*) as row_count
FROM email_verification_tokens;

-- 2. Check for any foreign keys pointing TO this table
SELECT
    tc.table_name as referencing_table,
    kcu.column_name as referencing_column,
    ccu.table_name as referenced_table,
    ccu.column_name as referenced_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'email_verification_tokens';

-- 3. Check for any foreign keys FROM this table
SELECT
    tc.table_name as this_table,
    kcu.column_name as this_column,
    ccu.table_name as references_table,
    ccu.column_name as references_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'email_verification_tokens';

-- =====================================================================
-- SAFE REMOVAL PROCEDURE (EXECUTE ONLY IF VERIFICATION PASSES)
-- =====================================================================

-- Step 1: Create backup of table structure (for rollback)
-- Commented out - uncomment to execute
-- CREATE TABLE email_verification_tokens_backup_20251103 AS
-- SELECT * FROM email_verification_tokens;

-- Step 2: Drop the table
-- ONLY EXECUTE AFTER CONFIRMING:
-- - Zero rows in verification query
-- - No foreign key dependencies
-- - No code references (already verified)
-- - Team approval obtained

-- DROP TABLE IF EXISTS email_verification_tokens CASCADE;

-- =====================================================================
-- ROLLBACK PROCEDURE (If needed)
-- =====================================================================

-- To restore the table (if backup was created):
-- ALTER TABLE email_verification_tokens_backup_20251103
-- RENAME TO email_verification_tokens;

-- =====================================================================
-- ADDITIONAL TABLES WITH LOW CODE REFERENCES (Monitor for future cleanup)
-- =====================================================================

-- These tables have very few code references and might be candidates for
-- future cleanup after verification with the development team:
--
-- campaign_settings: 5 references, 0 rows
-- - May be unused feature or configuration table
-- - Investigate if campaign settings functionality is active
--
-- dpa_sub_processors: 6 references, 6 rows
-- - Data Processing Agreement sub-processors
-- - Likely reference data, keep unless DPA feature removed
--
-- dpa_update_notifications: 6 references, 0 rows
-- - Part of DPA system, may be unused
-- - Check with legal/compliance team before removing
--
-- dpa_versions: 8 references, 1 row
-- - Part of DPA system with active data
-- - Keep for compliance
--
-- sam_funnel_template_performance: 6 references, 0 rows
-- - Performance tracking for SAM funnel templates
-- - May be future feature or unused analytics
-- - Monitor for usage
--
-- funnel_step_logs: 7 references, 0 rows
-- - Logging table with no data
-- - May be unused or future feature
-- - Can be removed if confirmed unused

-- =====================================================================
-- RECOMMENDATIONS SUMMARY
-- =====================================================================

/*
IMMEDIATE ACTION:
1. DROP email_verification_tokens (0 references, 0 rows)

FUTURE REVIEW (After team consultation):
1. campaign_settings (5 references, 0 rows)
2. dpa_update_notifications (6 references, 0 rows)
3. sam_funnel_template_performance (6 references, 0 rows)
4. funnel_step_logs (7 references, 0 rows)

KEEP (Active or compliance-related):
1. dpa_sub_processors (compliance data)
2. dpa_versions (compliance data)
3. All tables with 10+ code references
4. All tables with active data (row_count > 0 and recent activity)
*/

-- =====================================================================
-- USAGE STATISTICS FOR ALL TABLES
-- =====================================================================

-- Run this to see full picture of table usage:
SELECT
    t.tablename,
    pg_size_pretty(pg_total_relation_size(t.schemaname||'.'||t.tablename)) AS size,
    (SELECT reltuples::bigint FROM pg_class WHERE relname = t.tablename) AS estimated_rows,
    obj_description((t.schemaname||'.'||t.tablename)::regclass) AS table_comment
FROM pg_tables t
WHERE t.schemaname = 'public'
ORDER BY pg_total_relation_size(t.schemaname||'.'||t.tablename) DESC;
