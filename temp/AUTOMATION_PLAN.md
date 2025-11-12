# SAM Campaign Automation System

## Problems to Automate

1. **Unipile Rate Limits** - Manual detection and pausing
2. **Failed Prospects** - Stuck in queued_in_n8n, need manual reset
3. **Campaign Resume** - Manual restart after rate limits clear
4. **N8N Error Handling** - No retry logic for failures
5. **Missing Unipile Accounts** - Campaigns fail silently
6. **Long Wait Times** - 13-hour delays instead of minutes

## Automated Solutions

### 1. N8N Workflow Error Handling
**File:** Update workflow with error nodes

**Changes:**
- Add "Continue on Fail" to all HTTP request nodes
- Add "Error Check" node after each API call
- Route errors to "Handle Error" function node
- Update prospect status based on error type:
  - Rate limit → `rate_limited` (retry in 30 min)
  - Account not found → `account_error` (pause campaign)
  - Invalid URL → `invalid_data` (skip prospect)
  - Temporary error → `queued_for_retry` (retry in 5 min)

### 2. Automated Recovery Service
**File:** `scripts/node/auto-recovery-service.mjs`

**Runs every 5 minutes via cron:**
```javascript
// Check for rate-limited prospects
// If rate limit cleared (30+ min passed):
//   - Reset prospects to pending
//   - Resume campaigns
// 
// Check for stale queued prospects (stuck > 1 hour)
//   - Reset to pending
//
// Check for campaigns with missing Unipile accounts
//   - Pause automatically
//   - Notify user
```

### 3. Database Functions
**File:** `sql/functions/auto-campaign-management.sql`

**Functions:**
```sql
-- auto_retry_rate_limited_prospects()
--   Finds prospects in rate_limited status older than 30 min
--   Resets to pending
--   Returns count

-- auto_pause_failing_campaigns()
--   Finds campaigns with >50% failure rate
--   Pauses automatically
--   Logs reason

-- auto_cleanup_stale_executions()
--   Finds prospects stuck in queued_in_n8n > 2 hours
--   Resets to pending
```

### 4. Scheduled Jobs (Supabase pg_cron)
**File:** `sql/scheduled-jobs.sql`

```sql
-- Run every 5 minutes
SELECT cron.schedule('auto-retry-rate-limits', '*/5 * * * *', 
  'SELECT auto_retry_rate_limited_prospects()');

-- Run every 15 minutes  
SELECT cron.schedule('auto-cleanup-stale', '*/15 * * * *',
  'SELECT auto_cleanup_stale_executions()');

-- Run every hour
SELECT cron.schedule('auto-pause-failing', '0 * * * *',
  'SELECT auto_pause_failing_campaigns()');
```

### 5. N8N Monitoring Webhook
**File:** `app/api/webhooks/n8n/error-handler/route.ts`

**Purpose:**
- N8N calls this when errors occur
- Logs error details
- Updates prospect status
- Triggers auto-recovery if needed

## Implementation Order

1. ✅ Create database functions (immediate)
2. ✅ Create recovery service script (immediate)
3. ✅ Set up cron jobs (immediate)
4. ⏳ Update N8N workflow (requires download/upload)
5. ⏳ Create error handler webhook (requires deployment)

## Testing Plan

1. Trigger rate limit (send many requests)
2. Verify auto-pause happens
3. Wait 30 minutes
4. Verify auto-resume happens
5. Check prospects were retried

## Monitoring

- Dashboard showing:
  - Rate limit events
  - Auto-pause events
  - Auto-retry counts
  - Campaign health scores

## Rollout

1. Deploy to staging
2. Test with 1 campaign
3. Monitor for 24 hours
4. Deploy to production
