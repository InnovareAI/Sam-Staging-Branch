# CRITICAL BUGS HANDOVER - November 25, 2025

## Summary

Two critical bugs discovered preventing campaigns from executing properly:

1. **Queue Trigger Bug** - Campaigns activate but queue never populates
2. **CSV Upload Rejection** - 50% of prospects silently rejected

Both issues cause campaigns to appear "active" but never send any messages.

---

## BUG 1: Campaign Activation Does NOT Populate Queue (CRITICAL)

### Symptom
- User toggles campaign from paused → active
- Campaign status shows "active" in UI
- **But send_queue table remains empty**
- No connection requests ever send

### Root Cause
The frontend mutation in `CampaignHub.tsx` is supposed to:
1. Call `/api/campaigns/sync-linkedin-ids` to resolve LinkedIn URLs to provider IDs
2. Call `/api/campaigns/direct/send-connection-requests-fast` to populate the queue

**The second call is either failing silently or not being reached.**

### Evidence
```sql
-- Michelle's campaign after activation
SELECT status FROM campaigns WHERE id = '19c4fee5-a51e-46b9-8a55-bd72c83f8611';
-- Returns: 'active'

SELECT COUNT(*) FROM send_queue WHERE campaign_id = '19c4fee5-a51e-46b9-8a55-bd72c83f8611';
-- Returns: 0  (should be 25)
```

### Location in Code
**File:** `app/components/CampaignHub.tsx`
**Lines:** 145-214 (toggleStatusMutation)

```typescript
// Line 185-192 - This code is NOT executing or failing silently
const launchResponse = await fetch('/api/campaigns/direct/send-connection-requests-fast', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    campaignId
  })
});
```

### Workaround Applied (Temporary)
Manually populated queue via SQL:
```sql
-- See full query in session notes
INSERT INTO send_queue (campaign_id, prospect_id, linkedin_user_id, message, scheduled_for, status)
SELECT ... FROM campaign_prospects WHERE status = 'pending';
```

### Fix Required
1. Add console.log statements to trace the mutation flow
2. Check if `workspaceId` is null when mutation fires
3. Add error boundary/toast for failed queue creation
4. Consider: Should queue creation happen server-side when status changes to 'active'?

### Affected Users Today
- Michelle: 25 prospects manually queued
- Charissa: 77 prospects manually queued
- Irish: 6 prospects manually queued

---

## BUG 2: CSV Upload Silently Rejects 50% of Prospects

### Symptom
- User uploads CSV with 50 prospects
- Only 25 appear in campaign
- **No clear error message explaining what was rejected**

### Root Cause
The upload endpoint at `/api/prospect-approval/upload-csv/route.ts` rejects rows for:
1. **Incomplete rows** - Fewer CSV values than header columns
2. **No name** - Missing first_name/last_name/name field
3. **Sales Navigator URLs** - `/sales/lead/` or `/sales/account/` URLs

### Evidence
```sql
-- Approval session shows 50 uploaded but only partial approved
SELECT total_prospects, approved_count, pending_count
FROM prospect_approval_sessions
WHERE id = 'a738c512-8734-4128-846a-a60383790a98';
-- Returns: 50, 18, 32
```

### Location in Code
**File:** `app/api/prospect-approval/upload-csv/route.ts`

**Rejection points:**
- Line 216-219: Incomplete row check
- Line 243-246: No name check
- Line 277-287: Sales Navigator URL check

### Problem
The `skippedRows` array is logged to console but **never returned to the user**:
```typescript
// Line 306-312 - Only logs, doesn't return to user
console.log('CSV Parsing - Results:', {
  totalRows: lines.length - 1,
  prospectsFound: prospects.length,
  rowsSkipped: skippedRows.length,
  salesNavUrlsDetected: salesNavUrlsDetected,
  firstFewSkipped: skippedRows.slice(0, 3)
});
```

### Fix Required
1. Return `skippedRows` in the API response
2. Display rejection reasons in UI after upload
3. Add specific error messages:
   - "Row X skipped: Sales Navigator URL - please use regular LinkedIn URL"
   - "Row X skipped: Missing name"
   - "Row X skipped: Incomplete data"

### Sales Navigator URL Problem
Sales Navigator URLs like:
```
https://www.linkedin.com/sales/lead/ACwAAFvDKocBkeHV8FCRfQlmLM8S5b9feZ7Kh4E,NAME,abc
```
Cannot be converted to regular LinkedIn URLs. Users must:
1. Open prospect in Sales Navigator
2. Click "View profile on LinkedIn" button
3. Copy the actual profile URL

---

## BUG 3: sync-linkedin-ids Only Works for Existing Contacts (Design Flaw)

### Symptom
New prospects never get their `linkedin_user_id` populated

### Root Cause
The `/api/campaigns/sync-linkedin-ids` endpoint:
1. Fetches recent LinkedIn **messages** from Unipile
2. Tries to match prospects by URL/name from message history

**This only works for people you've already messaged!**

For new prospects (the main use case), it can never find a match because there's no message history.

### Location in Code
**File:** `app/api/campaigns/sync-linkedin-ids/route.ts`

