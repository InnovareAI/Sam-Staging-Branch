# Message Randomizer & Anti-Detection System

**Status:** ✅ IMPLEMENTED (in N8N flow)
**Purpose:** Avoid LinkedIn automation detection by mimicking human behavior
**Current Location:** `/app/api/campaigns/linkedin/execute-via-n8n/route.ts`

---

## Overview

You have a **sophisticated message randomizer** that generates human-like sending patterns to avoid LinkedIn detection.

**Key Features:**
- ✅ Variable sending speeds (0-5 messages/hour)
- ✅ Day-specific patterns (different each day)
- ✅ Weekend/holiday respect
- ✅ Working hours enforcement (5 AM - 6 PM PT)
- ✅ Daily limit enforcement (20 CRs/day free tier)
- ✅ +/- 30% random variation
- ✅ Burst patterns (alternating fast/slow)

---

## How the Randomizer Works

### 1. Day-Specific Pattern Seeding

```typescript
// Line 106: Seed based on date + account ID
const dateSeed = parseInt(today.replace(/-/g, '')) + unipileAccountId.charCodeAt(0);
const dayPattern = (dateSeed % 5); // 5 different patterns
```

**Why this approach:**
- ✅ Same account gets SAME pattern each day (seeded by date)
- ✅ Different accounts get DIFFERENT patterns (charCodeAt variation)
- ✅ Looks human: "I usually send messages around this time"
- ✅ Not truly random: Deterministic seeding

**Example:**
- Account A, Nov 22: Pattern #2 (Busy day: 3-5 msg/hr)
- Account A, Nov 23: Pattern #0 (Slow day: 0-2 msg/hr)
- Account B, Nov 22: Pattern #4 (Random walk: 1-5 msg/hr)

### 2. Five Day Patterns

```typescript
// Lines 112-130: Different patterns for variety

case 0: // Slow day: 0-2 messages/hour
  hourlyRate = Math.random() * 2;

case 1: // Medium day: 2-3 messages/hour
  hourlyRate = 2 + Math.random();

case 2: // Busy day: 3-5 messages/hour
  hourlyRate = 3 + Math.random() * 2;

case 3: // Burst pattern: alternate fast/slow
  hourlyRate = (prospectIndex % 2 === 0) ? 4 + Math.random() : 1 + Math.random();

case 4: // Random walk: each message slightly different
  hourlyRate = 1 + Math.random() * 4;
```

**Visual representation:**

```
Slow Day (0-2 msg/hr):
  |
  +--+-----+--------+-----+-----+
  30m  45m   60m     90m   120m

Busy Day (3-5 msg/hr):
  |
  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
  15m 20m 15m 25m 18m 20m...

Burst Pattern:
  |
  ++---------++----------++----+
  5m  [long]  3m [long]  4m[lg]
  (Fast)      (Slow)
```

### 3. Individual Message Variation

```typescript
// Lines 134-136: Add +/- 30% randomness to each message
const baseDelayMinutes = 60 / hourlyRate;
const randomness = 0.7 + Math.random() * 0.6; // 0.7 to 1.3x multiplier
const delayMinutes = Math.floor(baseDelayMinutes * randomness);
```

**Example for medium day (2.5 msg/hr = 24 min base):**
- Message 1: 24min × 0.85 = 20 minutes ✅
- Message 2: 24min × 1.15 = 28 minutes ✅
- Message 3: 24min × 0.92 = 22 minutes ✅
- Message 4: 24min × 1.28 = 31 minutes ✅

Human-like variation: No two messages have exact same spacing.

### 4. Working Hours Enforcement

```typescript
// Lines 66-89: Respect working hours + timezone
const timezone = campaignSettings?.timezone || 'America/Los_Angeles';
const workingHoursStart = 5;  // 5 AM PT (8 AM ET)
const workingHoursEnd = 18;   // 6 PM PT (9 PM ET)

if (isOutsideWorkingHours) {
  return hoursUntilStart * 60; // Wait until morning
}
```

**Why this matters:**
- LinkedIn users don't send messages at 3 AM
- AI assistant behavior is suspicious
- Enforce "office hours" pattern

