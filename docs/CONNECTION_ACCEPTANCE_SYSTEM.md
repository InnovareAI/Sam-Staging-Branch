# Connection Acceptance & Follow-Up System

## Overview

This document describes how the system detects when LinkedIn connection requests are accepted and triggers follow-up messages.

**Status:** ✅ IMPLEMENTED (Nov 22, 2025)
**Based on:** Unipile API documentation and best practices

---

## Architecture

### Three Methods (In Priority Order)

#### 1. **Webhook Method (PRIMARY - RECOMMENDED)**
- **Endpoint**: `/api/webhooks/unipile-connection-accepted`
- **Event**: `users.new_relation` from Unipile
- **Latency**: Up to 8 hours delay (acceptable per Unipile docs)
- **Reliability**: ⭐⭐⭐⭐⭐ (Real-time, no polling overhead)
- **Setup**: Run admin endpoint to register webhook

#### 2. **Relations Check (SECONDARY - BACKUP)**
- **Endpoint**: `/api/cron/check-relations`
- **Method**: Polls `/api/v1/users/relations` endpoint
- **Schedule**: 1-2 times per day with random delays
- **Reliability**: ⭐⭐⭐⭐ (Unipile recommended endpoint)
- **Overhead**: Minimal - only checks pending prospects

#### 3. **Legacy Polling (DEPRECATED - NOT USED)**
- ~~`/api/cron/poll-accepted-connections`~~ (kept for reference only)
- ~~Uses `network_distance === 'FIRST_DEGREE'`~~
- ~~Runs 3-4 times per day~~

---

## Flow

### Step 1: Send Connection Request
```
User creates campaign
    ↓
POST /api/campaigns/direct/send-connection-requests
    ↓
For each prospect:
  - Lookup LinkedIn profile using provider_id
  - Send invite via /api/v1/users/invite
  - Set status = 'connection_request_sent'
  - Set follow_up_due_at = NOW + 3 days
  - Set follow_up_sequence_index = 0
```

**Result in DB:**
```
status: 'connection_request_sent'
contacted_at: <timestamp>
linkedin_user_id: <provider_id>
connection_accepted_at: NULL
follow_up_due_at: <3 days from now>
follow_up_sequence_index: 0
```

### Step 2a: Webhook Detection (PRIMARY)
```
LinkedIn: Connection accepted
    ↓
Unipile: Detects new_relation event (up to 8 hours delay)
    ↓
Webhook POST to /api/webhooks/unipile-connection-accepted
    ↓
Handler:
  - Finds prospect by linkedin_user_id (provider_id)
  - Updates status = 'connected'
  - Sets connection_accepted_at = NOW
  - Sets follow_up_due_at = NOW + 24 hours
  - Sets follow_up_sequence_index = 0
```

### Step 2b: Relations Check (BACKUP)
```
Cron job (1-2x per day): GET /api/v1/users/relations?account_id=...
    ↓
For each pending prospect (status = 'connection_request_sent'):
  - Check if linkedin_user_id in relations list
  ↓
If found in relations:
  - Same updates as webhook above
```

### Step 3: Follow-Up Messages
```
Cron job (hourly): Check prospects with follow_up_due_at <= NOW
    ↓
For each prospect (status = 'connected'):
  - Lookup chat with prospect via /api/v1/chats
  - Send follow-up message
  - Increment follow_up_sequence_index
  - Calculate next follow-up time
  ↓
Follow-up intervals: [5, 7, 5, 7] days
  - FU1 (index 0): +5 days
  - FU2 (index 1): +7 days
  - FU3 (index 2): +5 days
  - FU4 (index 3): +7 days
  - After FU4: Status = 'messaging', no more follow-ups
```

---

## Setup Instructions

### 1. Register Webhook (One-Time Setup)

**Endpoint:** `POST /api/admin/register-unipile-webhook`

**Authorization:** Bearer token (admin only)

**Payload:**
```json
{
  "account_id": "ymtTx4xVQ6OVUFk83ctwtA",
  "webhook_url": "https://app.meet-sam.com/api/webhooks/unipile-connection-accepted"
}
```

**Response:**
```json
{
  "success": true,
  "webhook_id": "webhook_xxxxx",
  "message": "Webhook registered successfully",
  "details": {...}
}
```

### 2. Set Up Cron Jobs

**Connection Request Sending:**
- **Endpoint:** `POST /api/campaigns/direct/send-connection-requests`
- **Schedule:** Triggered manually by user or automatically when campaign is activated
- **Headers:** None required (called from UI)

**Relations Check (Backup):**
- **Endpoint:** `POST /api/cron/check-relations`
- **Schedule:** 1-2 times per day (e.g., 9 AM and 9 PM UTC)
- **Headers:** `x-cron-secret: <value from env>`
- **Service:** Use cron-job.org or similar

**Follow-Up Messages:**
- **Endpoint:** `POST /api/campaigns/direct/process-follow-ups`
- **Schedule:** Every hour
- **Headers:** `x-cron-secret: <value from env>`
- **Service:** Use cron-job.org or similar

---

## Database Schema

### campaign_prospects Table

**Key fields for connection acceptance:**

