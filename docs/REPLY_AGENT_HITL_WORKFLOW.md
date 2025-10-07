# Reply Agent HITL Workflow Documentation

**Last Updated**: October 7, 2025
**Status**: ✅ Complete Backend Implementation
**Priority**: 🔴 P1 - Highest Priority System

---

## Overview

The Reply Agent HITL (Human-in-the-Loop) workflow enables SAM AI to automatically generate reply drafts for campaign responses, while giving users full control over approval, editing, or refusal before messages are sent.

**SLA**: < 15 minutes from prospect reply to HITL notification

---

## Complete Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│           Reply Agent HITL Workflow (End-to-End)                     │
└─────────────────────────────────────────────────────────────────────┘

Step 1: Prospect Replies
┌──────────────┐
│  Prospect    │ ──── Replies to campaign email/LinkedIn
│  replies     │
└──────────────┘
       │
       ▼
Step 2: Email Received (<1 min)
┌──────────────┐
│  Postmark    │ ──── Receives email
│  or Unipile  │      Routes to webhook
└──────────────┘
       │
       ▼
Step 3: Webhook Processing (<2 min)
┌──────────────────────┐
│ Postmark Webhook     │
│ /api/webhooks/       │
│ postmark-inbound     │
└──────────────────────┘
│   1. Save to email_responses
│   2. Detect sentiment (positive/negative/neutral)
│   3. Create campaign_replies record (priority: urgent)
│   4. Send PRIORITY notification to all team members
│   5. Generate SAM AI draft response
└──────────────────────┘
       │
       ▼
Step 4: SAM Draft Generation (<5 min)
┌──────────────────────┐
│ SAM AI (Claude 3.5)  │
│ via OpenRouter       │
└──────────────────────┘
│   Context:
│   - Original campaign message
│   - Prospect details (name, company, industry)
│   - Prospect's reply text
│   - Campaign goals
│
│   Output:
│   - Personalized draft response (2-3 paragraphs)
│   - Call-to-action for next step
│   - Saved to ai_suggested_response field
└──────────────────────┘
       │
       ▼
Step 5: HITL Notification (<1 min)
┌──────────────────────┐
│ Priority Email to    │
│ All Team Members     │
└──────────────────────┘
│   Subject: "🟢 John Smith replied to your campaign"
│   Body:
│   - Prospect details
│   - Their reply
│   - Sentiment indicator
│   - Link to Reply UI
│   - "Draft is ready"
└──────────────────────┘
       │
       ▼
Step 6: HITL Reviews Draft
┌──────────────────────┐
│ User opens Reply UI  │
│ /replies/{replyId}   │
└──────────────────────┘
│   Displays:
│   - Prospect reply
│   - SAM's draft response
│   - Edit textarea
│   - Action buttons: [Approve] [Edit & Send] [Refuse]
└──────────────────────┘
       │
       ├──────────────────┬──────────────────┬──────────────────┐
       ▼                  ▼                  ▼                  ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  APPROVE    │   │    EDIT     │   │   REFUSE    │   │  (Timeout)  │
│  (as-is)    │   │ (modify)    │   │  (reject)   │   │  No action  │
└─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘

Step 7a: APPROVE Action
POST /api/reply-agent/{replyId}/action
{ action: "approve" }

→ Update campaign_replies:
  - status = 'approved'
  - final_message = ai_suggested_response
  - reviewed_by = user_id
  - requires_review = false

→ Create message_outbox record:
  - status = 'queued'
  - message_content = ai_suggested_response
  - scheduled_send_time = NOW() + 1 min

→ Trigger N8N workflow:
  - Send via email (Unipile/Postmark)
  - OR Send via LinkedIn (Unipile)

→ Response to UI:
  { success: true, messageId: "...", scheduledSendTime: "..." }

Step 7b: EDIT Action
POST /api/reply-agent/{replyId}/action
{ action: "edit", editedMessage: "..." }

→ Update campaign_replies:
  - status = 'edited'
  - final_message = editedMessage
  - metadata.original_draft = ai_suggested_response

→ Create message_outbox record:
  - message_content = editedMessage

→ Trigger sending (same as approve)

Step 7c: REFUSE Action
POST /api/reply-agent/{replyId}/action
{ action: "refuse", refusalReason: "..." }

→ Update campaign_replies:
  - status = 'refused'
  - requires_review = false
  - metadata.refusal_reason = "..."

→ NO message sent
→ NO outbox record created

