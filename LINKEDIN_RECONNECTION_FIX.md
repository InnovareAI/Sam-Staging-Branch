# LinkedIn Reconnection Auto-Update Fix

**Issue:** When users disconnect and reconnect their LinkedIn account (e.g., upgrading to Sales Navigator), the old Unipile account ID remains in the database, causing "No LinkedIn account connected" errors.

**Root Cause:** The RPC function `associate_linkedin_account_atomic` is NOT applied to the production database. This function is responsible for automatically updating the Unipile account ID when users reconnect.

**Status:** ⚠️ **REQUIRES IMMEDIATE FIX**

---

## What's Happening

1. User disconnects LinkedIn account
2. User reconnects LinkedIn account (gets new Unipile ID from Sales Nav)
3. OAuth callback tries to call `associate_linkedin_account_atomic` RPC
4. **RPC function doesn't exist** → fallback logic doesn't update Unipile ID
5. Old Unipile ID remains in database → API calls fail

---

## The Fix

The migration file already exists and is correct:
- **File:** `supabase/migrations/20251022_create_atomic_account_association.sql`
- **Lines 114-115:** Updates `unipile_account_id` on conflict (reconnection)

```sql
ON CONFLICT (workspace_id, user_id, account_type, account_identifier) DO UPDATE SET
    unipile_account_id = EXCLUDED.unipile_account_id,  ← This updates the ID!
```

**This migration just needs to be applied to production.**

---

## How to Apply

### Option 1: Supabase Dashboard (Recommended)

1. **Go to SQL Editor:**
   ```
   https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql/new
   ```

2. **Copy the entire migration file:**
   - Location: `supabase/migrations/20251022_create_atomic_account_association.sql`
   - Select all (Cmd/Ctrl+A) and copy

3. **Paste into SQL Editor**

4. **Click "Run"** (bottom right)

5. **Verify success:**
   ```sql
   -- Test the function exists
   SELECT proname FROM pg_proc WHERE proname = 'associate_linkedin_account_atomic';
   ```

   Should return 1 row.

### Option 2: Supabase CLI

```bash
# From project root
cd /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7

# Apply migration
supabase db push --db-url "postgresql://postgres.latxadqrvrrrcvkktrog:QFe75XZ2kqhy2AyH@db.latxadqrvrrrcvkktrog.supabase.co:5432/postgres"
```

**Note:** Password may have changed. Check `.env.local` for current credentials.

### Option 3: Direct psql

```bash
PGPASSWORD='QFe75XZ2kqhy2AyH' psql \
  -h db.latxadqrvrrrcvkktrog.supabase.co \
  -U postgres.latxadqrvrrrcvkktrog \
  -d postgres \
  -f supabase/migrations/20251022_create_atomic_account_association.sql
```

---

## Verification

After applying the migration, run this to verify:

```bash
node scripts/js/verify-reconnection-migration.mjs
```

**Expected output:**
```
✅ MIGRATION APPLIED!
   RPC function exists
```

---

## Testing the Fix

### Test with Stan's Account

Stan Bounev already reconnected his account and got the new ID: `4Vv6oZ73RvarImDN6iYbbg`

**Before fix:**
- Old ID in database: `FhQYuy9yS2KETw-OYIa0Yw`
- Error: "No LinkedIn account connected"

**After fix:**
1. Have Stan disconnect LinkedIn in Settings
2. Have Stan reconnect LinkedIn
3. **New ID should automatically update in database**
4. No more "No LinkedIn account connected" errors

### Verification Query

```sql
-- Check Stan's account
SELECT
  account_name,
  unipile_account_id,
  connection_status,
  updated_at
FROM workspace_accounts
WHERE user_id = '6a927440-ebe1-49b4-ae5e-fbee5d27944d'
  AND account_type = 'linkedin';
```

**Expected:**
- `unipile_account_id`: Should match the NEW ID from Unipile
- `connection_status`: 'connected'
- `updated_at`: Recent timestamp

---

## What This RPC Function Does

The `associate_linkedin_account_atomic` function:

1. **Validates** user, workspace, and Unipile account ID
2. **Updates** `user_unipile_accounts` table (personal account list)
3. **Upserts** `workspace_accounts` table with **automatic Unipile ID update** on conflict
4. **Atomic operation** - both tables updated or both fail (no drift)

### Key Feature: Auto-Update on Reconnection

```sql
-- Lines 114-121 of migration file
ON CONFLICT (workspace_id, user_id, account_type, account_identifier) DO UPDATE SET
    unipile_account_id = EXCLUDED.unipile_account_id,  ← Updates old ID to new ID
    connection_status = 'connected',
    connected_at = NOW(),
    is_active = TRUE,
    account_name = EXCLUDED.account_name,
    account_metadata = EXCLUDED.account_metadata,
    updated_at = NOW();
```

**This means:**
- User reconnects with same email → **Unipile ID automatically updated**
- No manual intervention needed
- No "No LinkedIn account connected" errors

---

## Impact

### Before Migration
- ❌ Every reconnection requires manual database update
- ❌ Users see "No LinkedIn account connected"
- ❌ Support tickets every time someone upgrades to Sales Nav
- ❌ Manual script required: `check-stan-bounev-account.mjs`

### After Migration
- ✅ Automatic Unipile ID updates on reconnection
- ✅ Zero manual intervention required
- ✅ No support tickets for reconnections
- ✅ Seamless Sales Navigator upgrades

---

## Files Involved

### Migration File (Needs to be applied)
- `supabase/migrations/20251022_create_atomic_account_association.sql`

### OAuth Callback (Already using RPC - line 442)
- `app/api/unipile/hosted-auth/callback/route.ts`
  ```typescript
  const { data: rpcResult, error: rpcError } = await supabase.rpc('associate_linkedin_account_atomic', {
    p_user_id: targetUserId,
    p_workspace_id: targetWorkspaceId,
    p_unipile_account_id: accountId,
    p_account_data: accountData
  })
  ```

### Verification Scripts
- `scripts/js/verify-reconnection-migration.mjs` - Check if migration applied
- `scripts/js/check-stan-bounev-account.mjs` - Manual fix for Stan (temporary)
- `scripts/js/apply-reconnection-fix.mjs` - Attempted automated fix (didn't work)

---

## Priority

**URGENT - Should be applied ASAP**

This affects:
- All users who disconnect/reconnect LinkedIn
- All users upgrading to Sales Navigator
- All users with expired LinkedIn sessions

**Current workaround:** Manual database updates using `check-stan-bounev-account.mjs`

**Proper fix:** Apply the migration once → problem solved forever

---

## Next Steps

1. **Apply migration** via Supabase Dashboard (5 minutes)
2. **Verify** using verification script
3. **Test** with Stan's account (have him reconnect)
4. **Monitor** logs for any reconnection attempts
5. **Delete temporary fix scripts** (no longer needed)

---

**Questions?**
- Check the migration file: `supabase/migrations/20251022_create_atomic_account_association.sql`
- Review OAuth callback: `app/api/unipile/hosted-auth/callback/route.ts` (line 442)
- Run verification: `node scripts/js/verify-reconnection-migration.mjs`
