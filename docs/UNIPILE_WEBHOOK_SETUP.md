# Unipile Webhook Configuration Guide

## Overview

This guide explains how to configure Unipile webhooks to enable real-time detection of accepted LinkedIn connection requests and received messages.

## Why Webhooks?

Without webhooks, the system must poll Unipile's API every few hours to check if connections were accepted. Webhooks provide **instant notifications** when:
- A LinkedIn connection request is accepted
- A prospect replies to a message
- Any other LinkedIn activity occurs

## Setup Steps

### 1. Access Unipile Dashboard

1. Go to https://dashboard.unipile.com (or your Unipile dashboard URL)
2. Log in with your Unipile credentials
3. Navigate to **Settings** → **Webhooks**

### 2. Create New Webhook

Click "Add Webhook" and configure:

**Webhook URL:**
```
https://app.meet-sam.com/api/webhooks/unipile
```

**Events to Subscribe:**
- ☑️ `USERS_WEBHOOK` - For connection acceptances (new_relation event)
- ☑️ `MESSAGING_WEBHOOK` - For new messages (new_message event)

**Description:** (Optional)
```
SAM AI - LinkedIn Connection & Message Tracking
```

### 3. Copy Webhook Secret

After creating the webhook, Unipile will provide a **webhook secret** (looks like a long random string).

**IMPORTANT:** Copy this secret immediately - you won't be able to see it again!

### 4. Add Secret to Environment Variables

Update your `.env` and `.env.local` files:

```bash
UNIPILE_WEBHOOK_SECRET=your_webhook_secret_from_unipile_dashboard
```

**For production (.env):**
1. Edit `.env` file
2. Replace `REPLACE_WITH_SECRET_FROM_UNIPILE_DASHBOARD` with your actual secret
3. Save the file

**For local development (.env.local):**
1. Edit `.env.local` file
2. Replace `REPLACE_WITH_SECRET_FROM_UNIPILE_DASHBOARD` with your actual secret
3. Save the file

### 5. Deploy Changes

**For Netlify:**
1. Go to Netlify dashboard → Site settings → Environment variables
2. Add new variable:
   - Key: `UNIPILE_WEBHOOK_SECRET`
   - Value: `your_webhook_secret_from_unipile_dashboard`
3. Trigger a new deploy

**Or commit and push:**
```bash
git add .env
git commit -m "Add Unipile webhook secret"
git push
```

### 6. Test the Webhook

#### Option A: Use Unipile Dashboard
1. In Unipile dashboard, find your webhook
2. Click "Test Webhook"
3. Send a test `new_relation` event
4. Check your application logs for: `📨 Received Unipile webhook event: USERS_WEBHOOK`

#### Option B: Manual Test
```bash
curl -X POST https://app.meet-sam.com/api/webhooks/unipile \
  -H "Content-Type: application/json" \
  -H "x-unipile-signature: test" \
  -d '{
    "event_type": "USERS_WEBHOOK",
    "type": "new_relation",
    "data": {
      "user": {
        "account_id": "test_account",
        "provider_id": "test_provider",
        "public_identifier": "test-user",
        "name": "Test User",
        "profile_url": "https://linkedin.com/in/test-user"
      }
    }
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Connection accepted for Test User",
  "updated_prospects": 0
}
```

## What Happens When a Connection is Accepted?

1. **LinkedIn User Accepts Connection** → Unipile detects it
2. **Unipile Sends Webhook** → POST to `/api/webhooks/unipile`
3. **Our System Receives Event** → Verifies signature, processes event
4. **Prospect Status Updated** → Changes from `connection_request_sent` to `connected`
5. **Follow-Up Scheduled** → Sets `follow_up_due_at` to 24 hours from now
6. **Cron Job Triggers** → After 24 hours, sends first follow-up message

## Backup Polling System

Even with webhooks configured, the system has a **backup polling mechanism** that runs 3-4 times per day to catch any missed events.

**Polling Cron:** `/api/cron/poll-accepted-connections`
- Runs every 6-8 hours with random delays
- Checks `network_distance` for all `connection_request_sent` prospects
- Updates status to `connected` if distance changed to `FIRST_DEGREE`

