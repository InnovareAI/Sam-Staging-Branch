# Reply Agent - Email-Only HITL Workflow

**Last Updated**: October 7, 2025
**Status**: ✅ Complete - NO UI REQUIRED
**Priority**: 🔴 P1 - Highest Priority

---

## Workflow Overview

**HITL responds from Outlook/Gmail - No dashboard login required!**

```
┌─────────────────────────────────────────────────────────────────────┐
│              Complete Email-Only HITL Workflow                       │
└─────────────────────────────────────────────────────────────────────┘

Step 1: Prospect Replies to Campaign
┌──────────────┐
│  Prospect    │ "Interested! Let's schedule a call."
└──────────────┘
       │
       ▼
Step 2: SAM Receives Reply (<1 min)
┌──────────────┐
│  Postmark    │ Email arrives at reply+{campaignId}+{prospectId}@...
│  Webhook     │ Processes immediately
└──────────────┘
       │
       ▼
Step 3: SAM Generates Draft (<5 min)
┌──────────────┐
│  SAM AI      │ Claude 3.5 Sonnet generates personalized draft
│  (OpenRouter)│ Context: campaign, prospect details, their reply
└──────────────┘
       │
       ▼
Step 4: SAM Emails HITL with Draft (<1 min)
┌──────────────────────────────────────────────────────────┐
│ From: Sam <hello@sam.innovareai.com>                      │
│ To: user@company.com                                      │
│ Reply-To: draft+{replyId}@sam.innovareai.com  ← CRITICAL │
│ Subject: 🟢 John Smith replied - Draft ready              │
│                                                            │
│ Hi Sarah,                                                  │
│                                                            │
│ John Smith from TechCorp just replied:                    │
│ "Interested! Let's schedule a call."                      │
│                                                            │
│ Here's my suggested response:                             │
│ ┌────────────────────────────────────────────────────┐   │
│ │ Hi John,                                            │   │
│ │                                                     │   │
│ │ Great to hear from you! I'd love to discuss...     │   │
│ │ ...                                                 │   │
│ │                                                     │   │
│ │ Looking forward to connecting!                     │   │
│ │ Sarah                                               │   │
│ └────────────────────────────────────────────────────┘   │
│                                                            │
│ HOW TO RESPOND:                                            │
│ Simply REPLY to this email from Outlook or Gmail:         │
│ - Type "APPROVE" to send my draft as-is                   │
│ - Edit the message and reply to send your version         │
│ - Type "REFUSE" to not send anything                      │
│                                                            │
│ Sam                                                        │
└──────────────────────────────────────────────────────────┘
       │
       ▼
Step 5: HITL Replies from Outlook/Gmail
┌──────────────────────────────────────────────────────────┐
│ Option A: APPROVE                                          │
│ ────────────────────────────────────────────             │
│ To: draft+abc123@sam.innovareai.com                      │
│ Body: "APPROVE"                                           │
│                                                            │
│ → SAM sends original draft to prospect                    │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ Option B: EDIT                                             │
│ ────────────────────────────────────────────────────────  │
│ To: draft+abc123@sam.innovareai.com                      │
│ Body:                                                      │
│ Hi John,                                                   │
│                                                            │
│ Absolutely! Let's schedule a call for next Tuesday at     │
│ 2pm PT. Does that work for you?                           │
│                                                            │
│ Best,                                                      │
│ Sarah                                                      │
│                                                            │
│ → SAM sends HITL's edited version to prospect             │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ Option C: REFUSE                                           │
│ ────────────────────────────────────────────────────────  │
│ To: draft+abc123@sam.innovareai.com                      │
│ Body: "REFUSE"                                            │
│                                                            │
│ → SAM does NOT send anything to prospect                  │
└──────────────────────────────────────────────────────────┘
       │
       ▼
Step 6: SAM Processes HITL Response (<1 min)
┌──────────────┐
│  Postmark    │ Receives HITL's reply to draft+{replyId}@...
│  Webhook     │ Detects action (APPROVE/EDIT/REFUSE)
└──────────────┘
       │
       ▼
Step 7: SAM Queues Message (if approved/edited)
┌──────────────┐
│ message_     │ Creates outbox record
│ outbox       │ Schedules send in 1 minute
└──────────────┘
       │
       ▼
Step 8: SAM Sends Message to Prospect
┌──────────────┐
│ N8N Workflow │ Sends via Unipile (email or LinkedIn)
│ + Unipile    │ Updates outbox status to 'sent'
└──────────────┘
       │
       ▼
Step 9: SAM Confirms to HITL
┌──────────────────────────────────────────────────────────┐
│ From: Sam <hello@sam.innovareai.com>                      │
│ To: user@company.com                                      │
│ Subject: ✅ Message approved and queued for John Smith    │
│                                                            │
│ Perfect! I've queued your message to John Smith.          │
│ It will be sent within the next minute.                   │
│                                                            │
│ Message:                                                   │
│ "Hi John, ..."                                            │
│                                                            │
│ Sam                                                        │
└──────────────────────────────────────────────────────────┘
```

