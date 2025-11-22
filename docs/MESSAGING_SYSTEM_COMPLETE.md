# LinkedIn Messaging System - Complete Technical Reference

**Status:** ✅ PRODUCTION (Nov 22, 2025)
**Last Updated:** November 22, 2025, 4:15 PM UTC
**Document Version:** 1.0

---

## Table of Contents
1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Connection Requests](#connection-requests)
4. [Connection Acceptance Detection](#connection-acceptance-detection)
5. [Follow-Up Messages](#follow-up-messages)
6. [API Endpoints](#api-endpoints)
7. [Database Schema](#database-schema)
8. [Known Issues & Bugs](#known-issues--bugs)
9. [Testing](#testing)
10. [Deployment History](#deployment-history)

---

## Overview

The LinkedIn messaging system manages the complete lifecycle of outbound LinkedIn engagement:
1. Sending connection requests (CRs)
2. Detecting when connections are accepted
3. Sending follow-up messages with configurable sequences
4. Managing message timing and retry logic

**Key Technologies:**
- Unipile API (for LinkedIn operations)
- Supabase PostgreSQL (for state management)
- Netlify Functions (for cron jobs)
- Webhooks (for real-time acceptance detection)

---

## System Architecture

### Three Core Flows

```
┌─────────────────────────────────────────────────────────────┐
│ 1. CONNECTION REQUEST FLOW                                   │
├─────────────────────────────────────────────────────────────┤
│ User creates campaign                                        │
│    ↓                                                          │
│ POST /api/campaigns/direct/send-connection-requests          │
│    ↓                                                          │
│ For each prospect:                                           │
│   - Lookup profile via provider_id or legacy endpoint        │
│   - Check relationship status (already connected?)           │
│   - Check for withdrawn invitations (LinkedIn cooldown)      │
│   - Send invite via /api/v1/users/invite                    │
│   - Update DB: status='connection_request_sent'             │
│   - Set follow_up_due_at = NOW + 3 days                     │
│   - Set follow_up_sequence_index = 0                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 2. ACCEPTANCE DETECTION FLOW                                 │
├─────────────────────────────────────────────────────────────┤
│ Option A: Webhook (PRIMARY)                                 │
│   - Unipile sends new_relation event                        │
│   - POST /api/webhooks/unipile-connection-accepted          │
│   - Update prospect: status='connected'                     │
│   - Set follow_up_due_at = NOW + 24 hours                   │
│                                                              │
│ Option B: Cron polling (BACKUP)                             │
│   - POST /api/cron/check-relations (1-2x daily)             │
│   - Uses /api/v1/users/relations endpoint                   │
│   - Same DB updates as webhook                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 3. FOLLOW-UP MESSAGE FLOW                                    │
├─────────────────────────────────────────────────────────────┤
│ Hourly cron job: POST /api/campaigns/direct/process-follow- │
│ ups                                                          │
│    ↓                                                          │
│ Find prospects: follow_up_due_at <= NOW                      │
│    ↓                                                          │
│ For each prospect (status='connected'):                      │
│   - Lookup chat via /api/v1/chats                           │
│   - Send message from follow_up_messages[index]             │
│   - Increment follow_up_sequence_index                      │
│   - Calculate next interval: [5,7,5,7] days                 │
│    ↓                                                          │
│ After 4 follow-ups: status='messaging' (done)               │
└─────────────────────────────────────────────────────────────┘
```

---

## Connection Requests

### Endpoint: POST /api/campaigns/direct/send-connection-requests

**Location:** `/app/api/campaigns/direct/send-connection-requests/route.ts`

**Purpose:** Send connection requests to prospects in a campaign

**Request:**
```json
{
  "campaignId": "uuid"
}
```

**Process:**

1. **Fetch campaign details**
   - Get campaign name, message templates, LinkedIn account
   - Verify account is connected to Unipile

2. **Fetch pending prospects**
   ```sql
   status IN ('pending', 'approved')
   OR (status = 'failed' AND updated_at < 24 hours ago)
   ```

3. **For each prospect:**

   **a) Duplicate check**
   - Same LinkedIn URL cannot exist in multiple campaigns
   - Prevents LinkedIn spam detection

   **b) Profile lookup** (CRITICAL BUG FIXED Nov 22)
   ```
   Tier 1: Use stored linkedin_user_id (provider_id) directly
      ✅ Most reliable

   Tier 2: Use legacy /api/v1/users/{vanity} endpoint
      ✅ Correctly resolves vanities with numbers
      ✅ Works where profile?identifier= breaks

   Tier 3: Never use /api/v1/users/profile?identifier=
      ❌ Returns WRONG profiles for vanities with numbers
      ❌ Example: "noah-ottmar-b59478295" returns "Jamshaid Ali"
   ```

   **c) Relationship checks**
   ```
   If network_distance === 'FIRST_DEGREE'
      → Skip: Already connected
      → Status: 'connected'

   If invitation?.status === 'WITHDRAWN'
      → Skip: LinkedIn cooldown (3-4 weeks)
      → Status: 'failed'
      → Notes: "Invitation previously withdrawn - cooldown until ~DATE"

   If invitation?.status === 'PENDING'
      → Skip: Already sent, pending response
      → Status: 'connection_request_sent'
   ```

   **d) Send CR**
   ```
   POST /api/v1/users/invite
   {
     "account_id": "unipile_account_id",
     "provider_id": "linkedin_internal_id",
     "message": "Hi {first_name}, personalized message..."
   }
   ```

   **e) Update database**
   ```sql
   UPDATE campaign_prospects
   SET
     status = 'connection_request_sent',
     contacted_at = NOW(),
     linkedin_user_id = provider_id,
     follow_up_due_at = NOW() + INTERVAL '3 days',
     follow_up_sequence_index = 0,
     updated_at = NOW()
   WHERE id = prospect.id
   ```

4. **Rate limiting**
   - 2-5 second delay between requests (human-like behavior)
   - Max 20 prospects per batch
   - Respects LinkedIn limits

**Response:**
```json
{
  "success": true,
  "processed": 20,
  "sent": 18,
  "failed": 2,
  "results": [
    {
      "prospectId": "uuid",
      "name": "John Doe",
      "status": "success",
      "nextActionAt": "2025-11-25T16:00:00Z"
    },
    {
      "prospectId": "uuid",
      "name": "Jane Smith",
      "status": "failed",
      "error": "Already connected",
      "reason": "already_connected"
    }
  ]
}
```

**Error Handling:**

```
Rate limited (HTTP 429)
  → Status: 'failed'
  → Notes: "Rate limited: Too many requests. Wait before retrying."

Already invited recently
  → Status: 'failed'
  → Notes: "LinkedIn cooldown: This person was recently invited/withdrawn..."

Profile lookup failed
  → Status: 'failed'
  → Notes: "CR failed: [error message]"
```

---

## Connection Acceptance Detection

### Method 1: Webhook (PRIMARY) ⭐⭐⭐⭐⭐

**Endpoint:** `POST /api/webhooks/unipile-connection-accepted`

**Location:** `/app/api/webhooks/unipile-connection-accepted/route.ts`

**Setup (One-time):**

Call `POST /api/admin/register-unipile-webhook` with:
```json
{
  "account_id": "ymtTx4xVQ6OVUFk83ctwtA",
  "webhook_url": "https://app.meet-sam.com/api/webhooks/unipile-connection-accepted"
}
```

**How it works:**
1. User accepts CR on LinkedIn
2. Unipile detects `new_relation` event (up to 8-hour delay is acceptable per Unipile docs)
3. Unipile sends webhook POST to our handler
4. Handler finds prospect by `provider_id` and updates status

**Webhook Payload:**
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

**Handler Logic:**

```typescript
// Find prospect by provider_id
const prospects = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('linkedin_user_id', provider_id)
  .eq('status', 'connection_request_sent');

// Update all matches
for (const prospect of prospects) {
  const followUpDueAt = new Date();
  followUpDueAt.setHours(followUpDueAt.getHours() + 24);

  await supabase
    .from('campaign_prospects')
    .update({
      status: 'connected',
      connection_accepted_at: NOW(),
      follow_up_due_at: followUpDueAt,
      follow_up_sequence_index: 0,
      updated_at: NOW()
    })
    .eq('id', prospect.id);
}
```

**Advantages:**
- ✅ Real-time (up to 8 hours)
- ✅ Zero polling overhead
- ✅ Unipile recommended
- ✅ Reliable

---

### Method 2: Relations Check (BACKUP) ⭐⭐⭐⭐

**Endpoint:** `POST /api/cron/check-relations`

**Location:** `/app/api/cron/check-relations/route.ts`

**Schedule:** 1-2 times per day with random delays (e.g., 9 AM and 9 PM UTC)

**Headers:** `x-cron-secret: <env value>`

**Purpose:** Backup system in case webhooks fail

**How it works:**

1. Add random delay (0-5 minutes) to avoid fixed timing
2. Fetch all pending CRs: `status = 'connection_request_sent'`
3. For each account, call `GET /api/v1/users/relations?account_id=...&limit=200`
4. Compare returned provider_ids with prospects
5. Update matches to `status = 'connected'`

**Logic:**
```typescript
// Get all relations for account
const relations = await unipileRequest(
  `/api/v1/users/relations?account_id=${accountId}&limit=200`
);

// Extract accepted provider IDs
const acceptedIds = new Set(
  relations.items.map(r => r.provider_id)
);

// Check each pending prospect
for (const prospect of prospects) {
  if (acceptedIds.has(prospect.linkedin_user_id)) {
    // Connection accepted!
    await supabase
      .from('campaign_prospects')
      .update({
        status: 'connected',
        connection_accepted_at: NOW(),
        follow_up_due_at: NOW() + 24 hours,
        follow_up_sequence_index: 0
      })
      .eq('id', prospect.id);
  }
}
```

**Advantages:**
- ✅ Backup to webhook system
- ✅ Uses `/users/relations` (Unipile recommended endpoint)
- ✅ Low overhead (only checks 50 prospects per run)
- ✅ Catches webhook failures

---

### Deprecated Method (DO NOT USE)

❌ **`/api/cron/poll-accepted-connections`** - Uses `network_distance`

**Why deprecated:**
- Indirect detection method
- High overhead (runs 3-4x daily)
- Can return wrong profiles due to Unipile bugs

**Kept for:** Reference only

---

## Follow-Up Messages

### Endpoint: POST /api/campaigns/direct/process-follow-ups

**Location:** `/app/api/campaigns/direct/process-follow-ups/route.ts`

**Schedule:** Every hour (via cron job)

**Headers:** `x-cron-secret: <env value>`

**Purpose:** Send follow-up messages after connection accepted

**Process:**

1. **Find due prospects**
   ```sql
   SELECT * FROM campaign_prospects
   WHERE status = 'connection_request_sent'
   AND follow_up_due_at <= NOW()
   AND follow_up_due_at IS NOT NULL
   ORDER BY follow_up_due_at ASC
   ```

2. **For each prospect:**

   **a) Check acceptance**
   ```
   Lookup profile via:
     - Tier 1: Use linkedin_user_id (provider_id)
     - Tier 2: Use legacy /api/v1/users/{vanity}

   Check: network_distance === 'FIRST_DEGREE'
     ✅ If yes: Connection accepted, continue to messaging
     ⏸️ If no: Still pending, retry in 24 hours
   ```

   **b) Find or create chat**
   ```
   GET /api/v1/chats?account_id=...

   Look for chat where:
     attendees.provider_id === prospect.linkedin_user_id

   If not found:
     ⏸️ Wait 2 hours, retry (chat might be creating)
   ```

   **c) Send message**
   ```
   Message template: follow_up_messages[follow_up_sequence_index]

   Personalization tokens:
     {first_name}
     {last_name}
     {company_name}
     {title}

   POST /api/v1/chats/{chat_id}/messages
   {
     "text": "personalized message"
   }
   ```

   **d) Update database**
   ```sql
   UPDATE campaign_prospects
   SET
     follow_up_sequence_index = follow_up_sequence_index + 1,
     last_follow_up_at = NOW(),
     follow_up_due_at = CASE
       WHEN follow_up_sequence_index < 4
         THEN NOW() + INTERVAL FOLLOW_UP_INTERVALS[index] days
       ELSE NULL
     END,
     updated_at = NOW()
   WHERE id = prospect.id
   ```

