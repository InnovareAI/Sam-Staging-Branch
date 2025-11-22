# Campaign Message Templates System

**Status:** ✅ DOCUMENTED (Nov 22, 2025)
**Current Schema:** 1 CR + 4 FU messages + 1 GB message

---

## Overview

The campaign message system stores all message templates in a single `message_templates` JSON object on the `campaigns` table:

```json
{
  "connection_request": "Hi {first_name}, I'd like to connect!",
  "alternative_message": "Alternative if CR fails...",
  "follow_up_messages": [
    "Follow-up 1",
    "Follow-up 2",
    "Follow-up 3",
    "Follow-up 4"
  ]
}
```

**Note:** The "goodbye" message is stored as `follow_up_messages[4]` (5th element in the array).

---

## Message Template Structure

### Storage Location
- **Table:** `campaigns`
- **Column:** `message_templates` (JSONB)
- **Type:** Immutable after first CR is sent

### Current Message Sequence

```
1. Connection Request (CR)
   - Sent immediately when campaign starts
   - Message: message_templates.connection_request
   - Field: {first_name}, {last_name}, {company_name}, {title}

2. Follow-up Message 1 (FU1)
   - Sent: 5 days after connection accepted
   - Message: message_templates.follow_up_messages[0]
   - Index: follow_up_sequence_index = 0

3. Follow-up Message 2 (FU2)
   - Sent: +7 days after FU1
   - Message: message_templates.follow_up_messages[1]
   - Index: follow_up_sequence_index = 1

4. Follow-up Message 3 (FU3)
   - Sent: +5 days after FU2
   - Message: message_templates.follow_up_messages[2]
   - Index: follow_up_sequence_index = 2

5. Follow-up Message 4 (FU4)
   - Sent: +7 days after FU3
   - Message: message_templates.follow_up_messages[3]
   - Index: follow_up_sequence_index = 3

6. Goodbye Message (GB)
   - Sent: +5 days after FU4
   - Message: message_templates.follow_up_messages[4]
   - Index: follow_up_sequence_index = 4
   - After this: status changes to 'messaging' (no more auto messages)

Total timeframe: ~29 days from connection acceptance to completion
```

### Follow-up Intervals (in days)
```typescript
const FOLLOW_UP_INTERVALS = [5, 7, 5, 7]; // FU1: +5d, FU2: +7d, FU3: +5d, FU4: +7d

// For the goodbye message, no next interval (sequence ends)
if (messageIndex >= followUpMessages.length) {
  status = 'messaging'
  follow_up_due_at = NULL
}
```

---

## What Happens If Templates Are Changed?

### ❌ PROBLEM 1: Templates Changed BEFORE Campaign Starts

**Scenario:** User creates campaign, edits templates, THEN starts campaign

**Impact:** ✅ SAFE
- Templates are read from database at CR send time
- Latest templates will be used
- No problem

---

### ⚠️ PROBLEM 2: Templates Changed AFTER Campaign Starts (Mid-Campaign)

**Scenario:** Campaign is running. User edits message templates. Follow-ups are in progress.

**What happens:**
- ✅ **Next follow-up will use NEW templates** (because code reads from campaign record at send time)
- ❌ **Inconsistent messaging** - Prospect might see different message tone/content

**Example:**
```
Day 1:  Send CR with template version A
Day 5:  Send FU1 with template version A
        → User edits templates to version B
Day 12: Send FU2 with template version B (DIFFERENT!)
Day 19: Send FU3 with template version B
Day 26: Send FU4 with template version B
```

**Risk Level:** 🔴 CRITICAL for consistency

---

### ⚠️ PROBLEM 3: Messages Deleted/Removed Mid-Campaign

**Scenario:** Campaign has 4 follow-ups. User edits to remove FU3 and FU4, leaving only 2.

**What happens:**
```
followUpMessages = [FU1, FU2]  // Only 2 messages now

Prospect processing:
- FU1 (index 0): ✅ Sent
- FU2 (index 1): ✅ Sent
- FU3 (index 2): ❌ Array[2] doesn't exist
  → Code sees messageIndex >= followUpMessages.length
  → Status changes to 'messaging'
  → NO GB message sent
  → Campaign ends early
```

