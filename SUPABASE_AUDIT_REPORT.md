# Supabase Database Query Audit Report

**Date:** November 22, 2025
**Scope:** Campaign execution, follow-ups, and related database operations
**Status:** CRITICAL ISSUES FOUND

---

## Executive Summary

Audit of all Supabase database queries in the codebase identified **4 CRITICAL MISMATCHES** and **3 MEDIUM ISSUES** between the actual database schema and the queries used in the code. These mismatches are causing silent failures in campaign execution.

### Critical Issues Found:
1. **Missing `campaign_name` field** - Queried in 2 locations, doesn't exist (column is `name`)
2. **Missing `linkedin_account_id` foreign key** - Broken join in 4 locations
3. **Incorrect status enum** - Code uses non-existent statuses like `pending`, `approved`, `connection_request_sent`
4. **Missing `contacted_at` field** - Queried but doesn't exist in schema

---

## Part 1: Actual Database Schema

### Campaigns Table
**File:** `/supabase/migrations/20250916073100_campaign_tracking.sql`

**Columns:**
```
id                    UUID PRIMARY KEY
workspace_id          UUID NOT NULL (references workspaces)
funnel_id             UUID
name                  TEXT NOT NULL  ⚠️ NOT "campaign_name"
description           TEXT
campaign_type         TEXT NOT NULL
target_icp            JSONB
ab_test_variant       TEXT
message_templates     JSONB ✓
status                TEXT DEFAULT 'draft'
launched_at           TIMESTAMPTZ
completed_at          TIMESTAMPTZ
created_by            UUID (references users)
created_at            TIMESTAMPTZ
updated_at            TIMESTAMPTZ

CONSTRAINTS:
- UNIQUE(workspace_id, name)
```

**No foreign key:** `linkedin_account_id` does not exist

---

### Campaign_Prospects Table
**File:** `/supabase/migrations/20250918100000_campaign_prospects_junction.sql`

**Columns:**
```
id                          UUID PRIMARY KEY
campaign_id                 UUID NOT NULL (references campaigns)
prospect_id                 UUID NOT NULL (references workspace_prospects)
status                      TEXT DEFAULT 'pending'
invitation_sent_at          TIMESTAMPTZ
invitation_id               TEXT
connection_accepted_at      TIMESTAMPTZ
first_message_sent_at       TIMESTAMPTZ
last_message_sent_at        TIMESTAMPTZ
message_count               INTEGER
first_reply_at              TIMESTAMPTZ
last_reply_at               TIMESTAMPTZ
reply_count                 INTEGER
error_message               TEXT
retry_count                 INTEGER
last_retry_at               TIMESTAMPTZ
sequence_step               INTEGER
next_action_due_at          TIMESTAMPTZ
added_to_campaign_at        TIMESTAMPTZ
updated_at                  TIMESTAMPTZ

ADDED LATER (20250918120000):
linkedin_user_id            TEXT ✓

ADDED LATER (20251029):
connection_accepted_at      TIMESTAMPTZ
follow_up_due_at            TIMESTAMPTZ
follow_up_sequence_index    INTEGER DEFAULT 0
last_follow_up_at           TIMESTAMPTZ

⚠️ NO FIELDS:
- first_name
- last_name
- company_name
- title
- linkedin_url
- contacted_at
```

**Status Values (CHECK constraint):**
```
'pending', 'invitation_sent', 'connected', 'message_sent', 'replied',
'interested', 'not_interested', 'bounced', 'error', 'completed',
'paused', 'excluded'
```

**Note:** Data like `first_name`, `company_name`, `title`, `linkedin_url` should come from `workspace_prospects` table via the `prospect_id` foreign key.

---

### Workspace_Accounts Table
**File:** `/supabase/migrations/20250916073000_workspace_account_management.sql` + fixes

**Columns:**
```
id                          UUID PRIMARY KEY
workspace_id                UUID NOT NULL (references workspaces)
user_id                     UUID NOT NULL (references users)
account_type                TEXT (e.g., 'linkedin')
account_identifier          TEXT
account_name                TEXT
unipile_account_id          TEXT ✓
connection_status           TEXT
connected_at                TIMESTAMPTZ
is_active                   BOOLEAN
created_at                  TIMESTAMPTZ
updated_at                  TIMESTAMPTZ

UNIQUE CONSTRAINTS:
- (unipile_account_id)
- (workspace_id, account_type, account_identifier)
```