3. **Follow-up intervals**
   ```
   FOLLOW_UP_INTERVALS = [5, 7, 5, 7]

   Index 0: Send FU1 after 5 days
   Index 1: Send FU2 after 7 days
   Index 2: Send FU3 after 5 days
   Index 3: Send FU4 after 7 days
   Index 4+: No more follow-ups, status = 'messaging'
   ```

4. **Mark as complete**
   ```
   After 4 follow-ups:
     status = 'messaging'
     follow_up_due_at = NULL

   Prospect no longer needs scheduled follow-ups
   ```

**Error Handling:**

```
Profile lookup failed
  → Retry in 2 hours
  → Status: unchanged

No chat found
  → Retry in 2 hours
  → Status: unchanged

Message send failed
  → Status: 'failed'
  → Notes: "FU failed: [error]"
  → Retry in 24 hours (after cooldown)
```

**Response:**
```json
{
  "success": true,
  "processed": 15,
  "sent": 12,
  "pending_acceptance": 2,
  "failed": 1,
  "results": [
    {
      "prospectId": "uuid",
      "name": "John Doe",
      "status": "success",
      "sequenceIndex": 1
    }
  ]
}
```

---

## API Endpoints

### Connection Requests

| Endpoint | Method | Purpose | Auth | Schedule |
|----------|--------|---------|------|----------|
| `/api/campaigns/direct/send-connection-requests` | POST | Send CRs | Campaign user | Manual/Auto |
| `/api/campaigns/direct/process-follow-ups` | POST | Send follow-ups | Cron secret | Hourly |