**Risk Level:** 🔴 CRITICAL - Campaign ends prematurely

---

### ⚠️ PROBLEM 4: Messages Added/Expanded Mid-Campaign

**Scenario:** Campaign running with 4 FU messages. User adds FU5 and FU6.

**What happens:**
```
Original: [FU1, FU2, FU3, FU4]
Updated:  [FU1, FU2, FU3, FU4, FU5_NEW, FU6_NEW]

Prospect who already completed:
- If status = 'messaging': No more follow-ups will be sent
  → Extra messages ignored

Prospect in progress:
- follow_up_sequence_index = 2
- Next iteration checks array[3] = FU4_OLD
  → Works fine, uses existing message
- Eventually completes normally
```

**Risk Level:** 🟡 MEDIUM - Doesn't break, but new messages won't be sent to existing prospects

---

## How Template Changes Are Read

### The Code (process-follow-ups)

```typescript
// Line 238-240
const followUpMessages = campaign.message_templates?.follow_up_messages || [];
const messageIndex = prospect.follow_up_sequence_index;

// Line 263-267: Personalization uses current values
const message = followUpMessages[messageIndex]
  .replace(/{first_name}/g, prospect.first_name)
  .replace(/{last_name}/g, prospect.last_name)
  .replace(/{company_name}/g, prospect.company_name || '')
  .replace(/{title}/g, prospect.title || '');

// Line 279: CRITICAL - Uses hardcoded interval array, not templates
const nextInterval = FOLLOW_UP_INTERVALS[messageIndex];
```

**Key insight:** Templates are read at SEND TIME, not at campaign creation time.

---

## Current System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ CAMPAIGN CREATION                                                │
├─────────────────────────────────────────────────────────────────┤
│ User provides:                                                    │
│  - campaign_name                                                 │
│  - message_templates: {                                          │
│      connection_request: "...",                                  │
│      follow_up_messages: ["FU1", "FU2", "FU3", "FU4"],          │
│      ...                                                         │
│    }                                                             │
│                                                                  │
│ Stored in: campaigns.message_templates (JSONB)                 │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ CAMPAIGN EXECUTION: Send CR                                      │
├─────────────────────────────────────────────────────────────────┤
│ POST /api/campaigns/direct/send-connection-requests              │
│  1. Fetch campaign with message_templates
│  2. Read campaign.message_templates.connection_request
│  3. Personalize with {first_name}, {last_name}, etc.
│  4. Send via Unipile /api/v1/users/invite
│  5. Set prospect.status = 'connection_request_sent'
│  6. Set prospect.follow_up_due_at = NOW + 3 days
│  7. Set prospect.follow_up_sequence_index = 0
└─────────────────────────────────────────────────────────────────┘
                           ↓
              (Connection accepted - webhook)
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ CAMPAIGN EXECUTION: Process Follow-ups (Hourly Cron)            │
├─────────────────────────────────────────────────────────────────┤
│ POST /api/campaigns/direct/process-follow-ups                    │
│  for each prospect with follow_up_due_at <= NOW:                │
│   1. Fetch campaign (including updated message_templates)       │
│   2. Check if connection accepted                               │
│   3. Get message: followUpMessages[prospect.follow_up_sequence_index]
│   4. Personalize message                                        │
│   5. Send via Unipile /api/v1/chats/{id}/messages              │
│   6. Increment follow_up_sequence_index                         │
│   7. Calculate next follow_up_due_at using FOLLOW_UP_INTERVALS  │
│   8. Update database                                            │
│                                                                  │
│ CRITICAL: Templates are read from database at SEND TIME         │
│           If changed mid-campaign, NEW templates will be used   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Solutions/Recommendations

### Option 1: Freeze Templates Once Campaign Starts (RECOMMENDED)

**Implementation:**
```sql
-- Add 'frozen_at' column to campaigns table
ALTER TABLE campaigns ADD COLUMN frozen_at TIMESTAMP;
ALTER TABLE campaigns ADD COLUMN frozen_templates JSONB;

-- When campaign starts, copy templates
UPDATE campaigns
SET frozen_at = NOW(),
    frozen_templates = message_templates
WHERE id = campaign_id;

-- In code, always read frozen_templates instead of message_templates
const templates = campaign.frozen_templates || campaign.message_templates;
```

