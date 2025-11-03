# Quick Start - Database Cleanup Deployment

**Date:** November 3, 2025
**Priority:** 🔴 CRITICAL - Security vulnerabilities exist
**Estimated Time:** 15 minutes total

---

## Pre-Flight Checklist

Before starting, ensure:

- [ ] You have database credentials handy
- [ ] You have read the full cleanup report (`2025-11-03-DATABASE-CLEANUP-REPORT.md`)
- [ ] Database backup is current
- [ ] You're ready to test application after deployment
- [ ] You have ~15 minutes of uninterrupted time

---

## Step-by-Step Deployment

### STEP 1: Connect to Database (1 min)

```bash
cd /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7

# Connect to Supabase
PGPASSWORD="QFe75XZ2kqhy2AyH" psql "postgresql://postgres@db.latxadqrvrrrcvkktrog.supabase.co:5432/postgres"
```

---

### STEP 2: Enable RLS (CRITICAL - 5 min)

**Why:** Fixes immediate security vulnerabilities allowing cross-workspace data access.

```sql
-- Start transaction
BEGIN;

-- Run RLS migration
\i sql/migrations/2025-11-03-enable-rls-on-unprotected-tables.sql

-- Watch for success messages like:
-- "knowledge_base: RLS enabled with workspace isolation"
-- "workspace_members: RLS enabled with workspace isolation"
-- etc.

-- Verify RLS enabled
SELECT tablename, relrowsecurity as rls_enabled
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE schemaname = 'public'
  AND tablename IN ('knowledge_base', 'workspace_members', 'workspaces');

-- Should show TRUE for all three tables

-- If everything looks good:
COMMIT;

-- If something is wrong:
-- ROLLBACK;
```

**Expected Output:**
```
NOTICE:  knowledge_base: RLS enabled with workspace isolation
NOTICE:  workspace_members: RLS enabled with workspace isolation
NOTICE:  workspaces: RLS enabled with member-based access
...
NOTICE:  ========================================
NOTICE:  RLS VERIFICATION RESULTS
NOTICE:  ========================================
NOTICE:  knowledge_base : RLS = true
NOTICE:  workspace_members : RLS = true
...
```

---

### STEP 3: Add workspace_id to Critical Tables (5 min)

**Why:** Ensures proper workspace isolation for user-generated content.

```sql
-- Start transaction
BEGIN;

-- Run workspace_id migration
\i sql/migrations/2025-11-03-add-workspace-id-to-critical-tables.sql

-- Watch for success messages like:
-- "campaign_schedules: workspace_id added and configured"
-- "sam_conversation_messages: workspace_id added and configured"
-- etc.

-- Verify workspace_id added and backfilled
-- Check the verification output at end of script

-- If everything looks good:
COMMIT;

-- If something is wrong:
-- ROLLBACK;
```

**Expected Output:**
```
NOTICE:  campaign_schedules: workspace_id added and configured
NOTICE:  sam_conversation_messages: workspace_id added and configured
NOTICE:  sam_funnel_messages: workspace_id added and configured
...
NOTICE:  ========================================
NOTICE:  VERIFICATION RESULTS
NOTICE:  ========================================
NOTICE:  campaign_schedules : 0 / 0 rows have workspace_id
NOTICE:  sam_conversation_messages : 1632 / 1632 rows have workspace_id
...
```

---

### STEP 4: Verify Everything (2 min)

```sql
-- 1. Check all critical tables have workspace_id
SELECT
    t.table_name,
    EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public'
        AND c.table_name = t.table_name
        AND c.column_name = 'workspace_id'
    ) as has_workspace_id
FROM (VALUES
    ('campaign_schedules'),
    ('sam_conversation_messages'),
    ('sam_funnel_messages'),
    ('prospect_approval_decisions')
) AS t(table_name);

-- All should return TRUE

-- 2. Check RLS enabled on all funnel tables
SELECT
    tablename,
    relrowsecurity as rls_enabled
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE schemaname = 'public'
  AND tablename LIKE '%funnel%'
ORDER BY tablename;

-- All should return TRUE

-- 3. Exit psql
\q
```

---

### STEP 5: Test Application (5 min)

Open your application and test these critical workflows:

**Test 1: SAM Conversation**
- [ ] Open SAM chat interface
- [ ] Send a message
- [ ] Verify message appears
- [ ] Switch workspace (if applicable)
- [ ] Verify no messages from other workspace visible

**Test 2: Campaign System**
- [ ] View campaigns list
- [ ] Open a campaign
- [ ] Verify campaign data loads correctly

**Test 3: Knowledge Base**
- [ ] View knowledge base documents
- [ ] Verify only workspace documents visible
- [ ] Upload a document (if applicable)

**Test 4: Workspace Isolation**
- [ ] Create second test user in different workspace
- [ ] Login as second user
- [ ] Verify first user's data is NOT visible

---

## Troubleshooting

### Problem: "Permission denied" or "RLS policy violation"

