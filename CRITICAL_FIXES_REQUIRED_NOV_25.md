# CRITICAL FIXES REQUIRED - IMMEDIATE ACTION
**Date:** November 25, 2025
**Status:** 🚨 PRODUCTION ISSUES CAUSING CAMPAIGN FAILURES

---

## TL;DR - Fix These NOW

Users report campaigns getting STUCK and NOT sending. Root causes identified:

1. **Daily cap logic is BROKEN** - Not counting sent CRs correctly
2. **Direct send endpoint DISABLED** - Frontend may be calling 503 endpoint

---

## 🚨 CRITICAL ISSUE #1: Daily Cap Logic is Broken

### Location
`/app/api/cron/process-send-queue/route.ts` - Lines 207-240

### Problem
The code counts number of campaigns instead of number of messages sent:

```typescript
// ❌ CURRENT (WRONG)
sentTodayCount = campaignsForAccount?.length || 0;
// This counts unique campaigns (1-5) instead of messages sent (1-20)
```

### Impact
- Daily cap check is ineffective
- Could send MORE than 20 CRs per day per account
- LinkedIn may throttle or restrict account
- Campaigns would appear "stuck" after account restricted

### Fix Required
```typescript
// ✅ CORRECT
sentTodayCount = sentTodayForAccount.filter(item =>
  campaignsForAccount?.some(c => c.id === item.campaign_id)
).length;
```

### Testing After Fix
```sql
-- Run this query after deploying fix
SELECT
  DATE(sent_at) as send_date,
  COUNT(*) as crs_sent
FROM send_queue
WHERE status = 'sent'
  AND campaign_id IN (
    SELECT id FROM campaigns WHERE linkedin_account_id = '{account_id}'
  )
GROUP BY DATE(sent_at)
ORDER BY send_date DESC
LIMIT 7;

-- Expected: Should never exceed 20 per day
```

---

## 🚨 CRITICAL ISSUE #2: Users May Be Calling Disabled Endpoint

### Location
`/app/api/campaigns/direct/send-connection-requests/route.ts`

### Problem
This endpoint returns HTTP 503:

```typescript
export async function POST(req: NextRequest) {
  return NextResponse.json({
    error: 'DISABLED',
    message: 'This endpoint is disabled to prevent direct sends. Use /api/campaigns/direct/send-connection-requests-queued instead.'
  }, { status: 503 });
```

### Impact
- Any frontend code calling this endpoint will fail
- Users will see "Internal server error" or campaigns not starting
- No CRs sent at all

### Fix Required

**Step 1:** Search frontend for references:
```bash
grep -r "send-connection-requests" app/ components/ lib/
grep -r "/campaigns/direct/send-connection" app/ components/ lib/
```

**Step 2:** Replace all instances with queue endpoint:
```typescript
// ❌ OLD (will fail with 503)
POST /api/campaigns/direct/send-connection-requests

// ✅ NEW (correct)
POST /api/campaigns/direct/send-connection-requests-queued
```

**Step 3:** Search for any documentation references:
```bash
grep -r "send-connection-requests\"" docs/ *.md
```

### Testing After Fix
1. Create a test campaign with 3 prospects
2. Click "Send Campaign" button
3. Check browser console - should see POST to `-queued` endpoint
4. Check `send_queue` table - should see 3 pending records
5. Wait 1 minute
6. Check Netlify logs - should see cron processing queue
7. Check `send_queue` - first record should be status='sent'

---

## ⚠️ WARNING: Follow-Up Chat Lookup Delays

### Location
`/app/api/campaigns/direct/process-follow-ups/route.ts` - Lines 186-218

### Problem
If LinkedIn takes longer than 2 hours to create a chat after connection acceptance, follow-ups keep getting delayed:

```typescript
if (!chat) {
  // Pushes back by 2 hours to allow chat creation
  const newDueAt = new Date();
  newDueAt.setHours(newDueAt.getHours() + 2);
  // ...
}
```

### Impact
- Follow-ups may never send if chat never appears
- Campaign appears "stuck" on follow-up stage
- User confusion

### Recommended Fix
Implement exponential backoff:
```typescript
// Get retry count from prospect record
const retryCount = prospect.follow_up_retry_count || 0;

// Exponential backoff: 2h → 4h → 8h → 24h
const delayHours = Math.pow(2, retryCount + 1); // 2, 4, 8, 16
const maxDelay = 24; // Cap at 24 hours
const actualDelay = Math.min(delayHours, maxDelay);

const newDueAt = new Date();
newDueAt.setHours(newDueAt.getHours() + actualDelay);

await supabase
  .from('campaign_prospects')
  .update({
    follow_up_due_at: newDueAt.toISOString(),
    follow_up_retry_count: retryCount + 1, // Track retries
    updated_at: new Date().toISOString()
  })
  .eq('id', prospect.id);
```

---

## 📋 IMMEDIATE INVESTIGATION CHECKLIST

Run these commands to diagnose current campaign issues:

### 1. Check Cron Job Execution
```bash
# See if cron jobs are running
netlify logs --function process-send-queue --tail
netlify logs --function send-follow-ups --tail
```

### 2. Check Queue Status
```sql
-- See queued messages
SELECT
  status,
  COUNT(*) as count,
  MIN(scheduled_for) as next_send,
  MAX(scheduled_for) as last_send
FROM send_queue
WHERE campaign_id = '{campaign_id}'
GROUP BY status;
```

### 3. Check for Daily Cap Hits
```sql
-- See if daily cap logic is being hit
SELECT
  DATE(created_at) as queue_date,
  COUNT(*) as messages_queued,
  SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as messages_sent
FROM send_queue
WHERE campaign_id IN (
  SELECT id FROM campaigns WHERE linkedin_account_id = '{account_id}'
)
GROUP BY DATE(created_at)
ORDER BY queue_date DESC
LIMIT 7;
```