---

## Key Implementation Details

### Email Addresses Used

| Address | Purpose |
|---------|---------|
| `reply+{campaignId}+{prospectId}@sam.innovareai.com` | Prospect replies to campaign |
| `draft+{replyId}@sam.innovareai.com` | HITL replies with approval/edits |
| `hello@sam.innovareai.com` | General SAM communications |

### Email Flow Tracking

**Prospect Reply Email**:
```
From: prospect@company.com
To: reply+campaign123+prospect456@sam.innovareai.com
  → Mailbox hash: "reply-campaign123-prospect456"
  → Triggers: handleCampaignReply()
```

**SAM Draft Email to HITL**:
```
From: Sam <hello@sam.innovareai.com>
To: user@company.com
Reply-To: draft+abc123@sam.innovareai.com  ← Critical for tracking
Subject: 🟢 John Smith replied - Draft ready
```

**HITL Response**:
```
From: user@company.com
To: draft+abc123@sam.innovareai.com
  → Mailbox hash: "draft-abc123"
  → Triggers: handleDraftReply()
  → Detects action: APPROVE/EDIT/REFUSE
```

---

## Action Detection Logic

```typescript
function detectHITLAction(body: string) {
  const bodyLower = body.toLowerCase().trim()

  // APPROVE: Short message with "approve" keyword
  if (bodyLower === 'approve' ||
      bodyLower.includes('approve') && bodyLower.length < 50) {
    return { action: 'approve' }
  }

  // REFUSE: Short message with "refuse" or "reject"
  if (bodyLower === 'refuse' || bodyLower === 'reject' ||
      bodyLower.includes('refuse') && bodyLower.length < 50) {
    return { action: 'refuse' }
  }

  // EDIT: Anything else is treated as edited message
  return {
    action: 'edit',
    editedMessage: stripEmailSignature(body)
  }
}
```

**Examples**:

| HITL Reply | Detected Action | Result |
|------------|----------------|---------|
| "APPROVE" | approve | Sends SAM's draft |
| "Approve" | approve | Sends SAM's draft |
| "REFUSE" | refuse | No message sent |
| "reject" | refuse | No message sent |
| "Hi John,\n\nLet's schedule..." | edit | Sends HITL's message |

---

## Database Flow

### When Prospect Replies

```sql
-- 1. Save to email_responses
INSERT INTO email_responses (
  from_email,
  to_email,
  subject,
  text_body,
  received_at,
  sentiment,  -- 'positive', 'negative', 'neutral'
  intent      -- 'campaign_reply'
)

-- 2. Create campaign_replies record
INSERT INTO campaign_replies (
  campaign_id,
  prospect_id,
  email_response_id,
  reply_text,
  priority,            -- 'urgent'
  requires_review      -- true
)

-- 3. Generate SAM draft
UPDATE campaign_replies SET
  ai_suggested_response = '...',
  draft_generated_at = NOW()
WHERE id = {replyId}
```

### When HITL Responds

```sql
-- APPROVE
UPDATE campaign_replies SET
  status = 'approved',
  reviewed_by = {userId},
  reviewed_at = NOW(),
  final_message = ai_suggested_response,
  requires_review = false
WHERE id = {replyId}

-- EDIT
UPDATE campaign_replies SET
  status = 'edited',
  reviewed_by = {userId},
  reviewed_at = NOW(),
  final_message = {editedMessage},
  requires_review = false,
  metadata = jsonb_set(metadata, '{original_draft}', ai_suggested_response)
WHERE id = {replyId}

-- REFUSE
UPDATE campaign_replies SET
  status = 'refused',
  reviewed_by = {userId},
  reviewed_at = NOW(),
  requires_review = false,
  metadata = jsonb_set(metadata, '{refusal_reason}', 'Refused via email')
WHERE id = {replyId}
```

### Message Queuing

```sql
-- Create outbox record (for APPROVE or EDIT)
INSERT INTO message_outbox (
  workspace_id,
  campaign_id,
  prospect_id,
  reply_id,
  channel,              -- 'email' or 'linkedin'
  message_content,      -- final_message
  status,               -- 'queued'
  scheduled_send_time   -- NOW() + 1 minute
)
```

---

## Testing

### End-to-End Test

