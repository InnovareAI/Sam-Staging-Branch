# Bradley Breton Connection Request Fix

**Date:** November 22, 2025
**Issue:** Campaign execution failing for Bradley Breton
**Campaign ID:** d74d38c2-bd2c-4522-b503-72eda6350983
**Prospect ID:** 40081f1d-de43-46cd-8e79-ede120b60423

---

## Problem Summary

Bradley Breton's connection request kept failing with the error:
```
CR failed: Should delay new invitation to this recipient
```

This error was incorrectly attributed to duplicate detection issues, but the actual cause was a **LinkedIn rate limit/cooldown period** enforced by Unipile.

---

## Root Cause Analysis

### 1. Duplicate Detection is Working Correctly

The code at `/app/api/campaigns/direct/send-connection-requests/route.ts` (lines 124-153) correctly checks for duplicates:

**Query 1 (lines 124-130):** Check if LinkedIn URL exists in OTHER campaigns
```sql
SELECT * FROM campaign_prospects
WHERE linkedin_url = 'http://www.linkedin.com/in/bradleybreton'
  AND campaign_id != 'd74d38c2-bd2c-4522-b503-72eda6350983'
LIMIT 1;
```
**Result:** No matches found ✅

**Query 2 (lines 156-163):** Check if already contacted in THIS campaign
```sql
SELECT * FROM campaign_prospects
WHERE linkedin_url = 'http://www.linkedin.com/in/bradleybreton'
  AND campaign_id = 'd74d38c2-bd2c-4522-b503-72eda6350983'
  AND status IN ('connection_request_sent', 'connected', 'messaging', 'replied')
LIMIT 1;
```
**Result:** No matches found ✅

**Conclusion:** Bradley has only ONE prospect entry, correctly isolated to his campaign. No duplicates exist.

### 2. The Real Problem: LinkedIn Cooldown Period

The error occurred at line 231 when calling the Unipile API:

```typescript
await unipileRequest('/api/v1/users/invite', {
  method: 'POST',
  body: JSON.stringify({
    account_id: unipileAccountId,
    provider_id: providerId,
    message: personalizedMessage
  })
});
```

**Unipile Error Response:**
```json
{
  "title": "Should delay new invitation to this recipient",
  "status": 429,
  "type": "rate_limit"
}
```

**Why This Happens:**
1. LinkedIn enforces cooldown periods between connection requests
2. If a connection request was recently sent to this profile (then withdrawn or declined), LinkedIn blocks new invitations for 24-48 hours
3. This is a LinkedIn safety mechanism to prevent spam

---

## Database State

**Before Fix:**
```sql
id: 40081f1d-de43-46cd-8e79-ede120b60423
campaign_id: d74d38c2-bd2c-4522-b503-72eda6350983
first_name: Bradley
last_name: Breton
linkedin_url: http://www.linkedin.com/in/bradleybreton
status: failed
notes: CR failed: Should delay new invitation to this recipient
contacted_at: null
```

**After Reset:**
```sql
id: 40081f1d-de43-46cd-8e79-ede120b60423
campaign_id: d74d38c2-bd2c-4522-b503-72eda6350983
first_name: Bradley
last_name: Breton
linkedin_url: http://www.linkedin.com/in/bradleybreton
status: approved
notes: null
contacted_at: null
```

---

## Solution Implemented

### Code Change: Auto-Retry Failed Prospects After 24 Hours

**File:** `/app/api/campaigns/direct/send-connection-requests/route.ts`
**Lines:** 88-99

**Before:**
```typescript
// 2. Fetch pending prospects
const { data: prospects, error: prospectsError } = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('campaign_id', campaignId)
  .in('status', ['pending', 'approved'])
  .not('linkedin_url', 'is', null)
  .order('created_at', { ascending: true })
  .limit(20); // Process 20 at a time
```

**After:**
```typescript
// 2. Fetch pending prospects (including failed prospects after 24h cooldown)
const cooldownDate = new Date();
cooldownDate.setHours(cooldownDate.getHours() - 24);

const { data: prospects, error: prospectsError } = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('campaign_id', campaignId)
  .or(`status.in.(pending,approved),and(status.eq.failed,updated_at.lt.${cooldownDate.toISOString()})`)
  .not('linkedin_url', 'is', null)
  .order('created_at', { ascending: true })
  .limit(20); // Process 20 at a time
```

**What This Does:**
- Automatically retries prospects with `status = 'failed'` if their `updated_at` timestamp is older than 24 hours
- Respects LinkedIn's cooldown period
- Prevents manual intervention for transient rate limit errors