**Solution:**
```sql
-- Check if user is in workspace_members
SELECT * FROM workspace_members WHERE user_id = auth.uid();

-- If no results, the user needs to be added to a workspace
```

### Problem: "Column workspace_id does not exist"

**Solution:**
- Ensure Step 3 completed successfully
- Check COMMIT was executed
- Re-run Step 3 if needed

### Problem: "Some rows have NULL workspace_id"

**Solution:**
```sql
-- Find tables with NULL workspace_id
SELECT '<table_name>' as table_name, COUNT(*) as null_count
FROM <table_name>
WHERE workspace_id IS NULL;

-- Manual fix (assign to a workspace)
UPDATE <table_name>
SET workspace_id = '<workspace-uuid>'
WHERE workspace_id IS NULL;
```

### Problem: Application shows "No data"

**Possible causes:**
1. RLS policy too restrictive
2. User not in workspace_members
3. workspace_id backfill failed

**Diagnosis:**
```sql
-- Check user's workspace access
SELECT w.id, w.name
FROM workspaces w
JOIN workspace_members wm ON wm.workspace_id = w.id
WHERE wm.user_id = auth.uid();

-- Check if data exists
SELECT COUNT(*) FROM sam_conversation_messages;

-- Check RLS bypass (as superuser)
SET LOCAL ROLE postgres;
SELECT COUNT(*) FROM sam_conversation_messages;
RESET ROLE;
```

---

## Rollback Procedure

If you need to undo changes:

### Rollback Step 3 (workspace_id additions)

```sql
BEGIN;

-- Remove workspace_id from tables
ALTER TABLE campaign_schedules DROP COLUMN workspace_id CASCADE;
ALTER TABLE sam_conversation_messages DROP COLUMN workspace_id CASCADE;
ALTER TABLE sam_funnel_messages DROP COLUMN workspace_id CASCADE;
ALTER TABLE sam_funnel_responses DROP COLUMN workspace_id CASCADE;
ALTER TABLE sam_funnel_analytics DROP COLUMN workspace_id CASCADE;
ALTER TABLE prospect_approval_decisions DROP COLUMN workspace_id CASCADE;
ALTER TABLE prospect_learning_logs DROP COLUMN workspace_id CASCADE;
ALTER TABLE prospect_search_results DROP COLUMN workspace_id CASCADE;

COMMIT;
```

### Rollback Step 2 (RLS)

```sql
BEGIN;

-- Disable RLS on tables
ALTER TABLE knowledge_base DISABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces DISABLE ROW LEVEL SECURITY;
ALTER TABLE core_funnel_executions DISABLE ROW LEVEL SECURITY;
ALTER TABLE core_funnel_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE dynamic_funnel_definitions DISABLE ROW LEVEL SECURITY;
ALTER TABLE dynamic_funnel_executions DISABLE ROW LEVEL SECURITY;
ALTER TABLE dynamic_funnel_steps DISABLE ROW LEVEL SECURITY;
ALTER TABLE funnel_adaptation_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE funnel_performance_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE funnel_step_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_error_logs DISABLE ROW LEVEL SECURITY;

COMMIT;
```

---

## Optional: Cleanup Orphaned Tables (Later)

After successful deployment and testing, you can optionally remove the orphaned table:

```bash
# Review analysis first
PGPASSWORD="QFe75XZ2kqhy2AyH" psql "postgresql://postgres@db.latxadqrvrrrcvkktrog.supabase.co:5432/postgres" -f sql/migrations/2025-11-03-orphaned-tables-analysis.sql

# Then manually drop if approved
PGPASSWORD="QFe75XZ2kqhy2AyH" psql "postgresql://postgres@db.latxadqrvrrrcvkktrog.supabase.co:5432/postgres" -c "DROP TABLE IF EXISTS email_verification_tokens CASCADE;"
```

---

## Success Criteria

Deployment is successful when:

- ✅ All migration scripts ran without errors
- ✅ All verification queries returned expected results
- ✅ Application loads and functions normally
- ✅ Users can access their workspace data
- ✅ Users CANNOT access other workspaces' data
- ✅ No errors in application logs

---

## Post-Deployment Monitoring

For the next 24-48 hours, monitor:

1. **Application Logs** - Check for RLS policy violations
2. **User Reports** - Any "permission denied" or "no data" issues
3. **Query Performance** - Ensure queries aren't significantly slower
4. **Database Metrics** - CPU/Memory usage in Supabase dashboard

---

## Support

If you encounter issues:

1. Check troubleshooting section above
2. Review full report: `2025-11-03-DATABASE-CLEANUP-REPORT.md`
3. Check rollback procedures
4. Verify database backup is available

---

**Time Estimate:**
- Step 1: 1 minute
- Step 2: 5 minutes
- Step 3: 5 minutes
- Step 4: 2 minutes
- Step 5: 5 minutes
- **Total: ~18 minutes**

**Good luck! 🚀**
