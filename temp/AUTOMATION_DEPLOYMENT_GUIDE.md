# SAM Campaign Automation - Deployment Guide

## What Was Built

Complete automation system that handles:
- ✅ Auto-retry rate limited prospects (every 5 min)
- ✅ Auto-cleanup stale N8N executions (every 15 min)
- ✅ Auto-pause failing campaigns (every hour)
- ✅ Auto-resume after rate limits clear (every 15 min)
- ✅ Error handling webhook for N8N
- ✅ Health monitoring

## Files Created

```
sql/
├── functions/
│   └── auto-campaign-management.sql    ← 5 database functions
└── scheduled-jobs.sql                  ← Cron job setup

app/api/webhooks/n8n/
└── error-handler/
    └── route.ts                        ← Error handling webhook

temp/
├── deploy-automation.mjs               ← Deployment script
├── resume-campaigns.mjs                ← Resume script for tomorrow
└── campaigns-to-resume.json            ← Paused campaign data
```

## Deployment Steps

### Step 1: Deploy Database Functions (5 minutes)

**Via Supabase Dashboard:**

1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT/sql

2. Copy contents of `sql/functions/auto-campaign-management.sql`

3. Paste and click **"Run"**

4. Verify success:
   ```sql
   SELECT * FROM get_automation_health();
   ```

**Expected Output:**
```
metric                      | value | details
---------------------------+-------+--------------------
rate_limited_prospects     | 0     | {...}
stale_queued_prospects     | 0     | {...}
high_failure_campaigns     | 0     | {...}
```

### Step 2: Enable Cron Jobs (2 minutes)

**Via Supabase Dashboard:**

1. Go to: Database → Extensions

2. Enable **"pg_cron"** extension

3. Go to SQL Editor

4. Copy contents of `sql/scheduled-jobs.sql`

5. Paste and click **"Run"**

6. Verify jobs are scheduled:
   ```sql
   SELECT jobname, schedule, active
   FROM cron.job
   WHERE jobname LIKE 'sam-%';
   ```

**Expected Output:**
```
jobname                       | schedule      | active
-----------------------------+--------------+--------
sam-auto-retry-rate-limits   | */5 * * * *  | t
sam-auto-cleanup-stale       | */15 * * * * | t
sam-auto-pause-failing       | 0 * * * *    | t
sam-auto-resume              | */15 * * * * | t
```

### Step 3: Deploy Error Handler Webhook (1 minute)

**The webhook is already created in:**
`app/api/webhooks/n8n/error-handler/route.ts`

**To deploy:**

1. Commit the file:
   ```bash
   git add app/api/webhooks/n8n/error-handler/route.ts
   git commit -m "Add N8N error handler webhook"
   ```

2. Push to trigger Netlify deployment:
   ```bash
   git push
   ```

3. Wait for deployment to complete (~3 minutes)

4. Verify endpoint is live:
   ```bash
   curl https://app.meet-sam.com/api/webhooks/n8n/error-handler \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
   ```

### Step 4: Update N8N Workflow (10 minutes)

**Option A: Manual UI Updates (Recommended)**

1. Open: https://workflows.innovareai.com/workflow/aVG6LC4ZFRMN7Bw6

2. For EACH HTTP Request node:
   - Get LinkedIn Profile
   - Send CR
   - Send Acceptance Message
   - Send FU1, FU2, FU3, FU4
   - Send GB (Breakup)

3. Click the node → Settings

4. Enable these options:
   ```
   ✅ Continue on Fail: ON
   ✅ Retry on Fail: ON
   Max Tries: 3
   Wait Between Tries: 5000ms
   ```

5. After EACH error-prone node, add "If" node:
   - Name: "Check for Error"
   - Condition: `{{ $json.error !== undefined }}`
   - If TRUE → route to "Report Error" node

6. Add ONE "HTTP Request" node (reusable):
   - Name: "Report Error to SAM"
   - Method: POST
   - URL: `https://app.meet-sam.com/api/webhooks/n8n/error-handler`
   - Body:
   ```json
   {
     "executionId": "={{ $execution.id }}",
     "workflowId": "={{ $workflow.id }}",
     "nodeName": "={{ $node.name }}",
     "error": {
       "message": "={{ $json.error.message }}",
       "httpCode": "={{ $json.error.httpCode }}"
     },
     "prospectId": "={{ $json.prospect?.id }}",
     "campaignId": "={{ $json.campaign_id }}",
     "timestamp": "={{ $now }}"
   }
   ```

7. Save workflow

**Option B: Automated Update (Advanced)**

Download workflow, modify JSON, re-upload (instructions in next section).

## Testing

