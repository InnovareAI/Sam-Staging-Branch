# Email Notification System - Deployment Guide

**Date**: October 6, 2025
**Status**: Ready for Deployment

---

## 🎯 Deployment Checklist

### ✅ **Step 1: Apply Database Migration**

**Location**: Supabase Dashboard → SQL Editor

**SQL to Execute**:
```sql
-- Add activity tracking columns to prospect_approval_sessions
ALTER TABLE prospect_approval_sessions
ADD COLUMN IF NOT EXISTS notification_scheduled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS user_last_active_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS reminder_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ;

-- Create index for efficient cron job queries
CREATE INDEX IF NOT EXISTS idx_approval_sessions_notification_pending
ON prospect_approval_sessions(notification_scheduled_at)
WHERE notification_scheduled_at IS NOT NULL
  AND notification_sent_at IS NULL;

-- Add documentation comments
COMMENT ON COLUMN prospect_approval_sessions.notification_scheduled_at IS
'Timestamp when email notification should be sent if user is still inactive';

COMMENT ON COLUMN prospect_approval_sessions.notification_sent_at IS
'Timestamp when email notification was actually sent (NULL if not sent yet)';

COMMENT ON COLUMN prospect_approval_sessions.user_last_active_at IS
'Last time user was active in the app (chat, page view, etc.) - used to cancel notifications if user returns';
```

**Verification**:
```sql
-- Check columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'prospect_approval_sessions'
  AND column_name IN (
    'notification_scheduled_at',
    'notification_sent_at',
    'user_last_active_at',
    'reminder_count',
    'last_reminder_sent_at'
  );

-- Check index was created
SELECT indexname
FROM pg_indexes
WHERE tablename = 'prospect_approval_sessions'
  AND indexname = 'idx_approval_sessions_notification_pending';
```

---

### ✅ **Step 2: Configure Netlify Scheduled Function**

**Method 1: Using netlify.toml** (Recommended)

Add to `netlify.toml`:
```toml
[[plugins]]
  package = "@netlify/plugin-functions-cron"

[[plugins.inputs.cron]]
  expression = "*/15 * * * *"  # Every 15 minutes
  function = "check-pending-notifications"
```

**Method 2: Using Netlify UI**

1. Go to Netlify Dashboard → Site Settings → Functions
2. Click "Add scheduled function"
3. **Function**: `/api/cron/check-pending-notifications`
4. **Schedule**: `*/15 * * * *` (every 15 minutes)
5. **Headers**: Add `Authorization: Bearer ${CRON_SECRET_TOKEN}`

**Environment Variables to Set**:
- `CRON_SECRET_TOKEN` → Generate a secure random token:
  ```bash
  openssl rand -base64 32
  ```

**Test the Cron Endpoint**:
```bash
# Replace YOUR_SECRET_TOKEN with actual token
curl -X GET https://app.meet-sam.com/api/cron/check-pending-notifications \
  -H "Authorization: Bearer YOUR_SECRET_TOKEN"
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Notification check complete",
  "results": {
    "sent": 0,
    "cancelled": 0,
    "failed": 0,
    "errors": [],
    "batchSize": 0
  }
}
```

---

### ✅ **Step 3: Configure Postmark Domain (innovareai.com)**

#### **Outbound Email Setup**

**1. SPF Record**
- **Type**: TXT
- **Host**: `@` or `innovareai.com`
- **Value**: `v=spf1 include:spf.mtasv.net ~all`

**2. DKIM Records** (Get from Postmark Dashboard)
- Go to Postmark → Sender Signatures → innovareai.com → DKIM
- Copy the DKIM hostname and value
- Add as TXT record in DNS

**3. Return-Path CNAME**
- **Type**: CNAME
- **Host**: `pm-bounces` or as specified by Postmark
- **Value**: `pm.mtasv.net`

#### **Inbound Email Setup** (For Reply Handling)

**1. MX Records**
- **Type**: MX
- **Priority**: 10
- **Host**: `@` or `innovareai.com`
- **Value**: `inbound.postmarkapp.com`

**2. Inbound Webhook**
- Go to Postmark → Servers → Your Server → Inbound
- Add webhook URL: `https://app.meet-sam.com/api/postmark/inbound`
- Enable JSON format

**3. Email Forwarding Rules**
- `sam@innovareai.com` → Postmark inbound webhook
- `sam+approval-*@innovareai.com` → Postmark inbound webhook
- `sam+reply-*@innovareai.com` → Postmark inbound webhook

**Verification**:
```bash
# Test SPF
dig TXT innovareai.com | grep spf

# Test DKIM
dig TXT [dkim-hostname-from-postmark]

# Test MX
dig MX innovareai.com
```

---

### ✅ **Step 4: Configure Postmark Domain (3cubed.ai)** (Optional)

Repeat Step 3 for `3cubed.ai` domain if multi-company support is needed.

---

### ✅ **Step 5: Verify Environment Variables**

