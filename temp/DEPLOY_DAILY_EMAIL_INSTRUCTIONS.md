# Daily Email Health Report - Deployment Instructions

## Overview
This sets up a daily email report sent at 7:00 AM UTC with the status of all health checks.

**Email will be sent EVERY DAY** regardless of status (green, yellow, or red).

---

## Step 1: Deploy Edge Function

### Option A: Using Supabase CLI (Recommended)

```bash
# Install Supabase CLI if needed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the Edge Function
supabase functions deploy send-daily-health-report

# Set environment variables
supabase secrets set POSTMARK_SERVER_TOKEN=your_postmark_token
supabase secrets set ALERT_EMAIL=tl@innovareai.com
```

### Option B: Manual Deployment via Dashboard

1. Go to Supabase Dashboard → Edge Functions
2. Click "New Function"
3. Name: `send-daily-health-report`
4. Copy contents from `supabase/functions/send-daily-health-report/index.ts`
5. Click "Deploy"
6. Go to Settings → Environment Variables:
   - Add `POSTMARK_SERVER_TOKEN` = your Postmark server token
   - Add `ALERT_EMAIL` = tl@innovareai.com

---

## Step 2: Get Your Edge Function URL

After deploying, your Edge Function URL will be:

```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-daily-health-report
```

**Find YOUR_PROJECT_REF:**
- Go to Supabase Dashboard → Settings → API
- Look at "Project URL" - it will be like: `https://abcdefgh.supabase.co`
- Your project ref is the part before `.supabase.co` (e.g., `abcdefgh`)

---

## Step 3: Update the SQL Migration

Edit `supabase/migrations/20251109_add_daily_email_cron.sql`:

**Line 20:** Replace `YOUR_PROJECT_REF` with your actual project reference:

```sql
v_function_url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-daily-health-report';
```

Example:
```sql
v_function_url := 'https://latxadqrvrrrcvkktrog.supabase.co/functions/v1/send-daily-health-report';
```

---

## Step 4: Enable http Extension in Supabase

The cron job needs to call the Edge Function via HTTP. Enable the extension:

**Run in Supabase SQL Editor:**

```sql
CREATE EXTENSION IF NOT EXISTS http;
```

---

## Step 5: Deploy the Cron Job

**Run in Supabase SQL Editor:**

Copy and paste the entire contents of:
`supabase/migrations/20251109_add_daily_email_cron.sql`

(After updating YOUR_PROJECT_REF)

---

## Step 6: Test Immediately

**Test the Edge Function directly:**

```bash
curl -X POST \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-daily-health-report \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Or test via SQL:**

```sql
SELECT send_daily_health_report_email();
```

**Check your email** - you should receive a health report!

---

## Verification

After deploying everything:

**Check cron jobs are scheduled:**
```sql
SELECT * FROM cron.job ORDER BY schedule;
```

You should see 5 jobs:
1. `daily-rls-verification` - 6:00 AM
2. `daily-orphaned-data-check` - 6:15 AM
3. `daily-workspace-health-check` - 6:30 AM
4. `daily-integration-health-check` - 6:45 AM
5. `daily-email-report` - 7:00 AM

**Check recent logs:**
```sql
SELECT * FROM get_recent_cron_results(1);
```

---

## Email Configuration

**Default settings:**
- **From:** sam-health@innovareai.com
- **To:** tl@innovareai.com (configurable via ALERT_EMAIL env var)
- **Schedule:** Daily at 7:00 AM UTC
- **Content:** HTML + Plain Text versions

**To change recipient email:**
```bash
supabase secrets set ALERT_EMAIL=new-email@example.com
```

---

## Troubleshooting

### Email not received?

1. **Check Edge Function logs:**
   - Supabase Dashboard → Edge Functions → send-daily-health-report → Logs

2. **Check cron job logs:**
   ```sql
   SELECT * FROM cron_job_logs WHERE job_name = 'send_daily_email_report' ORDER BY created_at DESC LIMIT 5;
   ```

3. **Verify Postmark token:**
   ```bash
   supabase secrets list
   ```

4. **Test Postmark directly:**
   ```bash
   curl "https://api.postmarkapp.com/email" \
     -X POST \
     -H "Accept: application/json" \
     -H "Content-Type: application/json" \
     -H "X-Postmark-Server-Token: YOUR_TOKEN" \
     -d '{
       "From": "sam-health@innovareai.com",
       "To": "tl@innovareai.com",
       "Subject": "Test",
       "TextBody": "Test email"
     }'
   ```

### http extension error?

Run this to enable the http extension:
```sql
CREATE EXTENSION IF NOT EXISTS http;
```

### Function URL wrong?

Make sure you replaced `YOUR_PROJECT_REF` with your actual Supabase project reference.

---

## What You'll Receive Daily

Every day at 7:00 AM UTC, you'll get an email like:

```
Subject: ✅ SAM Daily Health Report - Nov 9, 2025

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OVERALL STATUS: ✅ HEALTHY

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ RLS Policy Verification
   Last run: Nov 9, 2025, 6:00 AM UTC
   Issues: 0

✅ Orphaned Data Check
   Last run: Nov 9, 2025, 6:15 AM UTC
   Orphaned campaigns: 0
   Orphaned prospects: 0

✅ Workspace Health
   Last run: Nov 9, 2025, 6:30 AM UTC
   Workspaces without owners: 0

✅ Integration Health
   Last run: Nov 9, 2025, 6:45 AM UTC
   Active accounts: 24
```

If there are warnings or errors, the email status will change to ⚠️ or 🔴.

---

## Done! 🎉

Once deployed, you'll receive a daily email report at 7 AM UTC every day, showing the health of your SAM system.
