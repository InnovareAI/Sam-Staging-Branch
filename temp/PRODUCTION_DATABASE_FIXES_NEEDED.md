# Production Database Migrations Required

## Summary

The code fixes have been deployed successfully to production, but two database migrations need to be applied manually to resolve the 400 errors in the console.

## Deployment Status

✅ **Code Deployed**: https://app.meet-sam.com
- Commit: 1d8263a (fix: Resolve production console errors and API auth issues)
- Deploy Time: 114 seconds
- Status: Ready

## Database Migrations Needed

### 1. Add `profile_country` Column to `users` Table

**Migration File**: `/supabase/migrations/20251001120000_fix_users_profile_update.sql`

**Error Resolved**:
```
latxadqrvrrrcvkktrog.supabase.co/rest/v1/users?select=profile_country&id=eq.f6885ff3-deef-4781-8721-93011c990b1b:1
Failed to load resource: the server responded with a status of 400
```

**SQL to Apply**:
```sql
-- Add profile_country column
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_country TEXT;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_users_profile_country ON users(profile_country);

-- Update RLS policy if needed
DROP POLICY IF EXISTS "users_auth_update" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;

CREATE POLICY "users_can_update_own_profile" ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Grant permissions
GRANT UPDATE (profile_country, updated_at) ON users TO authenticated;

COMMENT ON COLUMN users.profile_country IS '2-letter country code for proxy location preference (e.g., us, de, gb)';
```

### 2. Create `workspace_invitations` Table

**Migration File**: `/supabase/migrations/20251005000003_create_workspace_invitations.sql`

**Error Resolved**:
```
latxadqrvrrrcvkktrog.supabase.co/rest/v1/workspace_invitations?select=email%2Cstatus&workspace_id=eq.babdcab8-1a78-4b2f-913e-6e9fd9821009&status=eq.pending:1
Failed to load resource: the server responded with a status of 400
```

**SQL to Apply**: See full file at `/supabase/migrations/20251005000003_create_workspace_invitations.sql` (165 lines)

**Quick Summary**:
- Creates `workspace_invitations` table with proper schema
- Adds RLS policies for workspace members to view/manage invitations
- Creates helper functions: `generate_invitation_token()`, `is_invitation_valid()`, `accept_workspace_invitation()`
- Adds indexes for performance

## How to Apply Migrations

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog
2. Click on "SQL Editor" in the left sidebar
3. Create a new query
4. Copy and paste the SQL from each migration file above
5. Run the SQL
6. Verify no errors

### Option 2: Via Supabase CLI

```bash
# From project root
cd /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7

# Push all pending migrations
supabase db push
```

**Note**: CLI push timed out during this deployment. If it continues to fail, use Option 1 (Dashboard).

### Option 3: Run Specific Migrations

```bash
# Apply just the profile_country migration
psql $DATABASE_URL < supabase/migrations/20251001120000_fix_users_profile_update.sql

# Apply just the workspace_invitations migration
psql $DATABASE_URL < supabase/migrations/20251005000003_create_workspace_invitations.sql
```

## Verification Steps

After applying the migrations, verify in the browser console:

1. **Check users table query succeeds**:
   - Open https://app.meet-sam.com
   - Open browser console (F12)
   - Look for: "✅ Loaded profile country: [value]" (or null if not set)
   - Should NOT see 400 error on `/rest/v1/users?select=profile_country`

2. **Check workspace_invitations query succeeds**:
   - Should NOT see 400 error on `/rest/v1/workspace_invitations`
   - Workspace invitation count should load properly

## Remaining Console Errors (Non-Critical)

These errors are expected and handled:

1. **Supabase cookie parsing errors**:
   - `Failed to parse cookie string: SyntaxError: Unexpected token 'b', "base64-eyJ"...`
   - **Status**: Already handled in code (see `app/lib/supabase.ts` lines 17-31)
   - **Impact**: None - cookies are auto-fixed and authentication works
   - **Action**: No action needed

2. **Google CORS error**:
   - `Access to fetch at 'https://accounts.google.com/ListAccounts...' has been blocked by CORS`
   - **Status**: Expected - browser security feature
   - **Impact**: None - doesn't affect application functionality
   - **Action**: No action needed

## Code Fixes Applied (Already Deployed)

✅ **Fixed TypeError**: Added null checks before `.replace()` calls
- `CampaignHub.tsx` line 63: `type ? type.replace(...) : 'Unknown'`
- `CampaignHub.tsx` line 4443: `template.type ? template.type.replace(...) : 'UNKNOWN'`
- `CampaignHub.tsx` line 4454: `step.message_template ? step.message_template.substring(...) : 'No message'`

✅ **Fixed 401 on approval endpoint**: Changed to use workspace_members table
- `/api/campaigns/messages/approval/route.ts`
- Now requires `workspace_id` in request
- Validates user membership via `workspace_members` table
- Removed invalid `user.user_metadata.workspace_id` references

## Expected Console After Fixes

After applying both migrations, the console should show:

```
✅ Loaded profile country: us (or null)
📊 User workspaces loaded: 1 workspaces
✅ Auto-selecting first workspace: babdcab8-1a78-4b2f-913e-6e9fd9821009
🔧 Fixed corrupted cookie (decoded base64)  [This is OK - handled automatically]
```

And should NOT show:
- ❌ 400 errors on `/rest/v1/users?select=profile_country`
- ❌ 400 errors on `/rest/v1/workspace_invitations`
- ❌ TypeError: Cannot read properties of null (reading 'replace')
- ❌ 401 on `/api/campaigns/messages/approval`

---

**Created**: 2025-10-17
**Deployment**: 68f1b378e88e13000876aa21
**Commit**: 1d8263a3519db2195d71c7ebfcc28d3509027227
