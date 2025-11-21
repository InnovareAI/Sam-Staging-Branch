# Direct Campaign System - Setup Guide

Simple campaign execution with no workflow engines (no N8N, no Inngest).

## Architecture

**Send Connection Requests** → **Cron checks every hour** → **Send follow-ups**

- ✅ Simple, no external dependencies
- ✅ Easy to debug (just check database)
- ✅ No stuck leads (just reset follow_up_due_at)
- ✅ SAM handles replies separately

## How It Works

### 1. Send Connection Requests (Immediate)
```
POST /api/campaigns/direct/send-connection-requests
Body: { "campaignId": "uuid" }
```

**What it does:**
1. Fetches pending prospects for the campaign
2. Sends connection request via Unipile
3. Updates database:
   - `status = 'connection_request_sent'`
   - `contacted_at = NOW`
   - `follow_up_due_at = NOW + 2 days`
   - `follow_up_sequence_index = 0`

### 2. Process Follow-Ups (Cron Job)
```
POST /api/campaigns/direct/process-follow-ups
Header: x-cron-secret: <your-secret>
```

**What it does:**
1. Finds prospects where `follow_up_due_at <= NOW`
2. Checks if connection accepted (looks for chat)
3. If accepted: sends next follow-up message
4. Updates `follow_up_sequence_index` and `follow_up_due_at`

**Follow-up schedule:**
- FU1: +5 days after CR accepted
- FU2: +7 days after FU1
- FU3: +5 days after FU2
- FU4: +7 days after FU3

## Setup Instructions

### Step 1: System Already Deployed ✅

The direct campaign system is live at: **https://app.meet-sam.com**

Environment variables already configured:
- `UNIPILE_DSN` = `api6.unipile.com:13670`
- `UNIPILE_API_KEY` = (configured)
- `SUPABASE_SERVICE_ROLE_KEY` = (configured)
- `CRON_SECRET` = `792e0c09eeee1a229b78a6341739613177fad24f401b1c82f2673bbb9ee806a0`

### Step 2: Configure cron-job.org

Go to https://cron-job.org and add this job:

**Title:** Process Campaign Follow-Ups

**URL:** `https://app.meet-sam.com/api/campaigns/direct/process-follow-ups`

**Schedule:** Every hour (or `0 * * * *`)

**Method:** POST

**Headers:**
```
x-cron-secret: 792e0c09eeee1a229b78a6341739613177fad24f401b1c82f2673bbb9ee806a0
Content-Type: application/json
```

**Important:** Keep `x-cron-secret` private!

### Step 3: Send Connection Requests

To start a campaign, call the send-connection-requests endpoint:

```bash
curl -X POST "https://app.meet-sam.com/api/campaigns/direct/send-connection-requests" \
  -H "Content-Type: application/json" \
  -d '{"campaignId": "YOUR_CAMPAIGN_ID"}'
```

Or use the test script:
```bash
cd /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7
node scripts/js/test-direct-campaign.mjs
```

## Monitoring

### Check prospects status:
```sql
SELECT
  first_name,
  last_name,
  status,
  follow_up_sequence_index,
  follow_up_due_at,
  contacted_at
FROM campaign_prospects
WHERE campaign_id = 'your-campaign-id'
ORDER BY contacted_at DESC;
```

### Check next follow-ups due:
```sql
SELECT
  first_name,
  last_name,
  follow_up_due_at,
  follow_up_sequence_index
FROM campaign_prospects
WHERE status = 'connection_request_sent'
  AND follow_up_due_at <= NOW()
ORDER BY follow_up_due_at;
```

## Troubleshooting

### Leads stuck in "connection_request_sent"?
**Check:** Is cron job running?
**Fix:** Verify cron-job.org is hitting your endpoint

### Follow-ups not sending?
**Check:** Connection accepted?
**Fix:** Cron will retry every hour until connection accepted

### Want to retry a prospect?
**Reset follow-up time:**
```sql
UPDATE campaign_prospects
SET follow_up_due_at = NOW()
WHERE id = 'prospect-id';
```

### Want to skip a prospect?
**Remove from queue:**
```sql
UPDATE campaign_prospects
SET follow_up_due_at = NULL,
    status = 'messaging'
WHERE id = 'prospect-id';
```

### LinkedIn Rate Limit?
**Error:** "You have reached a temporary provider limit"
**Fix:** Wait 24 hours, LinkedIn resets daily limits
**Prevention:** Spread campaigns across multiple accounts

## Rate Limits

**LinkedIn Connection Requests:**
- 100/week per account (LinkedIn's limit)
- Best practice: 15-20/day to stay safe

**LinkedIn Messages:**
- Unlimited for accepted connections
- 15-20/day for new connections

**Unipile API:**
- No strict limits, but respect LinkedIn's limits

## Benefits Over N8N/Inngest

1. **Simple** - No workflow engines to manage
2. **Transparent** - All logic in your codebase
3. **Debuggable** - Just check database queries
4. **No stuck leads** - Database is source of truth
5. **Reliable** - Cron-job.org is very reliable
6. **Flexible** - Easy to modify scheduling/sequences

## Next Steps

1. ✅ System deployed to production
2. ⏳ Configure cron-job.org (see Step 2 above)
3. ⏳ Test with Charissa's campaign (wait for rate limit to clear)
4. ⏳ Monitor for 24 hours
5. ⏳ If working well, migrate all campaigns to this system