## Troubleshooting

### Webhook Not Receiving Events

**Check 1:** Verify webhook URL is correct
```bash
curl https://app.meet-sam.com/api/webhooks/unipile
```
Should return:
```json
{
  "name": "Unipile Webhook Handler",
  "endpoint": "/api/webhooks/unipile",
  "events": ["new_relation - Connection accepted", ...]
}
```

**Check 2:** Verify secret is configured
```bash
# In your application logs, you should see:
secret_configured: true
```

**Check 3:** Check Unipile webhook delivery logs
- Go to Unipile dashboard → Webhooks → Your webhook → Delivery logs
- Look for failed deliveries (status codes 401, 500, etc.)

### Signature Verification Failing

If you see `❌ Invalid webhook signature` in logs:

1. Verify the secret matches exactly (no extra spaces, newlines)
2. Check you're using the correct secret from Unipile dashboard
3. Try regenerating the webhook secret in Unipile dashboard

### Prospects Not Updating

If webhook receives events but prospects don't update:

**Check 1:** Verify prospect exists in database
```sql
SELECT * FROM campaign_prospects
WHERE linkedin_user_id = 'provider_id_from_webhook'
OR linkedin_url ILIKE '%public_identifier%';
```

**Check 2:** Verify prospect status is `connection_request_sent`
- Webhook only updates prospects with this status
- If status is `pending` or `failed`, webhook will skip it

**Check 3:** Check workspace isolation
- Webhook finds account by `unipile_account_id`
- Then filters prospects by `workspace_id`
- If account is in wrong workspace, prospects won't match

## Monitoring

### Application Logs

Watch for these log messages:

**Success:**
```
📨 Received Unipile webhook event: USERS_WEBHOOK
🤝 New LinkedIn connection accepted!
✅ Updating prospect abc123 to connected status
🎉 Updated 1 prospects to connected status
```

**Warnings:**
```
⚠️ No pending prospects found for John Doe (johndoe)
```
This is normal if prospect already connected or not in system.

**Errors:**
```
❌ Invalid webhook signature
❌ Account not found for Unipile ID: xyz
❌ Error processing new_relation: [error details]
```

### Database Queries

**Check recent webhook updates:**
```sql
SELECT
  first_name,
  last_name,
  status,
  connection_accepted_at,
  follow_up_due_at
FROM campaign_prospects
WHERE connection_accepted_at > NOW() - INTERVAL '24 hours'
ORDER BY connection_accepted_at DESC;
```

**Check prospects waiting for follow-up:**
```sql
SELECT
  first_name,
  last_name,
  status,
  connection_accepted_at,
  follow_up_due_at
FROM campaign_prospects
WHERE status = 'connected'
AND follow_up_due_at <= NOW()
ORDER BY follow_up_due_at ASC;
```

## Security

### Webhook Signature Verification

The webhook handler verifies that requests actually come from Unipile using HMAC-SHA256 signatures:

1. Unipile signs the payload with your webhook secret
2. Sends signature in `x-unipile-signature` header
3. Our handler recalculates signature and compares
4. Rejects requests with invalid signatures

**Why this matters:**
- Prevents attackers from sending fake events
- Ensures data integrity
- Protects against replay attacks

### Best Practices

1. **Never commit webhook secrets** to git (.env files are in .gitignore)
2. **Use environment variables** for all sensitive data
3. **Rotate secrets periodically** (every 3-6 months)
4. **Monitor for suspicious activity** (multiple failed signature verifications)

## Next Steps

After webhook is configured:

1. ✅ Webhooks are working
2. → Send test connection request to verify end-to-end flow
3. → Accept connection from test account
4. → Verify prospect status updates to `connected`
5. → Wait 24 hours and verify follow-up message is sent
6. → Monitor logs and database for any issues

## Support

If you encounter issues:

1. Check application logs for error messages
2. Check Unipile webhook delivery logs
3. Verify environment variables are set correctly
4. Test webhook endpoint manually with curl
5. Contact Unipile support if webhook events aren't being sent
