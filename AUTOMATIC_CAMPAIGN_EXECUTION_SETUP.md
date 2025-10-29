# Automatic Campaign Execution Setup

## Problem
Netlify scheduled functions are NOT running automatically. Connection requests only work when triggered manually.

## Solution: External Cron Service

Use a free service to automatically call your API every 2 minutes.

### Option 1: cron-job.org (Recommended - FREE)

1. Go to: https://cron-job.org/en/
2. Sign up for free account
3. Create new cron job:
   - **Title:** SAM Campaign Execution
   - **URL:** `https://app.meet-sam.com/api/cron/process-pending-prospects`
   - **Method:** POST
   - **Schedule:** Every 2 minutes (`*/2 * * * *`)
   - **Headers:** Add header:
     - Name: `Content-Type`
     - Value: `application/json`
4. Save and enable

### Option 2: EasyCron (FREE tier)

1. Go to: https://www.easycron.com
2. Sign up for free (80 executions/day = 40 prospects/day at 2 per execution)
3. Add cron job:
   - **URL:** `https://app.meet-sam.com/api/cron/process-pending-prospects`
   - **Cron Expression:** `*/2 * * * *` (every 2 minutes)
   - **Request Method:** POST

### Option 3: UptimeRobot (FREE)

1. Go to: https://uptimerobot.com
2. Sign up for free
3. Add new monitor:
   - **Monitor Type:** HTTP(s)
   - **URL:** `https://app.meet-sam.com/api/cron/process-pending-prospects`
   - **Monitoring Interval:** 5 minutes (free tier limit)

### What Happens

Once configured, the cron service will:
- Call your API every 2 minutes
- Process 3 prospects per run
- Send connection requests automatically
- No manual triggering needed

### Test It's Working

After setup, check:
```bash
node scripts/js/check-campaign-status.mjs
```

Status should change from `pending` to `connection_requested` automatically.

### Monitoring

Check cron service dashboard to see:
- Last execution time
- Response status (should be 200)
- Any errors

---

**Current Status:**
- 8 pending prospects
- Will be sent in ~6 minutes (3 per run × 3 runs)
