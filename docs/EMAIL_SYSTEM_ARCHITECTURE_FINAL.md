# SAM Email System - Complete Architecture

**Date**: October 7, 2025
**Status**: ✅ Backend Complete | ⚠️ N8N Integration Pending
**System**: Email-Only HITL Workflow

---

## 🎯 System Architecture Overview

### Message Flow Types

**1. HITL Messaging (Sam ↔ User)**
- **Provider**: Postmark only
- **Purpose**: Notifications, draft approvals, confirmations
- **Examples**:
  - Sam sends draft to user: `hello@sam.innovareai.com` → `user@company.com`
  - User replies with APPROVE: `user@company.com` → `draft+{replyId}@sam.innovareai.com`

**2. Prospect Campaign Messages**
- **Initial outreach**: N8N → ReachInbox (high volume) or Unipile (low volume)
- **Replies to prospects**: N8N → Unipile
- **Provider routing based on workspace tier**

**3. Prospect Replies to Campaigns**
- **Reception**: Unipile → N8N (or direct webhook)
- **Processing**: SAM webhook processes reply

---

## 📊 Complete Provider Architecture

### Postmark (HITL Only)
```
SAM ←→ User (HITL)
  ├─ Draft notifications
  ├─ Approval requests
  ├─ Confirmations
  └─ Status updates
```

### N8N (Orchestration Layer)
```
Orchestrates ALL prospect messaging
  ├─ Initial campaigns
  │   ├─ Startup tier → Unipile
  │   └─ SME/Enterprise → ReachInbox (bulk)
  │
  └─ HITL-approved replies
      └─ All tiers → Unipile
```

### Unipile
```
Email (Startup tier)
  ├─ Send: 1 Gmail/Outlook account
  └─ Receive: Same account

Email (SME/Enterprise replies)
  ├─ Send: 1 Gmail/Outlook account
  └─ Receive: Same account (replies from ReachInbox campaigns)

LinkedIn (All tiers)
  ├─ Send: Unipile
  └─ Receive: Unipile
```

### ReachInbox
```
Email (SME/Enterprise initial outreach)
  ├─ Send: Bulk email sending
  └─ Receive: Replies go to 1 Gmail/Outlook → Unipile
```

---

## 🔄 Complete HITL Workflow

### Email-Only Workflow (No UI Required)

```
┌─────────────────────────────────────────────────────┐
│  Step 1: Prospect replies to campaign               │
├─────────────────────────────────────────────────────┤
│  Prospect@company.com                                │
│    ↓                                                 │
│  reply+{campaignId}+{prospectId}@sam.innovareai.com │
│    ↓                                                 │
│  Postmark Inbound Webhook                           │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│  Step 2: SAM processes reply                        │
├─────────────────────────────────────────────────────┤
│  - Save to email_responses                           │
│  - Create campaign_replies record                    │
│  - Analyze sentiment (positive/negative/neutral)     │
│  - Set priority = 'urgent'                          │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│  Step 3: SAM generates AI draft (<5 min)           │
├─────────────────────────────────────────────────────┤
│  - OpenRouter API (Claude 3.5 Sonnet)               │
│  - Context: campaign, prospect, reply sentiment      │
│  - Store in: campaign_replies.ai_suggested_response  │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│  Step 4: SAM emails HITL with draft                │
├─────────────────────────────────────────────────────┤
│  From: Sam <hello@sam.innovareai.com>               │
│  To: user@company.com                                │
│  Reply-To: draft+{replyId}@sam.innovareai.com  ⚡   │
│                                                      │
│  Subject: 🟢 John Smith replied - Draft ready       │
│                                                      │
│  Body:                                               │
│    "John Smith from TechCorp just replied:          │
│     'Interested! Let's schedule a call.'            │
│                                                      │
│     Here's my suggested response:                    │
│     [SAM's AI-generated draft]                      │
│                                                      │
│     HOW TO RESPOND from Outlook/Gmail:              │
│     - Reply 'APPROVE' to send my draft              │
│     - Edit and reply to send your version           │
│     - Reply 'REFUSE' to not send anything"          │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│  Step 5: HITL replies from Outlook/Gmail           │
├─────────────────────────────────────────────────────┤
│  Option A: APPROVE                                   │
│    From: user@company.com                            │
│    To: draft+{replyId}@sam.innovareai.com           │
│    Body: "APPROVE"                                   │
│    → Use SAM's draft as-is                          │
│                                                      │
│  Option B: EDIT                                      │
│    From: user@company.com                            │
│    To: draft+{replyId}@sam.innovareai.com           │
│    Body: [Edited message text]                      │
│    → Use HITL's edited version                      │
│                                                      │
│  Option C: REFUSE                                    │
│    From: user@company.com                            │
│    To: draft+{replyId}@sam.innovareai.com           │
│    Body: "REFUSE"                                    │
│    → Don't send anything to prospect                │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│  Step 6: SAM receives HITL response                │
├─────────────────────────────────────────────────────┤
│  Postmark Inbound Webhook                           │
│    ↓                                                 │
│  Parse email body → Detect action                   │
│    ↓                                                 │
│  Update campaign_replies:                            │
│    - status = 'approved' | 'edited' | 'refused'     │
│    - final_message = [appropriate message]          │
│    - reviewed_by = user_id                          │
│    - reviewed_at = NOW()                            │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│  Step 7: Queue message for N8N (if approved/edited)│
├─────────────────────────────────────────────────────┤
│  INSERT INTO message_outbox:                         │
│    - channel = 'email' | 'linkedin'                 │
│    - message_content = final_message                │
│    - status = 'queued'                              │
│    - scheduled_send_time = NOW() + 10 seconds       │
│    - metadata = {prospect_email, prospect_linkedin} │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│  Step 8: N8N polls and sends message               │
├─────────────────────────────────────────────────────┤
│  N8N Workflow (every 10 seconds):                   │
│    1. Poll message_outbox WHERE status='queued'     │
│    2. Determine provider based on workspace tier    │
│    3. Send via Unipile API                          │
│    4. Update status = 'sent' or 'failed'            │
│    5. Store external_message_id                     │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│  Step 9: SAM confirms to HITL                       │
├─────────────────────────────────────────────────────┤
│  From: Sam <hello@sam.innovareai.com>               │
│  To: user@company.com                                │
│  Subject: ✅ Message sent to John Smith             │
│                                                      │
│  Body:                                               │
│    "Perfect! Your message was sent to John Smith:   │
│     [Final message that was sent]"                  │
└─────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Tables

### email_responses
```sql
- id, from_email, to_email
- subject, text_body, html_body
- message_id (unique)
- received_at, processed
- sentiment ('positive', 'negative', 'neutral')
- intent ('campaign_reply', 'research_request')
```

### campaign_replies
```sql
- id, campaign_id, workspace_id, prospect_id
- reply_text, platform, sender_email, sender_name
- received_at, requires_review, sentiment