### Test 1: Database Functions

```sql
-- Should return 0 (no prospects to retry yet)
SELECT * FROM auto_retry_rate_limited_prospects();

-- Should return 0 (no stale prospects yet)
SELECT * FROM auto_cleanup_stale_executions();

-- Check health
SELECT * FROM get_automation_health();
```

### Test 2: Cron Jobs

Wait 5 minutes, then check execution history:

```sql
SELECT
  jobname,
  runid,
  start_time,
  status,
  return_message
FROM cron.job_run_details
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname LIKE 'sam-%')
ORDER BY start_time DESC
LIMIT 10;
```

### Test 3: Error Handler Webhook

```bash
curl https://app.meet-sam.com/api/webhooks/n8n/error-handler \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "executionId": "test-123",
    "workflowId": "aVG6LC4ZFRMN7Bw6",
    "nodeName": "Test Node",
    "error": {
      "message": "You have reached a temporary provider limit",
      "httpCode": 429
    },
    "prospectId": "test-prospect-id",
    "campaignId": "test-campaign-id",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"
  }'
```

Expected response:
```json
{
  "success": true,
  "errorType": "rate_limit",
  "action": "Marked as rate_limited, will retry after 30 minutes"
}
```

## Monitoring

### Dashboard Query

```sql
-- Get automation stats
SELECT
  metric,
  value,
  details
FROM get_automation_health()
ORDER BY metric;

-- View recent auto-actions
SELECT
  jobname,
  start_time,
  return_message,
  status
FROM cron.job_run_details
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname LIKE 'sam-%')
  AND start_time > NOW() - INTERVAL '1 day'
ORDER BY start_time DESC;

-- Prospect status distribution
SELECT
  status,
  COUNT(*) as count
FROM campaign_prospects
WHERE updated_at > NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY count DESC;
```

### Expected Behavior

**When rate limit occurs:**
1. N8N execution fails with 429 error
2. "Report Error" node calls webhook
3. Webhook marks prospect as `rate_limited`
4. After 30 min, `auto_retry_rate_limited_prospects()` resets to `pending`
5. Campaign picks it up and retries

**When prospect gets stuck:**
1. Prospect sits in `queued_in_n8n` for >2 hours
2. `auto_cleanup_stale_executions()` runs every 15 min
3. Resets stuck prospect to `pending`
4. Campaign picks it up and retries

**When campaign fails repeatedly:**
1. Campaign has >50% failure rate
2. `auto_pause_failing_campaigns()` runs hourly
3. Pauses campaign automatically
4. Logs reason in cron job history

## Tomorrow Morning Checklist

1. **Check automation ran overnight:**
   ```sql
   SELECT * FROM cron.job_run_details
   WHERE jobname LIKE 'sam-%'
     AND start_time > NOW() - INTERVAL '12 hours'
   ORDER BY start_time DESC;
   ```

2. **Resume paused campaigns:**
   ```bash
   node temp/resume-campaigns.mjs
   ```

3. **Monitor first hour:**
   - Watch N8N executions
   - Check for rate limit errors
   - Verify auto-retry is working

4. **Check Michelle reconnected LinkedIn:**
   - If not, remind her
   - Her campaigns will remain paused

## Rollback Plan

If automation causes issues:

```sql
-- Disable all cron jobs
SELECT cron.unschedule('sam-auto-retry-rate-limits');
SELECT cron.unschedule('sam-auto-cleanup-stale');
SELECT cron.unschedule('sam-auto-pause-failing');
SELECT cron.unschedule('sam-auto-resume');

-- Drop functions (if needed)
DROP FUNCTION IF EXISTS auto_retry_rate_limited_prospects();
DROP FUNCTION IF EXISTS auto_cleanup_stale_executions();
DROP FUNCTION IF EXISTS auto_pause_failing_campaigns();
DROP FUNCTION IF EXISTS auto_resume_after_rate_limits();
DROP FUNCTION IF EXISTS get_automation_health();
```

Then manage campaigns manually until fixed.

## Success Metrics

After 24 hours, you should see:

- ✅ 0 prospects stuck in `queued_in_n8n` >2 hours
- ✅ `rate_limited` prospects automatically retried
- ✅ Failing campaigns auto-paused
- ✅ Campaigns resume automatically after rate limits clear
- ✅ No manual intervention needed

## Support

If issues occur:

1. Check cron job execution history
2. Check error webhook logs in Netlify
3. Run health check: `SELECT * FROM get_automation_health();`
4. Check N8N execution logs

---

**Status:** Ready to deploy
**Time to deploy:** ~20 minutes
**Risk:** Low (all changes are additive, can be rolled back)