**No field:** `linkedin_account_id` - use `unipile_account_id` or `id` instead

---

## Part 2: Critical Issues Found

### CRITICAL #1: Missing `campaign_name` Field

**Locations:**
- `/app/api/campaigns/direct/send-connection-requests/route.ts` (line 61)
- `/app/api/campaigns/direct/process-follow-ups/route.ts` (line 69)

**Current Code:**
```typescript
.select(`
  id,
  campaign_name,  // ❌ DOES NOT EXIST
  message_templates,
  linkedin_account_id,
  ...
`)
```

**Actual Schema:** Column is named `name`, not `campaign_name`

**Impact:**
- Silent failure: Supabase returns `campaign_name: undefined`
- Logging shows undefined campaign names
- Code tries to access `campaign.campaign_name` which is undefined

**Fix:**
```typescript
.select(`
  id,
  name as campaign_name,  // Use alias to keep existing code, or change all references
  message_templates,
  ...
`)

// OR change code to use:
campaign.name  // instead of campaign.campaign_name
```

---

### CRITICAL #2: Broken Foreign Key Join `workspace_accounts!linkedin_account_id`

**Locations (4 files):**
1. `/app/api/campaigns/direct/send-connection-requests/route.ts` (line 64)
2. `/app/api/campaigns/direct/process-follow-ups/route.ts` (line 71)
3. `/app/api/campaigns/linkedin/execute-via-n8n/route.ts` (line 71)
4. `/app/api/campaigns/linkedin/execute-inngest/route.ts` (line 71)

**Current Code:**
```typescript
.select(`
  id,
  campaign_name,
  message_templates,
  linkedin_account_id,  // ❌ DOES NOT EXIST IN campaigns TABLE
  workspace_accounts!linkedin_account_id (  // ❌ CANNOT JOIN ON NON-EXISTENT COLUMN
    id,
    unipile_account_id,
    account_name
  )
`)
```

**Problem:**
- `campaigns` table has NO `linkedin_account_id` column
- Cannot join on a non-existent column
- This causes a Supabase error and the entire query fails

**Solution Approach:**
The code needs to know WHICH LinkedIn account to use for a campaign. Options:

**Option A: Store `linkedin_account_id` in campaigns**
```sql
ALTER TABLE campaigns
ADD COLUMN linkedin_account_id UUID REFERENCES workspace_accounts(id);
```

Then the query would work as written.

