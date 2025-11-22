# Cron-Job.org Setup Guide

**Status:** Ready for Setup (Nov 22, 2025)
**Purpose:** Configure automated queue processing with cron-job.org
**Update:** Weekend/Holiday blocking now enabled ✅

---

## Overview

Cron-job.org sends HTTP requests on a schedule. We use it to trigger the queue processing endpoint every minute, which sends 1 queued connection request per execution.

**Key Features:**
- ✅ Runs every minute (configurable)
- ✅ Sends via HTTP POST (not CRON syntax)
- ✅ Supports custom headers for authentication
- ✅ Logs execution history
- ✅ Weekend and public holiday support (messages skip, resume on next business day)

---

## Step 1: Get Your CRON_SECRET

First, retrieve the secret from Netlify environment variables:

```bash
netlify env:list | grep CRON_SECRET
```

You should see output like:
```
CRON_SECRET=xxxx...xxxx
```

Copy the value - you'll need it for the cron-job.org setup.

---

## Step 2: Create a New Job in Cron-Job.org

### 2.1 Go to Cron-Job.org Dashboard

Visit: **https://cron-job.org/en/members/**

Log in with your credentials. If you don't have an account:
1. Go to https://cron-job.org/en/
2. Click "Sign up" or "Create account"
3. Complete registration

### 2.2 Click "Create Cronjob"

You should see a button like "New Cronjob" or "Create Cronjob"

### 2.3 Fill in Job Details

**Job Title:**
```
SAM - Process Send Queue
```

**URL:**
```
https://app.meet-sam.com/api/cron/process-send-queue
```

**HTTP Method:**
```
POST
```

**Schedule:**
```
* * * * *
```
(This means: every minute, every hour, every day)

### 2.4 Add Headers for Authentication

**Important:** You must add the `x-cron-secret` header to authenticate the request.

In the "HTTP Headers" section, add:

| Name | Value |
|------|-------|
| `x-cron-secret` | `{CRON_SECRET from netlify env:list}` |

**Example:**
- Name: `x-cron-secret`
- Value: `abc123xyz789...`

### 2.5 Additional Settings (Optional)

**Timeout:** 60 seconds (sufficient for processing 1 message)
**Notification email:** Set to your email to receive alerts if job fails
**Save responses:** Enable to see logs

### 2.6 Save the Job

Click the "Save" or "Create" button.

---

## Step 3: Verify the Job is Running

### 3.1 Check Cron-Job.org Dashboard

1. Go to **Cronjobs** → **My Cronjobs**
2. You should see "SAM - Process Send Queue" listed
3. Status should show **ENABLED** (green)

### 3.2 Check Execution Log

1. Click on the job name
2. Scroll to **Execution log**
3. You should see entries like:
   ```
   ✓ Success  2025-11-22 17:45:00  Duration: 1.23s
   ✓ Success  2025-11-22 17:44:00  Duration: 0.98s
   ✓ Success  2025-11-22 17:43:00  Duration: 1.11s
   ```

### 3.3 Check Netlify Logs

```bash
netlify logs --function process-send-queue --tail
```

You should see logs like:
```
🕐 Processing send queue...
✅ No messages due
```

Or if there are queued messages:
```
🕐 Processing send queue...
📤 Sending CR to John Doe
✅ CR sent successfully
📊 Remaining in queue: 4
```

---

## Step 4: Test the Queue System

### 4.1 Create a Test Campaign

1. Go to https://app.meet-sam.com/workspace/[workspaceId]/campaign-hub
2. Click "New Campaign"
3. Name: "Queue Test - Nov 22"
4. Add 5-10 test prospects with LinkedIn URLs
5. Click "Create Campaign"

### 4.2 Approve Prospects

1. Go to **Data Approval** tab
2. Select all test prospects
3. Click "Approve"
4. Verify status shows "approved"

### 4.3 Queue the Campaign

Call the queue endpoint:

```bash
curl -X POST https://app.meet-sam.com/api/campaigns/direct/send-connection-requests-queued \
  -H "Content-Type: application/json" \
  -d '{"campaignId": "YOUR_CAMPAIGN_ID"}'
```

Expected response:
```json
{
  "success": true,
  "queued": 5,
  "skipped": 0,
  "message": "✅ Campaign queued! 5 CRs will be sent (1 every 30 minutes)",
  "estimated_completion": "2025-11-22T19:20:00Z",
  "estimated_duration_minutes": 110,
  "queue_details": [
    {
      "index": 1,
      "prospect": "ACoAA...",
      "scheduled_for": "2025-11-22T17:50:00Z"
    },
    ...
  ]
}
```

### 4.4 Monitor Progress

Check the send_queue table in Supabase:

```sql
SELECT
  id,
  status,
  scheduled_for,
  sent_at,
  error_message,
  created_at
FROM send_queue
WHERE campaign_id = 'YOUR_CAMPAIGN_ID'
ORDER BY scheduled_for ASC;
```

**Expected sequence:**
- Initially: All records have `status = 'pending'` and `sent_at = NULL`
- After first execution: First record gets `status = 'sent'` and `sent_at = now()`
- After 30+ minutes: More records get `status = 'sent'`

### 4.5 Verify CRs in LinkedIn