### 5. Weekend & Holiday Respect

```typescript
// Lines 92-96: Skip weekends
if (isWeekend && skipWeekends) {
  console.log(`Weekend detected, skipping until Monday`);
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 2;
  return daysUntilMonday * 24 * 60;
}
```

---

## Current Limitation: N8N Dependency

### ⚠️ The Problem

The randomizer is implemented in **N8N flow**, not in the direct API system we're using:

```
Current architecture:
  /api/campaigns/direct/send-connection-requests
    └─ Direct Unipile API calls
    └─ NO randomization
    └─ All CRs sent in rapid succession

N8N flow (legacy):
  /api/campaigns/linkedin/execute-via-n8n
    └─ Calls randomizer function
    └─ Generates delays
    └─ Passes to N8N workflow
    └─ N8N handles actual sending
```

**For direct API campaigns, randomization is NOT active!**

### Current Send Pattern (Direct API)

```typescript
// From send-connection-requests/route.ts (line 280)
await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
```

**What this does:**
- 2-5 second delay between API calls
- **NOT enough** to avoid detection
- All 20 prospects sent within ~1-2 minutes
- Looks like automation (batch job)

### What It Should Do

```typescript
// Using the randomizer for direct API
const delayMinutes = await calculateHumanSendDelay(
  supabase,
  unipileAccountId,
  prospects.length,
  prospectIndex,
  campaignSettings
);

await new Promise(resolve =>
  setTimeout(resolve, delayMinutes * 60 * 1000)
);
```

**This would:**
- ✅ Space CRs 20-90 minutes apart (depending on day pattern)
- ✅ Respect working hours (no 3 AM sends)
- ✅ Honor daily limits (max 20/day free tier)
- ✅ Look human (variable patterns)

---

## Solution: Integrate Randomizer into Direct API

### Option 1: Add Delay Queue to Database (RECOMMENDED)

**How it works:**
```
1. User clicks "Start Campaign"
2. System creates send_queue records with calculated_send_at times
3. Cron job runs every minute: checks if any queued messages are due
4. Sends only 1 message at a time (respects spacing)
5. Marks as sent, calculates next one
```

**Database:**
```sql
CREATE TABLE send_queue (
  id UUID PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id),
  prospect_id UUID REFERENCES campaign_prospects(id),
  scheduled_for TIMESTAMP, -- When to send
  sent_at TIMESTAMP NULL,
  status VARCHAR(50), -- pending, sent, failed
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Code flow:**
```typescript
// Step 1: Create queue on campaign start
POST /api/campaigns/direct/send-connection-requests
  → For each prospect:
    → Calculate delay using randomizer
    → Create send_queue record with scheduled_for = NOW + delay
    → Return: "Campaign scheduled, X messages queued"

// Step 2: Cron job runs every minute
POST /api/cron/process-send-queue
  → SELECT * FROM send_queue WHERE scheduled_for <= NOW AND sent_at IS NULL
  → For each message:
    → Send CR via Unipile
    → Update sent_at = NOW
    → Mark status = 'sent'
```

**Pros:**
- ✅ Respects all randomization rules
- ✅ Survives application restart
- ✅ Can pause/resume campaigns
- ✅ Visible progress (see queued messages)
- ✅ Human-like spacing

**Cons:**
- ❌ Requires database migration
- ❌ More complex than direct send

---

### Option 2: Simple Sequential Sending (QUICK FIX)

Add randomized delays to the current loop:

```typescript
// In send-connection-requests/route.ts
for (const prospect of prospects) {
  // Calculate human-like delay
  const delayMinutes = calculateHumanSendDelay(
    supabase,
    unipileAccountId,
    prospects.length,
    index
  );

  // Wait before sending
  await new Promise(resolve =>
    setTimeout(resolve, delayMinutes * 60 * 1000)
  );

  // Send CR
  await unipileRequest('/api/v1/users/invite', {...});
}
```

**Pros:**
- ✅ No database changes needed
- ✅ Reuses existing randomizer
- ✅ Works immediately

**Cons:**
- ❌ Campaign "hangs" for minutes/hours (UI doesn't show progress)
- ❌ Can't pause mid-campaign
- ❌ Server restart = loses progress

---

### Option 3: Async Background Job (BEST FOR UX)

```typescript
// User clicks "Start Campaign"
POST /api/campaigns/direct/send-connection-requests
  → Validate campaign
  → Queue background job: {campaignId, prospectIds}
  → Return immediately: "Campaign started, X prospects queued"

