# Supabase Query Fixes - Step by Step Implementation Guide

**Date:** November 22, 2025
**Est. Time:** 2-3 hours

This guide provides exact code changes to fix all identified issues.

---

## Step 1: Add Missing `linkedin_account_id` Column to Campaigns Table

**File:** Create new migration
**Location:** `/supabase/migrations/20251122_add_linkedin_account_to_campaigns.sql`

```sql
-- Add linkedin_account_id to campaigns table to support LinkedIn account selection per campaign
BEGIN;

-- Add the column
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS linkedin_account_id UUID REFERENCES workspace_accounts(id) ON DELETE SET NULL;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_campaigns_linkedin_account_id
ON campaigns(linkedin_account_id);

-- Add comment
COMMENT ON COLUMN campaigns.linkedin_account_id IS 'LinkedIn workspace account to use for this campaign';

-- Verify the column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'campaigns' AND column_name = 'linkedin_account_id';

COMMIT;
```

**Apply:** Run in Supabase SQL Editor or via migration system.

---

## Step 2: Fix send-connection-requests Route

**File:** `/app/api/campaigns/direct/send-connection-requests/route.ts`

### Change 1: Fix Campaign Query (lines 57-71)

**BEFORE:**
```typescript
    // 1. Fetch campaign details
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
```

**AFTER:**
```typescript
    // 1. Fetch campaign details
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
```

**What changed:**
- `campaign_name` → `name` (correct column name)

### Change 2: Fix Reference to campaign_name (line 85)

**BEFORE:**
```typescript
    console.log(`📋 Campaign: ${campaign.campaign_name}`);
```

**AFTER:**
```typescript
    console.log(`📋 Campaign: ${campaign.name}`);
```

### Change 3: Fix Prospects Query (lines 92-99)

**BEFORE:**
```typescript
    const { data: prospects, error: prospectsError } = await supabase
      .from('campaign_prospects')
      .select('*')
      .eq('campaign_id', campaignId)
      .or(`status.in.(pending,approved),and(status.eq.failed,updated_at.lt.${cooldownDate.toISOString()})`)
      .not('linkedin_url', 'is', null)
      .order('created_at', { ascending: true })
      .limit(20); // Process 20 at a time
```

**AFTER:**
```typescript
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
        )
      `)
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
      .not('workspace_prospects->>linkedin_url', 'is', null)
      .order('created_at', { ascending: true })
      .limit(20); // Process 20 at a time
```

**What changed:**
- Changed from `select('*')` to explicit fields + workspace_prospects join
- Removed invalid OR clause with `approved` and `failed` statuses
- Replaced with simple `eq('status', 'pending')` filter
- Updated NOT filter to reference the joined table

### Change 4: Fix Prospect Data Access (lines 124-125, and throughout)

**BEFORE:**
```typescript
        console.log(`\n👤 Processing: ${prospect.first_name} ${prospect.last_name}`);

        // ... more code ...

        // Line 129
          .select('status, contacted_at, campaign_id, campaigns(campaign_name)')

        // Line 136
          const otherCampaignName = (existingInOtherCampaign as any).campaigns?.campaign_name || 'another campaign';
```

**AFTER:**
```typescript
        const prospectData = prospect.workspace_prospects as any;
        console.log(`\n👤 Processing: ${prospectData.first_name} ${prospectData.last_name}`);

        // ... more code ...

        // Line 129
          .select(`status, campaign_id, campaigns(name)`)

        // Line 136
          const otherCampaignName = (existingInOtherCampaign as any).campaigns?.name || 'another campaign';
```

### Change 5: Fix All contacted_at References to invitation_sent_at

**Search and Replace in this file:**
- Search: `contacted_at:`
- Replace: `invitation_sent_at:`

**Lines affected:**
- Line 320: `contacted_at: new Date().toISOString(),`

**BEFORE:**
```typescript
            await supabase
            .from('campaign_prospects')
            .update({
              status: 'connection_request_sent',
              contacted_at: new Date().toISOString(),
              notes: 'Connection request sent via Unipile REST API',
              updated_at: new Date().toISOString()
            })