Step 8: Message Sending
┌──────────────────────┐
│   N8N Workflow       │
│  or Direct API Call  │
└──────────────────────┘
│   Email Flow:
│   1. Get outbox message
│   2. Send via Unipile email account
│   3. Update outbox: status = 'sent'
│   4. Save sent_at timestamp
│
│   LinkedIn Flow:
│   1. Get outbox message
│   2. Send via Unipile LinkedIn account
│   3. Update outbox: status = 'sent'
└──────────────────────┘
       │
       ▼
Step 9: Delivery Confirmation
┌──────────────────────┐
│  Update Database     │
└──────────────────────┘
│   message_outbox:
│   - status = 'sent'
│   - sent_at = NOW()
│   - external_message_id = "..."
│
│   campaign_replies:
│   - response_sent_at = NOW()
└──────────────────────┘
```

---

## API Endpoints

### 1. Webhook Handler (Receives Prospect Replies)

**Endpoint**: `POST /api/webhooks/postmark-inbound`

**Triggered by**: Postmark when prospect replies to campaign email

**Flow**:
```typescript
1. Parse incoming email
2. Save to email_responses table
3. Parse mailbox hash (reply+{campaignId}+{prospectId})
4. Call handleCampaignReply()
   → Store in campaign_replies (priority: urgent)
   → Send immediate notification
   → Generate SAM draft
```

**Response**:
```json
{
  "success": true,
  "emailId": "uuid",
  "message": "Email processed successfully"
}
```

### 2. HITL Action Endpoint (User Actions)

**Endpoint**: `POST /api/reply-agent/{replyId}/action`

**Authentication**: Required (Supabase auth)

**Request Body**:
```typescript
{
  action: 'approve' | 'edit' | 'refuse',
  editedMessage?: string,      // Required for 'edit'
  refusalReason?: string        // Optional for 'refuse'
}
```

**Approve Example**:
```bash
curl -X POST https://app.meet-sam.com/api/reply-agent/abc123/action \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "approve"}'
```

**Response**:
```json
{
  "success": true,
  "action": "approved",
  "message": "Draft approved and queued for sending",
  "messageId": "uuid",
  "scheduledSendTime": "2025-10-07T10:30:00Z"
}
```

**Edit Example**:
```bash
curl -X POST https://app.meet-sam.com/api/reply-agent/abc123/action \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "edit",
    "editedMessage": "Hi John,\n\nThanks for your interest! I'"'"'d love to schedule a call next Tuesday at 2pm. Does that work for you?\n\nBest,\nSarah"
  }'
```

**Refuse Example**:
```bash
curl -X POST https://app.meet-sam.com/api/reply-agent/abc123/action \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "refuse",
    "refusalReason": "Prospect is not a good fit"
  }'
```

---

## Database Schema

### email_responses (Inbound Emails)
```sql
email_responses (
  id UUID PRIMARY KEY,
  from_email TEXT NOT NULL,              -- Prospect email
  to_email TEXT NOT NULL,                -- reply+{campaignId}+{prospectId}@...
  subject TEXT,
  text_body TEXT,
  html_body TEXT,
  received_at TIMESTAMPTZ NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  sentiment TEXT,                        -- 'positive', 'negative', 'neutral'
  intent TEXT,                           -- 'campaign_reply'
  requires_response BOOLEAN DEFAULT TRUE,
  raw_email JSONB
)
```

### campaign_replies (Reply Tracking & HITL)
```sql
campaign_replies (
  id UUID PRIMARY KEY,
  campaign_id UUID,
  prospect_id UUID,
  email_response_id UUID,                -- Links to email_responses

  -- Original reply
  reply_text TEXT,                       -- Prospect's reply
  reply_html TEXT,
  received_at TIMESTAMPTZ,

  -- SAM AI draft
  ai_suggested_response TEXT,            -- SAM's generated draft
  draft_generated_at TIMESTAMPTZ,

  -- HITL workflow
  status TEXT,                           -- 'pending', 'approved', 'edited', 'refused'
  reviewed_by UUID,                      -- User who reviewed
  reviewed_at TIMESTAMPTZ,
  final_message TEXT,                    -- Final message (draft or edited)
  requires_review BOOLEAN DEFAULT TRUE,
  priority TEXT DEFAULT 'normal',        -- 'normal', 'urgent'

  -- Metadata
  metadata JSONB,                        -- Stores edit history, refusal reason, etc.
  response_sent_at TIMESTAMPTZ           -- When response was sent
)
```

### message_outbox (Queued Messages)
```sql
message_outbox (
  id UUID PRIMARY KEY,
  workspace_id UUID,
  campaign_id UUID,
  prospect_id UUID,
  reply_id UUID,                         -- Links to campaign_replies

  -- Delivery
  channel TEXT NOT NULL,                 -- 'email', 'linkedin', 'both'
  message_content TEXT NOT NULL,
  subject TEXT,

  -- Status
  status TEXT DEFAULT 'queued',          -- 'queued', 'sending', 'sent', 'failed'
  scheduled_send_time TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,

  -- External IDs
  external_message_id TEXT,              -- Unipile/provider message ID
  n8n_execution_id TEXT,

  metadata JSONB
)
```

---

## SAM AI Draft Generation

### Prompt Template
```typescript
System Prompt:
"You are SAM, an expert B2B sales assistant. Generate a professional,
personalized response to a prospect's reply.

