# Campaign Execution Flow Analysis - December 4, 2025

## Executive Summary

The SAM campaign execution system uses a **queue-based architecture** that handles both **Connector** (2nd/3rd degree) and **Messenger** (1st degree) campaigns through a unified pipeline. The system correctly integrates with Unipile's LinkedIn API for both connection requests and direct messaging.

**Status: ✅ ARCHITECTURE IS SOUND**

There are **2 critical issues** identified that require immediate attention:
1. Status naming inconsistency (`connection_request_sent` vs `connection_requested`)
2. Missing `messaging` status in prospect validation

---

## Architecture Overview

### Campaign Types

1. **Connector Campaigns** (2nd/3rd degree prospects)
   - Send connection requests first
   - Wait for acceptance
   - Send follow-up messages after acceptance

2. **Messenger Campaigns** (1st degree connections)
   - Skip connection requests
   - Send direct messages immediately
   - No waiting period required

---

## Campaign Execution Pipeline

### Phase 1: Queueing (`/api/cron/queue-pending-prospects`)

**Runs:** Every 5 minutes via Netlify scheduled functions

**Process:**
1. Finds active campaigns (both `connector` and `messenger` types)
2. Identifies unqueued prospects:
   - **Connector campaigns:** `status='pending'` (need connection request)
   - **Messenger campaigns:** `status='approved' OR status='pending'` (already connected)
3. Retrieves message templates:
   - **Connector:** `message_templates.connection_request`
   - **Messenger:** `message_templates.direct_message_1`
4. Personalizes messages with full variable support:
   - `{firstName}`, `{{firstName}}`, `{first_name}`, `{{first_name}}`
   - `{lastName}`, `{{lastName}}`, `{last_name}`, `{{last_name}}`
   - `{companyName}`, `{{companyName}}`, `{company}`, `{{company}}`
   - `{title}`, `{{title}}`
5. Creates `send_queue` records with:
   - `message_type`: `'connection_request'` or `'direct_message_1'`
   - `scheduled_for`: Spaced 2 minutes apart
   - `status`: `'pending'`

**Key Code:** `/app/api/cron/queue-pending-prospects/route.ts` (lines 64-67, 118-136)

```typescript
const isMessengerCampaign = campaign.campaign_type === 'messenger';
const targetStatuses = isMessengerCampaign
  ? ['approved', 'pending']  // Messenger: queue approved/pending 1st connections
  : ['pending'];             // Connector: queue pending prospects for connection requests
```

---

### Phase 2: Sending (`/api/cron/process-send-queue`)

**Runs:** Every 1 minute via Netlify scheduled functions

**Process:**
1. Finds next sendable message from queue (respects limits):
   - Business hours check (country-specific timezones)
   - Weekend blocking (Sat/Sun or Fri/Sat for Middle East)
   - Holiday blocking (30+ countries supported)
   - 2-minute spacing between messages per LinkedIn account
   - 40 messages/day daily cap (Sales Navigator limit)
2. Resolves LinkedIn profile:
   - If `linkedin_user_id` is provider_id (ACo format): Use directly
   - Otherwise: Extract vanity from URL → Use legacy `/api/v1/users/{vanity}?account_id=`
   - ⚠️ **NEVER use** `/api/v1/users/profile?identifier=` (returns wrong profiles)
3. Checks prospect status:
   - **Stop messaging** if `status IN ('replied', 'opted_out', 'converted', 'not_interested')`
   - **Skip follow-ups** if `requires_connection=true` and not connected yet
4. Sends message via Unipile:
   - **Connection Request:** `POST /api/v1/users/invite`
   - **Direct/Follow-up Message:** `POST /api/v1/chats`
5. Updates records:
   - Mark queue item as `sent`
   - Store in `campaign_messages` table
   - Update prospect status

**Key Code:** `/app/api/cron/process-send-queue/route.ts` (lines 483-558)

---

## Unipile API Integration

### ✅ Connection Requests (CORRECT)

**Endpoint:** `POST /api/v1/users/invite`

**Payload:**
```json
{
  "account_id": "ymtTx4xVQ6OVUFk83ctwtA",
  "provider_id": "ACoAABfK1...",
  "message": "Hi {firstName}, I noticed..."
}
```

**Used for:**
- Connector campaigns (initial message)

**Rate Limits:**
- 40/day for Sales Navigator accounts
- 2-minute spacing enforced
- LinkedIn weekly limit: ~100 connection requests