**Pros:**
- ✅ Guarantees consistency across entire campaign
- ✅ User can edit templates for future campaigns without affecting running campaigns
- ✅ Clear audit trail of what was used

**Cons:**
- ❌ Requires database migration
- ❌ User can't fix typos mid-campaign

---

### Option 2: Versioned Templates (MORE COMPLEX)

**Implementation:**
```typescript
{
  message_templates: {
    version: 1,
    created_at: "2025-11-22T...",
    connection_request: "...",
    follow_up_messages: [...]
  },
  message_template_history: [
    {
      version: 1,
      created_at: "2025-11-22T...",
      templates: {...}
    },
    {
      version: 2,
      created_at: "2025-11-23T...",
      templates: {...}
    }
  ]
}
```

**Pros:**
- ✅ Tracks all versions
- ✅ Can rollback to previous version

**Cons:**
- ❌ Complex implementation
- ❌ Still need versioning logic in code

---

### Option 3: Immutable at Campaign Start (SIMPLEST)

**Implementation:**
```typescript
// When saving message_templates, check campaign status
if (campaign.status !== 'draft') {
  return NextResponse.json(
    { error: 'Cannot edit templates once campaign has started' },
    { status: 400 }
  );
}
```

**Pros:**
- ✅ Simple to implement
- ✅ No database changes needed
- ✅ Guarantees consistency

**Cons:**
- ❌ User can't fix typos mid-campaign
- ❌ Must restart campaign to change templates

---

## Current Database Schema

### campaigns table (relevant fields)

```sql
CREATE TABLE campaigns (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  campaign_name VARCHAR(255) NOT NULL,

  -- Message templates
  message_templates JSONB DEFAULT '{
    "connection_request": "",
    "follow_up_messages": ["", "", "", ""]
  }',

  -- Campaign status
  status VARCHAR(50) DEFAULT 'draft', -- draft, active, paused, completed
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### campaign_prospects table (relevant fields)

```sql
CREATE TABLE campaign_prospects (
  id UUID PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id),

  -- Execution tracking
  status VARCHAR(50), -- pending, approved, connection_request_sent, connected, messaging
  contacted_at TIMESTAMP,
  connection_accepted_at TIMESTAMP,

  -- Follow-up tracking
  follow_up_sequence_index INTEGER DEFAULT 0,
  follow_up_due_at TIMESTAMP,
  last_follow_up_at TIMESTAMP
);
```

---

## Risk Assessment

| Risk | Current System | Likelihood | Impact | Mitigation |
|------|---|---|---|---|
| Template changed mid-campaign | ⚠️ Vulnerable | High | Medium | Freeze templates or make immutable |
| Messages deleted causing early end | ⚠️ Vulnerable | Medium | High | Validate template count on edit |
| Inconsistent personalization | ✅ Safe | Low | Medium | Already handled properly |
| Prospect data out of sync | ✅ Safe | Low | Medium | Already indexed by prospect ID |

---

## Recommended Next Steps

### Phase 1: Protect Current System (IMMEDIATE)
```typescript
// Add validation in campaign update endpoint
if (campaign.status !== 'draft') {
  throw new Error('Cannot edit templates for running campaigns');
}

// Or: Make templates immutable once first prospect is contacted
if (campaign.contacted_at && newTemplates !== oldTemplates) {
  throw new Error('Templates are frozen once campaign starts');
}
```

### Phase 2: Add Versioning (FUTURE)
```typescript
// When templates change, create new version
// But freeze active campaigns to current version
```

### Phase 3: UI/UX Improvements (FUTURE)
```typescript
// Show warning when editing running campaign
// Ask user: "This will affect pending follow-ups"
// Offer options: Apply to all / Apply only to new prospects
```

---

## Summary

**Current status:** Message templates are **NOT frozen** mid-campaign

**Impact if changed:**
- ✅ Next follow-up will use new template
- ❌ Campaign becomes inconsistent
- 🔴 Deleting messages can end campaign prematurely

**Recommendation:** Implement template freezing before running production campaigns

---

**Last Updated:** November 22, 2025
**Status:** Design & Architecture Documentation
**Next:** Implementation of template freezing system
