# Postmark Inbound Email Setup for SAM AI

## Overview
This guide walks through setting up inbound email processing for SAM AI using Postmark, allowing SAM to receive and process replies from prospects.

---

## Step 1: Deploy Database Migration

Run the email_responses table migration:

```bash
PGPASSWORD="Innovareeai2024!!" psql \
  -h aws-0-us-west-1.pooler.supabase.com \
  -p 6543 \
  -U postgres.latxadqrvrrrcvkktrog \
  -d postgres \
  -f supabase/migrations/20251007000001_create_email_responses.sql
```

Verify the table was created:
```bash
PGPASSWORD="Innovareeai2024!!" psql \
  -h aws-0-us-west-1.pooler.supabase.com \
  -p 6543 \
  -U postgres.latxadqrvrrrcvkktrog \
  -d postgres \
  -c "\d email_responses"
```

---

## Step 2: Postmark Dashboard Configuration (InnovareAI)

### A. Access Postmark Dashboard
1. Go to https://account.postmarkapp.com/
2. Select your **InnovareAI Server**

### B. Set Up Inbound Domain
1. Click **Inbound** in the left sidebar
2. Click **Add Inbound Domain**
3. Enter domain: `sam.innovareai.com`
4. Click **Add Domain**

### C. Configure MX Records
Postmark will display MX records like:
```
Priority: 10
Hostname: inbound.postmarkapp.com
```

**Add these MX records to your DNS provider (GoDaddy/Cloudflare/etc.):**

For subdomain `sam.innovareai.com`:
- **Type**: MX
- **Name**: `sam` (subdomain only)
- **Priority**: 10
- **Value**: `inbound.postmarkapp.com`

**IMPORTANT**: Use `sam` as the name/host, NOT the full `sam.innovareai.com`

**DNS Propagation**: Wait 5-15 minutes for DNS changes to propagate.

### D. Verify Domain
1. Back in Postmark dashboard, click **Verify MX Records**
2. Wait for green checkmark ✓

### E. Set Up Webhook
1. Still in Postmark Inbound settings
2. Find **Webhook URL** field
3. Enter: `https://app.meet-sam.com/api/webhooks/postmark-inbound`
4. **Authentication**: Leave blank (we'll validate via Postmark headers)
5. Click **Save**

### F. Test Inbound Email
Postmark will show a test email address like:
```
test-123456@inbound.postmarkapp.com
```

Send a test email to this address and check if webhook receives it.

---

## Step 3: Test the Webhook

### Test 1: Send test email via Postmark
```bash
curl -X POST https://app.meet-sam.com/api/webhooks/postmark-inbound \
  -H "Content-Type: application/json" \
  -d '{
    "From": "test@example.com",
    "FromName": "Test User",
    "FromFull": {
      "Email": "test@example.com",
      "Name": "Test User"
    },
    "To": "hello@sam.innovareai.com",
    "Subject": "Test Reply",
    "TextBody": "This is a test reply to a campaign",
    "HtmlBody": "<p>This is a test reply to a campaign</p>",
    "MessageID": "test-message-123",
    "Date": "2025-01-07T00:00:00Z"
  }'
```

### Test 2: Check database
```bash
PGPASSWORD="Innovareeai2024!!" psql \
  -h aws-0-us-west-1.pooler.supabase.com \
  -p 6543 \
  -U postgres.latxadqrvrrrcvkktrog \
  -d postgres \
  -c "SELECT id, from_email, subject, received_at FROM email_responses ORDER BY received_at DESC LIMIT 5;"
```

---

## Step 4: Email Addresses to Configure

### Recommended Setup (Subdomain):
1. **Primary SAM address**: `hello@sam.innovareai.com`
   - Used for all campaign replies
   - Automated inbox, no human monitoring
   - Handled entirely by Postmark → SAM AI

2. **Alternative**: `inbox@sam.innovareai.com`
   - Catch-all for any other subdomain emails

3. **Reply-to header**: Configure campaigns to use `hello@sam.innovareai.com` as reply-to address

**No forwarding needed** - Postmark handles all email directly via MX records

---

## Step 5: Webhook Security (Optional Enhancement)

Add Postmark signature validation to webhook handler:

1. Get your **Inbound Webhook Secret** from Postmark dashboard
2. Add to `.env.local`:
```bash
POSTMARK_INBOUND_WEBHOOK_SECRET=your_webhook_secret_here
```

3. Webhook handler will validate signatures automatically

---

## Architecture Overview

```
Prospect replies to campaign email
         ↓
   sarah@innovareai.com
         ↓
   MX Record forwards to Postmark
         ↓
   Postmark processes email
         ↓
   Webhook POST to /api/webhooks/postmark-inbound
         ↓
   SAM processes reply:
   - Stores in email_responses table
   - Analyzes sentiment/intent with AI
   - Creates notification for user
   - Optionally drafts response
```

---

## Monitoring & Debugging

### Check Postmark Activity Log
1. Go to Postmark Dashboard → **Activity**
2. Filter by **Inbound**
3. View delivery status, bounces, webhook calls

### Check Application Logs
```bash
# Check webhook handler logs
tail -f logs/postmark-inbound.log

# Or check Netlify function logs
netlify functions:log postmark-inbound
```

### Check Database
```sql
-- Recent email responses
SELECT
  id,
  from_email,
  subject,
  sentiment,
  intent,
  processed,
  received_at
FROM email_responses
ORDER BY received_at DESC
LIMIT 10;

-- Unprocessed emails
SELECT COUNT(*)
FROM email_responses
WHERE processed = FALSE;
```

---

## Next Steps

1. **Deploy migration**: Run the SQL migration
2. **Configure Postmark**: Add MX records and webhook
3. **Test webhook**: Send test email
4. **Configure forwarding**: Set up sam@innovareai.com forwarding
5. **Monitor**: Watch first few real replies come through

---

## Troubleshooting

### MX Records not verifying
- Wait 15-30 minutes for DNS propagation
- Check DNS with: `dig MX innovareai.com`
- Ensure Priority is 10 and points to `inbound.postmarkapp.com`

### Webhook not receiving emails
- Check Postmark Activity log for delivery status
- Verify webhook URL is correct: `https://app.meet-sam.com/api/webhooks/postmark-inbound`
- Check webhook returns 200 status code
- Review Netlify function logs

### Emails not showing in database
- Check webhook handler logs for errors
- Verify database connection
- Check RLS policies allow service role inserts
- Ensure email_responses table exists

---

## Support

- **Postmark Docs**: https://postmarkapp.com/developer/user-guide/inbound
- **Postmark Support**: support@postmarkapp.com
- **SAM AI Issues**: File issue in project repository
