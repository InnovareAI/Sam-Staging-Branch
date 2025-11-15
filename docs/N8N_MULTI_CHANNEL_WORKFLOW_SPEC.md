# N8N Multi-Channel Campaign Orchestrator Specification

**Date:** November 15, 2025
**Status:** Planning Phase
**Goal:** Extend existing "SAM Master Campaign Orchestrator" to support LinkedIn, Email, and WhatsApp campaigns

---

## Overview

Convert the current LinkedIn-only N8N workflow into a unified multi-channel orchestrator that can handle:
- **LinkedIn** - Connection requests + messaging (existing)
- **Email** - Cold outreach via Unipile email API (new)
- **WhatsApp** - Messages via Unipile WhatsApp API (new)

All channels share the same orchestration logic: send message → wait for reply → follow-ups → HITL approval.

---

## Architecture: Database-Driven Campaign Steps

### Database Schema Changes

#### 1. Update `campaigns` table flow_settings

```sql
-- Current flow_settings structure:
{
  "campaign_type": "linkedin_connection",
  "connection_wait_hours": 36,
  "followup_wait_days": 5,
  "messages": {
    "connection_request": "...",
    "follow_up_1": "...",
    ...
  }
}

-- NEW multi-channel structure:
{
  "channel": "linkedin" | "email" | "whatsapp",
  "steps": [
    {
      "step_number": 1,
      "action_type": "send_connection_request" | "send_email" | "send_whatsapp",
      "message_template_key": "connection_request",
      "delay_after_hours": 36,
      "wait_for_trigger": "connection_accepted" | null,
      "skip_condition": null | "already_replied"
    },
    {
      "step_number": 2,
      "action_type": "send_message" | "send_email" | "send_whatsapp",
      "message_template_key": "follow_up_1",
      "delay_after_hours": 120, // 5 days
      "wait_for_trigger": null,
      "skip_condition": "already_replied"
    },
    ...
  ],
  "messages": {
    "connection_request": "Hi {first_name}...",
    "follow_up_1": "Hello {first_name}...",
    "follow_up_2": "...",
    ...
  }
}
```

#### 2. Add `campaign_prospect_execution_state` table

```sql
CREATE TABLE campaign_prospect_execution_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES campaign_prospects(id) ON DELETE CASCADE,

  -- Execution state
  current_step INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending', -- pending, executing, waiting_trigger, completed, failed

  -- Step tracking
  completed_steps INTEGER[] DEFAULT '{}',
  failed_steps INTEGER[] DEFAULT '{}',

  -- Channel-specific state
  linkedin_state JSONB DEFAULT '{}', -- { connection_status: 'pending|accepted|rejected', last_message_at: '...' }
  email_state JSONB DEFAULT '{}',    -- { sent_count: 0, opened: false, replied: false, last_sent_at: '...' }
  whatsapp_state JSONB DEFAULT '{}', -- { sent_count: 0, delivered: false, replied: false }

  -- Triggers and waits
  waiting_for_trigger TEXT,          -- 'connection_accepted', null
  trigger_check_count INTEGER DEFAULT 0,
  trigger_max_checks INTEGER DEFAULT 168, -- 7 days * 24 hours
  next_check_at TIMESTAMP,

  -- Orchestration metadata
  n8n_execution_id TEXT,
  last_executed_at TIMESTAMP DEFAULT NOW(),
  next_execution_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(campaign_id, prospect_id)
);

CREATE INDEX idx_next_execution ON campaign_prospect_execution_state(next_execution_at)
  WHERE status IN ('pending', 'waiting_trigger');
```

---

## N8N Workflow Modifications

### Current Workflow: "SAM Master Campaign Orchestrator"
- **Workflow ID:** `aVG6LC4ZFRMN7Bw6`
- **Current:** LinkedIn-only (connection request flow)

### New Workflow Structure

