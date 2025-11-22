# Queue-Based Testing Setup Guide

**Status:** ✅ READY FOR TESTING (Nov 22, 2025)
**Mode:** Safe, throttled (1 CR every 30 minutes)
**Daily Capacity:** 20 CRs per day (under LinkedIn limit)

---

## What We Just Built

Two endpoints for **safe testing** of campaigns:

1. **Queue Creation** - `/api/campaigns/direct/send-connection-requests-queued`
   - Validates all prospects
   - Creates send_queue records (1 CR every 30 min)
   - Returns immediately (no hanging)

2. **Queue Processing** - `/api/cron/process-send-queue`
   - Runs every minute
   - Sends 1 CR per execution
   - Ultra-safe and throttled

---

## Step-by-Step Setup

### Step 1: Create Database Table

Run this SQL in Supabase:

```sql
CREATE TABLE send_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES campaign_prospects(id) ON DELETE CASCADE,

  -- LinkedIn data
  linkedin_user_id TEXT NOT NULL,

  -- Message
  message TEXT NOT NULL,

  -- Timing
  scheduled_for TIMESTAMP NOT NULL,
  sent_at TIMESTAMP,

  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- pending: waiting to send
    -- sent: successfully sent
    -- failed: error occurred

  error_message TEXT,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Indexes for performance
  UNIQUE(campaign_id, prospect_id)
);

-- Index for cron job queries
CREATE INDEX idx_send_queue_pending
  ON send_queue(scheduled_for)
  WHERE status = 'pending';

-- Enable RLS if needed
ALTER TABLE send_queue ENABLE ROW LEVEL SECURITY;
```

---

### Step 2: Deploy Code

```bash
# Build and deploy
npm run build
netlify deploy --prod
```

The two new endpoints are now live:
- `POST /api/campaigns/direct/send-connection-requests-queued`
- `POST /api/cron/process-send-queue`

---

### Step 3: Set Up Cron Job

Go to **cron-job.org** and create a new job:

**Job Details:**
- **URL:** `https://app.meet-sam.com/api/cron/process-send-queue`
- **Method:** POST
- **Schedule:** `* * * * *` (every minute)
- **Authentication:** Custom Headers

**Headers:**
```
Name: x-cron-secret
Value: <your CRON_SECRET value from netlify env:list>
```

**Note:** Get your CRON_SECRET:
```bash
netlify env:list | grep CRON_SECRET
```

**Example cron-job.org setup:**
```
Title: SAM - Process Send Queue (1 min interval)
URL: https://app.meet-sam.com/api/cron/process-send-queue
Method: POST
HTTP Auth: (leave blank)
HTTP Headers:
  Header 1:
    Name: x-cron-secret
    Value: abc123xyz789...
```

---

## Testing Flow

### Test 1: Create Test Campaign

1. **Create campaign** with 5-10 test prospects
2. **Approve prospects** (move to "approved" status)
3. **Queue campaign** via the new endpoint

### Test 2: Queue the Campaign

```bash
curl -X POST https://app.meet-sam.com/api/campaigns/direct/send-connection-requests-queued \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "YOUR_CAMPAIGN_ID"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "queued": 5,
  "skipped": 0,
  "message": "✅ Campaign queued! 5 CRs will be sent (1 every 30 minutes)",
  "estimated_completion": "2025-11-22T12:20:00Z",
  "estimated_duration_minutes": 120,
  "queue_details": [
    {
      "index": 1,
      "prospect": "ACoAA...",
      "scheduled_for": "2025-11-22T10:20:00Z"
    },
    {
      "index": 2,
      "prospect": "ACoAA...",
      "scheduled_for": "2025-11-22T10:50:00Z"
    },
    ...
  ]
}
```

### Test 3: Monitor Queue Progress

Check the `send_queue` table in Supabase:

```sql
SELECT
  id,
  status,
  scheduled_for,
  sent_at,
  error_message
FROM send_queue
WHERE campaign_id = 'YOUR_CAMPAIGN_ID'
ORDER BY scheduled_for ASC;
```

**Expected sequence:**
```
Status   | Scheduled For      | Sent At
---------|--------------------|---------
pending  | 10:20 AM          | NULL
pending  | 10:50 AM          | NULL
pending  | 11:20 AM          | NULL
...

After 10:20:
sent     | 10:20 AM          | 10:20:05
pending  | 10:50 AM          | NULL
pending  | 11:20 AM          | NULL

After 10:50:
sent     | 10:20 AM          | 10:20:05
sent     | 10:50 AM          | 10:50:03
pending  | 11:20 AM          | NULL
```

### Test 4: Check Prospect Status

View campaign prospects to see status updates:

```sql
SELECT
  id,
  first_name,
  status,
  contacted_at,
  follow_up_due_at
FROM campaign_prospects
WHERE campaign_id = 'YOUR_CAMPAIGN_ID'
ORDER BY contacted_at DESC;
```

**Expected sequence:**
```
After 1st CR sent:
first_name | status                  | contacted_at      | follow_up_due_at
-----------|-------------------------|-------------------|------------------
John Doe   | connection_request_sent | 2025-11-22 10:20  | 2025-11-25 10:20
(others)   | pending                 | NULL              | NULL

After 2nd CR sent:
John Doe   | connection_request_sent | 2025-11-22 10:20  | 2025-11-25 10:20
Jane Smith | connection_request_sent | 2025-11-22 10:50  | 2025-11-25 10:50
(others)   | pending                 | NULL              | NULL
```