Your response should:
- Address their specific message directly
- Maintain a conversational, helpful tone
- Move the conversation forward toward a meeting/call
- Be concise (2-3 short paragraphs)
- Include a clear call-to-action

Context:
- Campaign: {campaign.name}
- Prospect: {prospect.name}, {prospect.title} at {prospect.company}
- Industry: {prospect.industry}
- Original message template: {campaign.message_template}"

User Message:
"The prospect ({prospect.name}) just replied with:

'{email.TextBody}'

Generate a response draft."
```

### Example Interaction

**Prospect Reply**:
> "Hi Sarah, I'm interested in learning more about your AI solutions.
> Can we schedule a call next week?"

**SAM Draft Response**:
> "Hi John,
>
> Great to hear from you! I'd love to discuss how our AI platform can help
> streamline your sales operations at TechCorp.
>
> I have availability next Tuesday (Oct 10) at 2pm PT or Thursday (Oct 12)
> at 11am PT. Would either of those work for you? Happy to find another time
> if neither fits your schedule.
>
> Looking forward to connecting!
>
> Best,
> Sarah"

---

## Message Sending Integration

### Email via Unipile
```typescript
// N8N Webhook: /webhook/send-email-reply
{
  messageId: "uuid",
  to: "prospect@company.com",
  subject: "Re: Your inquiry about AI solutions",
  body: "Hi John, ...",
  prospectId: "uuid",
  campaignId: "uuid"
}

→ N8N calls Unipile API:
POST https://api6.unipile.com:13670/api/v1/emails
{
  account_id: "{unipile_account_id}",
  to: ["prospect@company.com"],
  subject: "Re: Your inquiry",
  body: "...",
  reply_to_message_id: "{original_message_id}"
}
```

### LinkedIn via Unipile
```typescript
// N8N Webhook: /webhook/send-linkedin-message
{
  messageId: "uuid",
  prospectLinkedInUrl: "https://linkedin.com/in/john-smith",
  message: "Hi John, ...",
  prospectId: "uuid",
  campaignId: "uuid"
}

→ N8N calls Unipile API:
POST https://api6.unipile.com:13670/api/v1/chats/messages
{
  account_id: "{unipile_account_id}",
  attendees: [{
    provider_id: "{linkedin_user_id}"  // Extracted from prospect URL
  }],
  text: "Hi John, ..."
}
```

---

## Priority Notification Email

**Subject**: `🟢 John Smith replied to your campaign`
(🟢 positive, 🔴 negative, 🟡 neutral)

**HTML Body**:
```html
<div style="font-family:sans-serif;max-width:600px;">
  <div style="background:#8907FF;color:white;padding:20px;">
    <h2>🚨 New Reply - Immediate Action Required</h2>
  </div>

  <div style="padding:20px;background:#f9f9f9;">
    <p>Hi Sarah,</p>

    <p><strong>John Smith</strong> (VP of Sales) from <strong>TechCorp</strong>
    just replied to your outreach:</p>

    <blockquote style="border-left:4px solid #8907FF;padding:15px;background:white;">
      Hi Sarah, I'm interested in learning more about your AI solutions.
      Can we schedule a call next week?
    </blockquote>

    <div style="background:#fff;padding:15px;">
      <p style="margin:0;font-size:12px;color:#666;">Sentiment:</p>
      <p style="margin:0;">🟢 Positive - High interest</p>
    </div>

    <div style="text-align:center;margin:30px 0;">
      <a href="https://app.meet-sam.com/replies/abc123"
         style="background:#8907FF;color:white;padding:15px 30px;
                text-decoration:none;border-radius:6px;font-weight:600;">
        View & Draft Response
      </a>
    </div>

    <p style="font-size:12px;color:#666;">
      I'm drafting a suggested response for you. It'll be ready when you
      open the Reply Agent.
    </p>

    <p>Sam</p>
  </div>
