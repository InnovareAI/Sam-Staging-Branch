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

### Step 1: Verify Environment Variables

Already set in Netlify:
- `UNIPILE_DSN`
- `UNIPILE_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET` (generated: `792e0c09eeee...`)

### Step 2: Wait for Deployment

Netlify will automatically deploy the new code.

Check deployment status:
```bash
netlify status
```

### Step 3: Configure cron-job.org

1. Go to https://cron-job.org
2. Create new job:
   - **Title:** Process Campaign Follow-Ups
   - **URL:** `https://app.meet-sam.com/api/campaigns/direct/process-follow-ups`
   - **Schedule:** Every hour (or `0 * * * *`)
   - **Method:** POST
   - **Headers:**
     ```
     x-cron-secret: 792e0c09eeee1a229b78a6341739613177fad24f401b1c82f2673bbb9ee806a0
     Content-Type: application/json
     ```
3. Save and enable

### Step 4: Test It

#### Test sending connection requests:
```bash
cd /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7
node scripts/js/test-direct-campaign.mjs
```

#### Test follow-up processing:
```bash
curl -X POST "http://localhost:3000/api/campaigns/direct/process-follow-ups" \
  -H "x-cron-secret: 792e0c09eeee1a229b78a6341739613177fad24f401b1c82f2673bbb9ee806a0"
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

## Benefits Over N8N/Inngest

1. **Simple** - No workflow engines to manage
2. **Transparent** - All logic in your codebase
3. **Debuggable** - Just check database queries
4. **No stuck leads** - Database is source of truth
5. **Reliable** - Cron-job.org is very reliable
6. **Flexible** - Easy to modify scheduling/sequences

## Next Steps

1. Deploy to production (automatic)
2. Set up cron-job.org
3. Test with Charissa's campaign
4. Monitor for 24 hours
5. If working well, switch all campaigns to this system
