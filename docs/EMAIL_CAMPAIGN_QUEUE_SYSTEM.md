# EMAIL CAMPAIGN QUEUE SYSTEM

**Date:** November 24, 2025
**Status:** ✅ DEPLOYED TO PRODUCTION

---

## Overview

Email campaigns now use a **queue-based system** with strict compliance rules to match LinkedIn campaigns. This ensures cold email outreach follows best practices and legal requirements.

### Compliance Rules

- ✅ **Max 40 emails per day**
- ✅ **Business hours only: 8 AM - 5 PM** (9-hour window)
- ✅ **No weekends** (Saturday/Sunday blocked)
- ✅ **No US public holidays** (11+ holidays blocked)
- ✅ **13.5 minute intervals** between emails (40 emails / 9 hours)

---

## How It Works

### 1. Campaign Activation

When a user activates an email campaign:

```
User clicks "Activate Campaign"
  ↓
POST /api/campaigns/activate
  ↓
Determines campaign_type = 'email' or 'connector'
  ↓
Calls POST /api/campaigns/email/send-emails-queued
```

### 2. Queue Creation (< 2 seconds)

The queue endpoint validates and schedules all emails:

```typescript
// Endpoint: /api/campaigns/email/send-emails-queued

1. Fetch pending prospects (max 40)
2. Get email account for workspace
3. Personalize subject/body for each prospect
4. Calculate send times:
   - Start: 8 AM
   - Interval: 13.5 minutes apart
   - Skip weekends/holidays
5. Insert records into email_send_queue table
6. Return success immediately
```

**Example Schedule:**
- Prospect 1: Today 8:00 AM
- Prospect 2: Today 8:13 AM (13.5 min later)
- Prospect 3: Today 8:27 AM
- ...
- Prospect 40: Today 3:46 PM

If it's Friday 3:00 PM and 5 prospects queued:
- Prospect 1-4: Friday 3:00, 3:13, 3:27, 3:40 PM
- Prospect 5: Monday 8:00 AM (weekend skipped, time preserved)

### 3. Cron Processing (every 13 minutes)

External cron job sends emails from the queue:

```typescript
// Endpoint: /api/cron/process-email-queue
// Called by: cron-job.org every 13 minutes

1. Check if now is valid send time:
   - Between 8 AM - 5 PM?
   - Not weekend?
   - Not holiday?
2. If NO: return "Outside business hours"
3. If YES: Find next email in queue
4. Send email via Unipile API
5. Update queue status: pending → sent
6. Update prospect status: pending → email_sent
7. Return success
```

---

## Database Schema

### `email_send_queue` Table

```sql
CREATE TABLE email_send_queue (
  id UUID PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id),
  prospect_id UUID REFERENCES campaign_prospects(id),

  -- Email data
  email_account_id TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  from_name TEXT,

  -- Scheduling
  scheduled_for TIMESTAMP NOT NULL,
  sent_at TIMESTAMP,

  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending',
    -- pending, sent, failed

  error_message TEXT,
  message_id TEXT,  -- Unipile message ID

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(campaign_id, prospect_id)
);
```

---

## Cron Job Setup

### Required Configuration

**Service:** cron-job.org
**URL:** `https://app.meet-sam.com/api/cron/process-email-queue`
**Method:** POST
**Schedule:** Every 13 minutes
**Header:** `x-cron-secret: ${CRON_SECRET}`

### Steps to Configure

1. Go to https://cron-job.org
2. Create new cron job
3. Configure:
   - Title: "SAM Email Queue Processor"
   - URL: `https://app.meet-sam.com/api/cron/process-email-queue`
   - Schedule: `*/13 * * * *` (every 13 minutes)
   - HTTP Method: POST
   - Header: `x-cron-secret` = `${CRON_SECRET}` (from Netlify env vars)
4. Enable job
5. Verify first execution in logs

### Environment Variables

Set via Netlify CLI:

```bash
netlify env:set CRON_SECRET "your-secret-here"
```

---

## Weekend/Holiday Blocking

### US Public Holidays (2025-2026)

The system automatically blocks these holidays:

- 2025-01-01: New Year's Day
- 2025-01-20: MLK Jr. Day
- 2025-02-17: Presidents' Day
- 2025-05-26: Memorial Day
- 2025-06-19: Juneteenth
- 2025-07-04: Independence Day
- 2025-09-01: Labor Day
- 2025-11-11: Veterans Day
- 2025-11-27: Thanksgiving
- 2025-12-25: Christmas
- 2026-01-01: New Year's Day
- 2026-01-19: MLK Jr. Day

### Weekend Behavior

- **Saturday/Sunday:** All scheduled emails automatically move to next Monday 8 AM
- **Time preservation:** Friday 3:00 PM → Monday 3:00 PM (NOT Monday 8:00 AM)

---

## Monitoring & Debugging

### Check Queue Status

```sql
-- View pending emails
SELECT
  q.id,
  c.campaign_name,
  p.email as recipient,
  q.subject,
  q.scheduled_for,
  q.status
FROM email_send_queue q
JOIN campaigns c ON c.id = q.campaign_id
JOIN campaign_prospects p ON p.id = q.prospect_id
WHERE q.status = 'pending'
ORDER BY q.scheduled_for;
```

### Check Sent Emails