```
┌─────────────────────────────────────────────────────────┐
│  Webhook Trigger: /webhook/campaign-execute            │
│  Input: { campaign_id, workspace_id, prospects[] }     │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  Campaign Handler (Modified)                            │
│  - Read campaign flow_settings                          │
│  - Detect channel type (linkedin/email/whatsapp)        │
│  - Initialize execution state for each prospect         │
│  - Output: prospects with channel + step data           │
└─────────────────────────────────────────────────────────┘
                         ↓
           ┌─────────────┴─────────────┐
           ↓                           ↓
┌──────────────────────┐    ┌──────────────────────┐
│  Channel Router       │    │  Step Executor       │
│  - Switch on channel  │    │  - Execute current   │
│  - LinkedIn branch    │    │    step action       │
│  - Email branch       │    │  - Update state      │
│  - WhatsApp branch    │    │  - Schedule next     │
└──────────────────────┘    └──────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────┐
│  Action Nodes (Channel-Specific)                        │
│                                                          │
│  LinkedIn Actions:                                       │
│  ├─ Send Connection Request (existing)                  │
│  ├─ Check Connection Accepted (existing)                │
│  └─ Send LinkedIn Message (existing)                    │
│                                                          │
│  Email Actions (NEW):                                    │
│  ├─ Send Email via Unipile                              │
│  ├─ Check Email Opened                                  │
│  └─ Check Email Replied                                 │
│                                                          │
│  WhatsApp Actions (NEW):                                │
│  ├─ Send WhatsApp via Unipile                           │
│  ├─ Check WhatsApp Delivered                            │
│  └─ Check WhatsApp Replied                              │
└─────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────┐
│  Update Execution State                                 │
│  - Mark step completed                                  │
│  - Check for replies                                    │
│  - Calculate next_execution_at                          │
│  - Update campaign_prospect_execution_state             │
└─────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────┐
│  HITL Approval (if reply detected)                      │
│  - Create HITL session                                  │
│  - Pause campaign for this prospect                     │
│  - Wait for human approval                              │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Database Schema (Week 1)
- [ ] Create `campaign_prospect_execution_state` table
- [ ] Update campaigns flow_settings to support multi-step structure
- [ ] Migrate existing LinkedIn campaigns to new format
- [ ] Test migration with production data

### Phase 2: N8N - Email Support (Week 2)
- [ ] Add "Email Channel Router" branch to Campaign Handler
- [ ] Create "Send Email via Unipile" node
  - Endpoint: `POST https://${UNIPILE_DSN}/api/v1/messages/send`
  - Body: `{ account_id, to, subject, body, from_name }`
- [ ] Create "Check Email Reply" node
  - Query campaign_interactions for email_reply
- [ ] Test email campaign end-to-end

### Phase 3: N8N - WhatsApp Support (Week 3)
- [ ] Add "WhatsApp Channel Router" branch
- [ ] Create "Send WhatsApp via Unipile" node
  - Endpoint: `POST https://${UNIPILE_DSN}/api/v1/whatsapp/send`
  - Body: `{ account_id, to, message }`
- [ ] Create "Check WhatsApp Reply" node
- [ ] Test WhatsApp campaign end-to-end

### Phase 4: Multi-Step Orchestration (Week 4)
- [ ] Implement step progression logic
- [ ] Add delay scheduling between steps
- [ ] Add condition checking (skip_if_replied, etc.)
- [ ] Test multi-step campaigns

### Phase 5: Multi-Channel Campaigns (Week 5)
- [ ] Allow campaigns with mixed steps (LI → Email → LI)
- [ ] Cross-channel reply detection
- [ ] Smart routing (if replied on LI, skip email step)
- [ ] Test complex multi-channel sequences

---

## Unipile API Endpoints

### Email
```bash
# Send Email
POST https://api6.unipile.com:13670/api/v1/messages/send
Headers: { X-API-KEY: ${UNIPILE_API_KEY} }
Body: {
  "account_id": "email_account_id",
  "to": "prospect@company.com",
  "subject": "Quick question",
  "body": "Hi John, ...",
  "from_name": "Your Name"
}

Response: {
  "object": "EmailSent",
  "message_id": "msg_xyz123",
  "status": "sent"
}
```

### WhatsApp
```bash
# Send WhatsApp Message
POST https://api6.unipile.com:13670/api/v1/whatsapp/send
Headers: { X-API-KEY: ${UNIPILE_API_KEY} }
Body: {
  "account_id": "whatsapp_account_id",
  "to": "+1234567890",
  "message": "Hi John, ..."
}

Response: {
  "object": "WhatsAppSent",
  "message_id": "wa_msg_xyz",
  "status": "sent"
}
```

### LinkedIn (existing)
```bash
# Send Connection Request
POST https://api6.unipile.com:13670/api/v1/users/${linkedin_username}/invitation
Headers: { X-API-KEY: ${UNIPILE_API_KEY}, account-id: ${linkedin_account_id} }
Body: {
  "message": "Hi John, ..."
}
```

---

## Example: Multi-Channel Campaign Flow

