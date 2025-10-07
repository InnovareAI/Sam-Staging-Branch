# Email-Only HITL Workflow - End-to-End Test Plan

## Prerequisites

1. ✅ **Database Migration Applied**
   - Run `supabase/migrations/20251007000002_create_message_outbox_and_update_replies.sql`
   - Verify with: `node temp/verify-email-schema.cjs`

2. ✅ **Postmark Configured**
   - Inbound domain: sam.innovareai.com
   - Webhook: https://app.meet-sam.com/api/webhooks/postmark-inbound

3. ✅ **Development Server Running**
   - `npm run dev` on localhost:3000
   - OR production deployment at app.meet-sam.com

## Test Scenario Overview

We'll simulate this complete flow:

```
Prospect replies to campaign
  ↓
SAM receives email (<1 min)
  ↓
SAM generates draft (<5 min)
  ↓
SAM emails HITL with draft (<1 min)
  ↓
HITL replies with APPROVE/EDIT/REFUSE
  ↓
SAM processes action and queues message
  ↓
SAM sends confirmation to HITL
```

## Test 1: APPROVE Workflow

### Step 1: Simulate Prospect Reply

```bash
curl -X POST https://app.meet-sam.com/api/webhooks/postmark-inbound \
  -H "Content-Type: application/json" \
  -d '{
    "From": "john.smith@techcorp.com",
    "FromFull": {
      "Email": "john.smith@techcorp.com",
      "Name": "John Smith"
    },
    "To": "reply+campaign123+prospect456@sam.innovareai.com",
    "ToFull": [{
      "Email": "reply+campaign123+prospect456@sam.innovareai.com",
      "MailboxHash": "reply-campaign123-prospect456"
    }],
    "Subject": "Re: AI Solutions for Your Business",
    "TextBody": "Hi! Very interested in learning more about your AI platform. Can we schedule a call next week?",
    "HtmlBody": "<p>Hi! Very interested in learning more about your AI platform. Can we schedule a call next week?</p>",
    "Date": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
    "MessageID": "test-approve-'$(date +%s)'@example.com"
  }'
```

### Expected Results:

1. ✅ **Email saved to database**
   ```bash
   node temp/check-email-replies.cjs
   # Should show new email from john.smith@techcorp.com
   ```

2. ✅ **Campaign reply created** (if tables exist)
   - priority: urgent
   - requires_review: true
   - sentiment: positive

3. ✅ **SAM draft generated**
   - ai_suggested_response populated
   - draft_generated_at timestamp set

4. ✅ **HITL notification sent**
   - Email to user@company.com
   - Reply-To: draft+{replyId}@sam.innovareai.com
   - Subject: "🟢 John Smith replied - Draft ready"
   - Contains draft text
   - Instructions: APPROVE/EDIT/REFUSE

### Step 2: Simulate HITL APPROVE

```bash
curl -X POST https://app.meet-sam.com/api/webhooks/postmark-inbound \
  -H "Content-Type: application/json" \
  -d '{
    "From": "tl@innovareai.com",
    "FromFull": {
      "Email": "tl@innovareai.com",
      "Name": "Thorsten Linz"
    },
    "To": "draft+{REPLACE_WITH_REPLY_ID}@sam.innovareai.com",
    "ToFull": [{
      "Email": "draft+{REPLACE_WITH_REPLY_ID}@sam.innovareai.com",
      "MailboxHash": "draft-{REPLACE_WITH_REPLY_ID}"
    }],
    "Subject": "Re: John Smith replied - Draft ready",
    "TextBody": "APPROVE",
    "Date": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
    "MessageID": "test-approve-response-'$(date +%s)'@example.com"
  }'
```

### Expected Results:

