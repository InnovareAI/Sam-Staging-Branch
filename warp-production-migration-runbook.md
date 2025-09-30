# Production Database Migration Runbook for WARP

**CRITICAL**: This migration involves structural changes to the knowledge base system. Follow each step carefully.

## Prerequisites
- Direct database access to production PostgreSQL/Supabase
- Supabase CLI installed and configured
- Production environment credentials
- At least 30 minutes of maintenance window

## Step 1: Backup Production Database

### Option A: Supabase Dashboard Backup
```bash
# Navigate to Supabase Dashboard > Settings > Backups
# Create a manual backup before proceeding
```

### Option B: pg_dump Command
```bash
# Replace with your production credentials
export PGPASSWORD='your-production-password'
export PROD_DB_URL='postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres'

# Create timestamped backup
pg_dump $PROD_DB_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup size
ls -lh backup_*.sql
```

### Option C: Supabase CLI Backup
```bash
# Ensure you're linked to production project
supabase link --project-ref [YOUR-PROJECT-REF]

# Create backup using Supabase CLI
supabase db dump --file backup_$(date +%Y%m%d_%H%M%S).sql
```

## Step 2: Run Database Migration

```bash
# Verify migration files exist
ls -la supabase/migrations/

# Push migrations to production
supabase db push --password [YOUR-DB-PASSWORD]

# Alternative: Direct psql execution
psql $PROD_DB_URL < supabase/migrations/[MIGRATION-FILE].sql
```

## Step 3: Backfill Workspace IDs

Execute the following SQL to assign workspace IDs to existing knowledge base entries:

```sql
-- First, verify current state
SELECT COUNT(*), workspace_id IS NULL as is_null 
FROM knowledge_base 
GROUP BY workspace_id IS NULL;

-- Backfill workspace IDs based on user associations
-- Adjust this query based on your specific requirements
UPDATE knowledge_base kb
SET workspace_id = w.id
FROM users u
JOIN workspace_accounts wa ON wa.user_id = u.id
JOIN workspaces w ON w.id = wa.workspace_id
WHERE kb.created_by = u.id
AND kb.workspace_id IS NULL;

-- Mark shared/global content explicitly
UPDATE knowledge_base
SET workspace_id = NULL
WHERE is_shared = true OR category = 'global';

-- Verify results
SELECT COUNT(*), workspace_id IS NULL as is_null 
FROM knowledge_base 
GROUP BY workspace_id IS NULL;
```

## Step 4: Seed Default Sections for Each Workspace

```sql
-- Insert default sections for all workspaces
INSERT INTO knowledge_base_sections (workspace_id, name, description, display_order, created_at, updated_at)
SELECT 
    w.id as workspace_id,
    section.name,
    section.description,
    section.display_order,
    NOW() as created_at,
    NOW() as updated_at
FROM workspaces w
CROSS JOIN (
    VALUES 
        ('ICP', 'Ideal Customer Profile', 1),
        ('Products', 'Product Information', 2),
        ('Competitors', 'Competitive Analysis', 3),
        ('Personas', 'User Personas', 4),
        ('General', 'General Knowledge', 5)
) AS section(name, description, display_order)
WHERE NOT EXISTS (
    SELECT 1 
    FROM knowledge_base_sections kbs 
    WHERE kbs.workspace_id = w.id 
    AND kbs.name = section.name
);

-- Verify sections were created
SELECT workspace_id, COUNT(*) as section_count
FROM knowledge_base_sections
GROUP BY workspace_id
ORDER BY workspace_id;
```

## Step 5: Import Legacy Data (Optional)

```sql
-- Example: Import legacy ICP data
INSERT INTO knowledge_base (
    workspace_id,
    section_id,
    title,
    content,
    metadata,
    created_by,
    created_at,
    updated_at
)
SELECT 
    l.workspace_id,
    kbs.id as section_id,
    l.title,
    l.content,
    jsonb_build_object(
        'imported_from', 'legacy_system',
        'import_date', NOW(),
        'original_id', l.id
    ) as metadata,
    l.user_id as created_by,
    l.created_at,
    NOW() as updated_at
FROM legacy_icp_data l
JOIN knowledge_base_sections kbs ON kbs.workspace_id = l.workspace_id AND kbs.name = 'ICP'
WHERE NOT EXISTS (
    SELECT 1 
    FROM knowledge_base kb 
    WHERE kb.title = l.title 
    AND kb.workspace_id = l.workspace_id
);

-- Repeat similar process for products, competitors, personas
```

## Step 6: Smoke Tests

### Test 1: Verify RLS Policies
```sql
-- Test as a specific user (replace with actual user ID)
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims.sub TO 'user-uuid-here';

-- Should only see their workspace's KB entries
SELECT COUNT(*) FROM knowledge_base;

-- Reset role
RESET role;
```

### Test 2: Application-Level Tests
1. Log in as a test user in production
2. Navigate to Knowledge Base section
3. Verify you can:
   - See existing KB entries for your workspace
   - Create a new KB entry
   - Edit an existing entry
   - Cannot see other workspace's entries
4. Check that sections are properly displayed
5. Test search functionality within KB

### Test 3: API Endpoint Tests
```bash
# Test KB list endpoint
curl -X GET https://your-api.com/api/knowledge-base \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Workspace-Id: $WORKSPACE_ID"

# Test KB create endpoint
curl -X POST https://your-api.com/api/knowledge-base \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Workspace-Id: $WORKSPACE_ID" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Entry","content":"Test content","section_id":"uuid"}'
```

## Rollback Plan

If any issues arise:

```bash
# 1. Restore from backup
psql $PROD_DB_URL < backup_[TIMESTAMP].sql

# 2. Or revert specific migration
supabase db reset --password [YOUR-DB-PASSWORD]

# 3. Notify team immediately
```

## Post-Migration Checklist

- [ ] All migrations applied successfully
- [ ] Workspace IDs backfilled correctly
- [ ] Default sections created for all workspaces
- [ ] Legacy data imported (if applicable)
- [ ] RLS policies working correctly
- [ ] Application functionality verified
- [ ] No errors in application logs
- [ ] Performance metrics normal
- [ ] Backup verified and stored securely

## Emergency Contacts

- Database Admin: [Contact]
- Application Owner: [Contact]
- On-call Engineer: [Contact]

---
**Last Updated**: $(date)
**Version**: 1.0