**Option B: Get account from campaign prospects** (if each prospect's account is known)
```typescript
.select(`
  id,
  name as campaign_name,
  message_templates,
  workspace_id
`)
.eq('id', campaignId)
.single();

// Then get prospects with their accounts:
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select(`
    *,
    workspace_accounts!user_id (
      id,
      unipile_account_id,
      account_name
    )
  `)
  .eq('campaign_id', campaignId);
```

**Option C: Fetch account separately by workspace**
```typescript
// After getting campaign:
const { data: accounts } = await supabase
  .from('workspace_accounts')
  .select('id, unipile_account_id, account_name')
  .eq('workspace_id', campaign.workspace_id)
  .eq('account_type', 'linkedin')
  .limit(1);
```

**Recommended Fix:** Option A (add `linkedin_account_id` to campaigns table)

---

### CRITICAL #3: Non-Existent Status Values

**Locations:** Multiple files using wrong status values

**Actual Status Values (from schema):**
```
'pending', 'invitation_sent', 'connected', 'message_sent', 'replied',
'interested', 'not_interested', 'bounced', 'error', 'completed',
'paused', 'excluded'
```

**Code Uses (from `/app/api/campaigns/direct/send-connection-requests/route.ts`):**
```typescript
// Line 96: ❌ These statuses don't match schema
.or(`status.in.(pending,approved),and(status.eq.failed,updated_at.lt.${...})`)

// Line 164: ❌ Wrong status values
.in('status', ['connection_request_sent', 'connected', 'messaging', 'replied'])

// Lines 226-280: ❌ Sets status to values that don't exist
.update({ status: 'connected' })        // ✓ EXISTS
.update({ status: 'connection_request_sent' })  // ❌ DOESN'T EXIST (should be 'invitation_sent')
.update({ status: 'failed' })           // ❌ DOESN'T EXIST (should be 'error')
```

**Mapping:**
| Code Uses | Correct Value |
|-----------|--------------|
| `pending` | `pending` ✓ |
| `approved` | DOESN'T EXIST - remove from query |
| `failed` | `error` |
| `connection_request_sent` | `invitation_sent` |
| `messaging` | `message_sent` |
| `replied` | `replied` ✓ |
| `connected` | `connected` ✓ |

**Impact:** Queries using non-existent status values may:
- Fail validation
- Return no results (no rows match those statuses)
- Cause constraint violations on update

---

### CRITICAL #4: Missing `contacted_at` Field

**Locations:**
- `/app/api/campaigns/direct/send-connection-requests/route.ts` (lines 129, 161, 320)

**Current Code:**
```typescript
// Line 129:
.select('status, contacted_at, campaign_id, campaigns(campaign_name)')

// Line 161:
.select('status, contacted_at')

// Line 320:
contacted_at: new Date().toISOString(),  // Trying to set non-existent field
```

**Problem:**
- `campaign_prospects` table has NO `contacted_at` field
- Queries will fail or return undefined
- Updates will fail with "column doesn't exist" error

**Actual Field:** Use `invitation_sent_at` instead

**Fix:**
```typescript
// Replace:
.select('status, contacted_at, ...')

// With:
.select('status, invitation_sent_at, ...')

// Replace updates:
contacted_at: new Date().toISOString()

// With:
invitation_sent_at: new Date().toISOString()
```

---

## Part 3: Medium Issues

### MEDIUM #1: Querying Non-Existent Prospect Fields

**File:** `/app/api/campaigns/direct/send-connection-requests/route.ts`

**Problem:**
```typescript
// Line 94: Selecting all fields from campaign_prospects
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('*')

// Later code assumes these fields exist (lines 124+):
prospect.first_name          // ❌ NOT IN campaign_prospects
prospect.last_name           // ❌ NOT IN campaign_prospects
prospect.company_name        // ❌ NOT IN campaign_prospects
prospect.title               // ❌ NOT IN campaign_prospects
prospect.linkedin_url        // ❌ NOT IN campaign_prospects
prospect.linkedin_user_id    // ✓ EXISTS
```

**Root Cause:** These fields are in `workspace_prospects`, not `campaign_prospects`

**Fix:**
```typescript
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select(`
    *,
    workspace_prospects (
      id,
      first_name,
      last_name,
      company_name,
      title,
      linkedin_url
    )
  `)
  .eq('campaign_id', campaignId)
  // ... rest of filters

// Then access via:
prospect.workspace_prospects.first_name
// OR flatten with response transformation
```

---

### MEDIUM #2: Incorrect OR Clause Syntax

**File:** `/app/api/campaigns/direct/send-connection-requests/route.ts` (line 96)

**Current Code:**
```typescript
.or(`status.in.(pending,approved),and(status.eq.failed,updated_at.lt.${cooldownDate.toISOString()})`)
```

**Problems:**
1. Status values `pending` and `approved` - `approved` doesn't exist
2. Complex OR/AND combination may have operator precedence issues

**What It's Trying to Do:**
- Select: (status IN ('pending', 'approved')) OR (status = 'failed' AND updated_at < cooldownDate)

**Fixed Query:**
```typescript
.or(`status.eq.pending,and(status.eq.error,updated_at.lt.${cooldownDate.toISOString()})`)

// OR split into simpler filters:
const cooldownDate = new Date();
cooldownDate.setHours(cooldownDate.getHours() - 24);

const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('campaign_id', campaignId)
  .eq('status', 'pending')
  .not('linkedin_url', 'is', null)
  .order('created_at', { ascending: true })
  .limit(20);

// Then separately get failed prospects from >24h ago
```

---

### MEDIUM #3: RLS Policy Mismatch

**Migration:** `/supabase/migrations/20250918100000_campaign_prospects_junction.sql` (line 76)

**Current RLS Policy:**
```sql
CREATE POLICY "Users can access workspace campaign prospects" ON campaign_prospects
    FOR ALL USING (
        campaign_id IN (
            SELECT id FROM campaigns WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members WHERE user_id =
                (SELECT id FROM users WHERE clerk_id = auth.uid()::text)  -- ❌ CLERK REMOVED
            )
        )
    );
```

**Problem:**
- Code references `users.clerk_id` which was removed (migration 20250919)
- This RLS policy will fail for all non-service-role users
- Service role queries bypass RLS, so they may work but regular user queries will fail

**Fix:** Update RLS policy to use Supabase Auth:
```sql
CREATE POLICY "Users can access workspace campaign prospects" ON campaign_prospects
    FOR ALL USING (
        campaign_id IN (
            SELECT id FROM campaigns WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
            )
        )
    );
```

---

## Part 4: Detailed Query Audit by File

### File 1: `/app/api/campaigns/direct/send-connection-requests/route.ts`

| Line | Issue | Severity | Status |
|------|-------|----------|--------|
| 58-71 | Queries `campaign_name` (doesn't exist) | CRITICAL | ❌ BROKEN |
| 58-71 | Tries to join on `linkedin_account_id` (doesn't exist) | CRITICAL | ❌ BROKEN |
| 96 | Uses wrong status enum values | CRITICAL | ❌ BROKEN |
| 94 | Selects `*` from campaign_prospects but accesses prospect fields | MEDIUM | ❌ BROKEN |
| 129 | Queries `contacted_at` field (doesn't exist) | CRITICAL | ❌ BROKEN |
| 320 | Updates `contacted_at` field (doesn't exist) | CRITICAL | ❌ BROKEN |
| 164 | Uses non-existent status `connection_request_sent` | CRITICAL | ❌ BROKEN |

**Status:** This entire route is broken. Will fail at campaign fetch on line 57-71.

---

### File 2: `/app/api/campaigns/direct/process-follow-ups/route.ts`

| Line | Issue | Severity | Status |
|------|-------|----------|--------|
| 63-76 | Queries `campaign_name` (doesn't exist) | CRITICAL | ❌ BROKEN |
| 63-76 | Tries to join on `linkedin_account_id` (doesn't exist) | CRITICAL | ❌ BROKEN |
| 77 | Uses non-existent status `connection_request_sent` | CRITICAL | ❌ BROKEN |

**Status:** This entire route is broken. Will fail at prospects fetch on line 62-81.

---

### File 3: `/app/api/campaigns/linkedin/execute-via-n8n/route.ts`

| Line | Issue | Severity | Status |
|------|-------|----------|--------|
| 71 | Tries to join on `linkedin_account_id` (doesn't exist) | CRITICAL | ❌ BROKEN |

**Status:** Will fail when this query is executed.

---

### File 4: `/app/api/campaigns/linkedin/execute-inngest/route.ts`

| Line | Issue | Severity | Status |
|------|-------|----------|--------|
| 71 | Tries to join on `linkedin_account_id` (doesn't exist) | CRITICAL | ❌ BROKEN |

**Status:** Will fail when this query is executed.

---

## Part 5: Recommended Fixes (Priority Order)

### Priority 1: Database Schema (Add Missing Columns)

```sql
-- Add to campaigns table to support linkedin_account_id foreign key
ALTER TABLE campaigns
ADD COLUMN linkedin_account_id UUID REFERENCES workspace_accounts(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_campaigns_linkedin_account_id ON campaigns(linkedin_account_id);

-- Add comment
COMMENT ON COLUMN campaigns.linkedin_account_id IS 'LinkedIn account to use for this campaign';
```

**Impact:** Enables the join in all 4 files.

---

### Priority 2: Fix All Campaign Queries

**File:** `/app/api/campaigns/direct/send-connection-requests/route.ts`

```typescript
// BEFORE (lines 57-71):
const { data: campaign, error: campaignError } = await supabase
  .from('campaigns')
  .select(`
    id,
    campaign_name,
    message_templates,
    linkedin_account_id,
    workspace_accounts!linkedin_account_id (
      id,
      unipile_account_id,
      account_name
    )
  `)
  .eq('id', campaignId)
  .single();

// AFTER:
const { data: campaign, error: campaignError } = await supabase
  .from('campaigns')
  .select(`
    id,
    name,
    message_templates,
    linkedin_account_id,
    workspace_accounts!linkedin_account_id (
      id,
      unipile_account_id,
      account_name
    )
  `)
  .eq('id', campaignId)
  .single();

// Update code to use:
const campaignName = campaign.name;  // instead of campaign.campaign_name
```

**File:** `/app/api/campaigns/direct/process-follow-ups/route.ts`

```typescript
// BEFORE (lines 62-76):
const { data: prospects, error: prospectsError } = await supabase
  .from('campaign_prospects')
  .select(`
    *,
    campaigns!inner (
      id,
      campaign_name,
      message_templates,
      linkedin_account_id,
      workspace_accounts!linkedin_account_id (
        unipile_account_id,
        account_name
      )
    )
  `)

// AFTER:
const { data: prospects, error: prospectsError } = await supabase
  .from('campaign_prospects')
  .select(`
    *,
    workspace_prospects (
      first_name,
      last_name,
      company_name,
      title,
      linkedin_url
    ),
    campaigns!inner (
      id,
      name,
      message_templates,
      linkedin_account_id,
      workspace_accounts!linkedin_account_id (
        unipile_account_id,
        account_name
      )
    )
  `)
```

---

### Priority 3: Fix Status Values

**Replace all instances:**

| Search | Replace |
|--------|---------|
| `status.in.(pending,approved)` | `status.eq.pending` |
| `status.eq.failed` | `status.eq.error` |
| `connection_request_sent` | `invitation_sent` |
| `messaging` | `message_sent` |

**Files affected:**
- `/app/api/campaigns/direct/send-connection-requests/route.ts`
- `/app/api/campaigns/direct/process-follow-ups/route.ts`
- Any other files using campaign_prospects

---

### Priority 4: Fix contacted_at References

**Replace all instances:**

```typescript
// BEFORE:
.select('status, contacted_at, ...')
contacted_at: new Date().toISOString()

// AFTER:
.select('status, invitation_sent_at, ...')
invitation_sent_at: new Date().toISOString()
```

---

### Priority 5: Update RLS Policies

**File:** `/supabase/migrations/20250918100000_campaign_prospects_junction.sql`

Need to update the RLS policy for `campaign_prospects` to remove reference to `users.clerk_id`:

```sql
-- Drop old policy
DROP POLICY IF EXISTS "Users can access workspace campaign prospects" ON campaign_prospects;

-- Create new policy using Supabase Auth
CREATE POLICY "Users can access workspace campaign prospects" ON campaign_prospects
    FOR ALL USING (
        campaign_id IN (
            SELECT id FROM campaigns WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
            )
        )
    );
```

---

## Part 6: Testing Checklist

After applying fixes, verify:

- [ ] Campaign created with `linkedin_account_id` set
- [ ] `GET /api/campaigns/direct/send-connection-requests` returns campaign with correct fields
- [ ] `GET /api/campaigns/direct/process-follow-ups` returns prospects with prospect data
- [ ] Status values stored and queried correctly
- [ ] RLS policies allow workspace members to access campaigns
- [ ] Prospect name fields display correctly (not undefined)
- [ ] Follow-up messages send without `contacted_at` errors
- [ ] LinkedIn account info properly joined and accessible

---

## Part 7: Summary Table

| Issue | Type | Files | Impact | Difficulty | Time |
|-------|------|-------|--------|------------|------|
| Missing `linkedin_account_id` column | Schema | 4 files | Campaign fetch fails | Low | 10m |
| Wrong column name `campaign_name` | Code | 2 files | Undefined names | Low | 5m |
| Broken `workspace_accounts!linkedin_account_id` join | Code | 4 files | Campaign fetch fails | Medium | 15m |
| Wrong status enum values | Code | 2 files | Fetch returns 0 rows | Low | 10m |
| Missing `contacted_at` field | Code | 1 file | Updates fail | Low | 5m |
| Wrong prospect field join | Code | 2 files | Undefined prospect data | Medium | 20m |
| RLS policy references removed column | Policy | 1 file | User queries blocked | High | 20m |

---

## Conclusion

**Critical Status:** The campaign execution system is currently broken due to fundamental schema/query mismatches.

**Estimated Fix Time:** 2-3 hours total

**Recommended Approach:**
1. Start with database schema (add missing `linkedin_account_id` column) - 10m
2. Fix all campaign queries to use correct column names - 30m
3. Fix all status enum values - 15m
4. Fix prospect data joins - 30m
5. Update RLS policies - 20m
6. Test end-to-end - 30m

All fixes are straightforward once the schema is understood.
