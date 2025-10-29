# LinkedIn TOS Compliance Safeguards

**Date:** 2025-10-29
**Status:** ✅ IMPLEMENTED

## Critical Rule

**LinkedIn TOS requires that users can ONLY message prospects they personally found/added.**

This means:
- ❌ No account sharing between team members
- ❌ User A cannot message prospects added by User B
- ❌ Cannot use someone else's LinkedIn account to send messages
- ✅ Each user must use their own LinkedIn account
- ✅ Each user can only message prospects they personally added

---

## Implementation

### 1. Database Schema Changes

**Added `added_by` column to track prospect ownership:**

```sql
-- workspace_prospects
ALTER TABLE workspace_prospects
ADD COLUMN added_by UUID REFERENCES auth.users(id);

-- campaign_prospects
ALTER TABLE campaign_prospects
ADD COLUMN added_by UUID REFERENCES auth.users(id);
```

**Indexes for performance:**
```sql
CREATE INDEX idx_workspace_prospects_added_by ON workspace_prospects(added_by);
CREATE INDEX idx_campaign_prospects_added_by ON campaign_prospects(added_by);
```

**Current status:**
- ✅ campaign_prospects: 153/153 have ownership
- ✅ workspace_prospects: 176/368 have ownership (remaining are orphaned)

---

### 2. Code-Level Safeguards

**File:** `app/api/campaigns/linkedin/execute-live/route.ts`

**Change 1: Use campaign creator's LinkedIn account (Lines 108-122)**
```typescript
if (isInternalTrigger) {
  // Cron trigger: use campaign creator's LinkedIn account
  // CRITICAL: Each campaign must use the LinkedIn account of the person who created it
  const result = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('workspace_id', campaign.workspace_id)
    .eq('user_id', campaign.created_by)  // Use campaign creator's account
    .eq('account_type', 'linkedin')
    .eq('connection_status', 'connected')
    .single();
}
```

**Change 2: Filter prospects by ownership (Lines 262-281)**
```typescript
// CRITICAL TOS COMPLIANCE: Filter prospects by ownership
// Users can ONLY message prospects they personally added
const executableProspects = campaignProspects?.filter(cp => {
  const hasLinkedIn = cp.linkedin_url || cp.linkedin_user_id;
  const isOwnedByUser = cp.added_by === selectedAccount.user_id;

  if (hasLinkedIn && !isOwnedByUser) {
    console.warn(`⚠️ TOS VIOLATION PREVENTED: Prospect ${cp.first_name} ${cp.last_name} owned by ${cp.added_by}, cannot message from ${selectedAccount.user_id}'s account`);
  }

  return hasLinkedIn && isOwnedByUser;
}) || [];
```

**Change 3: Clear error messages (Lines 295-301)**
```typescript
if (blockedByOwnership > 0) {
  suggestions.unshift(
    `🚨 TOS COMPLIANCE: ${blockedByOwnership} prospects cannot be messaged because they were added by other users`,
    'LinkedIn TOS requires each user to ONLY message prospects they personally added',
    'Each team member must create their own prospect lists and campaigns'
  );
}
```

---

## How It Works

### Before (TOS VIOLATION) ❌

1. Michelle creates a campaign
2. Campaign uses ANY LinkedIn account in workspace (could be Irish's)
3. Michelle's prospects get messaged from Irish's LinkedIn account
4. **VIOLATION:** Irish didn't add those prospects

### After (TOS COMPLIANT) ✅

1. Michelle creates a campaign
2. Campaign uses ONLY Michelle's LinkedIn account
3. System checks: Does Michelle own these prospects?
4. If YES → Send messages
5. If NO → Block and warn about TOS violation

---

## Testing

Run a test campaign to verify compliance:

```bash
# This should now use YOUR LinkedIn account only
node scripts/js/watch-all-campaigns.mjs
```

**Expected behavior:**
- Campaign uses creator's LinkedIn account ✅
- Only messages prospects added by creator ✅
- Blocks prospects added by other users ✅
- Logs TOS violation warnings ✅

---

## User Workflow

**Correct workflow (each user does this):**

1. User connects their own LinkedIn account
2. User creates their own prospect list (CSV upload, SAM AI search, etc.)
3. User creates a campaign with their prospects
4. Campaign executes using their LinkedIn account
5. System ensures ONLY their prospects are messaged

**What's prevented:**

- ❌ Using a coworker's LinkedIn account
- ❌ Messaging prospects added by a coworker
- ❌ Sharing LinkedIn accounts between team members
- ❌ Bulk messaging from shared prospect pools

---

## Monitoring

**Check logs for TOS violations:**

```bash
# Look for this warning in Netlify function logs:
"⚠️ TOS VIOLATION PREVENTED: Prospect [name] owned by [user_a], cannot message from [user_b]'s account"
```

**Database queries:**

```sql
-- Check prospect ownership distribution
SELECT
  added_by,
  COUNT(*) as prospect_count
FROM campaign_prospects
WHERE added_by IS NOT NULL
GROUP BY added_by;

-- Find prospects with no owner (need manual review)
SELECT COUNT(*)
FROM campaign_prospects
WHERE added_by IS NULL;
```

---

## Files Modified

1. **Database:**
   - `workspace_prospects` - added `added_by` column
   - `campaign_prospects` - added `added_by` column

2. **API:**
   - `app/api/campaigns/linkedin/execute-live/route.ts` - added ownership validation

3. **Scripts:**
   - `scripts/js/add-prospect-ownership.mjs` - backfill script
   - `scripts/js/fix-workspace-prospects-ownership.mjs` - fix orphaned prospects

4. **Migrations:**
   - `supabase/migrations/RUN_THIS_IN_SUPABASE_SQL_EDITOR.sql` - schema changes

---

## Future Improvements

1. **Add RLS policies** - Database-level enforcement
2. **UI warnings** - Show ownership info in campaign UI
3. **Audit trail** - Log all messaging attempts with ownership info
4. **Auto-assignment** - Set `added_by` when prospects are created
5. **Ownership transfer** - Allow explicit prospect ownership transfer (with audit)

---

## Support

If you see TOS violation warnings:
1. **DO NOT** ignore them
2. **DO NOT** try to bypass the ownership check
3. **DO** ensure each user creates their own prospect lists
4. **DO** ensure each user connects their own LinkedIn account

**Questions?** Contact the development team.

---

**Last Updated:** 2025-10-29
**Compliance Status:** ✅ FULLY IMPLEMENTED