</div>
```

---

## Metrics & Monitoring

### SLA Compliance
```sql
-- Check if replies meet <15 min SLA
SELECT
  id,
  received_at,
  draft_generated_at,
  EXTRACT(EPOCH FROM (draft_generated_at - received_at)) / 60 as minutes,
  CASE
    WHEN EXTRACT(EPOCH FROM (draft_generated_at - received_at)) / 60 < 15
    THEN '✅ Within SLA'
    ELSE '❌ SLA Breach'
  END as sla_status
FROM campaign_replies
WHERE received_at > NOW() - INTERVAL '24 hours'
ORDER BY received_at DESC;
```

### HITL Action Rates
```sql
SELECT
  status,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM campaign_replies
WHERE received_at > NOW() - INTERVAL '7 days'
GROUP BY status;
```

**Expected Results**:
| status | count | percentage |
|--------|-------|------------|
| approved | 150 | 60% |
| edited | 80 | 32% |
| refused | 20 | 8% |

### Response Time
```sql
-- Time from prospect reply to message sent
SELECT
  AVG(EXTRACT(EPOCH FROM (response_sent_at - received_at)) / 60) as avg_minutes,
  MIN(EXTRACT(EPOCH FROM (response_sent_at - received_at)) / 60) as min_minutes,
  MAX(EXTRACT(EPOCH FROM (response_sent_at - received_at)) / 60) as max_minutes
FROM campaign_replies
WHERE response_sent_at IS NOT NULL
  AND received_at > NOW() - INTERVAL '7 days';
```

---

## Testing

### End-to-End Test

**1. Trigger webhook with test reply**:
```bash
curl -X POST https://app.meet-sam.com/api/webhooks/postmark-inbound \
  -H "Content-Type: application/json" \
  -d '{
    "From": "john@techcorp.com",
    "FromName": "John Smith",
    "To": "reply+campaign123+prospect456@sam.innovareai.com",
    "ToFull": [{
      "Email": "reply+campaign123+prospect456@sam.innovareai.com",
      "MailboxHash": "reply-campaign123-prospect456"
    }],
    "Subject": "Re: AI Solutions Inquiry",
    "TextBody": "Hi! Very interested. Can we schedule a call?",
    "Date": "2025-10-07T10:00:00Z",
    "MessageID": "test-'$(date +%s)'"
  }'
```

**2. Verify draft was generated**:
```sql
SELECT
  id,
  ai_suggested_response,
  draft_generated_at,
  status
FROM campaign_replies
WHERE prospect_id = 'prospect456'
ORDER BY received_at DESC
LIMIT 1;
```

**3. Test HITL approve action**:
```bash
curl -X POST https://app.meet-sam.com/api/reply-agent/{replyId}/action \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"action": "approve"}'
```

**4. Verify outbox record created**:
```sql
SELECT * FROM message_outbox WHERE reply_id = '{replyId}';
```

---

## Next Steps (UI Implementation)

### Reply UI Page: `/replies/[replyId]`

**Components needed**:
1. **ProspectCard** - Display prospect info
2. **ReplyPreview** - Show prospect's reply
3. **DraftEditor** - Editable textarea with SAM's draft
4. **ActionButtons** - Approve, Edit & Send, Refuse
5. **SentimentBadge** - Visual sentiment indicator

**State management**:
```typescript
const [reply, setReply] = useState<CampaignReply | null>(null)
const [draftMessage, setDraftMessage] = useState('')
const [isEditing, setIsEditing] = useState(false)
const [isSubmitting, setIsSubmitting] = useState(false)

const handleApprove = async () => {
  await fetch(`/api/reply-agent/${replyId}/action`, {
    method: 'POST',
    body: JSON.stringify({ action: 'approve' })
  })
  // Redirect to inbox or show success
}

const handleEdit = async () => {
  await fetch(`/api/reply-agent/${replyId}/action`, {
    method: 'POST',
    body: JSON.stringify({
      action: 'edit',
      editedMessage: draftMessage
    })
  })
}

const handleRefuse = async (reason: string) => {
  await fetch(`/api/reply-agent/${replyId}/action`, {
    method: 'POST',
    body: JSON.stringify({
      action: 'refuse',
      refusalReason: reason
    })
  })
}
```

---

## Summary

✅ **Complete Backend Implementation**:
- Webhook processing with <15 min SLA
- SAM AI draft generation (Claude 3.5)
- Priority notification system
- HITL action endpoint (approve/edit/refuse)
- Message outbox queue
- N8N integration for sending

⚠️ **UI Implementation Needed**:
- Reply UI page (`/replies/[replyId]`)
- Draft editor component
- Action buttons
- Real-time status updates

**Production Ready**: Backend ✅ | Frontend ⚠️

---

**Last Updated**: October 7, 2025
**Version**: 1.0
**Critical Path**: This is the highest priority feature for SAM AI