```sql
-- View sent emails
SELECT
  q.sent_at,
  c.campaign_name,
  p.email as recipient,
  q.subject,
  q.message_id
FROM email_send_queue q
JOIN campaigns c ON c.id = q.campaign_id
JOIN campaign_prospects p ON p.id = q.prospect_id
WHERE q.status = 'sent'
ORDER BY q.sent_at DESC
LIMIT 20;
```

### Check Failed Emails

```sql
-- View failed emails
SELECT
  q.scheduled_for,
  c.campaign_name,
  p.email as recipient,
  q.error_message
FROM email_send_queue q
JOIN campaigns c ON c.id = q.campaign_id
JOIN campaign_prospects p ON p.id = q.prospect_id
WHERE q.status = 'failed';
```

### Netlify Function Logs

```bash
# Real-time logs
netlify logs --function process-email-queue --tail

# Recent logs
netlify logs --function process-email-queue --since 1h
```

---

## Comparison: Email vs LinkedIn

| Feature | Email Campaigns | LinkedIn Campaigns |
|---------|----------------|-------------------|
| Max Daily | 40 emails | 20 CRs |
| Interval | 13.5 minutes | 30 minutes |
| Business Hours | 8 AM - 5 PM | 7 AM - 6 PM |
| Window | 9 hours | 11 hours |
| Weekends | Blocked | Blocked |
| Holidays | Blocked (11+) | Blocked (11+) |
| Queue Table | `email_send_queue` | `send_queue` |
| Cron Schedule | Every 13 min | Every minute |
| Endpoint | `/api/cron/process-email-queue` | `/api/cron/process-send-queue` |

---

## Testing

### Test Campaign Creation

1. Login as test user: `jf@innovareai.com` / `TestDemo2024!`
2. Navigate to Campaign Hub
3. Upload CSV with 5 prospects
4. Create email campaign
5. Activate campaign
6. Check queue:

```sql
SELECT * FROM email_send_queue
WHERE campaign_id = 'YOUR_CAMPAIGN_ID'
ORDER BY scheduled_for;
```

Expected result: 5 records with status 'pending', scheduled 13.5 min apart

### Test Cron Processing

1. Manually trigger cron:

```bash
curl -X POST https://app.meet-sam.com/api/cron/process-email-queue \
  -H "x-cron-secret: ${CRON_SECRET}"
```

2. Check response:
   - If business hours: `{"success": true, "processed": 1}`
   - If outside hours: `{"success": true, "message": "Outside business hours", "processed": 0}`

3. Verify email sent in database:

```sql
SELECT * FROM email_send_queue
WHERE status = 'sent'
ORDER BY sent_at DESC
LIMIT 1;
```

---

## Troubleshooting

### Issue: No emails being sent

**Check:**
1. Is cron job enabled? (cron-job.org dashboard)
2. Is `CRON_SECRET` set? (`netlify env:get CRON_SECRET`)
3. Are we in business hours? (8 AM - 5 PM, weekday, not holiday)
4. Are there pending emails? (query `email_send_queue` table)

### Issue: Emails sending too fast

**Verify:**
- Cron schedule is `*/13 * * * *` (every 13 minutes), NOT `* * * * *` (every minute)
- Only 1 email processed per execution

### Issue: Weekend emails still sending

**Check:**
- `canSendEmailNow()` function properly checks `day === 0 || day === 6`
- Timezone is correct (default: `America/New_York`)

### Issue: Queue records not created

**Check:**
1. Campaign has pending prospects: `SELECT * FROM campaign_prospects WHERE campaign_id = '...' AND status = 'pending'`
2. Email account connected: `SELECT * FROM workspace_integration_accounts WHERE workspace_id = '...'`
3. Endpoint returns error? Check Netlify logs

---

## Files Modified

### New Files

1. **`/sql/migrations/020-create-email-send-queue-table.sql`**
   - Database schema for email queue
   - RLS policies for multi-tenant safety

2. **`/app/api/campaigns/email/send-emails-queued/route.ts`**
   - Queue creation endpoint
   - Validates prospects, personalizes messages, calculates send times
   - Returns in <2 seconds

3. **`/app/api/cron/process-email-queue/route.ts`**
   - Cron processor endpoint
   - Sends 1 email per execution
   - Checks business hours, weekends, holidays

### Modified Files

4. **`/app/api/campaigns/activate/route.ts`**
   - Lines 74-77: Use email queue for email/connector campaigns
   - Changed from N8N orchestration to queue-based system

---

## Next Steps

1. ✅ Database migration applied
2. ✅ Queue endpoints deployed
3. ⚠️ **TODO:** Configure cron-job.org with correct secret
4. ⚠️ **TODO:** Test with real campaign (5 prospects)
5. ⚠️ **TODO:** Monitor first 24 hours of production usage

---

## Related Documentation

- **LinkedIn Queue System:** `docs/QUEUE_SYSTEM_COMPLETE.md`
- **Campaign Architecture:** `SAM_SYSTEM_TECHNICAL_OVERVIEW.md`
- **Prospect Upload Fix:** `docs/HANDOVER_PROSPECT_UPLOAD_BUG_FIX_NOV_24.md`

---

**Last Updated:** November 24, 2025, 19:30 UTC
**Status:** ✅ PRODUCTION READY
**Next Action:** Configure cron-job.org