// Background job (runs separately)
async function processCampaignQueuedProspects(campaignId) {
  const prospects = [...];

  for (const prospect of prospects) {
    // Apply randomizer
    const delay = await calculateHumanSendDelay(...);
    await wait(delay);

    // Send
    await sendCR(prospect);

    // Update DB
    await updateProspectStatus(prospect.id, 'sent');
  }
}
```

**Pros:**
- ✅ UI returns immediately
- ✅ Shows progress in real-time
- ✅ Human-like spacing
- ✅ Can pause with queue table

**Cons:**
- ❌ Requires job queue system (Bull, RabbitMQ, etc.)
- ❌ More complex infrastructure

---

## Recommendation

### For Immediate Production (Next 1 week)

Use **Option 2: Sequential Sending with Delays**

**Changes needed:**
1. Extract randomizer function to shared utility
2. Call in send-connection-requests loop
3. Add delay before each CR send
4. Test with test account (5-10 prospects)

**Time estimate:** 2 hours

**Result:**
- ✅ Proper human-like spacing
- ✅ Respects daily limits
- ✅ Avoids detection
- ⚠️ Campaign takes 30+ minutes to complete (UI shows loading)

### For Production v2 (Next 2-3 weeks)

Use **Option 1: Send Queue Table**

**Advantages over Option 2:**
- ✅ Non-blocking (UI returns immediately)
- ✅ Progress tracking
- ✅ Pause/resume campaigns
- ✅ Campaign survives app restarts

---

## Current Randomizer Implementation Details

### Location
`/app/api/campaigns/linkedin/execute-via-n8n/route.ts` (lines 33-150)

### Function Signature
```typescript
async function calculateHumanSendDelay(
  supabase: any,
  unipileAccountId: string,
  totalProspects: number,
  prospectIndex: number,
  campaignSettings?: any
): Promise<number> // Returns minutes
```

### Inputs
- `unipileAccountId` - LinkedIn account ID (for seeding)
- `totalProspects` - Total messages in batch
- `prospectIndex` - Which message number this is
- `campaignSettings` - Optional: custom working hours, timezone, etc.

### Outputs
- Minutes to wait before sending this message

### Settings (Campaign Settings)
```typescript
{
  skip_weekends: true,              // Default: M-F only
  skip_holidays: true,              // Default: skip holidays
  timezone: 'America/Los_Angeles',  // Campaign timezone
  working_hours_start: 5,           // 5 AM PT
  working_hours_end: 18,            // 6 PM PT
  daily_message_limit: 20           // Free tier default
}
```

---

## Testing the Randomizer

```bash
# Test with N8N flow (current implementation)
curl -X POST https://app.meet-sam.com/api/campaigns/linkedin/execute-via-n8n \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_id": "test-campaign-id",
    "account_type": "connector"
  }'

# Monitor delays in logs
netlify logs --function execute-via-n8n --tail
```

---

## Summary

**Current state:**
- ✅ Randomizer exists and is sophisticated
- ❌ Only used in N8N flow (legacy)
- ❌ Direct API campaigns have no randomization
- ⚠️ Direct API sends all CRs rapidly (looks like bot)

**Problem:**
- Direct API campaigns don't use randomizer
- All CRs sent within 1-2 minutes
- High risk of LinkedIn detection

**Solution:**
- Integrate randomizer into direct API campaign execution
- Option 1 (quick): Add delays to send loop
- Option 2 (better): Use send queue table

**Effort:**
- Quick fix: 2 hours
- Proper fix: 4-6 hours

---

**Last Updated:** November 22, 2025
**Status:** Architecture Review & Recommendations
**Next Step:** Integrate randomizer into direct API campaigns