-- HITL Workflow Fields
- status ('pending', 'approved', 'edited', 'refused')
- reviewed_by, reviewed_at
- ai_suggested_response (SAM's draft)
- final_message (approved/edited message)
- draft_generated_at, priority
- email_response_id
```

### message_outbox
```sql
- id, workspace_id, campaign_id, prospect_id, reply_id
- channel ('email', 'linkedin', 'both')
- message_content, subject

-- Status Tracking
- status ('queued', 'sending', 'sent', 'failed')
- scheduled_send_time, sent_at, failed_at
- failure_reason

-- External IDs
- external_message_id (Unipile message ID)
- n8n_execution_id

-- Metadata
- metadata JSONB {
    prospect_email,
    prospect_linkedin,
    created_via,
    retry_count
  }
```

---

## ✅ What's Complete

### Backend (100%)
- ✅ Postmark inbound email webhook
- ✅ Email routing and parsing
- ✅ Sentiment analysis
- ✅ AI draft generation (Claude 3.5 Sonnet)
- ✅ HITL action detection (APPROVE/EDIT/REFUSE)
- ✅ Message queuing to outbox
- ✅ Confirmation emails
- ✅ Database schema with RLS
- ✅ All indexes and triggers

### Documentation (100%)
- ✅ Complete workflow documentation
- ✅ N8N integration specification
- ✅ Testing procedures
- ✅ Architecture diagrams

---

## ⚠️ What's Pending

### N8N Integration (Required for complete workflow)

**Status**: Specification complete, needs implementation

**Required N8N Workflow**:
1. Poll `message_outbox` every 10 seconds
2. Route to Unipile based on channel
3. Send message via Unipile API
4. Update `message_outbox.status`
5. Handle errors and retries

**Documentation**: `/docs/N8N_REPLY_AGENT_INTEGRATION.md`

**Estimated Time**: 4-6 hours

---

## 🧪 Current Testing Status

### Can Test Now (Without N8N)

✅ **Prospect reply → SAM draft**:
- Send test email to webhook
- Verify draft generation
- Check HITL notification email

✅ **HITL APPROVE/EDIT/REFUSE**:
- Reply to Sam's notification email
- Verify action detection
- Confirm message queued to outbox

### Requires N8N Setup

⚠️  **Message delivery to prospect**:
- Messages queue successfully
- But won't send until N8N is configured

---

## 📋 Deployment Status

| Component | Status | Notes |
|-----------|--------|-------|
| Database | ✅ 100% | All tables deployed |
| Webhook | ✅ 100% | Processing all email types |
| AI Drafting | ✅ 100% | Claude 3.5 Sonnet integrated |
| HITL Email Flow | ✅ 100% | APPROVE/EDIT/REFUSE working |
| Message Queuing | ✅ 100% | Outbox table ready |
| N8N Integration | ⚠️ 0% | Spec ready, needs implementation |
| Testing | ⚠️ 75% | Partial (missing N8N) |

**Overall**: 🟡 **85% Complete**

---

## 🚀 Next Steps

### Immediate (Required for Full Workflow)

1. **Create N8N workflow** for message sending
   - Use spec: `/docs/N8N_REPLY_AGENT_INTEGRATION.md`
   - Estimated time: 4-6 hours
   - Test with Startup tier first

2. **End-to-end testing**
   - Run: `./temp/test-complete-workflow.sh`
   - Verify full workflow including N8N sending

### Future Enhancements

3. **LinkedIn reply support**
   - Extend N8N workflow for LinkedIn
   - Test with Unipile LinkedIn API

4. **Digest email system**
   - Daily/weekly batched notifications
   - Campaign approval requests

---

## 📞 Documentation Index

| Document | Purpose |
|----------|---------|
| `EMAIL_SYSTEM_ARCHITECTURE_FINAL.md` | This file - Complete architecture |
| `EMAIL_ONLY_HITL_WORKFLOW.md` | Email-only workflow details |
| `N8N_REPLY_AGENT_INTEGRATION.md` | N8N workflow specification |
| `EMAIL_SYSTEM_READY_FOR_PRODUCTION.md` | Production deployment status |
| `SAM_EMAIL_SYSTEM_SUMMARY.md` | System overview |

---

**System Status**: 🟡 85% Complete
**Production Ready**: Backend ✅ | N8N ⚠️
**Last Updated**: October 7, 2025