### 4. Check for 503 Errors
```bash
# Search Netlify logs for disabled endpoint errors
netlify logs | grep "DISABLED"
netlify logs | grep "503"
```

### 5. Verify Unipile API Key
```bash
# Test current API key
curl -X GET "https://api6.unipile.com:13670/api/v1/accounts" \
  -H "X-API-KEY: 39qOAzhn.7ks6QfCYBMSYSEx4op78j57lD5ZItVooPcsN1Fu1EbE=" \
  -H "Accept: application/json"

# Should return list of accounts, NOT 401 error
```

### 6. Check Frontend Endpoint Usage
```bash
# Find all campaign execution calls
cd /home/user/Sam-New-Sep-7
grep -r "campaigns/direct/send" app/ components/ --include="*.tsx" --include="*.ts"
grep -r "executeCampaign" app/ components/ --include="*.tsx" --include="*.ts"
grep -r "sendConnectionRequests" app/ components/ --include="*.tsx" --include="*.ts"
```

---

## 🎯 PRIORITY ORDER

### Priority 1 (DO NOW - 30 minutes)
1. ✅ Fix daily cap logic in `/app/api/cron/process-send-queue/route.ts`
2. ✅ Search frontend for disabled endpoint usage
3. ✅ Deploy fixes to production

### Priority 2 (DO TODAY - 2 hours)
1. Run investigation checklist above
2. Review Netlify logs for errors
3. Test campaign execution end-to-end
4. Monitor send_queue processing for 1 hour

### Priority 3 (DO THIS WEEK - 4 hours)
1. Implement exponential backoff for chat lookup
2. Add user-facing feedback for queue status
3. Add monitoring/alerting for rate limits
4. Add Unipile API call logging

---

## 🔍 HOW TO TEST FIXES

### Test 1: Daily Cap Fix
1. Create test campaign with 25 prospects
2. Queue all 25 for sending
3. Wait for cron to process
4. After 20 CRs sent, next cron run should skip with "Daily limit reached"
5. Check logs: Should see "🛑 Daily limit reached for this LinkedIn account"

### Test 2: Queue Endpoint Fix
1. Open browser DevTools → Network tab
2. Create new campaign with 1 prospect
3. Click "Send Campaign" button
4. Verify Network tab shows POST to `/api/campaigns/direct/send-connection-requests-queued`
5. Response should be 200 OK with `{success: true, queued: 1, ...}`
6. Check `send_queue` table - should have 1 pending record

### Test 3: End-to-End Campaign
1. Create campaign: 3 prospects, CR message + 1 follow-up
2. Queue for sending
3. Wait 3 minutes
4. Check `send_queue` - 1st prospect should be sent
5. Wait for connection acceptance (manual: accept on LinkedIn)
6. Wait 1-2 hours
7. Check `send_queue` - follow-up should be scheduled
8. Verify follow-up sends after due time

---

## 📊 SUCCESS METRICS

After deploying fixes, monitor these metrics:

### Daily Cap Enforcement
- ✅ Max 20 CRs per account per day
- ✅ Logs show "Daily limit reached" when appropriate
- ✅ No accounts sending >20 CRs/day

### Campaign Queue Processing
- ✅ Cron runs every 1 minute (check Netlify scheduled functions)
- ✅ 1 CR sent per minute
- ✅ Queue status updates correctly (pending → sent)
- ✅ No 503 errors in logs

### User Experience
- ✅ Campaigns start sending within 1 minute of creation
- ✅ Queue status visible to users
- ✅ No "stuck campaign" reports
- ✅ Follow-ups send within expected timeframe

---

## 🆘 IF ISSUES PERSIST AFTER FIXES

### Scenario 1: Daily cap still allows >20 CRs
**Check:** Query `send_queue` for actual count
**Verify:** Daily cap logic fix was deployed
**Test:** Manually trigger cron with 21 queued CRs

### Scenario 2: Still getting 503 errors
**Check:** Browser DevTools → Network tab
**Verify:** Frontend code updated
**Test:** Clear browser cache and retry

### Scenario 3: Follow-ups still not sending
**Check:** `campaign_prospects` table - `follow_up_due_at` field
**Verify:** Cron job `send-follow-ups` is running
**Test:** Set `follow_up_due_at` to NOW for test prospect

### Scenario 4: Queue not processing
**Check:** Netlify scheduled functions dashboard
**Verify:** `process-send-queue` cron is enabled
**Test:** Manually trigger function via Netlify dashboard

---

## 📞 ESCALATION

If fixes don't resolve issues within 24 hours:

1. **Check Unipile status page** - https://status.unipile.com
2. **Review Unipile API logs** - Check for 429 (rate limit) or 5xx errors
3. **Contact Unipile support** - support@unipile.com with:
   - Account ID: `ymtTx4xVQ6OVUFk83ctwtA`
   - Timestamp of failed requests
   - Full error messages from logs
4. **Review LinkedIn account status** - May be restricted if limits exceeded

---

## 📝 DOCUMENTATION TO UPDATE

After deploying fixes:

1. Update `CLAUDE.md` - Add note about daily cap fix
2. Update `README.md` - Campaign execution section
3. Update any API documentation referencing direct send endpoint
4. Create runbook for "Campaign Troubleshooting"

---

**Created:** November 25, 2025
**Next Review:** After fixes deployed
**Full Audit:** See `UNIPILE_API_COMPREHENSIVE_AUDIT_NOV_25_2025.md`
