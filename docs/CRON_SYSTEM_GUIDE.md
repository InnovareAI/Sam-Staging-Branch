# CRON System Guide

**Status:** ✅ DOCUMENTED (Nov 22, 2025)
**Current Setup:** Netlify Functions + cron-job.org
**Active Jobs:** 3 critical + 5 optional

---

## Overview

The system uses **cron jobs** (scheduled tasks) to automate:
1. Sending connection requests
2. Detecting connection acceptance
3. Sending follow-up messages
4. Processing pending prospects

**Current Infrastructure:**
- Netlify Functions (serverless endpoints)
- cron-job.org (external scheduler)
- Security: `x-cron-secret` header validation

---

## Critical Cron Jobs (For Campaigns)

### 1. Send Connection Requests ❌ NOT AUTOMATED
**Endpoint:** `/api/campaigns/direct/send-connection-requests`
**Schedule:** Manual (user clicks "Start Campaign")
**Frequency:** One-time per campaign
**Security:** None (called from UI)

**What it does:**
```
1. User clicks "Start Campaign"
2. Frontend calls POST /api/campaigns/direct/send-connection-requests
3. Endpoint fetches pending prospects
4. Sends CR to each via Unipile API
5. Updates database: status = 'connection_request_sent'
6. Schedules first follow-up (3 days later)
```

**No cron needed** - triggered by user action

---

### 2. Detect Connection Acceptance
**Primary Method:** Webhook
**Endpoint:** `/api/webhooks/unipile-connection-accepted`
**Trigger:** LinkedIn user accepts CR (Unipile sends webhook)
**Latency:** Up to 8 hours

**Backup Method:** Polling
**Endpoint:** `/api/cron/check-relations`
**Schedule:** 1-2 times per day
**Security:** `x-cron-secret` header required

**What it does:**
```
1. Fetch prospects with status = 'connection_request_sent'
2. Call Unipile /api/v1/users/relations
3. Check if prospect appears in accepted relations
4. If accepted:
   - Update status = 'connected'
   - Set follow_up_due_at = NOW + 24 hours
   - Set follow_up_sequence_index = 0
```

**Setup:**
```bash
# Service: cron-job.org
# URL: https://app.meet-sam.com/api/cron/check-relations
# Schedule: 0 9 * * * (9 AM UTC daily) AND 0 21 * * * (9 PM UTC daily)
# Headers: x-cron-secret: ${CRON_SECRET}
```

---

### 3. Send Follow-Up Messages ⭐ CRITICAL
**Endpoint:** `/api/campaigns/direct/process-follow-ups`
**Schedule:** Every hour (60 times per day)
**Security:** `x-cron-secret` header required
**Frequency:** Continuous while campaign is running

**What it does:**
```
1. Fetch prospects with follow_up_due_at <= NOW
2. For each prospect:
   a. Check if connection accepted
   b. Get next follow-up message from templates
   c. Personalize with {first_name}, {company}, etc.
   d. Send via Unipile /api/v1/chats/{id}/messages
   e. Update follow_up_sequence_index
   f. Schedule next follow-up (5, 7, 5, or 7 days)
3. Return summary (sent, pending, failed)
```

**Setup:**
```bash
# Service: cron-job.org
# URL: https://app.meet-sam.com/api/campaigns/direct/process-follow-ups
# Schedule: 0 * * * * (every hour, on the hour)
# Headers: x-cron-secret: ${CRON_SECRET}
```

---

## Optional Cron Jobs (Legacy/Special)

### 4. Poll Accepted Connections (DEPRECATED)
**Endpoint:** `/api/cron/poll-accepted-connections`
**Schedule:** Not recommended
**Status:** Kept for reference only
**Reason:** Replaced by webhook + check-relations

---

### 5. Execute Scheduled Campaigns
**Endpoint:** `/api/cron/execute-scheduled-campaigns`
**Schedule:** Every 5 minutes
**Purpose:** Auto-start campaigns with scheduled start times

---

### 6. Process Pending Prospects
**Endpoint:** `/api/cron/process-pending-prospects`
**Schedule:** Hourly
**Purpose:** Legacy prospect processing