**Source:** [Unipile LinkedIn API](https://www.unipile.com/send-invitations-using-linkedin-api-from-your-software-application/)

---

### ✅ Direct Messages (CORRECT)

**Endpoint:** `POST /api/v1/chats`

**Payload:**
```json
{
  "account_id": "ymtTx4xVQ6OVUFk83ctwtA",
  "attendees_ids": ["ACoAABfK1..."],
  "text": "Thanks for connecting! I wanted to..."
}
```

**Used for:**
- Messenger campaigns (all messages)
- Connector campaigns (follow-ups after connection acceptance)

**Behavior:**
- Creates new chat if none exists
- Appends to existing chat thread if found
- Automatically handles thread management

**Constraints:**
- Only works for 1st degree connections (unless using InMail)
- For 2nd/3rd degree: Must send connection request first

**Rate Limits:**
- 100-150 messages/day recommended
- 2-minute spacing enforced

**Source:** [Unipile Send Messages API](https://developer.unipile.com/docs/send-messages)

---

## Prospect Status Flow

### Connector Campaign Flow

```
pending
  ↓ [Queue: connection_request]
connection_request_sent (contacted_at set)
  ↓ [Poll accepted connections cron]
connected
  ↓ [Queue: follow_up_1]
messaging
  ↓ [Queue: follow_up_2, follow_up_3...]
messaging
  ↓ [Prospect replies]
replied
```

### Messenger Campaign Flow

```
approved/pending (already 1st degree)
  ↓ [Queue: direct_message_1]
messaging (contacted_at set)
  ↓ [Queue: direct_message_2]
messaging
  ↓ [Prospect replies]
replied
```

---

## 🔴 CRITICAL ISSUES IDENTIFIED

### Issue 1: Status Naming Inconsistency

**Problem:**
- **Code uses:** `connection_request_sent`
- **Schema defines:** `connection_requested` (in old migration 20251031)
- **Newer migrations use:** `connection_request_sent` (migration 021, 020)

**Evidence:**

**Schema (OLD - 20251031_cleanup_campaign_prospects.sql):**
```sql
CHECK (status IN (
    'pending',
    'connection_requested',  -- ❌ OLD NAME
    'connected',
    ...
))
```

**Code (CURRENT - process-send-queue/route.ts:605):**
```typescript
status: 'connection_request_sent',  -- ✅ CURRENT NAME
```

**Validation trigger (021-create-status-validation-trigger.sql:10):**
```sql
IF NEW.status = 'connection_request_sent' AND NEW.contacted_at IS NULL THEN
  RAISE EXCEPTION 'Cannot set status to connection_request_sent...';
END IF;
```

**Impact:**
- Status updates may fail with CHECK constraint violation
- Triggers expect `connection_request_sent`
- Code uses `connection_request_sent`
- Old migration has `connection_requested`

**Fix Required:**
1. Update migration 20251031 to use `connection_request_sent`
2. Or create new migration to add `connection_request_sent` to CHECK constraint
3. Verify production database has correct constraint

---

### Issue 2: Missing `messaging` Status in Schema

**Problem:**
- **Code sets:** `status: 'messaging'` (process-send-queue/route.ts:621)
- **Schema defines:** No `messaging` status in 20251031 migration

**Evidence:**

**Code (process-send-queue/route.ts:617-627):**
```typescript
} else {
  // Messenger message or follow-up sent - update status
  await supabase
    .from('campaign_prospects')
    .update({
      status: 'messaging',  // ❌ NOT IN SCHEMA
      contacted_at: prospect.contacted_at || new Date().toISOString(),
      last_follow_up_at: new Date().toISOString(),
      ...
    })
}
```

**Schema (20251031_cleanup_campaign_prospects.sql:17):**
```sql
CHECK (status IN (
    'pending',
    'approved',
    'ready_to_message',
    'queued_in_n8n',
    'contacted',
    'connection_requested',
    'connected',
    'replied',
    'completed',
    -- ❌ NO 'messaging' status
    ...
))
```

**Validation trigger (021-create-status-validation-trigger.sql:16):**
```sql
IF NEW.status NOT IN ('connection_request_sent', 'connected', 'messaging', 'replied', 'failed') THEN
  -- ✅ Trigger expects 'messaging' status
  RAISE EXCEPTION '...';
END IF;
```

**Impact:**
- Follow-up messages fail to update prospect status
- Messenger campaigns cannot update to `messaging` status
- CHECK constraint violation

**Fix Required:**
Add `'messaging'` to the status CHECK constraint

---

## Rate Limiting & Safety Measures

### Per-Account Limits (Enforced)

1. **Minimum Spacing:** 2 minutes between messages
2. **Daily Cap:** 40 messages/day (Sales Navigator)
3. **Business Hours:** Configurable per campaign (default 9 AM - 5 PM)
4. **Weekend Blocking:** Country-specific (Sat/Sun or Fri/Sat)
5. **Holiday Blocking:** 30+ countries supported

### LinkedIn Platform Limits

1. **Connection Requests:** ~100/week
2. **Direct Messages:** 100-150/day recommended
3. **Account Blocks:** Triggered by rapid sending or spammy behavior

**Source:** [Unipile Rate Limits](https://www.unipile.com/linkedin-api-a-comprehensive-guide-to-integration/)

---

## Data Flow Architecture

```
CSV Upload
  ↓
prospect_approval_data
  ↓ [User approves]
campaign_prospects (status='pending')
  ↓ [Cron: queue-pending-prospects]
send_queue (status='pending', message_type='connection_request'/'direct_message_1')
  ↓ [Cron: process-send-queue]
Unipile API (/users/invite or /chats)
  ↓
LinkedIn Platform
  ↓ [Connection accepted]
campaign_prospects (status='connected')
  ↓ [Cron: queue-pending-prospects]
send_queue (message_type='follow_up_1', requires_connection=true)
  ↓ [Cron: process-send-queue]
Unipile API (/chats)
  ↓
LinkedIn Platform
```

---

## Testing Recommendations

### 1. Verify Status Constraint (HIGH PRIORITY)

**Run in Supabase SQL Editor:**
```sql
-- Check current constraint
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'campaign_prospects'::regclass
AND conname = 'campaign_prospects_status_check';

-- Should include: 'connection_request_sent' AND 'messaging'
```

### 2. Test Connector Campaign Flow

1. Upload prospects with 2nd degree connections
2. Create connector campaign
3. Verify queue creation (`SELECT * FROM send_queue WHERE message_type='connection_request'`)
4. Monitor cron logs: `netlify logs --function process-send-queue --tail`
5. Check prospect status updates to `connection_request_sent`

### 3. Test Messenger Campaign Flow

1. Upload prospects with 1st degree connections
2. Create messenger campaign with `campaign_type='messenger'`
3. Verify queue creation (`SELECT * FROM send_queue WHERE message_type='direct_message_1'`)
4. Monitor cron logs
5. Check prospect status updates to `messaging`

### 4. Verify Unipile Endpoints

**Test connection request:**
```bash
curl -X POST "https://api6.unipile.com:13670/api/v1/users/invite" \
  -H "X-API-KEY: 39qOAzhn.7ks6QfCYBMSYSEx4op78j57lD5ZItVooPcsN1Fu1EbE=" \
  -H "Content-Type: application/json" \
  -d '{
    "account_id": "ymtTx4xVQ6OVUFk83ctwtA",
    "provider_id": "ACoAABfK1...",
    "message": "Test message"
  }'
```

**Test direct message:**
```bash
curl -X POST "https://api6.unipile.com:13670/api/v1/chats" \
  -H "X-API-KEY: 39qOAzhn.7ks6QfCYBMSYSEx4op78j57lD5ZItVooPcsN1Fu1EbE=" \
  -H "Content-Type: application/json" \
  -d '{
    "account_id": "ymtTx4xVQ6OVUFk83ctwtA",
    "attendees_ids": ["ACoAABfK1..."],
    "text": "Test message"
  }'
```

---

## Files Reference

### Core Campaign Execution

- `/app/api/cron/queue-pending-prospects/route.ts` (234 lines) - Queues prospects
- `/app/api/cron/process-send-queue/route.ts` (774 lines) - Sends messages
- `/app/api/campaigns/direct/send-connection-requests/route.ts` (482 lines) - DISABLED direct send

### Database Schema

- `/sql/migrations/014-messenger-campaign-support.sql` - Messenger campaign type
- `/sql/migrations/013-add-message-type-to-send-queue.sql` - Message type support
- `/sql/migrations/021-create-status-validation-trigger.sql` - Status validation
- `/sql/migrations/20251031_cleanup_campaign_prospects.sql` - Status constraint (NEEDS UPDATE)

### Monitoring

- `/app/api/cron/poll-accepted-connections/route.ts` - Detects accepted connections
- `/app/api/cron/poll-message-replies/route.ts` - Detects prospect replies

---

## Recommendations

### Immediate Actions (P0)

1. **Fix Status Constraint** (30 minutes)
   - Create migration to add `connection_request_sent` and `messaging` to CHECK constraint
   - Apply to production database
   - Verify with test status update

2. **Test Both Campaign Types** (1 hour)
   - Create test connector campaign with 1 prospect
   - Create test messenger campaign with 1 prospect
   - Monitor queue and sending process
   - Verify status updates work correctly

### Future Improvements (P1)

1. **Add Status Transition Validation** (2 hours)
   - Prevent invalid status transitions (e.g., `pending` → `replied`)
   - Add trigger to enforce valid state machine
   - Document all valid transitions

2. **Enhance Error Handling** (2 hours)
   - Add retry logic for rate limit errors
   - Implement exponential backoff
   - Better error messages for common Unipile errors

3. **Improve Monitoring** (3 hours)
   - Dashboard for queue health
   - Alert on stuck messages
   - Real-time send rate tracking

---

## Conclusion

**The campaign execution architecture is fundamentally sound.** The Unipile API integration is correct for both connection requests (`/users/invite`) and direct messages (`/chats`). The queue-based system properly handles both connector and messenger campaigns.

**However, two critical database schema issues must be fixed immediately:**
1. Status constraint missing `connection_request_sent`
2. Status constraint missing `messaging`

**Once these schema fixes are deployed, the system will work correctly for both campaign types.**

---

**Last Updated:** December 4, 2025
**Author:** Claude Code Analysis
**Status:** Ready for Schema Fix → Production Testing
