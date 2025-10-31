# Campaign Queue Monitoring Guide

**Last Updated:** October 31, 2025

## Overview

When campaigns are executed, prospects are queued in n8n for processing with humanized timing. This guide shows you where to view and monitor the queue.

---

## Where Queue Data is Stored

### 1. **Supabase Database** (Source of Truth)

**Table:** `campaign_prospects`

**Key Status Values:**
- `pending` - Not yet queued
- `approved` - Ready for queueing
- `ready_to_message` - Explicitly ready
- **`queued_in_n8n`** - ✅ **Currently in n8n processing queue**
- `connection_requested` - LinkedIn message sent
- `contacted` - Legacy status (sent)
- `connected` - Connection accepted
- `replied` - Prospect replied

**Important Fields:**
```typescript
{
  status: 'queued_in_n8n',
  contacted_at: null, // Will be set when actually sent
  personalization_data: {
    queued_at: '2025-10-31T04:10:43.278Z',
    send_delay_minutes: 117, // From daily random pattern
    pattern_index: 0, // Position in today's pattern
    daily_pattern_seed: '2025-10-31',
    n8n_execution_id: '234710' // N8N tracking
  }
}
```

---

## How to View the Queue

### Option 1: Quick Script (Recommended)

```bash
node scripts/js/view-campaign-queue.mjs
```

**Output:**
```
📊 Campaign Queue Viewer

🔄 56 prospect(s) currently queued:

📋 Campaign: 20251030-IAI-Outreach Campaign
   Type: connector
   Queued: 2 prospect(s)

   1. Matt Zuvella
      LinkedIn: https://www.linkedin.com/in/mattzuvella
      Queued at: 10/31/2025, 12:10:43 PM
      Delay: 117 minutes (pattern position: 0)
      Estimated send: 10/31/2025, 2:07:43 PM
      ⏰ Sending in: 117 minutes
      N8N Execution: 234710

   2. Aliya Jasrai
      LinkedIn: https://www.linkedin.com/in/aliyajasrai
      Queued at: 10/31/2025, 12:10:43 PM
      Delay: 119 minutes (pattern position: 1)
      Estimated send: 10/31/2025, 2:09:43 PM
      ⏰ Sending in: 119 minutes

📊 Summary:
   Total in queue: 56
   Campaigns affected: 4
   Oldest in queue: 0 hours
```

---

### Option 2: Supabase Dashboard (Visual)

1. **Go to:** https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog
2. **Click:** Table Editor → `campaign_prospects`
3. **Add Filter:** `status` equals `queued_in_n8n`
4. **Sort by:** `personalization_data->>'queued_at'` descending

**What You'll See:**
- All queued prospects
- Campaign IDs
- Queue timestamps
- Delay patterns
- N8N execution IDs

---

### Option 3: SQL Query (Advanced)

```sql
-- View all queued prospects with timing
SELECT
  cp.first_name,
  cp.last_name,
  c.name as campaign_name,
  cp.status,
  cp.personalization_data->>'queued_at' as queued_at,
  cp.personalization_data->>'send_delay_minutes' as delay_minutes,
  cp.personalization_data->>'n8n_execution_id' as n8n_execution,

  -- Calculate estimated send time
  (cp.personalization_data->>'queued_at')::timestamp +
  ((cp.personalization_data->>'send_delay_minutes')::integer * INTERVAL '1 minute') as estimated_send_time

FROM campaign_prospects cp
JOIN campaigns c ON c.id = cp.campaign_id
WHERE cp.status = 'queued_in_n8n'
ORDER BY cp.personalization_data->>'queued_at' DESC
LIMIT 20;
```

---

### Option 4: N8N Cloud Dashboard (Processing View)

**View active executions:**

1. **Go to:** https://innovareai.app.n8n.cloud/workflow/2bmFPN5t2y6A4Rx2
2. **Click:** Executions tab (left sidebar)
3. **Filter:** Mode = webhook
4. **Look for:** Recent executions with "Running" or "Success" status

**What You'll See:**
- Execution ID (e.g., 234710)
- Start time
- Status: Running, Success, Error
- Input data (prospect details)
- Wait nodes in progress

**Note:** N8N doesn't maintain a traditional "queue table". Instead:
- Prospects are queued in Supabase (`status = 'queued_in_n8n'`)
- N8N workflow has **wait nodes** that schedule future actions
- Execution continues running until all steps complete (days/weeks)

---

## Understanding Queue Status

### Current Queue (As of Oct 31, 2025)

**Total Queued:** 56 prospects
**Campaigns:**
1. 20251028-3AI-SEO search 3: 49 prospects
2. 20251030-IAI-test 1: 3 prospects
3. 20251030-IAI-test 2: 2 prospects
4. 20251030-IAI-Outreach Campaign: 2 prospects

### Queue Processing Flow

```
1. Campaign Executed
   ↓
2. Sam App queues prospects
   - Status: pending → queued_in_n8n
   - Adds: queued_at, send_delay_minutes, pattern_index
   ↓
3. N8N receives webhook
   - Creates workflow execution
   - Starts processing with delays
   ↓
4. Wait nodes (hours/days)
   - CR wait → FU1 wait → FU2 wait → etc.
   ↓
5. Message sent
   - Status: queued_in_n8n → connection_requested
   - Sets: contacted_at
   ↓
6. Follow-ups (wait nodes)
   - Days between messages
   - Reply detection checks
   ↓
7. Campaign complete
   - Final goodbye message
   - Status: completed or replied
```

---

## Daily Random Patterns

Each prospect gets a unique delay based on the daily pattern:

**Example Day (Oct 31, 2025):**
```
Prospect 1: 0 minutes (immediate)
Prospect 2: +117 minutes (send at 10:57 AM)
Prospect 3: +16 more minutes (send at 11:13 AM)
Prospect 4: +24 more minutes (send at 11:37 AM)
...
```

**Key Points:**
- Pattern changes every day (date-based seed)
- Completely unpredictable to LinkedIn
- Respects business hours only
- No two prospects get same timing

---

## Monitoring Best Practices

### Daily Checks

**Morning (9am):**
```bash
# View current queue
node scripts/js/view-campaign-queue.mjs

# Check if any stuck (queued >24 hours)
# They should move to connection_requested within delays
```

**Evening (5pm):**
```bash
# Check how many sent today
curl 'https://latxadqrvrrrcvkktrog.supabase.co/rest/v1/campaign_prospects?contacted_at=gte.2025-10-31T00:00:00Z&status=eq.connection_requested&select=id' | jq 'length'
```

### Weekly Checks

**Monitor queue health:**
```sql
-- Prospects stuck in queue >48 hours
SELECT
  c.name,
  COUNT(*) as stuck_count,
  MIN(cp.personalization_data->>'queued_at') as oldest_queued
FROM campaign_prospects cp
JOIN campaigns c ON c.id = cp.campaign_id
WHERE cp.status = 'queued_in_n8n'
  AND (cp.personalization_data->>'queued_at')::timestamp < NOW() - INTERVAL '48 hours'
GROUP BY c.name;
```

**N8N execution health:**
1. Go to: https://innovareai.app.n8n.cloud/executions
2. Check for: Any failed executions
3. Review: Error messages if any

---

## Troubleshooting

### Issue: Prospect stuck in `queued_in_n8n` for >24 hours

**Possible Causes:**
1. N8N workflow paused/inactive
2. N8N execution failed
3. Wait node delay miscalculated
4. Supabase status not updated

**How to Fix:**
```bash
# 1. Check N8N workflow is active
curl -X GET "https://innovareai.app.n8n.cloud/api/v1/workflows/2bmFPN5t2y6A4Rx2" \
  -H "X-N8N-API-KEY: YOUR_KEY" | jq '.active'

# 2. Check for failed executions
# Go to: https://innovareai.app.n8n.cloud/workflow/2bmFPN5t2y6A4Rx2
# → Executions → Filter: status = error

# 3. Manually update status (if truly stuck)
# In Supabase: Update status from 'queued_in_n8n' to 'ready_to_message'
# Then re-execute campaign
```

### Issue: Queue growing too large (>100 prospects)

**Possible Causes:**
1. Multiple campaigns executing simultaneously
2. Daily rate limit not enforced
3. Scheduler running too frequently

**How to Fix:**
```bash
# 1. Check daily sends
# Should not exceed 20 per day per account

# 2. Pause campaigns if needed
# In Sam App: Set campaign status to 'paused'

# 3. Verify scheduler interval
# Should be 2 hours (120 minutes), not 2 minutes
```

### Issue: No prospects moving from queue to sent

**Possible Causes:**
1. N8N webhook not receiving data
2. LinkedIn account disconnected
3. Unipile API issues

**How to Fix:**
```bash
# 1. Test webhook manually
curl -X POST "https://innovareai.app.n8n.cloud/webhook/campaign-execute" \
  -H "Content-Type: application/json" \
  -d '{"test": "ping"}'
# Should return: {"message":"Workflow was started"}

# 2. Check LinkedIn account status
# Go to: Sam App → Settings → Integrations
# Verify: LinkedIn account shows "Connected"

# 3. Check Unipile status
curl "https://${UNIPILE_DSN}/api/v1/accounts/${ACCOUNT_ID}" \
  -H "X-API-KEY: ${UNIPILE_API_KEY}"
```

---

## Queue Capacity Planning

### Current Limits

**Michelle's Account:**
- 20 connection requests per day
- 100 connection requests per week
- 400 connection requests per month

**Queue Sizing:**
- Max daily queue: 20 prospects
- Recommended: 5-10 per campaign execution
- Multiple executions per day: 4 batches (every 2 hours)

### Scaling Strategy

**To handle more volume:**
1. **Add more LinkedIn accounts** (multi-account rotation)
2. **Increase batch delays** (spread over longer time)
3. **Implement account rotation** (distribute across accounts)

---

## API Endpoints for Queue Management

### Get Queue Status

```bash
GET /rest/v1/campaign_prospects?status=eq.queued_in_n8n
```

### Get Campaign Queue

```bash
GET /rest/v1/campaign_prospects?campaign_id=eq.CAMPAIGN_ID&status=eq.queued_in_n8n
```

### Update Prospect Status (Admin Only)

```bash
PATCH /rest/v1/campaign_prospects?id=eq.PROSPECT_ID
Content-Type: application/json

{
  "status": "ready_to_message"
}
```

---

## Summary

**Queue Location:**
- Primary: Supabase `campaign_prospects` table (`status = 'queued_in_n8n'`)
- Processing: N8N workflow executions with wait nodes
- Monitoring: `scripts/js/view-campaign-queue.mjs`

**Key Monitoring Points:**
- Queue size (should be <100)
- Oldest queued (should be <48 hours)
- Daily sends (should not exceed 20)
- Failed executions (should be 0)

**Tools:**
- Script: `view-campaign-queue.mjs`
- Supabase: Table editor with filters
- N8N: Executions dashboard
- SQL: Custom queries for analysis

---

**Questions?** See:
- `docs/LINKEDIN_HUMANIZATION_SUMMARY.md`
- `docs/N8N_DATABASE_TRACKING_SETUP.md`
- Sam App dashboard (coming soon: queue view)