---

### 7. Process Outbox
**Endpoint:** `/api/cron/process-outbox`
**Schedule:** Hourly
**Purpose:** Process message queue

---

### 8. GDPR Cleanup
**Endpoint:** `/api/cron/gdpr-cleanup`
**Schedule:** Daily
**Purpose:** Delete expired user data

---

### 9. Check Pending Notifications
**Endpoint:** `/api/cron/check-pending-notifications`
**Schedule:** Every 5 minutes
**Purpose:** Process notification queue

---

## Setup Instructions

### Prerequisite: Environment Variable

```bash
# Set cron secret (must match in all requests)
netlify env:set CRON_SECRET "your-secret-token-here"
```

**Generate a good secret:**
```bash
openssl rand -base64 32
# Output: abc123def456xyz789... (copy this)
```

---

### Option 1: cron-job.org (RECOMMENDED)

**Why recommended:**
- ✅ Free tier (100 jobs)
- ✅ Easy to set up
- ✅ External scheduler (no dependency on Netlify)
- ✅ Can monitor execution history
- ✅ Custom headers support

**Steps:**

1. **Create account:** https://cron-job.org

2. **Create Job 1: Check Relations (Acceptance Detection)**
   ```
   Name: SAM - Check Relations (Acceptance Detection)
   URL: https://app.meet-sam.com/api/cron/check-relations
   Schedule: 0 9 * * * (9 AM UTC) AND 0 21 * * * (9 PM UTC)
   HTTP Method: POST
   Headers:
     x-cron-secret: <your-secret>
     Content-Type: application/json
   ```

3. **Create Job 2: Process Follow-Ups (CRITICAL)**
   ```
   Name: SAM - Process Follow-Ups
   URL: https://app.meet-sam.com/api/campaigns/direct/process-follow-ups
   Schedule: 0 * * * * (every hour)
   HTTP Method: POST
   Headers:
     x-cron-secret: <your-secret>
     Content-Type: application/json
   ```

4. **Optional Job 3: Execute Scheduled Campaigns**
   ```
   Name: SAM - Execute Scheduled Campaigns
   URL: https://app.meet-sam.com/api/cron/execute-scheduled-campaigns
   Schedule: */5 * * * * (every 5 minutes)
   HTTP Method: POST
   Headers:
     x-cron-secret: <your-secret>
   ```

---

### Option 2: AWS EventBridge (MORE RELIABLE)

For production, use AWS Lambda + EventBridge:

```bash
# Create Lambda function that calls the endpoint
# Create EventBridge rule with cron expression
# Set retry policy and DLQ
```

---

### Option 3: Netlify Scheduled Functions (FUTURE)

Netlify has native scheduled functions, but setup is more complex.

---

## Cron Job Security

### Current Implementation

```typescript
// Every endpoint checks this
const cronSecret = req.headers.get('x-cron-secret');
if (cronSecret !== process.env.CRON_SECRET) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### Security Best Practices

1. **Use strong secret**
   ```bash
   openssl rand -base64 32
   ```

2. **Store in environment**
   ```bash
   netlify env:set CRON_SECRET "your-secret"
   ```

3. **Don't expose in logs**
   - ✅ cron-job.org stores it securely
   - ❌ Don't hardcode in code
   - ❌ Don't commit to git

4. **Use HTTPS only**
   - ✅ All endpoints are HTTPS
   - ✅ cron-job.org sends POST only

5. **Rotate secret periodically**
   - Change every 3-6 months
   - Update all cron jobs simultaneously

---

## Execution Flow

### Hour-by-Hour Example

```
TIME    | ACTION
--------|------------------------------------------
9:00 AM | Check Relations (acceptance detection)
        | - Fetch prospects in 'connection_request_sent'
        | - Call Unipile /users/relations
        | - Update any accepted to 'connected'
        |
9:00 AM | (If webhook already fired, skip)
        |
10:00 AM| Process Follow-Ups (hourly)
        | - Find prospects with follow_up_due_at <= NOW
        | - Send FU1, FU2, FU3, or FU4
        | - Schedule next follow-up
        |