```

**AFTER:**
```typescript
            await supabase
            .from('campaign_prospects')
            .update({
              status: 'invitation_sent',
              invitation_sent_at: new Date().toISOString(),
              notes: 'Connection request sent via Unipile REST API',
              updated_at: new Date().toISOString()
            })
```

### Change 6: Fix Status Value References

**Search and Replace throughout file:**
- `connection_request_sent` → `invitation_sent`
- `failed` → `error`

**Lines affected:**
- Line 96, 164, 226, 254, 276

**Example (line 226):**
**BEFORE:**
```typescript
              status: 'connected',
```
**AFTER:**
```typescript
              status: 'connected',  // Keep as is - this is correct
```

**Example (line 254):**
**BEFORE:**
```typescript
              status: 'failed',
```
**AFTER:**
```typescript
              status: 'error',
```

---

## Step 3: Fix process-follow-ups Route

**File:** `/app/api/campaigns/direct/process-follow-ups/route.ts`

### Change 1: Fix Prospects Query with Nested Campaign & Account (lines 62-81)

**BEFORE:**
```typescript
    // 1. Find prospects due for follow-up
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
      .eq('status', 'connection_request_sent')
      .not('follow_up_due_at', 'is', null)
      .lte('follow_up_due_at', new Date().toISOString())
      .order('follow_up_due_at', { ascending: true })
      .limit(50); // Process 50 at a time
```

**AFTER:**
```typescript
    // 1. Find prospects due for follow-up
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
      .eq('status', 'invitation_sent')
      .not('follow_up_due_at', 'is', null)
      .lte('follow_up_due_at', new Date().toISOString())
      .order('follow_up_due_at', { ascending: true })
      .limit(50); // Process 50 at a time
```

**What changed:**
- Added `workspace_prospects` join to get prospect data
- Changed `campaign_name` → `name`
- Changed `connection_request_sent` → `invitation_sent`

### Change 2: Fix Prospect Data Access (line 103-108)

**BEFORE:**
```typescript
        console.log(`\n👤 Processing: ${prospect.first_name} ${prospect.last_name}`);
        console.log(`📍 Follow-up index: ${prospect.follow_up_sequence_index}`);

        const campaign = prospect.campaigns as any;
        const linkedinAccount = campaign.workspace_accounts as any;
        const unipileAccountId = linkedinAccount.unipile_account_id;
```

**AFTER:**
```typescript
        const prospectData = prospect.workspace_prospects as any;
        console.log(`\n👤 Processing: ${prospectData.first_name} ${prospectData.last_name}`);
        console.log(`📍 Follow-up index: ${prospect.follow_up_sequence_index}`);

        const campaign = prospect.campaigns as any;
        const linkedinAccount = campaign.workspace_accounts as any;
        const unipileAccountId = linkedinAccount.unipile_account_id;
```

### Change 3: Update Status Values in Updates (lines 159, 277)

**BEFORE (line 159):**
```typescript
              status: 'messaging',
```

**AFTER:**
```typescript
              status: 'message_sent',
```

---

## Step 4: Fix execute-via-n8n Route

**File:** `/app/api/campaigns/linkedin/execute-via-n8n/route.ts`

### Change: Fix Campaign Query (around line 71)

**Find the select with `workspace_accounts!linkedin_account_id` and update:**

**BEFORE:**
```typescript
        linkedin_account:workspace_accounts!linkedin_account_id (
          id,
          account_name,
          unipile_account_id,
          is_active
        )
```

**AFTER:**
Keep as-is once Step 1 (adding `linkedin_account_id` to campaigns) is complete. This query will work after the migration.

---

## Step 5: Fix execute-inngest Route

**File:** `/app/api/campaigns/linkedin/execute-inngest/route.ts`

Same fix as Step 4 - the query will work once the migration is applied.

---

## Step 6: Update RLS Policy

**File:** Create new migration or apply directly

**Create:** `/supabase/migrations/20251122_fix_campaign_prospects_rls.sql`

```sql
-- Fix RLS policy for campaign_prospects to use Supabase Auth instead of Clerk

-- Drop old policy that references removed clerk_id
DROP POLICY IF EXISTS "Users can access workspace campaign prospects" ON campaign_prospects;