### Connection Acceptance

| Endpoint | Method | Purpose | Auth | Schedule |
|----------|--------|---------|------|----------|
| `/api/webhooks/unipile-connection-accepted` | POST | Receive acceptance webhook | None (Unipile) | Real-time |
| `/api/admin/register-unipile-webhook` | POST | Register webhook | Bearer token | Once |
| `/api/cron/check-relations` | POST | Backup acceptance check | Cron secret | 1-2x daily |
| `/api/cron/poll-accepted-connections` | POST | DEPRECATED | Cron secret | Deprecated |

### Configuration

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/webhooks/unipile-connection-accepted` | GET | Info/test |
| `GET /api/cron/check-relations` | GET | Info/test |
| `GET /api/campaigns/direct/send-connection-requests` | GET | Info/test |

---

## Database Schema

### campaign_prospects Table

**All fields:**
```sql
id (uuid, PK)
campaign_id (uuid, FK → campaigns)
workspace_id (uuid, FK → workspaces)

-- Contact info
first_name (text)
last_name (text)
email (text)
title (text)
company_name (text)
location (text)

-- LinkedIn
linkedin_url (text) -- Full URL with miniProfileUrn preserved
linkedin_user_id (text) -- provider_id from Unipile (CRITICAL)
connection_degree (text) -- 1st, 2nd, 3rd, etc.