```typescript
// Line 104-125 - Fetches messages, not profiles
const messagesResponse = await mcpRegistry.callTool({
  method: 'tools/call',
  params: {
    name: 'unipile_get_recent_messages',  // WRONG - should be profile lookup
    arguments: {
      account_id: linkedinAccountId,
      limit: 100
    }
  }
});
```

### Current Workaround
The `send-connection-requests-fast` endpoint stores LinkedIn URL instead of provider ID:
```typescript
// Line 121 - Falls back to URL
linkedin_user_id: prospect.linkedin_user_id || prospect.linkedin_url,
```

This works because Unipile's invite endpoint can accept URLs and resolve them internally.

### Proper Fix Required
Replace message-based lookup with Unipile profile lookup:
```typescript
// Use Unipile's profile lookup API
const profile = await unipileRequest(`/api/v1/users/${vanity}?account_id=${accountId}`);
const providerId = profile.provider_id;
```

---

## Database State After Manual Fixes

### Send Queue Summary (Nov 25, 2025 13:10 UTC)
```sql
SELECT
  CASE
    WHEN campaign_id IN (SELECT id FROM campaigns c JOIN workspace_accounts wa ON wa.workspace_id = c.workspace_id WHERE wa.account_name LIKE '%Michelle%') THEN 'Michelle'
    WHEN campaign_id IN (SELECT id FROM campaigns c JOIN workspace_accounts wa ON wa.workspace_id = c.workspace_id WHERE wa.account_name LIKE '%Charissa%') THEN 'Charissa'
    WHEN campaign_id IN (SELECT id FROM campaigns c JOIN workspace_accounts wa ON wa.workspace_id = c.workspace_id WHERE wa.account_name LIKE '%Irish%') THEN 'Irish'
  END as account,
  COUNT(*) as queued,
  MIN(scheduled_for) as first_send,
  MAX(scheduled_for) as last_send
FROM send_queue
WHERE status = 'pending'
GROUP BY 1;
```

| Account | Queued | First Send | Last Send |
|---------|--------|------------|-----------|
| Michelle | 25 | 13:33 UTC | Nov 26 01:33 |
| Charissa | 77 | 13:36 UTC | Nov 27 03:36 |
| Irish | 6 | 13:37 UTC | 16:07 UTC |

**Total: 108 messages queued**

---

## Priority Fix Order

### P0 - Must Fix This Week
1. **Add queue creation feedback to UI** - Users need to know if queue failed
2. **Return skipped rows in CSV upload response** - Users need to know what was rejected

### P1 - Fix Next Week
3. **Investigate why queue creation endpoint not called** - Check browser console logs
4. **Add server-side queue trigger** - When campaign status changes to 'active' in DB

### P2 - Technical Debt
5. **Replace message-based ID sync with profile lookup** - Current approach is fundamentally wrong
6. **Add Sales Navigator URL converter** - Or clear documentation on how to get real URLs

---

## How to Manually Populate Queue (Emergency)

If users report campaigns not sending:

```sql
-- 1. Find the campaign ID
SELECT id, campaign_name, status FROM campaigns WHERE campaign_name LIKE '%search term%';

-- 2. Check if queue is empty
SELECT COUNT(*) FROM send_queue WHERE campaign_id = 'CAMPAIGN_ID' AND status = 'pending';

-- 3. If empty, populate manually
WITH pending_prospects AS (
  SELECT
    id as prospect_id,
    first_name,
    COALESCE(company_name, 'your company') as company_name,
    linkedin_url,
    ROW_NUMBER() OVER (ORDER BY created_at) as row_num
  FROM campaign_prospects
  WHERE campaign_id = 'CAMPAIGN_ID'
    AND status = 'pending'
    AND linkedin_url IS NOT NULL
)
INSERT INTO send_queue (campaign_id, prospect_id, linkedin_user_id, message, scheduled_for, status, message_type)
SELECT
  'CAMPAIGN_ID'::uuid,
  prospect_id,
  linkedin_url,
  format(E'Hi %s,\n\nYOUR MESSAGE TEMPLATE HERE with %s.\n\nOpen to it?', first_name, company_name),
  NOW() + (row_num * interval '30 minutes'),
  'pending',
  'connection_request'
FROM pending_prospects;
```

---

## Files to Review

| File | Issue |
|------|-------|
| `app/components/CampaignHub.tsx:145-214` | Queue trigger not firing |
| `app/api/prospect-approval/upload-csv/route.ts:306-312` | Skipped rows not returned |
| `app/api/campaigns/sync-linkedin-ids/route.ts` | Wrong approach (messages vs profiles) |
| `app/api/campaigns/direct/send-connection-requests-fast/route.ts:121` | URL fallback workaround |

---

## Session Notes

**Date:** November 25, 2025
**Time:** 12:00 - 14:00 UTC
**Users Affected:** Michelle, Charissa, Irish
**Resolution:** Manual queue population via SQL
**Follow-up Required:** Code fixes for all 3 bugs

---

*Last Updated: November 25, 2025 13:10 UTC*
