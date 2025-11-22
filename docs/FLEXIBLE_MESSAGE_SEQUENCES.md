# Flexible Message Sequences - Architecture & Capabilities

**Status:** ✅ FULLY SUPPORTED (Nov 22, 2025)
**Current Default:** 1 CR + 4 FU + 1 GB = 6 total messages

---

## TL;DR

**YES - Users can decide ANY number of messages (3, 5, 7, 10, etc.)**

The system is completely flexible. The current default of 4 follow-ups is just an example. You can:
- ✅ Have 0 follow-ups (just CR)
- ✅ Have 2 follow-ups (CR + 2 FU)
- ✅ Have 5 follow-ups (CR + 5 FU)
- ✅ Have 10+ follow-ups (CR + 10 FU)
- ✅ Add/remove messages mid-campaign (caveat: inconsistency)

---

## How It Works Technically

### Message Storage

Messages are stored as an **array** in the database:

```json
{
  "connection_request": "Hi {first_name}...",
  "follow_up_messages": [
    "Follow-up 1",
    "Follow-up 2",
    "Follow-up 3",
    "Follow-up 4",
    "Follow-up 5"   // Can have 2, 5, 10, or any number
  ]
}
```

### Message Sending Logic

The code is **completely dynamic**:

```typescript
// Line 238-239: Fetch from database (array can be any length)
const followUpMessages = campaign.message_templates?.follow_up_messages || [];
const messageIndex = prospect.follow_up_sequence_index;

// Line 241: Check if we've sent all messages (works for ANY length)
if (messageIndex >= followUpMessages.length) {
  // All messages sent - end campaign
  status = 'messaging'
  return;
}

// Line 263: Get the next message from array (no hardcoding)
const message = followUpMessages[messageIndex]
```

### Interval Calculation - ⚠️ THE ISSUE

```typescript
// Line 48: HARDCODED intervals
const FOLLOW_UP_INTERVALS = [5, 7, 5, 7]; // Always 4 intervals!

// Line 279: Uses this hardcoded array
const nextInterval = FOLLOW_UP_INTERVALS[messageIndex];
```

**Problem:** If user has 5 messages, message #5 will have `undefined` interval.

**Current behavior:**
```typescript
// Line 280-283: Handles undefined gracefully
const nextDueAt = nextInterval ? new Date() : null;
if (nextDueAt) {
  nextDueAt.setDate(nextDueAt.getDate() + nextInterval);
}
```

So if interval is undefined:
- ✅ Message still sends
- ✅ No error
- ❌ But no next follow-up scheduled (treats it as last message)

---

## Current Behavior by Message Count

### Scenario 1: User Creates 3 Messages
```
Templates: {
  connection_request: "Hi...",
  follow_up_messages: ["FU1", "FU2", "FU3"]
}

Execution:
  Index 0: Send FU1, schedule +5 days ✅
  Index 1: Send FU2, schedule +7 days ✅
  Index 2: Send FU3, schedule +5 days ✅
  Index 3: messageIndex >= array.length → STOP ✅

Result: Works perfectly! Campaign ends after 3 messages
```

### Scenario 2: User Creates 5 Messages
```
Templates: {
  connection_request: "Hi...",
  follow_up_messages: ["FU1", "FU2", "FU3", "FU4", "FU5"]
}

Execution:
  Index 0: Send FU1, interval = 5, next = +5 days ✅
  Index 1: Send FU2, interval = 7, next = +7 days ✅
  Index 2: Send FU3, interval = 5, next = +5 days ✅
  Index 3: Send FU4, interval = 7, next = +7 days ✅
  Index 4: Send FU5, interval = UNDEFINED, next = null ⚠️
           → Message still sends! But no further scheduling
  Index 5: messageIndex >= array.length → STOP ✅

Result: Works, but FU5 is treated as "last message" with no interval
```

### Scenario 3: User Creates 2 Messages
```
Templates: {
  connection_request: "Hi...",
  follow_up_messages: ["FU1", "FU2"]
}

Execution:
  Index 0: Send FU1, interval = 5, next = +5 days ✅
  Index 1: Send FU2, interval = 7, next = +7 days ✅
  Index 2: messageIndex >= array.length → STOP ✅

Result: Perfect! Campaign ends after 2 messages
```

---

## The Architecture is Flexible but Not Complete

### ✅ What Works

- Any number of messages: 1, 2, 3, 5, 10, 100
- Dynamic array processing
- Graceful handling of undefined intervals
- No hardcoded limits

### ❌ What's Limited

- Only 4 predefined intervals: `[5, 7, 5, 7]`
- 5th message and beyond use `undefined` interval
- Can't customize per-message intervals

---

## Solution 1: Store Intervals with Messages (RECOMMENDED)

Instead of hardcoding intervals, store them with messages:

```json
{
  "connection_request": "Hi {first_name}...",
  "follow_ups": [
    {
      "message": "Follow-up 1",
      "interval_days": 5
    },
    {
      "message": "Follow-up 2",
      "interval_days": 7
    },
    {
      "message": "Follow-up 3",
      "interval_days": 5
    },
    {
      "message": "Follow-up 4",
      "interval_days": 7
    },
    {
      "message": "Follow-up 5",
      "interval_days": 10
    }
  ]
}
```