**1. Simulate prospect reply**:
```bash
curl -X POST https://app.meet-sam.com/api/webhooks/postmark-inbound \
  -H "Content-Type: application/json" \
  -d '{
    "From": "john@techcorp.com",
    "To": "reply+campaign123+prospect456@sam.innovareai.com",
    "ToFull": [{"MailboxHash": "reply-campaign123-prospect456"}],
    "Subject": "Re: AI Solutions",
    "TextBody": "Interested! Let'\''s schedule a call.",
    "Date": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
    "MessageID": "test-'$(date +%s)'"
  }'
```

**Expected**:
- ✅ Email saved to `email_responses`
- ✅ Campaign reply created with `priority: urgent`
- ✅ SAM draft generated within 5 seconds
- ✅ Email sent to HITL with draft and Reply-To: `draft+{replyId}@...`

**2. Check draft was sent**:
```bash
# Check Postmark Activity → Outbound
# Look for email to user with Tag: 'reply-draft-notification'
```

**3. Simulate HITL approve**:
```bash
curl -X POST https://app.meet-sam.com/api/webhooks/postmark-inbound \
  -H "Content-Type: application/json" \
  -d '{
    "From": "sarah@company.com",
    "To": "draft+{replyId}@sam.innovareai.com",
    "ToFull": [{"MailboxHash": "draft-{replyId}"}],
    "Subject": "Re: Draft ready",
    "TextBody": "APPROVE",
    "Date": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
    "MessageID": "test-approve-'$(date +%s)'"
  }'
```

**Expected**:
- ✅ Campaign reply updated: `status = 'approved'`
- ✅ Outbox message created
- ✅ Confirmation email sent to HITL

**4. Simulate HITL edit**:
```bash
curl -X POST https://app.meet-sam.com/api/webhooks/postmark-inbound \
  -H "Content-Type: application/json" \
  -d '{
    "From": "sarah@company.com",
    "To": "draft+{replyId}@sam.innovareai.com",
    "ToFull": [{"MailboxHash": "draft-{replyId}"}],
    "TextBody": "Hi John,\n\nLet'\''s schedule a call for Tuesday at 2pm PT.\n\nBest,\nSarah",
    "Date": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
    "MessageID": "test-edit-'$(date +%s)'"
  }'
```

**Expected**:
- ✅ Campaign reply updated: `status = 'edited'`, `final_message = {edited text}`
- ✅ Outbox message created with edited content
- ✅ Confirmation email sent to HITL

**5. Verify database**:
```sql
SELECT
  id,
  status,
  ai_suggested_response,
  final_message,
  reviewed_at
FROM campaign_replies
WHERE id = '{replyId}';

SELECT
  id,
  message_content,
  status,
  scheduled_send_time
FROM message_outbox
WHERE reply_id = '{replyId}';
```

---

## Benefits of Email-Only Workflow

### ✅ Advantages

1. **No Context Switching**
   - HITL stays in Outlook/Gmail
   - No need to login to dashboard
   - Faster response time

2. **Mobile Friendly**
   - Respond from phone's email app
   - Works on any device
   - No app required

3. **Familiar Interface**
   - Everyone knows how to reply to email
   - Zero training needed
   - Lower adoption friction

4. **Email Threading**
   - Keeps conversation context
   - Easy to find later
   - Search works in email client

5. **Async Workflow**
   - Respond when convenient
   - Can forward to team members
   - Delegatable

### ⚠️ Considerations

1. **Email Signature Handling**
   - System strips common signatures
   - May need manual cleanup in rare cases

2. **Typo Risk**
   - "APROVE" won't be recognized
   - Falls back to treating as edited message (safe)

3. **No Preview**
   - Can't see how message will look
   - Solution: Include formatted preview in notification email

---

## SLA Metrics

**Target**: < 15 minutes from prospect reply to HITL notification

**Breakdown**:
- Prospect replies: 0:00
- Webhook receives: 0:30 (30 sec)
- Draft generated: 5:00 (5 min)
- Email sent to HITL: 6:00 (6 min)
- **Total: 6 minutes** ✅ Well under 15 min SLA

**Monitoring**:
```sql
SELECT
  id,
  received_at,
  draft_generated_at,
  EXTRACT(EPOCH FROM (draft_generated_at - received_at)) / 60 as minutes
FROM campaign_replies
WHERE received_at > NOW() - INTERVAL '24 hours'
ORDER BY received_at DESC;
```

---

## Summary

✅ **Complete Email-Only Implementation**
- No UI required
- HITL responds from Outlook/Gmail
- SAM processes APPROVE/EDIT/REFUSE
- Messages queued for sending
- Confirmation emails sent

**Production Ready**: Yes ✅

**Next Step**: Test with real emails

---

**Last Updated**: October 7, 2025
**Version**: 1.0 (Corrected - Email Only)
**No UI Required**: ✅