-- Campaign status
status (text) -- pending, approved, connection_request_sent, connected, messaging, failed
notes (text) -- Error messages or status notes

-- Timing
created_at (timestamp)
updated_at (timestamp)
contacted_at (timestamp) -- When CR was sent
connection_accepted_at (timestamp) -- When acceptance detected
last_follow_up_at (timestamp) -- When last FU was sent

-- Follow-ups
follow_up_due_at (timestamp) -- When to send next message
follow_up_sequence_index (integer) -- 0-3 (which FU to send)
```

**State machine:**
```
pending
  ↓ (User approves)
approved
  ↓ (send-connection-requests runs)
connection_request_sent
  ├→ connected (acceptance detected)
  │   ↓ (process-follow-ups runs)
  │   messaging (4 follow-ups sent)
  │
  └→ failed (CR failed)
```

**Key constraints:**
- `linkedin_user_id` must be set before sending follow-ups
- `follow_up_due_at` is NULL after all follow-ups sent
- One prospect can only be in ONE campaign

---

## Known Issues & Bugs

### Issue 1: Unipile Profile Lookup Bug (FIXED Nov 22)

**Status:** ✅ RESOLVED

**Description:**
- Unipile's `/api/v1/users/profile?identifier=` endpoint returns WRONG profiles for vanity URLs containing numbers
- Example: `noah-ottmar-b59478295` returns **Jamshaid Ali** instead of **Noah Ottmar**

**Root Cause:**
- Unipile bug in identifier parameter handling
- Only affects vanity URLs with numbers
- Full URLs and provider_ids work correctly

**Solution Implemented:**
- ✅ Never use `/api/v1/users/profile?identifier=` for profile lookup
- ✅ Use legacy `/api/v1/users/{vanity}?account_id=...` instead
- ✅ Prefer provider_id when available
- ✅ Code comments added to prevent regression

**Files Fixed:**
- `/app/api/campaigns/direct/send-connection-requests/route.ts` (lines 194-226)
- `/app/api/campaigns/direct/process-follow-ups/route.ts` (lines 117-131)
- `/app/api/cron/poll-accepted-connections/route.ts` (lines 133-147)

**Test Case:**
```
Prospect: Noah Ottmar
URL: https://www.linkedin.com/in/noah-ottmar-b59478295?miniProfileUrn=...
Vanity: noah-ottmar-b59478295