```json
{
  "campaign_id": "abc-123",
  "name": "Multi-Channel Outreach Q4",
  "flow_settings": {
    "channel": "multi", // NEW: indicates multi-channel
    "steps": [
      {
        "step_number": 1,
        "channel": "linkedin",
        "action_type": "send_connection_request",
        "message_template_key": "connection_request",
        "delay_after_hours": 72,
        "wait_for_trigger": "connection_accepted",
        "skip_condition": null
      },
      {
        "step_number": 2,
        "channel": "email",
        "action_type": "send_email",
        "message_template_key": "email_intro",
        "delay_after_hours": 48,
        "wait_for_trigger": null,
        "skip_condition": "linkedin_connected" // Skip email if already connected on LinkedIn
      },
      {
        "step_number": 3,
        "channel": "linkedin",
        "action_type": "send_message",
        "message_template_key": "follow_up_1",
        "delay_after_hours": 120,
        "wait_for_trigger": null,
        "skip_condition": "already_replied"
      },
      {
        "step_number": 4,
        "channel": "whatsapp",
        "action_type": "send_whatsapp",
        "message_template_key": "whatsapp_check_in",
        "delay_after_hours": 168,
        "wait_for_trigger": null,
        "skip_condition": "already_replied"
      }
    ],
    "messages": {
      "connection_request": "Hi {first_name}, I'd love to connect...",
      "email_intro": "Subject: Quick intro\nHi {first_name}...",
      "follow_up_1": "Hello {first_name}, following up...",
      "whatsapp_check_in": "Hi {first_name}, just checking in..."
    }
  }
}
```

**Execution Sequence:**
1. Send LinkedIn CR → Wait up to 72 hours for acceptance
2. If not accepted, send Email after 48 hours
3. If LinkedIn accepted, send LinkedIn message after 5 days
4. If no reply on either, send WhatsApp after 7 days
5. HITL approval on any channel reply

---

## Benefits of This Approach

1. **Unified Orchestration** - One workflow handles all channels
2. **Flexible Sequencing** - Database-driven, not hardcoded in N8N
3. **Cross-Channel Intelligence** - Skip email if LinkedIn worked
4. **Easy to Extend** - Add SMS, phone calls, etc. just by adding new action types
5. **Scalable** - Database handles state, N8N just executes
6. **User-Configurable** - Future: UI to build custom sequences

---

## Migration Strategy

### For Existing LinkedIn Campaigns

```sql
-- Migrate existing campaigns to new format
UPDATE campaigns
SET flow_settings = jsonb_build_object(
  'channel', 'linkedin',
  'steps', jsonb_build_array(
    jsonb_build_object(
      'step_number', 1,
      'channel', 'linkedin',
      'action_type', 'send_connection_request',
      'message_template_key', 'connection_request',
      'delay_after_hours', 36,
      'wait_for_trigger', 'connection_accepted',
      'skip_condition', null
    ),
    jsonb_build_object(
      'step_number', 2,
      'channel', 'linkedin',
      'action_type', 'send_message',
      'message_template_key', 'follow_up_1',
      'delay_after_hours', 120,
      'wait_for_trigger', null,
      'skip_condition', 'already_replied'
    )
    -- Add more steps based on existing follow_up messages
  ),
  'messages', flow_settings->'messages'
)
WHERE campaign_type = 'linkedin' OR campaign_type = 'connector';
```

---

## Testing Plan

### Phase 1: Email-Only Campaign
- Create email campaign with 3 follow-ups
- Verify emails sent via Unipile
- Test reply detection via webhook
- Verify HITL approval triggered

### Phase 2: WhatsApp-Only Campaign
- Create WhatsApp campaign
- Verify messages sent
- Test delivery status
- Test reply detection

### Phase 3: Multi-Channel Campaign
- LinkedIn CR → Email → LinkedIn Message
- Verify step progression
- Test skip conditions
- Verify cross-channel reply detection

### Phase 4: Load Testing
- 100 prospects, multi-channel
- Monitor N8N performance
- Check database query performance
- Optimize slow queries

---

## Success Criteria

- ✅ Email campaigns execute with follow-ups
- ✅ WhatsApp campaigns execute
- ✅ Multi-channel campaigns route correctly
- ✅ Reply detection works for all channels
- ✅ HITL approval triggered on replies
- ✅ Existing LinkedIn campaigns continue working
- ✅ No performance degradation

---

## Next Steps

1. **Get approval** for database-driven architecture
2. **Create database migration** for execution_state table
3. **Download current N8N workflow** for modification
4. **Build email nodes** in N8N workflow
5. **Test email campaign** end-to-end
6. **Iterate** to WhatsApp, then multi-channel

---

**Last Updated:** November 15, 2025
**Owner:** SAM AI Team
**Status:** Awaiting approval
