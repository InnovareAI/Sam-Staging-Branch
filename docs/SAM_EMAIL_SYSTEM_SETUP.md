# SAM Email System Setup Guide

**Date**: October 6, 2025
**Status**: Implementation Ready

---

## Email Sender Strategy

### 🧑 Sarah Powell (Real Person) - Service/Auth Emails
**Email**: `sp@innovareai.com`
**Display Name**: `Sarah Powell - InnovareAI`

**Sends:**
- ✉️ Trial confirmation emails
- 🔐 Password reset emails
- 🔗 Magic link authentication
- 👥 Workspace invitations
- ⚙️ Account-related service emails

**Why**: Builds trust with human touch for critical account actions

---

### 🤖 SAM AI - App/Workflow Emails
**Email**: `sam@innovareai.com` (or `sam@3cubed.ai`)
**Display Name**: `SAM AI`

**Sends:**
- 🎯 Approval notifications (prospects ready for review)
- 💬 Reply notifications (prospect responded)
- 🚀 Campaign launch confirmations
- 📊 Daily/weekly digests
- ✅ Approval confirmations (via email reply)

**Why**: SAM is the AI assistant handling workflow operations

---

## Postmark Configuration

### Step 1: Add Domains

#### InnovareAI Domain
1. Go to [Postmark Dashboard](https://account.postmarkapp.com) → **Sender Signatures**
2. Click **Add Domain**
3. Enter: `innovareai.com`
4. Verify DNS records:
   - Add DKIM records to DNS
   - Add SPF record: `v=spf1 include:spf.mtasv.net ~all`
   - Add CNAME for DKIM

#### 3Cubed Domain (if needed)
1. Add domain: `3cubed.ai`
2. Verify DNS records (same process)

---

### Step 2: Configure DNS Records

**⚠️ Critical: These DNS records must be added to your domain registrar (e.g., GoDaddy, Namecheap, Cloudflare)**

#### Required DNS Records for `innovareai.com`:

1. **SPF Record** (TXT record for sender authentication):
   ```
   Type: TXT
   Name: @ (or innovareai.com)
   Value: v=spf1 include:spf.mtasv.net ~all
   TTL: 3600
   ```

2. **DKIM Records** (CNAME records - provided by Postmark after domain verification):
   ```
   Type: CNAME
   Name: [provided by Postmark, e.g., 20230101._domainkey]
   Value: [provided by Postmark]
   TTL: 3600
   ```

3. **Return-Path CNAME** (for bounce handling):
   ```
   Type: CNAME
   Name: pm-bounces (or as specified by Postmark)
   Value: pm.mtasv.net
   TTL: 3600
   ```

4. **Inbound MX Records** (to receive emails at sam@innovareai.com):
   ```
   Type: MX
   Name: @ (or innovareai.com)
   Value: inbound.postmarkapp.com
   Priority: 10
   TTL: 3600
   ```

   **Note**: If you already have MX records for Google Workspace or another email provider, you can use a subdomain instead (see Option B below).

#### Option A: Use Main Domain (`sam@innovareai.com`)
- Requires replacing existing MX records
- SAM emails come from `sam@innovareai.com`
- Best for dedicated sending domains

#### Option B: Use Subdomain (`sam@mail.innovareai.com`)
- Keeps existing email provider MX records intact
- SAM emails come from `sam@mail.innovareai.com`
- Recommended if using Google Workspace for primary email

**For subdomain setup**:
```
Type: MX
Name: mail.innovareai.com
Value: inbound.postmarkapp.com
Priority: 10
TTL: 3600
```

Then update code to use `sam@mail.innovareai.com` instead.

---

### Step 3: Configure Inbound Processing

#### Enable Inbound Webhooks
1. Postmark Dashboard → **Servers** → Select server
2. Go to **Inbound** tab
3. Enable inbound processing
4. Set webhook URL: `https://app.meet-sam.com/api/webhooks/postmark-inbound`
5. Configure inbound email addresses:
   - `sam@innovareai.com` (catch SAM replies)
   - `*@innovareai.com` (catch all, if needed)

#### Inbound Address Format
```
sam+{context}@innovareai.com
```

**Examples:**
- `sam+approval-abc123@innovareai.com` → Approval session abc123
- `sam+reply-campaign456-prospect789@innovareai.com` → Campaign reply tracking

---

### Step 4: Email Reply Actions

Users can reply to SAM emails with keywords:

#### Approval Emails
Reply with:
- `"APPROVE ALL"` → Auto-approve all prospects
- `"REJECT ALL"` → Reject all prospects
- `"REVIEW"` → Just notify (no action)

#### Campaign Replies
Forwarded automatically to SAM for HITL review

---

## Implementation Files

### 1. Inbound Webhook Handler
**File**: `/app/api/webhooks/postmark-inbound/route.ts`

**Handles:**
- Approval email replies
- Campaign reply forwards
- General SAM messages

**Flow:**
```
User replies to sam+approval-123@innovareai.com
  ↓
Postmark sends to webhook
  ↓
Parse mailbox hash (approval-123)
  ↓
Execute action (approve/reject)
  ↓
Send confirmation email
```

---

### 2. Outbound Notification Library
**File**: `/lib/notifications/sam-email.ts`

**Functions:**
```typescript
// Notify when prospects ready for review
sendApprovalNotification({
  userEmail, userName, sessionId,
  prospectCount, campaignName
})

// Notify when prospect replies
sendReplyNotification({
  userEmail, userName, prospectName,
  replyText, campaignId, prospectId
})

// Notify when campaign launches
sendCampaignLaunchNotification({
  userEmail, userName, campaignName,
  campaignId, prospectCount
})

// Daily activity digest
sendDailyDigest({
  userEmail, userName, stats
})
```

---

### 3. Service Email Templates
**File**: `/lib/email-templates.ts`

**Already configured:**
- Trial confirmation (from Sarah Powell)
- Password reset (from Sarah Powell)
- Magic links (from Sarah Powell)

---

## Trigger Points

### When to Send Approval Notifications

**Location**: `/app/api/prospect-approval/session/route.ts`

```typescript
// After creating approval session
import { sendApprovalNotification } from '@/lib/notifications/sam-email'

const session = await createApprovalSession(...)

await sendApprovalNotification({
  userEmail: user.email,
  userName: user.first_name,
  sessionId: session.id,
  prospectCount: prospects.length,
  campaignName: campaignTag
})
```

---

### When to Send Reply Notifications

**Location**: N8N webhook or `/app/api/campaign/reply-received/route.ts`

```typescript
// When prospect replies to campaign
import { sendReplyNotification } from '@/lib/notifications/sam-email'

await sendReplyNotification({
  userEmail: owner.email,
  userName: owner.first_name,
  prospectName: prospect.name,
  prospectCompany: prospect.company,
  replyText: message.body,
  campaignId: campaign.id,
  prospectId: prospect.id
})
```

---

### When to Send Campaign Launch

**Location**: `/app/api/campaign/launch/route.ts`

```typescript
// After campaign successfully launches
import { sendCampaignLaunchNotification } from '@/lib/notifications/sam-email'

await sendCampaignLaunchNotification({
  userEmail: owner.email,
  userName: owner.first_name,
  campaignName: campaign.name,
  campaignId: campaign.id,
  prospectCount: prospects.length
})
```

---

## Testing

### Test Inbound Webhook

```bash
# Send test email to SAM
curl -X POST https://app.meet-sam.com/api/webhooks/postmark-inbound \
  -H "Content-Type: application/json" \
  -d '{
    "From": "user@example.com",
    "To": "sam+approval-test123@innovareai.com",
    "Subject": "RE: Approval needed",
    "TextBody": "APPROVE ALL",
    "MailboxHash": "approval-test123"
  }'
```

### Test Approval Notification

```bash
# Run test script
node scripts/js/test-approval-notification.js
```

---

## Email Reply Flow Diagram

```
User approves prospects in app
         ↓
SAM sends approval notification
"12 prospects ready for review"
ReplyTo: sam+approval-abc123@innovareai.com
         ↓
User replies "APPROVE ALL"
         ↓
Postmark webhook triggers
         ↓
Parse: approval-abc123 + "APPROVE ALL"
         ↓
Update database (approve all)
         ↓
SAM sends confirmation
"✅ 12 prospects approved"
```

---

## Environment Variables

```bash
# Postmark API keys
POSTMARK_INNOVAREAI_API_KEY=<key>
POSTMARK_3CUBED_API_KEY=<key>  # If using 3cubed.ai

# Already configured
NEXT_PUBLIC_SUPABASE_URL=<url>
SUPABASE_SERVICE_ROLE_KEY=<key>
```

---

## Security Considerations

1. **Verify Sender**: Check `From` email matches user in database
2. **Session Validation**: Ensure approval session exists and is active
3. **Rate Limiting**: Prevent spam/abuse via email replies
4. **Action Logging**: Log all email-triggered actions for audit

---

## Next Steps

1. ✅ **Inbound webhook created** (`/app/api/webhooks/postmark-inbound/route.ts`)
2. ✅ **Notification library created** (`/lib/notifications/sam-email.ts`)
3. ✅ **Approval notification trigger added** (`/app/api/prospect-approval/prospects/route.ts` line 157-192)
4. ✅ **Campaign launch notification trigger added** (`/app/api/campaign/launch/route.ts` line 282-306)
5. ⏳ **Configure Postmark inbound** (manual setup in dashboard)
6. ⏳ **Test end-to-end** (send test email, verify webhook, check database)

---

**Implementation Status**: Code complete - Ready for Postmark DNS configuration
**Postmark Setup Required**: Yes (DNS records + inbound webhook configuration)
**Estimated Time**: 1-2 hours to configure DNS and test

---

## ✅ Implemented Trigger Locations

### Approval Notification Trigger
**File**: `/app/api/prospect-approval/prospects/route.ts`
**Lines**: 157-192
**Triggered When**: Prospects are added to an approval session (after CSV upload + scraping)
**Email Sent**: "🎯 X Prospects Ready for Review - Campaign Name"

### Campaign Launch Notification Trigger
**File**: `/app/api/campaign/launch/route.ts`
**Lines**: 282-306
**Triggered When**: Campaign successfully launches and N8N execution starts
**Email Sent**: "🚀 Campaign 'Name' is Live!"

### Reply Notification (Future)
**Location**: N8N webhook or `/app/api/campaign/reply-received/route.ts`
**Status**: ⏳ Pending - to be implemented when reply tracking is active