Before fix:
  /api/v1/users/profile?identifier=noah-ottmar-b59478295
  ❌ Returns: Jamshaid Ali profile

After fix:
  /api/v1/users/noah-ottmar-b59478295?account_id=...
  ✅ Returns: Noah Ottmar profile (correct)
```

---

### Issue 2: LinkedIn Header Format (FIXED Nov 22)

**Status:** ✅ RESOLVED

**Description:**
- Code was using `X-Api-Key` (incorrect) instead of `X-API-KEY` (correct)
- Caused all Unipile API calls to fail with 401 Unauthorized

**Solution Implemented:**
- ✅ Changed all instances to `X-API-KEY` (uppercase with hyphens)
- ✅ Applied to 4 files

**Files Fixed:**
- `/app/api/campaigns/direct/send-connection-requests/route.ts` (line 26)
- `/app/api/campaigns/direct/process-follow-ups/route.ts` (line 27)
- `/app/api/cron/poll-accepted-connections/route.ts` (line 27)
- `/netlify/functions/process-linkedin-search-background.ts` (line 76)

---

### Issue 3: Missing Provider ID Storage (FIXED Nov 22)

**Status:** ✅ RESOLVED

**Description:**
- Search endpoint wasn't returning `provider_id` to frontend
- Upload endpoint wasn't storing `provider_id` in database
- System fell back to unreliable vanity URL resolution

**Solution Implemented:**
- ✅ Search endpoint returns `providerId: item.id`
- ✅ Upload endpoint stores `linkedin_provider_id` in database
- ✅ Send CR uses stored provider_id as primary method

**Files Fixed:**
- `/app/api/linkedin/search/simple/route.ts` (line 945-946)
- `/app/api/prospect-approval/upload-prospects/route.ts` (line 232)
- `/app/api/campaigns/direct/send-connection-requests/route.ts` (lines 191-226)

---

### Issue 4: URL Cleaning Removing Context (FIXED Nov 22)

**Status:** ✅ RESOLVED

**Description:**
- Code was cleaning LinkedIn URLs, removing `miniProfileUrn` parameter
- This parameter contains critical context for Unipile lookups
- Result: Lost information needed for reliable profile matching

**Solution Implemented:**
- ✅ Preserve full LinkedIn URLs unchanged
- ✅ Store with all query parameters intact
- ✅ Only extract vanity identifier when needed (not full URL)

**File Fixed:**
- `/app/api/prospect-approval/upload-prospects/route.ts` (line 230)

---

### Known Limitation: Webhook 8-Hour Delay

**Status:** ⚠️ ACCEPTED (Per Unipile Docs)

**Description:**
- Unipile webhook for `new_relation` events can have up to 8-hour delay
- This is a LinkedIn limitation, not Unipile bug
- LinkedIn doesn't provide real-time connection events

**Mitigation:**
- Backup cron job (`check-relations`) runs 1-2x daily
- Catches any acceptances webhook might miss
- Ensures follow-ups start within 24 hours max

---

### Known Limitation: No Rejection Detection

**Status:** 📋 FUTURE

**Description:**
- System doesn't detect when prospects reject CRs
- Could use `/users/invitations/sent` endpoint
- Not yet implemented

**Workaround:**
- Manual review of prospects stuck in `connection_request_sent` status
- Can manually mark as `failed` if needed

---

## Testing

### Test Connection Request Sending

```bash
curl -X POST https://app.meet-sam.com/api/campaigns/direct/send-connection-requests \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "your-campaign-id"
  }'