```sql
-- Connection request fields
status: 'connection_request_sent' | 'connected' | 'messaging' | 'failed' | ...
contacted_at: timestamp (when CR was sent)
linkedin_user_id: string (provider_id from Unipile)

-- Acceptance detection
connection_accepted_at: timestamp | NULL (when we detected acceptance)

-- Follow-up fields
follow_up_due_at: timestamp | NULL (when to send next message)
follow_up_sequence_index: integer (0-3, which follow-up to send)
last_follow_up_at: timestamp | NULL (when last FU was sent)
```

**State Transitions:**

```
pending → connection_request_sent → connected → messaging → (end)
                                   ↓
                                 failed (if error)
```

---

## Webhook Payload

**From Unipile:**
```json
{
  "id": "webhook_event_id",
  "account_id": "ymtTx4xVQ6OVUFk83ctwtA",
  "event_type": "new_relation",
  "source": "users",
  "data": {
    "provider_id": "ACoAACtFUtgBVA2KKiTrBOxxkm25rmUjo9f0OJA",
    "first_name": "John",
    "last_name": "Doe",
    "profile_url": "https://www.linkedin.com/in/john-doe/",
    "timestamp": "2025-11-22T16:00:00Z"
  }
}
```

**Our Handler:**
1. Extracts `provider_id` from `data.provider_id`
2. Queries `campaign_prospects` where `linkedin_user_id = provider_id`
3. Updates matching prospects to `status = 'connected'`
4. Sets `connection_accepted_at = NOW`
5. Sets `follow_up_due_at = NOW + 24 hours`
6. Resets `follow_up_sequence_index = 0` to send first follow-up

---

## Monitoring & Logs

### Webhook Handler Logs
- `POST /api/webhooks/unipile-connection-accepted`
- Look for: "Processing new connection", "Updated X prospect(s)"

### Relations Check Logs
- `POST /api/cron/check-relations`
- Look for: "Accepted:", "Still pending:", "Summary"

### Follow-Up Logs
- `POST /api/campaigns/direct/process-follow-ups`
- Look for: "Sending follow-up X", "All follow-ups sent"

---

## Testing

### Test Webhook Handler
```bash
curl -X POST https://app.meet-sam.com/api/webhooks/unipile-connection-accepted \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "new_relation",
    "source": "users",
    "account_id": "ymtTx4xVQ6OVUFk83ctwtA",
    "data": {
      "provider_id": "ACoAAEdwM3UB1tC2xflIFaffnR4qqdvQRaZ3V4w",
      "first_name": "Test",
      "last_name": "User",
      "profile_url": "https://www.linkedin.com/in/test-user/",
      "timestamp": "2025-11-22T16:00:00Z"
    }
  }'
```

### Test Relations Check
```bash
curl -X POST https://app.meet-sam.com/api/cron/check-relations \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

### Test Follow-Up
```bash
curl -X POST https://app.meet-sam.com/api/campaigns/direct/process-follow-ups \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

---

## Comparison: Old vs New

### Old System (DEPRECATED)
```
Polling via network_distance every 3-4 hours
  - Indirect method (checks "1st degree" status)
  - High overhead
  - Potential false positives
  - Network_distance can return wrong profiles (BUGGY)
```

### New System (IMPLEMENTED)
```
1. Webhook detection (real-time, up to 8 hours)
   - Direct event from Unipile
   - Zero polling overhead
   - Unipile recommended

2. Backup relations check (1-2x per day)
   - Uses /users/relations endpoint
   - Unipile recommended
   - Covers webhook failures
```

---

## Edge Cases

### Case 1: Prospect Accepts, Webhook Arrives After Cron
- ✅ Relations check runs, detects acceptance
- ✅ Updates prospect status to 'connected'
- ✅ No duplicate follow-ups (webhook won't re-trigger)

### Case 2: Webhook Fails, Cron Detects Acceptance
- ✅ Relations check finds acceptance
- ✅ Updates status correctly
- ✅ Triggers follow-ups

### Case 3: Acceptance Happens Before Webhook Setup
- ✅ Relations check (1-2x daily) will detect it
- ✅ System will mark as connected and start follow-ups

### Case 4: Prospect Rejects Connection
- ⚠️ No event from Unipile currently
- 📋 Feature: Could track via `/users/invitations/sent` (not yet implemented)

---

## Future Improvements

1. **Implement rejection detection**
   - Use `/users/invitations/sent` endpoint
   - Check for `status = 'rejected'`
   - Mark prospect as `status = 'rejected'`

2. **Add message webhook**
   - Detect replies to initial CR
   - Trigger custom response logic

3. **Implement InMail fallback**
   - Detect CR cooldown
   - Suggest InMail alternative

---

## Files

**New Endpoints:**
- `/app/api/webhooks/unipile-connection-accepted/route.ts` - Webhook handler
- `/app/api/admin/register-unipile-webhook/route.ts` - Webhook registration
- `/app/api/cron/check-relations/route.ts` - Relations check (backup)

**Updated Endpoints:**
- `/app/api/campaigns/direct/send-connection-requests/route.ts` - Sets follow_up_due_at
- `/app/api/campaigns/direct/process-follow-ups/route.ts` - Sends messages

**Deprecated:**
- `/app/api/cron/poll-accepted-connections/route.ts` - (kept for reference)

**Documentation:**
- This file: `docs/CONNECTION_ACCEPTANCE_SYSTEM.md`
- CLAUDE.md: Updated with webhook implementation

---

**Last Updated:** November 22, 2025
**Deployed:** November 22, 2025, 4:15 PM UTC
**Status:** ✅ PRODUCTION READY