11:00 AM| Process Follow-Ups (hourly)
12:00 PM| Process Follow-Ups (hourly)
...
9:00 PM | Check Relations (acceptance detection)
...
```

---

## Monitoring & Logs

### cron-job.org Dashboard

1. Go to https://cron-job.org
2. Click "Cronjobs"
3. See execution history for each job
4. Check for failures and retries

### Netlify Logs

```bash
# View function logs
netlify logs --function process-follow-ups

# Watch in real-time
netlify logs --function process-follow-ups --tail
```

### Application Logs

Each endpoint logs detailed information:

```typescript
console.log('🕐 Processing follow-ups...');
console.log(`📊 Found ${prospects.length} prospects`);
console.log(`✅ Sent: ${sentCount}`);
console.log(`⏸️  Pending: ${pendingCount}`);
```

---

## Troubleshooting

### Job Not Running

**Check 1: cron-job.org Status**
- Log in to cron-job.org
- Check if job is "enabled"
- Check last execution time
- Look for error messages

**Check 2: CRON_SECRET Mismatch**
```bash
# Verify secret is set
netlify env:list | grep CRON_SECRET

# If not set, set it
netlify env:set CRON_SECRET "your-secret"

# Redeploy
netlify deploy --prod
```

**Check 3: Endpoint Returning 401**
```bash
curl -X POST https://app.meet-sam.com/api/cron/check-relations \
  -H "x-cron-secret: wrong-secret"
# Should return: {"error": "Unauthorized"}
```

**Check 4: Netlify Function Not Responding**
```bash
# Test endpoint directly
curl https://app.meet-sam.com/api/cron/check-relations
# Should return 401 (auth required) or 200 (with valid secret)
```

---

## Current Production Status

### ✅ Implemented
- Webhook for connection acceptance
- `/api/cron/check-relations` - Backup acceptance detection
- `/api/campaigns/direct/process-follow-ups` - Follow-up sending
- Security: `x-cron-secret` validation

### ⏳ TODO
- [ ] Set up cron-job.org account
- [ ] Create 2 cron jobs (check-relations, process-follow-ups)
- [ ] Test with real campaign
- [ ] Monitor for 1 week
- [ ] Set up alerts for failures

### Estimated Setup Time
- Creating cron-job.org account: 5 minutes
- Creating 2 jobs: 10 minutes
- Testing: 15 minutes
- **Total: 30 minutes**

---

## Test Commands

### Test Check Relations Endpoint

```bash
curl -X POST https://app.meet-sam.com/api/cron/check-relations \
  -H "x-cron-secret: ${CRON_SECRET}" \
  -H "Content-Type: application/json"
```

**Expected response:**
```json
{
  "success": true,
  "checked": 5,
  "accepted": 2,
  "still_pending": 3,
  "errors": []
}
```

### Test Process Follow-Ups Endpoint

```bash
curl -X POST https://app.meet-sam.com/api/campaigns/direct/process-follow-ups \
  -H "x-cron-secret: ${CRON_SECRET}" \
  -H "Content-Type: application/json"
```

**Expected response:**
```json
{
  "success": true,
  "processed": 10,
  "sent": 3,
  "pending": 5,
  "completed": 2,
  "failed": 0,
  "results": [...]
}
```

---

## Summary

**For campaigns to work, you need:**

1. ✅ **Webhook Handler** (already implemented)
   - `/api/webhooks/unipile-connection-accepted`
   - Receives events from Unipile automatically

2. ⏳ **Backup Acceptance Check** (needs cron job setup)
   - `/api/cron/check-relations`
   - Schedule: 1-2x daily via cron-job.org
   - Prevents acceptances from being missed

3. ⏳ **Follow-Up Sender** (needs cron job setup)
   - `/api/campaigns/direct/process-follow-ups`
   - Schedule: Every hour via cron-job.org
   - Sends messages on schedule

**Next step:** Set up cron-job.org with 2 jobs (30 minutes total)

---

**Last Updated:** November 22, 2025
**Status:** Architecture & Setup Documentation
**Next:** Implement cron jobs when ready
