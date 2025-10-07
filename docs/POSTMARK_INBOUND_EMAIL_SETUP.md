# Postmark Inbound Email Setup Guide for SAM AI

**Last Updated**: October 7, 2025
**System**: SAM AI Platform - InnovareAI
**Inbound Email**: hello@sam.innovareai.com
**Status**: ✅ Fully Operational

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Step 1: DNS Configuration](#step-1-dns-configuration)
5. [Step 2: Database Setup](#step-2-database-setup)
6. [Step 3: Webhook Implementation](#step-3-webhook-implementation)
7. [Step 4: Postmark Configuration](#step-4-postmark-configuration)
8. [Step 5: Testing](#step-5-testing)
9. [Monitoring & Troubleshooting](#monitoring--troubleshooting)
10. [Next Steps](#next-steps)

---

## Overview

This guide documents the complete setup of Postmark inbound email processing for SAM AI, enabling the platform to:

- Receive emails at custom addresses (e.g., `hello@sam.innovareai.com`)
- Process campaign replies automatically
- Handle prospect approval via email
- Store all inbound emails in the database for analysis
- Trigger AI-powered response workflows

**Key Components:**
- **Inbound Domain**: `sam.innovareai.com`
- **Email Address**: `hello@sam.innovareai.com`
- **Webhook Endpoint**: `https://app.meet-sam.com/api/webhooks/postmark-inbound`
- **Database Table**: `email_responses`
- **Email Provider**: Postmark (InnovareAI server)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Inbound Email Flow                            │
└─────────────────────────────────────────────────────────────────┘

1. Email sent to hello@sam.innovareai.com
           ↓
2. DNS MX record routes to inbound.postmarkapp.com
           ↓
3. Postmark receives email
           ↓
4. Postmark checks inbound domain forwarding config
           ↓
5. Postmark triggers webhook POST request
           ↓
6. Webhook: https://app.meet-sam.com/api/webhooks/postmark-inbound
           ↓
7. Next.js API route processes the email
           ↓
8. Email saved to Supabase (email_responses table)
           ↓
9. Email routed to appropriate handler:
   - Approval replies → handleApprovalReply()
   - Campaign replies → handleCampaignReply()
   - General messages → handleGeneralMessage()
           ↓
10. User notification sent (if applicable)
```

---

## Prerequisites

Before starting, ensure you have:

- ✅ **Postmark Account** with InnovareAI server configured
- ✅ **Postmark API Key** (stored in `POSTMARK_INNOVAREAI_API_KEY`)
- ✅ **Domain Access** to configure DNS records (innovareai.com)
- ✅ **Supabase Database** access with service role key
- ✅ **Production Environment** deployed at app.meet-sam.com
- ✅ **Subdomain Decision** (using `sam.innovareai.com` to avoid Google Workspace conflicts)

---

## Step 1: DNS Configuration

### 1.1 Create Subdomain MX Record

Configure the MX (Mail Exchange) record to route emails to Postmark's inbound servers.

**DNS Provider**: (Your DNS provider - e.g., Cloudflare, Route53, GoDaddy)

**Record Details:**
```
Type:     MX
Name:     sam.innovareai.com (or just "sam" depending on provider)
Priority: 10
Value:    inbound.postmarkapp.com
TTL:      3600 (or Auto)
```

**Example Configuration:**
```bash
# MX Record
sam.innovareai.com  MX  10  inbound.postmarkapp.com
```

### 1.2 Verify MX Record

After configuring, verify the MX record is active:

```bash
dig sam.innovareai.com MX +short
```

**Expected Output:**
```
10 inbound.postmarkapp.com.
```

**Note**: DNS propagation can take 5-60 minutes. You can check status at:
- https://mxtoolbox.com/
- https://dnschecker.org/

---

## Step 2: Database Setup

### 2.1 Create Migration File

The `email_responses` table stores all inbound emails with metadata for processing.

**Migration File**: `supabase/migrations/20251007000001_create_email_responses_fixed.sql`

Key features:
- Stores email metadata (from, to, subject, message_id)
- Stores email content (text_body, html_body, stripped_text)
- Tracks processing status and AI analysis
- Links to workspaces, campaigns, and prospects
- Handles attachments as JSONB
- Implements RLS (Row Level Security) for multi-tenant isolation

### 2.2 Apply Migration

**Via Direct SQL Connection:**
```bash
PGPASSWORD="Innovareeai2024!!" psql \
  -h aws-0-us-west-1.pooler.supabase.com \
  -p 6543 \
  -U postgres.latxadqrvrrrcvkktrog \
  -d postgres \
  -f supabase/migrations/20251007000001_create_email_responses_fixed.sql
```

**Verification:**
```sql
-- Check table exists
\dt email_responses

-- Check indexes
\di email_responses*

-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'email_responses';
```

### 2.3 Table Schema

```sql
email_responses (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  campaign_id UUID,
  prospect_id UUID,

  -- Email metadata
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT NOT NULL,
  subject TEXT,
  message_id TEXT UNIQUE,

  -- Content
  text_body TEXT,
  html_body TEXT,
  stripped_text TEXT,

  -- Attachments
  has_attachments BOOLEAN,
  attachments JSONB,

  -- Processing
  received_at TIMESTAMPTZ NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  sentiment TEXT,
  intent TEXT,
  requires_response BOOLEAN DEFAULT TRUE,

  -- AI Analysis
  ai_summary TEXT,
  ai_suggested_response TEXT,

  -- Raw data
  raw_email JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)
```

---

## Step 3: Webhook Implementation

### 3.1 Create Webhook Route

**File**: `app/api/webhooks/postmark-inbound/route.ts`

This Next.js API route handles incoming webhooks from Postmark.

**Key Functions:**

```typescript
// Main webhook handler
export async function POST(request: NextRequest)

// Save email to database (uses service role)
async function saveEmailToDatabase(email: PostmarkInboundEmail)

// Parse email context (approval, campaign-reply, general)
function parseEmailContext(mailboxHash: string, subject: string, body: string)

// Handler functions
async function handleApprovalReply(email, context, emailId)
async function handleCampaignReply(email, context, emailId)
async function handleGeneralMessage(email, emailId)
```

### 3.2 Important: Service Role Client

**Critical for Webhooks**: The webhook must use Supabase service role client (NOT auth-based client) because:
- Webhook requests don't have user authentication
- Service role bypasses Row Level Security (RLS)
- Allows writing to database from external sources

```typescript
function getServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,  // ← Service role, not anon key
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}
```

### 3.3 Environment Variables

Ensure these are set in `.env.local` and production:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://latxadqrvrrrcvkktrog.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Postmark
POSTMARK_INNOVAREAI_API_KEY=bf9e070d-eec7-4c41-8fb5-1d37fe384723
POSTMARK_FROM_EMAIL=hello@sam.innovareai.com
POSTMARK_FROM_NAME=Sam
```

### 3.4 Deploy Webhook

Ensure the webhook is deployed and accessible:

```bash
# Deploy to production
npm run deploy:production

# Verify webhook is live
curl https://app.meet-sam.com/api/webhooks/postmark-inbound
# Should return 405 Method Not Allowed (POST is required)
```

---

## Step 4: Postmark Configuration

### 4.1 Navigate to Inbound Stream Settings

1. Log into **Postmark Dashboard**
2. Select **InnovareAI** server
3. Click **Message Streams** in the left sidebar
4. Click on **"Inbound"** stream (NOT "Default Transactional Stream")
5. Click **Settings** tab

### 4.2 Configure Inbound Webhook

In the **Inbound** section:

**Inbound webhook URL:**
```
https://app.meet-sam.com/api/webhooks/postmark-inbound
```

**Options:**
- ☐ Include raw email content in JSON payload (optional, can enable for debugging)

**Click Save**

### 4.3 Configure Inbound Domain Forwarding

This is the **critical step** that enables custom email addresses.

In the **Inbound domain forwarding** section:

**Inbound domain:**
```
sam.innovareai.com
```

**Click Save**

**Postmark will verify:**
- ✅ MX record exists and points to `inbound.postmarkapp.com`
- ✅ Domain is properly configured

**Verification Status:**
Once saved, you should see:
- ✅ Domain verified
- ✅ Emails to `*@sam.innovareai.com` will be processed

### 4.4 Optional: Configure Spam Filtering

**SpamAssassin threshold:**
- Set to `5` (recommended) to block obvious spam
- Adjust based on your needs (higher = more strict)

**Inbound rules:**
- Can add custom rules to filter/route emails
- Not required for basic setup

### 4.5 Verify Configuration

After saving, your settings should show:

```
Email address: 76a68db93be97d1efe0b2bc77b696b08@inbound.postmarkapp.com
Webhook: https://app.meet-sam.com/api/webhooks/postmark-inbound
Inbound domain: sam.innovareai.com
```

---

## Step 5: Testing

### 5.1 Test Email Delivery

Send a test email from any email client:

**To:** `hello@sam.innovareai.com`
**Subject:** Test SAM Inbound Email
**Body:** This is a test message to verify the inbound email system.

### 5.2 Verify in Postmark Activity

1. Go to **Postmark** → **Activity** → **Inbound**
2. Look for your test email
3. Click on it to see:
   - ✅ Email received
   - ✅ Webhook triggered
   - ✅ Webhook returned 200 OK
   - View the full JSON payload sent to webhook

### 5.3 Verify in Database

Run the check script:

```bash
node temp/check-email-replies.cjs
```

**Expected Output:**
```
📧 Recent Email Responses:

1. From: your-email@example.com
   To: hello@sam.innovareai.com
   Subject: Test SAM Inbound Email
   Preview: This is a test message to verify the inbound email system....
   Received: 10/7/2025, 10:15:08 AM
   ID: 70eb3ae2-743d-4714-93d5-a9db7f748fbf
```

### 5.4 Test Webhook Directly

You can test the webhook endpoint directly:

```bash
curl -X POST https://app.meet-sam.com/api/webhooks/postmark-inbound \
  -H "Content-Type: application/json" \
  -d '{
    "From": "test@example.com",
    "FromName": "Test User",
    "FromFull": {"Email": "test@example.com", "Name": "Test User"},
    "To": "hello@sam.innovareai.com",
    "ToFull": [{"Email": "hello@sam.innovareai.com", "Name": "Sam", "MailboxHash": ""}],
    "Subject": "Webhook Test",
    "MessageID": "test-'$(date +%s)'",
    "Date": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
    "TextBody": "This is a webhook test",
    "HtmlBody": "<p>This is a webhook test</p>",
    "StrippedTextReply": "This is a webhook test",
    "Cc": "", "CcFull": [], "Bcc": "", "BccFull": [],
    "ReplyTo": "", "OriginalRecipient": "hello@sam.innovareai.com",
    "MailboxHash": "", "Tag": "", "Headers": [], "Attachments": []
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Email processed successfully",
  "emailId": "27b04aa8-c3c1-4a76-8875-e811a16d8151"
}
```

---

## Monitoring & Troubleshooting

### Common Issues

#### Issue 1: Emails Not Appearing in Postmark Activity

**Symptoms:**
- Sent email to `hello@sam.innovareai.com`
- Not showing in Postmark Activity → Inbound

**Possible Causes:**
1. MX record not configured or not propagated
2. Wrong email address (using generic `@inbound.postmarkapp.com` instead of custom domain)
3. Inbound domain forwarding not configured in Postmark

**Solutions:**
```bash
# Check MX record
dig sam.innovareai.com MX +short
# Should return: 10 inbound.postmarkapp.com.

# Check DNS propagation
# Visit: https://mxtoolbox.com/ and enter sam.innovareai.com

# Verify Postmark configuration
# Check that "Inbound domain" shows: sam.innovareai.com
```

#### Issue 2: Emails in Postmark but Not in Database

**Symptoms:**
- Email appears in Postmark Activity → Inbound
- Webhook shows as triggered
- Email NOT in database

**Possible Causes:**
1. Webhook URL incorrect
2. Webhook returned error (not 200 OK)
3. Service role key not configured
4. Database RLS blocking inserts

**Solutions:**
```bash
# Check webhook URL in Postmark settings
# Should be: https://app.meet-sam.com/api/webhooks/postmark-inbound

# Check Postmark Activity webhook logs
# Look for error responses (500, 401, 403)

# Test webhook directly
curl -X POST https://app.meet-sam.com/api/webhooks/postmark-inbound \
  -H "Content-Type: application/json" \
  -d '{"From":"test@example.com",...}'

# Check environment variables
echo $SUPABASE_SERVICE_ROLE_KEY
# Should be a valid JWT token
```

#### Issue 3: Webhook Returns 500 Error

**Symptoms:**
- Postmark Activity shows webhook failed (500)
- Database error in logs

**Possible Causes:**
1. Database connection failure
2. Invalid service role key
3. Missing required fields in email payload
4. Foreign key constraint violations

**Solutions:**
```bash
# Check application logs (Netlify)
netlify logs:functions

# Verify service role key
# Check .env.local has SUPABASE_SERVICE_ROLE_KEY

# Test database connection
node -e "const { createClient } = require('@supabase/supabase-js'); \
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, \
  process.env.SUPABASE_SERVICE_ROLE_KEY); \
  supabase.from('workspaces').select('count').then(console.log);"
```

### Monitoring Tools

#### Check Recent Emails Script

**File**: `temp/check-email-replies.cjs`

```bash
node temp/check-email-replies.cjs
```

Shows last 10 emails received.

#### Database Query

```sql
-- Recent emails
SELECT
  id,
  from_email,
  to_email,
  subject,
  received_at,
  processed
FROM email_responses
ORDER BY received_at DESC
LIMIT 10;

-- Unprocessed emails
SELECT *
FROM email_responses
WHERE processed = false
ORDER BY received_at DESC;

-- Email statistics
SELECT
  DATE(received_at) as date,
  COUNT(*) as total_emails,
  COUNT(*) FILTER (WHERE processed = true) as processed,
  COUNT(*) FILTER (WHERE sentiment = 'positive') as positive
FROM email_responses
GROUP BY DATE(received_at)
ORDER BY date DESC;
```

#### Postmark Activity Stream

1. Go to **Postmark** → **Activity** → **Inbound**
2. Filter by:
   - Date range
   - Recipient (hello@sam.innovareai.com)
   - Status (Processed, Failed)
3. Click on individual emails to see:
   - Full email content
   - Webhook delivery logs
   - Error messages (if any)

---

## Next Steps

Now that inbound email is working, you can implement:

### 1. Campaign Reply Detection

**Workflow:**
1. Prospect replies to campaign email
2. Email received at `reply+{campaignId}+{prospectId}@sam.innovareai.com`
3. Webhook parses mailbox hash to extract IDs
4. Update prospect status to "replied"
5. Notify user of reply
6. Generate AI-suggested response

**Implementation**: Already scaffolded in `handleCampaignReply()` function

### 2. Prospect Approval via Email

**Workflow:**
1. User receives approval email with link to `sam+approval-{sessionId}@sam.innovareai.com`
2. User replies with "Approve All" or "Reject All"
3. Webhook detects approval intent
4. Bulk update prospect statuses
5. Send confirmation email

**Implementation**: Already scaffolded in `handleApprovalReply()` function

### 3. AI-Powered Email Analysis

**Features to add:**
- Sentiment analysis (positive, negative, neutral, interested)
- Intent detection (meeting request, question, objection, unsubscribe)
- Automated response suggestions
- Priority scoring

**Integration Points:**
- Update `sentiment` and `intent` fields in database
- Use OpenRouter API for analysis
- Store results in `ai_summary` and `ai_suggested_response`

### 4. Email Response UI

**Pages to build:**
- `/workspace/[workspaceId]/inbox` - View all received emails
- `/workspace/[workspaceId]/replies/[campaignId]/[prospectId]` - Reply to specific prospect
- Integration with existing campaign dashboard

### 5. Automated Responses

**SAM AI can:**
- Detect common questions and respond automatically
- Schedule follow-up emails based on intent
- Route complex queries to human review
- Track response rates and engagement

---

## Reference

### Postmark Inbound Email Documentation
- https://postmarkapp.com/developer/user-guide/inbound
- https://postmarkapp.com/developer/api/inbound-api

### Postmark Webhook Format
```json
{
  "From": "sender@example.com",
  "FromName": "Sender Name",
  "FromFull": {
    "Email": "sender@example.com",
    "Name": "Sender Name"
  },
  "To": "hello@sam.innovareai.com",
  "ToFull": [
    {
      "Email": "hello@sam.innovareai.com",
      "Name": "Sam",
      "MailboxHash": ""
    }
  ],
  "Subject": "Email subject",
  "MessageID": "unique-message-id",
  "Date": "2025-10-07T10:15:08Z",
  "TextBody": "Plain text content",
  "HtmlBody": "<p>HTML content</p>",
  "StrippedTextReply": "Reply text without quoted content",
  "Headers": [...],
  "Attachments": [...]
}
```

### Email Address Formats

**Standard inbox:**
```
hello@sam.innovareai.com
```

**Campaign replies (with tracking):**
```
reply+{campaignId}+{prospectId}@sam.innovareai.com
```

**Approval sessions:**
```
approval+{sessionId}@sam.innovareai.com
```

**Mailbox hash parsing:**
```
sam.innovareai.com
     ^
     |
MailboxHash = "approval-abc123" → Type: approval, SessionId: abc123
MailboxHash = "reply-campaign1-prospect1" → Type: campaign-reply
```

---

## Summary

✅ **DNS**: MX record configured for `sam.innovareai.com`
✅ **Database**: `email_responses` table created with RLS
✅ **Webhook**: Processing at `https://app.meet-sam.com/api/webhooks/postmark-inbound`
✅ **Postmark**: Inbound domain forwarding enabled for `sam.innovareai.com`
✅ **Testing**: Verified end-to-end email flow

**System Status**: Fully Operational

**Contact**: SAM AI can now receive emails at `hello@sam.innovareai.com` 🎉

---

**Last Verified**: October 7, 2025
**Version**: 1.0
**Author**: AI-assisted setup with Claude Code