**Required Variables in Netlify**:
```bash
POSTMARK_INNOVAREAI_API_KEY=<your-postmark-api-key>
CRON_SECRET_TOKEN=<generated-secret-token>
NEXT_PUBLIC_APP_URL=https://app.meet-sam.com
NEXT_PUBLIC_SUPABASE_URL=https://latxadqrvrrrcvkktrog.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

**Check in Netlify**:
1. Site Settings → Environment Variables
2. Verify all keys are set for Production scope

---

## 🧪 Testing After Deployment

### **Test 1: Delayed Notification Flow**

1. **Create approval session**:
   - Upload CSV with prospects
   - Verify session created in `prospect_approval_sessions`
   - Check `notification_scheduled_at` is ~2-3 hours in future

2. **Wait for scheduled time** (or manually update in DB):
   ```sql
   -- Fast-track for testing
   UPDATE prospect_approval_sessions
   SET notification_scheduled_at = NOW() - INTERVAL '1 minute'
   WHERE id = 'YOUR_SESSION_ID';
   ```

3. **Wait for next cron run** (max 15 minutes)
   - Check logs in Netlify Functions
   - Verify email received

4. **Check database**:
   ```sql
   SELECT
     notification_scheduled_at,
     notification_sent_at,
     reminder_count,
     last_reminder_sent_at
   FROM prospect_approval_sessions
   WHERE id = 'YOUR_SESSION_ID';
   ```

---

### **Test 2: Activity Tracking Cancellation**

1. **Create session** (as above)
2. **Before scheduled time**, chat with SAM:
   - Send any message in SAM chat
   - Verify `user_last_active_at` updated
3. **Wait for cron**:
   - Email should NOT be sent (user active)
   - Check logs for skip message

---

### **Test 3: Persistent Reminders**

1. **Create session and receive first email**
2. **Do NOT act on email**
3. **Wait until next morning (9-11 AM)**:
   - Morning reminder sent
   - `reminder_count = 2`
4. **Wait until evening (6-8 PM)**:
   - Evening reminder sent
   - `reminder_count = 3`

---

### **Test 4: Randomization Verification**

1. **Create 10+ sessions simultaneously**
2. **Check scheduled times**:
   ```sql
   SELECT
     id,
     notification_scheduled_at,
     EXTRACT(MINUTE FROM notification_scheduled_at) as scheduled_minute
   FROM prospect_approval_sessions
   WHERE notification_scheduled_at > NOW()
   ORDER BY notification_scheduled_at;
   ```
3. **Verify**: Times are distributed across 2-3 hour window (not all same minute)

---

## 📊 Monitoring

### **Key Metrics to Watch**

1. **Cron Job Performance**:
   - Netlify Functions → Logs
   - Filter by function: `check-pending-notifications`
   - Watch for execution time (should be < 5 seconds)

2. **Email Delivery**:
   - Postmark Dashboard → Activity
   - Monitor bounce rate (< 2%)
   - Monitor spam complaints (< 0.1%)

3. **Database Queries**:
   - Supabase Dashboard → Performance
   - Watch `prospect_approval_sessions` query times
   - Should be < 10ms with index

4. **Backlog Size**:
   ```sql
   SELECT COUNT(*) as pending_notifications
   FROM prospect_approval_sessions
   WHERE notification_scheduled_at IS NOT NULL
     AND notification_sent_at IS NULL
     AND notification_scheduled_at <= NOW();
   ```
   - Alert if > 500 pending

---

## 🚨 Troubleshooting

### **Emails Not Sending**

1. **Check cron job logs**:
   - Netlify Functions → Logs
   - Look for errors or authorization failures

2. **Verify Postmark API key**:
   ```bash
   curl "https://api.postmarkapp.com/server" \
     -H "X-Postmark-Server-Token: YOUR_API_KEY"
   ```

3. **Check database**:
   ```sql
   -- Sessions that should have sent emails
   SELECT * FROM prospect_approval_sessions
   WHERE notification_scheduled_at <= NOW()
     AND notification_sent_at IS NULL
     AND status = 'active';
   ```

---

### **Cron Job Timing Out**

1. **Check batch size**:
   - Default is 100 sessions/run
   - If timing out, reduce to 50 in `route.ts`

2. **Check Postmark response time**:
   - Postmark Dashboard → Performance
   - Should be < 200ms per email

---

### **Duplicate Emails**

1. **Check reminder_count**:
   ```sql
   SELECT id, reminder_count, last_reminder_sent_at
   FROM prospect_approval_sessions
   WHERE notification_sent_at IS NOT NULL
   ORDER BY last_reminder_sent_at DESC;
   ```

2. **Verify cron not running multiple times**:
   - Netlify Dashboard → Scheduled Functions
   - Should show only one schedule

---

## ✅ Post-Deployment Checklist

- [ ] Database migration applied successfully
- [ ] Netlify cron configured and running every 15 min
- [ ] `CRON_SECRET_TOKEN` environment variable set
- [ ] Postmark DNS records configured (SPF, DKIM, MX)
- [ ] Postmark inbound webhook configured
- [ ] Test email sent and received
- [ ] Activity tracking verified (cancels notifications)
- [ ] Persistent reminders working (morning/evening)
- [ ] Randomization confirmed (emails not all same time)
- [ ] Monitoring dashboard set up
- [ ] Team notified of new email system

---

**Deployment Time Estimate**: 30-45 minutes
**Recommended Deployment Window**: Off-peak hours (low user activity)
**Rollback Plan**: Remove cron job from Netlify, system continues working without notifications

---

**Last Updated**: October 6, 2025
**System Status**: Code Complete, Pending Deployment Configuration