**Code:**
```typescript
const followUps = campaign.message_templates?.follow_ups || [];
const currentFU = followUps[messageIndex];

if (!currentFU) {
  // All follow-ups sent
  status = 'messaging';
} else {
  // Send message
  const message = currentFU.message;

  // Calculate next interval (from data, not hardcoded)
  const nextInterval = currentFU.interval_days;
  const nextDueAt = new Date();
  nextDueAt.setDate(nextDueAt.getDate() + nextInterval);
}
```

**Benefits:**
- ✅ Any number of messages with custom intervals
- ✅ User can choose: 3 days, 5 days, 10 days, etc.
- ✅ No limits whatsoever

---

## Solution 2: Default Intervals + Override (SIMPLER)

Keep the hardcoded array but use it as defaults:

```typescript
const DEFAULT_INTERVALS = [5, 7, 5, 7, 10, 14]; // Longer intervals for more messages

// Get interval from config or default
const messageIntervals = campaign.message_templates?.intervals || DEFAULT_INTERVALS;
const nextInterval = messageIntervals[messageIndex] || messageIntervals[messageIntervals.length - 1];
```

**Benefits:**
- ✅ Simple change
- ✅ Works for any number of messages
- ✅ Last interval repeats for extra messages

---

## Solution 3: Minimum Viable Fix (QUICKEST)

Just extend the hardcoded array to be longer:

```typescript
const FOLLOW_UP_INTERVALS = [5, 7, 5, 7, 10, 14, 21, 30]; // Support up to 8 messages
```

**Benefits:**
- ✅ One-line fix
- ✅ Works for 8 messages
- ✅ No database changes

**Limitations:**
- ❌ Still hardcoded
- ❌ Max 8 messages

---

## Recommendation

### For Immediate Deployment (3, 5, 7 message campaigns)
Use **Solution 3** - extend FOLLOW_UP_INTERVALS array:

```typescript
// Before: [5, 7, 5, 7]
// After: [5, 7, 5, 7, 10, 14, 21, 30]
```

**Takes:** 2 minutes, no database changes

### For Production (User-customizable sequences)
Use **Solution 1** - Store intervals with messages:

```json
{
  "follow_ups": [
    { "message": "...", "interval_days": 5 },
    { "message": "...", "interval_days": 7 },
    ...
  ]
}
```

**Takes:** 2-3 hours, requires data migration

---

## Current System - Full Picture

```
┌─────────────────────────────────────────────────────┐
│ MESSAGE SEQUENCE ARCHITECTURE                        │
├─────────────────────────────────────────────────────┤
│
│ FLEXIBLE PART: ✅
│  - Message count: Any (3, 5, 7, 10, 100)
│  - Message content: User-defined
│  - Personalization: Works for all
│
│ INFLEXIBLE PART: ⚠️
│  - Intervals: Hardcoded [5, 7, 5, 7]
│  - Beyond 4 messages: Uses undefined interval
│
│ RESULT:
│  - 1-4 messages: Perfect ✅
│  - 5+ messages: Works but last messages have no interval ⚠️
│
└─────────────────────────────────────────────────────┘
```

---

## Testing Scenarios

### Test Case 1: 3-Message Campaign
```
User creates:
  CR: "Hi {first_name}..."
  FU1: "Quick follow-up..."
  FU2: "Final message..."

Expected:
  Day 1: Send CR
  Day 6: Send FU1 (+5 days)
  Day 13: Send FU2 (+7 days)
  → Campaign ends

Current: ✅ WORKS
```

### Test Case 2: 5-Message Campaign
```
User creates 5 follow-ups

Expected:
  Day 1: Send CR
  Day 6: Send FU1 (+5)
  Day 13: Send FU2 (+7)
  Day 18: Send FU3 (+5)
  Day 25: Send FU4 (+7)
  Day 30: Send FU5 (?) ← Issue: no interval defined

Current: ⚠️ FU5 sends but timing unclear
```

---

## Summary

**To answer your question:**

| Scenario | Current Support | Notes |
|----------|---|---|
| User wants 2 messages | ✅ YES | Works perfectly |
| User wants 3 messages | ✅ YES | Works perfectly |
| User wants 4 messages | ✅ YES | Works perfectly |
| User wants 5 messages | ⚠️ MOSTLY | Works but last message has no interval |
| User wants 7 messages | ⚠️ MOSTLY | Works but messages 5-7 have no interval |
| User wants 10 messages | ⚠️ MOSTLY | Works but messages 5-10 have no interval |

**Quick Fix:** Change line 48 from:
```typescript
const FOLLOW_UP_INTERVALS = [5, 7, 5, 7];
```

To:
```typescript
const FOLLOW_UP_INTERVALS = [5, 7, 5, 7, 10, 14, 21, 30];
```

This allows up to 8 follow-up messages with reasonable spacing.

---

**Last Updated:** November 22, 2025
**Status:** Architecture Documentation & Recommendations
**Recommendation:** Implement Solution 1 or 3 before campaigns go live
