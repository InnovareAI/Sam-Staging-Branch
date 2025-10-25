# LinkedIn/Workspace Schema Fix - Deployment Guide

## 🚨 CRITICAL FIX REQUIRED

This migration fixes ALL LinkedIn/Workspace/User mapping inconsistencies that are breaking the prospect → LinkedIn message workflow.

---

## Issues Fixed

1. ✅ **workspace_accounts.workspace_id** type mismatch (TEXT → UUID)
2. ✅ **user_unipile_accounts** missing workspace_id column
3. ✅ **linkedin_contacts** RLS policies still using old Clerk auth
4. ✅ **linkedin_discovery_jobs** RLS policies still using old Clerk auth
5. ✅ Orphaned accounts not synced between tables
6. ✅ Missing foreign key constraints
7. ✅ Atomic account association function updated

---

## Deployment Steps

### Option 1: Supabase Dashboard (RECOMMENDED)

1. **Go to Supabase SQL Editor:**
   ```
   https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql
   ```

2. **Create New Query**

3. **Copy the entire contents** of:
   ```
   supabase/migrations/20251025_fix_linkedin_workspace_schema.sql
   ```

4. **Run the migration**

5. **Verify success** - Check for:
   - ✅ No errors
   - ✅ "Synced orphaned accounts" output

---

### Option 2: Command Line

```bash
# From project root
cd /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7

# Apply via psql (if you have direct access)
psql $DATABASE_URL -f supabase/migrations/20251025_fix_linkedin_workspace_schema.sql
```

---

## Post-Migration Verification

Run these queries in Supabase SQL Editor to verify:

### 1. Check workspace_id type is now UUID:
```sql
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_name = 'workspace_accounts'
  AND column_name = 'workspace_id';
-- Expected: data_type = 'uuid'
```

### 2. Check user_unipile_accounts has workspace_id:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'user_unipile_accounts'
  AND column_name = 'workspace_id';
-- Expected: 1 row returned
```

### 3. Check linkedin_contacts RLS policies:
```sql
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'linkedin_contacts';
-- Expected: New policies without 'clerk_id'
```

### 4. Check for unmapped accounts:
```sql
SELECT * FROM v_linkedin_account_status
WHERE mapping_status != 'fully_mapped';
-- Expected: 0 rows (all accounts mapped)
```

### 5. Verify orphaned accounts were synced:
```sql
SELECT COUNT(*) as synced_accounts
FROM workspace_accounts
WHERE created_at > NOW() - INTERVAL '5 minutes';
-- Should show newly created accounts
```

---

## What This Migration Does

### Part 1: Fix workspace_accounts.workspace_id Type
- Converts `workspace_id` from TEXT → UUID
- Adds proper foreign key to `workspaces(id)`
- Recreates unique constraints

### Part 2: Add workspace_id to user_unipile_accounts
- Adds `workspace_id UUID` column
- Backfills data from `workspace_members`
- Creates index for performance

### Part 3: Fix linkedin_contacts RLS
- Drops old Clerk-based policies
- Fixes foreign key to `auth.users`
- Creates new Supabase Auth policies

### Part 4: Fix linkedin_discovery_jobs RLS
- Same fixes as linkedin_contacts

### Part 5: Update user_unipile_accounts RLS
- Adds workspace-aware policies

### Part 6: Update Atomic Association Function
- `associate_linkedin_account_atomic()` now handles workspace_id
- Writes to BOTH tables atomically

### Part 7: Create Helper View
- `v_linkedin_account_status` - Shows mapping status

### Part 8: Sync Function
- `sync_orphaned_linkedin_accounts()` - Fixes existing data

### Part 9: Auto-Sync
- Runs sync function immediately after migration

---

## Rollback Plan (if needed)

```sql
-- 1. Restore workspace_accounts.workspace_id to TEXT
ALTER TABLE workspace_accounts
  ALTER COLUMN workspace_id TYPE TEXT;

-- 2. Remove workspace_id from user_unipile_accounts
ALTER TABLE user_unipile_accounts
  DROP COLUMN workspace_id;

-- 3. Restore old RLS policies (see backup)
-- (You'd need to restore from backup file)
```

**NOTE:** Rollback not recommended as it reverts to broken state.

---

## Testing After Migration

### Test 1: LinkedIn Account Connection
```javascript
// In app, try connecting a LinkedIn account
// Should now write to BOTH:
// - user_unipile_accounts (with workspace_id)
// - workspace_accounts (with UUID workspace_id)
```

### Test 2: Prospect → Campaign Flow
```javascript
// 1. Approve prospects
// 2. Upload to campaign
// 3. Sync LinkedIn IDs
// 4. Send messages
// Should work end-to-end now
```

### Test 3: linkedin_contacts Query
```javascript
// Should not error on RLS policies
const { data, error } = await supabase
  .from('linkedin_contacts')
  .select('*');
// Expected: No auth errors
```

---

## Files Changed

- ✅ `supabase/migrations/20251025_fix_linkedin_workspace_schema.sql` (NEW)
- ✅ `LINKEDIN_SCHEMA_FIX_DEPLOYMENT.md` (NEW - this file)

---

## Timeline

- **Created:** 2025-10-25
- **Priority:** CRITICAL - Blocks LinkedIn messaging
- **Estimated Time:** 5 minutes to apply
- **Risk Level:** MEDIUM (schema changes, but with rollback)

---

## Support

If migration fails, check:
1. ❌ Duplicate Unipile account IDs → Clean up first
2. ❌ Invalid UUID formats in workspace_id → Fix data first
3. ❌ Missing workspaces → Create missing workspaces

For help, check migration output for specific error messages.