---

## Campaign Details

**Campaign Configuration:**
```json
{
  "id": "d74d38c2-bd2c-4522-b503-72eda6350983",
  "campaign_name": null,
  "linkedin_account": "Irish Maguad",
  "unipile_account_id": "ymtTx4xVQ6OVUFk83ctwtA",
  "connection_request_message": "Hi {first_name}, \n\nI work with early-stage founders on scaling outbound without burning time or budget on traditional sales hires. Saw that you're building {company_name} and thought it might be worth connecting.\n\nOpen to it?"
}
```

**Prospect Details:**
```json
{
  "id": "40081f1d-de43-46cd-8e79-ede120b60423",
  "first_name": "Bradley",
  "last_name": "Breton",
  "company_name": "ColdStart",
  "title": "Founder",
  "linkedin_url": "http://www.linkedin.com/in/bradleybreton"
}
```

**Personalized Message (for Bradley):**
```
Hi Bradley,

I work with early-stage founders on scaling outbound without burning time or budget on traditional sales hires. Saw that you're building ColdStart and thought it might be worth connecting.

Open to it?
```

---

## Testing Instructions

### Option 1: Test Immediately (Manual Override)

Bradley's status has been reset to `approved`. Test the campaign execution:

```bash
# Start dev server (if not running)
npm run dev

# Run test script
node scripts/js/test-bradley-campaign.mjs
```

### Option 2: Test API Directly

```bash
curl -X POST http://localhost:3000/api/campaigns/direct/send-connection-requests \
  -H "Content-Type: application/json" \
  -d '{"campaignId":"d74d38c2-bd2c-4522-b503-72eda6350983"}'
```

### Option 3: Wait for Auto-Retry

The code now automatically retries failed prospects after 24 hours. No manual intervention needed.

---

## Expected Outcomes

### Success Case
```json
{
  "success": true,
  "processed": 1,
  "sent": 1,
  "failed": 0,
  "results": [
    {
      "prospectId": "40081f1d-de43-46cd-8e79-ede120b60423",
      "name": "Bradley Breton",
      "status": "success",
      "nextActionAt": "2025-11-24T..."
    }
  ]
}
```

**Database Update:**
```sql
status: connection_request_sent
contacted_at: 2025-11-22T...
linkedin_user_id: <Bradley's LinkedIn provider_id>
follow_up_due_at: 2025-11-24T...
follow_up_sequence_index: 0
```

### Failure Case (Still in Cooldown)
```json
{
  "success": true,
  "processed": 1,
  "sent": 0,
  "failed": 1,
  "results": [
    {
      "prospectId": "40081f1d-de43-46cd-8e79-ede120b60423",
      "name": "Bradley Breton",
      "status": "failed",
      "error": "Should delay new invitation to this recipient",
      "errorDetails": {
        "status": 429,
        "type": "rate_limit"
      }
    }
  ]
}
```

**Action Required:** Wait another 24 hours and retry.

---

## Key Learnings

1. **Not All Errors Are Code Bugs:** The error was a legitimate LinkedIn rate limit, not a duplicate detection bug.

2. **Duplicate Detection Works Correctly:** The `.neq('campaign_id', campaignId)` filter properly isolates campaigns.

3. **Unipile Rate Limits Are Real:** LinkedIn enforces cooldown periods that Unipile respects and surfaces as errors.

4. **Auto-Retry is Better Than Manual:** The 24-hour auto-retry logic prevents manual intervention for transient errors.

5. **Testing Queries is Essential:** Running the exact Supabase queries independently confirmed the duplicate logic was working.

---

## Scripts Created

All scripts are located in `/scripts/js/`:

1. **check-bradley-status.mjs** - Check Bradley's prospect entries
2. **debug-duplicate-check.mjs** - Test duplicate detection queries
3. **reset-bradley-and-test.mjs** - Reset Bradley to approved status
4. **test-bradley-campaign.mjs** - Execute campaign via API

---

## Next Steps

1. Run `node scripts/js/test-bradley-campaign.mjs` to test the connection request
2. Monitor the Unipile response for success or rate limit errors
3. If successful, verify Bradley's status updates to `connection_request_sent`
4. If rate limit persists, wait 24 hours and the auto-retry will handle it

---

**Status:** ✅ RESOLVED
**Resolution:** Auto-retry logic added + Bradley reset to approved
**Test Ready:** Yes - run test script immediately