1. ✅ **Campaign reply updated**
   - status: 'approved'
   - final_message: {SAM's draft}
   - reviewed_by: {userId}
   - reviewed_at: NOW()

2. ✅ **Message queued in outbox**
   - status: 'queued'
   - message_content: {SAM's draft}
   - scheduled_send_time: NOW() + 1 minute

3. ✅ **Confirmation email sent to HITL**
   - Subject: "✅ Message approved and queued for John Smith"
   - Contains final message that will be sent

## Test 2: EDIT Workflow

### Step 1: Simulate Prospect Reply (Same as Test 1)

### Step 2: Simulate HITL EDIT

```bash
curl -X POST https://app.meet-sam.com/api/webhooks/postmark-inbound \
  -H "Content-Type: application/json" \
  -d '{
    "From": "tl@innovareai.com",
    "To": "draft+{REPLACE_WITH_REPLY_ID}@sam.innovareai.com",
    "ToFull": [{
      "MailboxHash": "draft-{REPLACE_WITH_REPLY_ID}"
    }],
    "Subject": "Re: John Smith replied - Draft ready",
    "TextBody": "Hi John,\\n\\nAbsolutely! I'\\''d love to schedule a call for next Tuesday at 2pm PT. Does that work for you?\\n\\nWe can discuss how our AI platform can help automate your sales processes and generate qualified leads.\\n\\nLooking forward to it!\\nSarah",
    "Date": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
    "MessageID": "test-edit-'$(date +%s)'@example.com"
  }'
```

### Expected Results:

1. ✅ **Campaign reply updated**
   - status: 'edited'
   - final_message: {HITL's edited text}
   - metadata.original_draft: {SAM's draft}

2. ✅ **Message queued with edited content**
   - message_content: {HITL's edited version}

3. ✅ **Confirmation email sent**

## Test 3: REFUSE Workflow

### Step 1: Simulate Prospect Reply (Same as Test 1)

### Step 2: Simulate HITL REFUSE

```bash
curl -X POST https://app.meet-sam.com/api/webhooks/postmark-inbound \
  -H "Content-Type: application/json" \
  -d '{
    "From": "tl@innovareai.com",
    "To": "draft+{REPLACE_WITH_REPLY_ID}@sam.innovareai.com",
    "ToFull": [{
      "MailboxHash": "draft-{REPLACE_WITH_REPLY_ID}"
    }],
    "Subject": "Re: John Smith replied - Draft ready",
    "TextBody": "REFUSE",
    "Date": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
    "MessageID": "test-refuse-'$(date +%s)'@example.com"
  }'
```

### Expected Results:

1. ✅ **Campaign reply updated**
   - status: 'refused'
   - requires_review: false
   - metadata.refusal_reason: "Refused via email"

2. ✅ **NO message queued** (no outbox record created)

3. ✅ **Confirmation email sent** (notifying refusal)

## Verification Commands

### Check Email Responses
```bash
node temp/check-email-replies.cjs
```

### Check Campaign Replies (after migration)
```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

supabase
  .from('campaign_replies')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(5)
  .then(({ data }) => console.log(JSON.stringify(data, null, 2)))
  .catch(console.error);
"
```

### Check Message Outbox
```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

supabase
  .from('message_outbox')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(5)
  .then(({ data }) => console.log(JSON.stringify(data, null, 2)))
  .catch(console.error);
"
```

## Success Criteria

✅ **All Tests Pass If**:
1. Emails received and stored in email_responses
2. Campaign replies created with correct priority
3. SAM drafts generated within 5 seconds
4. HITL notification emails sent with Reply-To header
5. APPROVE creates outbox message with SAM's draft
6. EDIT creates outbox message with HITL's edited version
7. REFUSE updates status but doesn't queue message
8. Confirmation emails sent for all actions

## Known Limitations

⚠️  **Campaign/Prospect Tables**:
- If campaign_replies table doesn't exist, webhook will only save to email_responses
- Reply Agent features require campaign_replies table
- Migration handles this gracefully with conditional checks

⚠️  **N8N Integration**:
- Outbox messages are queued but not automatically sent yet
- N8N workflow for sending needs to be implemented separately

⚠️  **User Lookup**:
- Currently uses first user in workspace for notifications
- Production should lookup based on campaign owner

---

**Created**: October 7, 2025
**Status**: Ready for testing after migration deployment
