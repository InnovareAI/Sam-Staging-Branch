# Queue System - Quick Start (5 Minutes)

## TL;DR

✅ Code is deployed. Two quick tasks:

### Task 1: Create Database Table (3 min)

Go to: https://app.supabase.com/project/latxadqrvrrrcvkktrog/sql/new

Copy entire content of: `sql/migrations/011-create-send-queue-table.sql`

Paste → Click "Run"

Done! ✅

### Task 2: Set Up Cron Job (2 min)

Go to: Netlify dashboard

Click "Create Cronjob"

Fill in:
- Title: `SAM - Process Send Queue`
- URL: `https://app.meet-sam.com/api/cron/process-send-queue`
- Method: `POST`
- Schedule: `* * * * *`

Click "HTTP Headers" → Add header:
- Name: `x-cron-secret`
- Value: `792e0c09eeee1a229b78a6341739613177fad24f401b1c82f2673bbb9ee806a0`

Click "Save" → Done! ✅

---

## Test It (5 minutes)

### 1. Create Campaign
https://app.meet-sam.com/workspace/[id]/campaign-hub → New Campaign → Add 5 prospects → Save

### 2. Approve Prospects
Data Approval → Select all → Approve

### 3. Queue Campaign
```bash
curl -X POST https://app.meet-sam.com/api/campaigns/direct/send-connection-requests-queued \
  -H "Content-Type: application/json" \
  -d '{"campaignId": "PASTE_CAMPAIGN_ID_HERE"}'
```

### 4. Monitor
```bash
# Live logs
netlify logs --function process-send-queue --tail

# Queue status (Supabase SQL):
SELECT status, COUNT(*) FROM send_queue
WHERE campaign_id = 'PASTE_CAMPAIGN_ID_HERE'
GROUP BY status;
```

### 5. Verify
Check LinkedIn → My Network → Invitations sent
You should see connection requests appearing (1 every 30 min)

---

## What You Get

| Feature | What it does |
|---------|-------------|
| **Queue Creation** | Validates prospects, creates queue records, returns in 2 seconds |
| **Cron Processing** | Sends 1 CR per minute (respects 30-min spacing) |
| **Weekend Skip** | Automatically skips Sat/Sun, moves to Monday |
| **Holiday Skip** | Skips 11+ US holidays (Thanksgiving, Christmas, etc.) |
| **Error Tracking** | Failed messages logged with reasons (no spam/auto-retry) |

---

## System Behavior

**Friday 3:00 PM - Queue 5 prospects:**
```
3:00 PM Fri → CR 1 sent ✅
3:30 PM Fri → CR 2 sent ✅
4:00 PM Fri → CR 3 sent ✅
4:30 PM Fri → CR 4 sent ✅
5:00 PM Fri (→ Sat) → Skipped (weekend)
              ↓
9:00 AM Mon → CR 5 sent ✅ (waits until Monday)
```

**Rate:** 20 CRs per 10 hours (never exceeds LinkedIn's 20/day limit)

---

## Monitoring Commands

```bash
# Real-time cron logs
netlify logs --function process-send-queue --tail

# Check queue status
# Supabase: SELECT * FROM send_queue ORDER BY scheduled_for;

# Check Netlify scheduled functions
# Netlify dashboard → Click job → Execution log

# Check LinkedIn
# LinkedIn → My Network → Invitations sent
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Unauthorized" in logs | x-cron-secret doesn't match. Update Netlify scheduled functions header |
| No messages sending | Cron job might be disabled. Check Netlify dashboard status |
| Messages stuck pending | Check if it's weekend/holiday. Message will send next business day |
| Database error | Execute the SQL table creation (Step 1 above) |

---

## Documentation Files

- **Full Details:** `docs/IMPLEMENTATION_COMPLETE.md`
- **Testing Guide:** `docs/QUEUE_TESTING_SETUP.md`
- **System Overview:** `docs/QUEUE_SYSTEM_COMPLETE.md`

---

**Total setup time: 10 minutes**
**Ready to test: Immediately after**

Go! 🚀