-- Create new policy using Supabase Auth
CREATE POLICY "campaign_prospects_select" ON campaign_prospects
  FOR SELECT USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "campaign_prospects_insert" ON campaign_prospects
  FOR INSERT WITH CHECK (
    campaign_id IN (
      SELECT id FROM campaigns WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "campaign_prospects_update" ON campaign_prospects
  FOR UPDATE USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "campaign_prospects_delete" ON campaign_prospects
  FOR DELETE USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      )
    )
  );
```

---

## Step 7: Quick Verification Checklist

After applying all changes, verify:

```bash
# 1. Check migration applied
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'campaigns' AND column_name = 'linkedin_account_id';
# Should return: linkedin_account_id | uuid

# 2. Test campaign query
SELECT id, name, message_templates, linkedin_account_id
FROM campaigns
WHERE id = 'your-test-campaign-id'
LIMIT 1;

# 3. Test prospect query
SELECT cp.*, wp.first_name, wp.last_name, wp.linkedin_url
FROM campaign_prospects cp
LEFT JOIN workspace_prospects wp ON cp.prospect_id = wp.id
WHERE cp.campaign_id = 'your-test-campaign-id'
LIMIT 1;

# 4. Verify status values are correct
SELECT DISTINCT status FROM campaign_prospects;
# Should show: pending, invitation_sent, connected, message_sent, replied, etc.
# Should NOT show: approved, failed, connection_request_sent, messaging
```

---

## Step 8: Testing the Fixed Routes

### Test send-connection-requests

```bash
curl -X POST http://localhost:3000/api/campaigns/direct/send-connection-requests \
  -H "Content-Type: application/json" \
  -d '{"campaignId": "your-test-campaign-id"}'
```

**Expected Response:**
```json
{
  "success": true,
  "campaignName": "Test Campaign",
  "processed": 5,
  "results": [...]
}
```

**Should NOT return:**
- "Campaign not found" error (this was happening due to `campaign_name` issue)
- "No LinkedIn account configured" without trying (this was happening due to broken join)

### Test process-follow-ups

```bash
curl -X POST http://localhost:3000/api/campaigns/direct/process-follow-ups \
  -H "x-cron-secret: your-cron-secret" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "processed": 3,
  "results": [...]
}
```

---

## Step 9: Verify in Database

Check actual data after running routes:

```sql
-- Check campaign was updated correctly
SELECT
  id,
  name,
  linkedin_account_id,
  status,
  updated_at
FROM campaigns
WHERE id = 'your-test-campaign-id';

-- Check prospects have correct status
SELECT
  id,
  campaign_id,
  status,
  invitation_sent_at,
  follow_up_due_at,
  follow_up_sequence_index
FROM campaign_prospects
WHERE campaign_id = 'your-test-campaign-id'
ORDER BY updated_at DESC
LIMIT 10;

-- Verify prospect data is accessible via join
SELECT
  cp.id,
  cp.status,
  wp.first_name,
  wp.last_name,
  wp.linkedin_url
FROM campaign_prospects cp
JOIN workspace_prospects wp ON cp.prospect_id = wp.id
WHERE cp.campaign_id = 'your-test-campaign-id'
LIMIT 10;
```

---

## Summary of All Changes

| File | Changes | Impact |
|------|---------|--------|
| Migration (new) | Add `linkedin_account_id` to campaigns | Enables join in 4 files |
| send-connection-requests | 6 changes: column names, joins, status values | Critical fix |
| process-follow-ups | 3 changes: query structure, status values | Critical fix |
| execute-via-n8n | 0 changes needed (works after migration) | Enabled by schema |
| execute-inngest | 0 changes needed (works after migration) | Enabled by schema |
| RLS Policy | Update to use Supabase Auth | Security/Access fix |

**Total files modified:** 3 (+ 1 migration + 1 RLS fix)

**Total lines changed:** ~50

**Estimated time:** 1-2 hours (most of which is careful verification)

---

## Rollback Plan

If issues occur:

```bash
# 1. Revert campaign queries to use name AS campaign_name alias
# 2. Revert status values back to original (but understand they'll fail)
# 3. Drop the new linkedin_account_id column:
ALTER TABLE campaigns DROP COLUMN linkedin_account_id;
DROP INDEX idx_campaigns_linkedin_account_id;
```

However, the real fix is needed - the current queries don't match the schema.