---

## What the Queue Does

### For Each CR:
1. ✅ Validates prospect (checks for duplicates, already connected, etc.)
2. ✅ Looks up LinkedIn profile (extracts provider_id)
3. ✅ Checks relationship status (2nd/3rd degree)
4. ✅ Creates queue record with scheduled_for time
5. ✅ Returns immediately

### Cron Job (Every Minute):
1. ✅ Finds next message due to send
2. ✅ Sends CR via Unipile API
3. ✅ Marks queue item as "sent"
4. ✅ Updates prospect record (status, contacted_at, follow_up_due_at)
5. ✅ Reports remaining queue count

---

## Timing Breakdown

**With 10 prospects:**

```
Queue creation:        ~2 seconds ✅
Messages scheduled:    1 every 30 minutes
Total send time:       10 × 30 = 300 minutes = 5 hours
Daily capacity:        20 CRs (enough for full day)
```

**Timeline example:**
```
10:00 AM  → Queue 10 prospects (returns immediately)
10:20 AM  → CR 1 sent
10:50 AM  → CR 2 sent
11:20 AM  → CR 3 sent
11:50 AM  → CR 4 sent
12:20 PM  → CR 5 sent
... (continues every 30 min)
2:50 PM   → CR 10 sent
```

---

## Safety Features

### 1. Validation Before Queuing
- ✅ Checks for duplicates across campaigns
- ✅ Checks if already contacted in this campaign
- ✅ Verifies LinkedIn profile exists
- ✅ Checks if already connected
- ✅ Detects withdrawn invitations (LinkedIn cooldown)
- ✅ Detects pending invitations

### 2. Throttling
- ✅ 1 CR every 30 minutes = 20 per 10 hours
- ✅ Never exceeds 20 per day (LinkedIn free limit)
- ✅ Safe from automation detection

### 3. Error Handling
- ✅ Failed messages marked in queue (not retried automatically)
- ✅ Prospect status updated to "failed" with error message
- ✅ Error logged for debugging
- ✅ Queue continues processing other messages

### 4. Persistence
- ✅ Queue stored in database (survives app restarts)
- ✅ Can pause by stopping cron job
- ✅ Can resume by restarting cron job
- ✅ No messages lost

---

## Debugging

### Check Cron Job Execution

In cron-job.org dashboard:
1. Go to "Cronjobs" → "Process Send Queue"
2. Click "Execution log"
3. See execution history and any errors

### Check Netlify Logs

```bash
netlify logs --function process-send-queue --tail
```

You should see:
```
🕐 Processing send queue...
📤 Sending CR to John Doe
   Campaign: Test Campaign
   Account: Irish LinkedIn
   Scheduled: 2025-11-22T10:20:00Z
📨 Sending to provider_id: ACoAA...
✅ CR sent successfully
⏰ Next follow-up scheduled for: 2025-11-25T10:20:00Z
📊 Remaining in queue: 9
```

### Check Database Directly

```sql
-- See all queued messages
SELECT * FROM send_queue ORDER BY scheduled_for;

-- See failed messages
SELECT * FROM send_queue WHERE status = 'failed';

-- See sent messages
SELECT * FROM send_queue WHERE status = 'sent' ORDER BY sent_at DESC;
```

---

## Troubleshooting

### Issue: Queue not processing

**Check 1:** Is cron job running?
- Go to cron-job.org
- Check if job is enabled
- Check execution log for errors

**Check 2:** Is CRON_SECRET correct?
```bash
# Get the secret
netlify env:list | grep CRON_SECRET

# Compare with cron-job.org header value
# They must match exactly
```

**Check 3:** Is send_queue table created?
```bash
# Query table
SELECT COUNT(*) FROM send_queue;

# If error: table doesn't exist, run SQL from Step 1
```

### Issue: Messages not being sent

**Check 1:** Are there pending messages?
```sql
SELECT * FROM send_queue WHERE status = 'pending' AND scheduled_for <= NOW();
```

**Check 2:** Check Netlify logs for errors
```bash
netlify logs --function process-send-queue --tail
```

**Check 3:** Check for Unipile API errors
- Look in logs for "failed to send CR"
- Common errors:
  - `already_invited_recently` = LinkedIn cooldown
  - `network_distance FIRST_DEGREE` = Already connected
  - `invitation status WITHDRAWN` = Cooldown active

---

## Next Steps

1. ✅ Create send_queue table (SQL above)
2. ✅ Deploy code (`npm run build && netlify deploy --prod`)
3. ✅ Set up cron-job.org job
4. ✅ Create test campaign (5-10 prospects)
5. ✅ Queue campaign (`POST /api/campaigns/direct/send-connection-requests-queued`)
6. ✅ Monitor progress (check send_queue and prospect status)
7. ✅ Watch for errors and validate CRs on LinkedIn

---

## Success Criteria

✅ Queue creation endpoint returns in <2 seconds
✅ Cron job runs every minute (check execution log)
✅ send_queue table shows messages going from "pending" to "sent"
✅ Prospect records update with contacted_at and follow_up_due_at
✅ CRs appear in LinkedIn sent list
✅ No errors in Netlify logs

---

**Last Updated:** November 22, 2025
**Status:** Ready for testing
**Estimated Testing Time:** 1-2 hours for full queue to process
