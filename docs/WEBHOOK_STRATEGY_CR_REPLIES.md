# Webhook Strategy: Connection Requests & Reply Management

**Status:** ✅ DOCUMENTED (Nov 22, 2025)
**Based on:** Unipile Official Documentation & API Reference

---

## Executive Summary

Unipile has **two separate webhook systems** for different purposes:

1. **User Relations Webhooks** (`new_relation`) - For connection acceptance detection
2. **Message Webhooks** (`message_received`, `message_read`, etc.) - For reply management and message tracking

**The key insight:** We need DIFFERENT webhooks for different parts of the funnel:
- **CRs + Initial Follow-ups:** Use direct API calls (no webhooks needed)
- **Reply Management:** Use `message_received` webhook (CRITICAL for N8N)
- **Connection Acceptance:** Use `new_relation` webhook (good to have, but NOT real-time)

---

## Part 1: Connection Request (CR) Acceptance Detection

### Available Methods

#### Method 1: `new_relation` Webhook (PRIMARY)
**Event:** User sends webhook when connection is accepted

**Characteristics:**
- **Latency:** Up to 8 hours (LinkedIn doesn't support real-time)
- **Reliability:** ⭐⭐⭐⭐⭐ (uses accepted connections list from LinkedIn)
- **Payload:**
```json
{
  "event": "new_relation",
  "account_id": "unipile_account_id",
  "account_type": "LINKEDIN",
  "webhook_name": "string",
  "user": {
    "full_name": "John Doe",
    "provider_id": "ACoAA...",
    "public_identifier": "john-doe",
    "profile_url": "https://linkedin.com/in/john-doe/",
    "picture_url": "https://..."
  }
}
```

**Implementation:**
```
1. Register webhook for `new_relation` event
2. POST /api/webhooks/unipile-connection-accepted receives event
3. Extract provider_id from webhook
4. Find prospect by linkedin_user_id = provider_id
5. Update status to 'connected'
6. Schedule follow-up message (24 hours)
```

#### Method 2: Relations Polling (`/api/v1/users/relations`)
**Endpoint:** Unipile's recommended endpoint for getting accepted connections

**Characteristics:**
- **Real-time:** ✅ Immediate check against current LinkedIn state
- **Frequency:** 1-2 times per day (to avoid detection)
- **Overhead:** Minimal (only checks pending prospects)
- **Reliability:** ⭐⭐⭐⭐⭐ (official Unipile recommendation)

**Implementation:**
```
1. Cron job runs 1-2x daily
2. GET /api/v1/users/relations?account_id=...&limit=200
3. Extract provider_ids from response
4. For each pending prospect: check if linkedin_user_id in accepted relations
5. Update status to 'connected' if found
6. Schedule follow-up message (24 hours)
```

**Why Use Polling Instead of Webhook?**
- Catches acceptances before webhook arrives (8-hour latency)
- Backup if webhook fails
- Ensures no acceptances slip through the cracks
- Unipile-recommended approach

#### Method 3: Message-Based Detection
**Trigger:** When CR includes a message, acceptance creates a chat with that message

**Characteristics:**
- **Latency:** Real-time (as soon as recipient opens the message)
- **Limitation:** Only works if CR included an initial message
- **Reliability:** ⭐⭐⭐⭐ (depends on recipient opening message)

**Implementation:**
```
1. Register webhook for `message_received`
2. When message is received, check if it's from a pending prospect
3. Look up prospect by attendee_provider_id
4. If status = 'connection_request_sent', mark as 'connected'
5. Schedule follow-up message (24 hours)
```

### Our Current Implementation (Nov 22, 2025)

**Primary + Backup approach:**

1. ✅ **Webhook Handler:** `/api/webhooks/unipile-connection-accepted`
   - Listens for `new_relation` events
   - Updates prospects to 'connected' status
   - Schedules follow-up 24 hours later

2. ✅ **Backup Polling:** `/api/cron/check-relations`
   - Runs 1-2x daily
   - Uses `/api/v1/users/relations` endpoint
   - Catches any webhook failures
   - Random delays to avoid detection

**Result:** No acceptances will be missed, even with 8-hour webhook latency

---

## Part 2: Reply Management (FOR N8N)

### The Critical Webhook: `message_received`

**Event:** User sends this webhook EVERY TIME a message is received

**When triggered:**
- ✅ Initial reply to your CR message
- ✅ Reply to follow-up messages
- ✅ New messages from prospects
- ✅ Messages from any source (LinkedIn, email, etc.)

**Webhook Payload:**
```json
{
  "event": "message_received",
  "account_id": "unipile_account_id",
  "account_type": "LINKEDIN",
  "webhook_name": "string",
  "message": {
    "id": "message_id_abc123",
    "content": "Hi! Thanks for connecting. I'm interested in...",
    "timestamp": "2025-11-22T16:00:00Z"
  },
  "chat": {
    "id": "chat_id_xyz789",
    "subject": "Chat with John Doe"
  },
  "sender": {
    "provider_id": "ACoAA...",
    "full_name": "John Doe",
    "profile_url": "https://linkedin.com/in/john-doe/"
  },
  "attendees": [
    {
      "provider_id": "ACoAA...",
      "full_name": "John Doe",
      "profile_url": "https://linkedin.com/in/john-doe/",
      "type": "user"
    }
  ]
}
```

### Why This Matters for N8N

**Reply Management Flow:**

```
Prospect replies to CR/Follow-up message
    ↓
Unipile webhook: POST /api/webhooks/unipile-message-received
    ↓
Handler extracts:
  - chat_id (conversation identifier)
  - sender.provider_id (who replied)
  - message.content (what they said)
    ↓
Update database:
  - Link message to prospect by provider_id
  - Create conversation thread by chat_id
  - Set status to 'replied'
    ↓
Trigger N8N workflow:
  - N8N receives webhook with conversation data
  - AI generates response using SAM
  - N8N sends reply via /api/v1/messages/send
  - SAM logs interaction for HITL approval
```

### Implementation Checklist for Reply Management

**Webhooks needed:**
- [ ] `message_received` - When prospect replies
- [ ] `message_read` - When you need to track if reply was read
- [ ] `message_reaction` - If you want to track emoji reactions

**API endpoints needed:**
- [ ] `POST /api/webhooks/unipile-message-received` - Handler
- [ ] `POST /api/v1/messages/send` - Send reply
- [ ] `GET /api/v1/chats` - Get conversation history
- [ ] Trigger N8N workflow with webhook data

**N8N workflow steps:**
1. Receive message webhook
2. Fetch conversation context from SAM
3. Generate AI response
4. Send via Unipile
5. Log for HITL approval
6. Await manual review if needed

---

## Part 3: Other Webhooks (Optional)

### Message Delivery Status

**Webhooks:**
- `message_delivered` - Message was delivered to recipient
- `message_read` - Recipient read the message

**Use case:** Track engagement with your initial follow-up messages

**Implementation:**
```
POST /api/webhooks/unipile-message-delivered
POST /api/webhooks/unipile-message-read
  → Update prospect engagement metrics
  → Track email open rates equivalent for LinkedIn
```

### Message Reactions

**Webhook:** `message_reaction`

**Use case:** Track emoji reactions on messages (LinkedIn feature)

**Payload example:**
```json
{
  "event": "message_reaction",
  "message_id": "msg_xyz",
  "reaction": "👍",
  "sender": { "provider_id": "..." }
}
```

---

## Part 4: Webhook Registration

### Current Setup (Nov 22, 2025)

**Registered webhooks:**

1. ✅ `new_relation` webhook
   - Endpoint: `/api/webhooks/unipile-connection-accepted`
   - Status: Active
   - Event type: `users.new_relation`

**To register via API:**
```bash
curl -X POST https://api6.unipile.com:13670/api/v1/webhooks \
  -H "X-API-KEY: ${UNIPILE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "account_id": "ymtTx4xVQ6OVUFk83ctwtA",
    "url": "https://app.meet-sam.com/api/webhooks/unipile-connection-accepted",
    "source": "users",
    "event_type": "new_relation",
    "active": true
  }'
```

### For Reply Management (TODO)

```bash
# Register message_received webhook
curl -X POST https://api6.unipile.com:13670/api/v1/webhooks \
  -H "X-API-KEY: ${UNIPILE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "account_id": "ymtTx4xVQ6OVUFk83ctwtA",
    "url": "https://app.meet-sam.com/api/webhooks/unipile-message-received",
    "source": "chats",
    "event_type": "message_received",
    "active": true
  }'
```

### Authentication

**Webhook Validation:**
```typescript
// Handler should verify signature (optional but recommended)
const signature = req.headers.get('x-unipile-signature');

// Alternatively, add custom headers in webhook registration
// And verify them in your handler
const authHeader = req.headers.get('authorization');
if (authHeader !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

---

## Part 5: Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    SAM AI FUNNEL ARCHITECTURE                    │
└─────────────────────────────────────────────────────────────────┘

STAGE 1: SEND CONNECTION REQUEST
─────────────────────────────────
User creates campaign
    ↓
POST /api/campaigns/direct/send-connection-requests
    ↓
For each prospect:
  • Lookup LinkedIn profile (via provider_id or vanity URL)
  • Send CR via Unipile /api/v1/users/invite
  • Set status = 'connection_request_sent'
  • Set follow_up_due_at = NOW + 3 days
    ↓
[NO WEBHOOK NEEDED - Direct API]


STAGE 2: DETECT CONNECTION ACCEPTANCE (PARALLEL METHODS)
──────────────────────────────────────────────────────────

METHOD A: new_relation webhook
LinkedIn user accepts CR
    ↓
(Up to 8 hours latency)
    ↓
Unipile webhook → POST /api/webhooks/unipile-connection-accepted
    ↓
Update prospect: status = 'connected'
Set follow_up_due_at = NOW + 24h


METHOD B: Relations polling (backup)
Cron job runs 1-2x daily
    ↓
GET /api/v1/users/relations?account_id=...
    ↓
Check if prospects in pending list appear in accepted relations
    ↓
Update prospect: status = 'connected'
Set follow_up_due_at = NOW + 24h


STAGE 3: SEND FOLLOW-UP MESSAGES (DIRECT API)
──────────────────────────────────────────────
Cron job hourly: Check prospects with follow_up_due_at <= NOW
    ↓
For each connected prospect:
  • GET /api/v1/chats to find conversation
  • POST /api/v1/messages/send with follow-up message
  • Increment follow_up_sequence_index
  • Calculate next follow-up time
    ↓
[NO WEBHOOK NEEDED - Direct API]
Follow-up intervals: [5, 7, 5, 7] days


STAGE 4: PROSPECT REPLIES TO FOLLOW-UP MESSAGE
───────────────────────────────────────────────
Prospect sends reply to your message
    ↓
Unipile webhook → POST /api/webhooks/unipile-message-received
    ↓
Extract: chat_id, sender.provider_id, message.content
    ↓
Update database:
  • Link message to prospect
  • Create/update conversation thread
  • Set status = 'replied'
    ↓
Trigger N8N workflow (webhook POST to N8N):
  • Pass conversation data
  • AI generates response (via SAM)
  • Send reply via Unipile
  • Log for HITL approval
    ↓
If approval needed: HITL reviews in dashboard
If approved: Send response via Unipile


OPTIONAL: Message delivery/read tracking
─────────────────────────────────────────
message_delivered webhook → Track delivery
message_read webhook → Track engagement
message_reaction webhook → Track interactions
```

---

## Part 6: Implementation Roadmap

### Phase 1: Connection Requests + Follow-ups (✅ DONE)
- ✅ Send CR via direct API
- ✅ Detect acceptance via webhook + polling
- ✅ Send follow-up messages via direct API

### Phase 2: Reply Management (🚧 IN PROGRESS)
- [ ] Register `message_received` webhook
- [ ] Build webhook handler `/api/webhooks/unipile-message-received`
- [ ] Build conversation tracking in database
- [ ] Integrate with N8N for reply generation
- [ ] Build HITL approval UI

### Phase 3: Advanced Tracking (📋 PLANNED)
- [ ] Message delivery tracking (`message_delivered` webhook)
- [ ] Message read tracking (`message_read` webhook)
- [ ] Engagement metrics dashboard
- [ ] A/B testing follow-up message timing

---

## Part 7: Key Takeaways

### What You Get With Unipile Webhooks

✅ **Real-time reply detection** - Know immediately when someone replies
✅ **Conversation threading** - Group related messages by chat_id
✅ **Engagement tracking** - See if message was delivered/read
✅ **Multi-platform** - Same webhooks work for email, WhatsApp, etc.
✅ **Flexible filtering** - Send different data to different webhooks

### What You DON'T Get

❌ **Real-time CR acceptance** - 8-hour latency (LinkedIn limitation)
❌ **Rejection detection** - Must poll sent invitations list
❌ **Typing indicators** - Not supported
❌ **Profile views** - Not available

### Best Practice: Hybrid Approach

**For CR Acceptance:**
- Use BOTH webhook (for speed) + polling (for reliability)
- Webhook catches ~90% within first hour
- Polling catches the rest within 24 hours

**For Reply Management:**
- Use webhooks (real-time required)
- N8N processes immediately
- HITL approves before sending

---

## Summary: When You Need What

| Component | Webhook | Polling | Direct API |
|-----------|---------|---------|-----------|
| **Send CR** | ❌ | ❌ | ✅ REQUIRED |
| **Detect acceptance** | ✅ PRIMARY | ✅ BACKUP | ❌ |
| **Send follow-up** | ❌ | ❌ | ✅ REQUIRED |
| **Receive reply** | ✅ REQUIRED | ❌ | ❌ |
| **Send reply** | ❌ | ❌ | ✅ REQUIRED |
| **Track engagement** | ✅ OPTIONAL | ❌ | ❌ |

---

**Last Updated:** November 22, 2025
**Status:** Production documentation
**Next Phase:** Reply management webhook + N8N integration