```

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

### Test Follow-Ups

```bash
curl -X POST https://app.meet-sam.com/api/campaigns/direct/process-follow-ups \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

### Check Endpoint Info

```bash
curl https://app.meet-sam.com/api/campaigns/direct/send-connection-requests
curl https://app.meet-sam.com/api/webhooks/unipile-connection-accepted
curl https://app.meet-sam.com/api/cron/check-relations
```

---

## Deployment History

### November 22, 2025 - 3:37 PM UTC
**Deploy 1: Core API Key & Header Fixes**
- Fixed Unipile API key (was invalid in production)
- Fixed HTTP header format: `X-Api-Key` → `X-API-KEY`
- Deployed to https://app.meet-sam.com
- Status: ✅ WORKING

### November 22, 2025 - 4:03 PM UTC
**Deploy 2: Profile Lookup Bug Fix**
- Fixed Unipile profile lookup returning wrong profiles for vanity URLs with numbers
- Implemented proper fallback: provider_id → legacy endpoint → extract vanity
- Added critical code comments to prevent regression
- Deployed to https://app.meet-sam.com
- Status: ✅ VERIFIED (Noah Ottmar CR sent successfully)

### November 22, 2025 - 4:15 PM UTC
**Deploy 3: Connection Acceptance System**
- Implemented webhook for real-time connection detection
- Implemented backup relations check cron job
- Added webhook registration endpoint
- Deprecated legacy polling system
- Documentation: `docs/CONNECTION_ACCEPTANCE_SYSTEM.md`
- Deployed to https://app.meet-sam.com
- Status: ✅ READY FOR SETUP

---

## Configuration

### Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://latxadqrvrrrcvkktrog.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<key>
SUPABASE_SERVICE_ROLE_KEY=<key>

UNIPILE_DSN=api6.unipile.com:13670
UNIPILE_API_KEY=POcBmCSV.b/t0gstHvY5alDsy/BmKQmUBt4FmNXRF7fdOYqywJSM=

CRON_SECRET=<secret_value>

NODE_ENV=production
```

### Cron Jobs to Set Up

**Relations Check (Backup acceptance detection):**
```
Schedule: Daily at 9 AM and 9 PM UTC
URL: https://app.meet-sam.com/api/cron/check-relations
Header: x-cron-secret: <value>
Service: cron-job.org or similar
```

**Follow-Ups (Send messages):**
```
Schedule: Every hour at :00
URL: https://app.meet-sam.com/api/campaigns/direct/process-follow-ups
Header: x-cron-secret: <value>
Service: cron-job.org or similar
```

---

## Links to Code Files

| File | Purpose |
|------|---------|
| `/app/api/campaigns/direct/send-connection-requests/route.ts` | Send CRs |
| `/app/api/campaigns/direct/process-follow-ups/route.ts` | Send follow-ups |
| `/app/api/webhooks/unipile-connection-accepted/route.ts` | Webhook handler |
| `/app/api/admin/register-unipile-webhook/route.ts` | Webhook registration |
| `/app/api/cron/check-relations/route.ts` | Relations backup check |
| `/app/api/cron/poll-accepted-connections/route.ts` | DEPRECATED |
| `/app/api/linkedin/search/simple/route.ts` | Search (returns provider_id) |
| `/app/api/prospect-approval/upload-prospects/route.ts` | Upload (stores provider_id) |

---

**Document Status:** ✅ COMPLETE & PRODUCTION READY
**Last Update:** November 22, 2025, 4:15 PM UTC
**Next Review:** As issues arise (document gets updated only)