1. Go to your LinkedIn account (the one you're sending from)
2. Check **My Network** → **Invitations sent**
3. You should see the connection requests appear

---

## Step 5: Understand Weekend & Holiday Behavior

The queue system now respects business hours:

- **Weekends:** Messages scheduled for Saturday/Sunday are held until Monday
- **Public Holidays:** Messages skip US holidays (Thanksgiving, Christmas, etc.)
- **Same Time:** Messages preserve their scheduled time but move to the next business day

### Example:
```
Friday 11/22/25 @ 5:00 PM - CR 1 sent ✅
Friday 11/22/25 @ 5:30 PM - CR 2 sent ✅
Saturday 11/23/25 @ 6:00 PM - Skipped (weekend)
                              → Moves to Monday 11/25/25 @ 6:00 PM
Monday 11/25/25 @ 6:00 PM - CR 3 sent ✅
```

### Holiday Calendar (Built-in)

The system recognizes these holidays:
- New Year's Day (Jan 1)
- MLK Jr. Day (3rd Monday in Jan)
- Presidents' Day (3rd Monday in Feb)
- Memorial Day (last Monday in May)
- Juneteenth (Jun 19)
- Independence Day (Jul 4)
- Labor Day (1st Monday in Sep)
- Columbus Day (2nd Monday in Oct)
- Veterans Day (Nov 11)
- Thanksgiving (4th Thursday in Nov)
- Christmas (Dec 25)

To customize holidays, edit `/app/api/cron/process-send-queue/route.ts` and `/app/api/campaigns/direct/send-connection-requests-queued/route.ts` - look for `PUBLIC_HOLIDAYS` array.

---

## Troubleshooting

### Job Not Running?

**Check 1: Is cron-job.org enabled?**
- Visit https://cron-job.org/en/members/
- Go to **My Cronjobs**
- Check that "SAM - Process Send Queue" shows ENABLED (green status)
- If disabled, click it and toggle ON

**Check 2: Is the CRON_SECRET correct?**
```bash
# Get the secret
netlify env:list | grep CRON_SECRET

# Compare with what you put in cron-job.org
# They must match exactly
```

**Check 3: Check cron-job.org execution log**
- Click on the job
- Look at "Execution log"
- If you see errors, note them

### Messages Not Sending?

**Check 1: Are there pending messages?**
```sql
SELECT COUNT(*) FROM send_queue
WHERE status = 'pending'
AND scheduled_for <= NOW();
```

**Check 2: Is the time zone correct?**
- Scheduled times are in UTC
- Your LinkedIn account timezone might be different
- But messages will send at the right UTC time

**Check 3: Check Netlify logs**
```bash
netlify logs --function process-send-queue --tail
```

Look for error messages like:
- `❌ Queue fetch error:` - Database issue
- `❌ Failed to send CR:` - Unipile API error
- `⏸️ Skipping weekend message` - Working as expected

### Messages Sending at Wrong Time?

**Check 1: Queue creation times**
```sql
SELECT
  prospect.first_name,
  scheduled_for AT TIME ZONE 'UTC' as utc_time,
  scheduled_for AT TIME ZONE 'America/New_York' as ny_time
FROM send_queue
WHERE campaign_id = 'YOUR_CAMPAIGN_ID'
ORDER BY scheduled_for;
```

**Check 2: Verify no weekend/holiday skipping is happening**
```sql
-- These should not exist if scheduling is working
SELECT * FROM send_queue
WHERE
  status = 'pending'
  AND EXTRACT(DOW FROM scheduled_for) IN (0, 6);  -- 0=Sun, 6=Sat
```

### Cron-Job.org Says "Invalid URL"

**Issue:** The URL might not be accessible or has typos

**Fix:**
```bash
# Test the endpoint manually
curl -X POST https://app.meet-sam.com/api/cron/process-send-queue \
  -H "x-cron-secret: YOUR_SECRET" \
  -H "Content-Type: application/json"

# Should return something like:
# {"success":true,"processed":0,"message":"No messages due"}
```

---

## Advanced Configuration

### Adjust Frequency

By default, the cron job runs **every minute**. You can adjust:

- **Every 5 minutes:** `*/5 * * * *`
- **Every 10 minutes:** `*/10 * * * *`
- **Every hour:** `0 * * * *`
- **Every day at 9 AM (UTC):** `0 9 * * *`

**Note:** Adjust based on your queue size and performance needs.

### Custom Holidays

To add custom holidays, edit the queue processing and creation endpoints:

**File:** `/app/api/cron/process-send-queue/route.ts` (lines 26-41)
**File:** `/app/api/campaigns/direct/send-connection-requests-queued/route.ts` (lines 30-45)

```typescript
const PUBLIC_HOLIDAYS = [
  '2025-01-01', // New Year's Day
  '2025-03-17', // St. Patrick's Day (example)
  '2025-05-26', // Memorial Day
  // Add your custom holidays here
];
```

After editing, rebuild and deploy:
```bash
npm run build && netlify deploy --prod
```

### Monitor Queue Health

Create a monitoring query to check queue status:

```sql
-- Queue health check
SELECT
  COUNT(*) as total_queued,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
  ROUND(AVG(EXTRACT(EPOCH FROM (sent_at - scheduled_for))), 2) as avg_delay_seconds
FROM send_queue
WHERE created_at > NOW() - INTERVAL '7 days';
```

---

## Success Criteria

✅ Cron-job.org job shows ENABLED
✅ Execution log shows successful runs (green checkmarks)
✅ Netlify logs show "Processing send queue..." messages
✅ Queue table shows messages moving from pending → sent
✅ Campaign prospects update with contacted_at and follow_up_due_at
✅ CRs appear in LinkedIn sent list
✅ Weekends and holidays are skipped (messages wait until next business day)

---

## Next Steps

1. ✅ Complete Step 1-5 above
2. ✅ Verify cron job is running (check execution log)
3. ✅ Create test campaign and queue it
4. ✅ Monitor for 2-3 hours to see messages send
5. ✅ Check LinkedIn to confirm CRs arrived
6. ✅ Document any issues and fixes

Once verified, you can:
- Create larger campaigns (20+ prospects)
- Monitor queue continuously
- Adjust holiday calendar if needed
- Review follow-up performance

---

## Support

If you encounter issues:

1. Check the **Execution Log** in cron-job.org
2. Run `netlify logs --function process-send-queue --tail` for detailed errors
3. Query the send_queue table to see message status
4. Verify CRON_SECRET matches exactly

---

**Last Updated:** November 22, 2025
**Status:** Ready for Production Testing
**Features:** ✅ Queue-based sending, ✅ Weekend/Holiday blocking, ✅ Business day scheduling
