# Messaging Randomizer System

> **Last Updated:** December 14, 2025
> **Status:** Production - Live on all workspaces
> **Purpose:** Create message variations while protecting CR acceptance rates

---

## Table of Contents

1. [Overview](#overview)
2. [Core Principle](#core-principle)
3. [Spintax System](#spintax-system)
4. [Message Variance](#message-variance)
5. [Human-Like Delays](#human-like-delays)
6. [Follow-Up Randomization](#follow-up-randomization)
7. [A/B Testing](#ab-testing)
8. [UI Integration](#ui-integration)
9. [Technical Implementation](#technical-implementation)
10. [Best Practices](#best-practices)

---

## Overview

### Why This System Exists

LinkedIn detects automated messaging by looking for:
- **Identical messages** - Same text to multiple people = bot
- **Fixed timing** - Messages at exact intervals = bot
- **Instant actions** - No reading/typing time = bot
- **Predictable patterns** - Same sequence every time = bot

### Our Solution

Create **human-like variance** in messaging while **protecting the core message** that drives CR acceptance:

| What Changes | What Stays The Same |
|--------------|---------------------|
| Greetings (Hi/Hello/Hey) | Value proposition |
| Closings (Best/Cheers/Thanks) | Core pitch |
| Timing (delays, intervals) | CTA wording |
| Follow-up spacing | Key phrases |

---

## Core Principle

### The Golden Rule

> **NEVER alter the core message content. Only vary greetings, closings, and timing.**

Connection request acceptance rates depend heavily on the message quality. Users spend significant time crafting the perfect pitch. The system must:

1. **Preserve** - Keep the user's core message exactly as written
2. **Vary** - Only change low-impact elements (greetings, closings)
3. **Randomize** - Add timing variance for anti-detection
4. **Opt-In** - Spintax only works when user explicitly writes it

### What Gets Varied

| Element | Variance Type | Impact on CR Rate |
|---------|---------------|-------------------|
| Greeting | Spintax (user-controlled) | Low |
| Closing | Spintax (user-controlled) | Low |
| Pre-send delay | Automatic (30-90s) | None |
| Typing simulation | Automatic (20-60s) | None |
| Follow-up interval | Automatic (+/- 2 days) | None |
| A/B variant selection | Automatic (natural distribution) | None |

### What NEVER Gets Varied

| Element | Reason |
|---------|--------|
| Value proposition | Critical for acceptance |
| Problem/solution statement | Core of the pitch |
| Call-to-action | Drives response |
| Personalization variables | Must match prospect data |
| Message structure | User's deliberate choice |

---

## Spintax System

### What is Spintax?

Spintax is a syntax for creating message variations:

```
{Hi|Hello|Hey} {first_name}, {I noticed|I came across} your profile...
```

This creates **3 x 2 = 6 unique variations** from one template.

### Syntax Reference

| Syntax | Example | Result |
|--------|---------|--------|
| Basic | `{Hi\|Hello}` | Randomly picks "Hi" or "Hello" |
| Multiple | `{A\|B\|C\|D}` | Picks one of four options |
| Weighted | `{Hi:3\|Hello:1}` | "Hi" appears 3x more often |
| Empty | `{text\|}` | 50% chance of no text |
| Nested | `{Hi {there\|friend}\|Hello}` | Nested variations |

### Deterministic Per Prospect

**Same prospect always gets the same variation:**

```typescript
// Uses prospect ID as seed for consistent randomness
const result = spinForProspect(message, prospectId);
```

This ensures:
- Prospect A always gets "Hi Sarah" (not sometimes "Hello Sarah")
- Follow-up messages maintain consistent style
- Retries send the same message

### Processing Order

```
1. SPINTAX FIRST → Process {option1|option2} syntax
2. PERSONALIZE SECOND → Replace {first_name}, {company_name}, etc.
```

**Why this order matters:**
- Spintax must be resolved before personalization
- Prevents `{Hi|Hello}` from being confused with `{first_name}`

### Code Location

```
lib/anti-detection/spintax.ts
```

**Key Functions:**

| Function | Purpose |
|----------|---------|
| `spinText(text, options)` | Parse and spin spintax |
| `spinForProspect(text, prospectId)` | Deterministic spin per prospect |
| `countVariations(text)` | Count possible combinations |
| `validateSpintax(text)` | Check for syntax errors |
| `generatePreviews(text, count)` | Generate sample variations |
| `personalizeMessage(text, data)` | Replace personalization variables |

---

## Message Variance

### Length Distribution

Messages vary naturally in length:

| Category | Length | Probability |
|----------|--------|-------------|
| Brief | 50-100 chars | 15% |
| Short | 100-150 chars | 30% |
| Medium | 150-220 chars | 35% |
| Detailed | 220-280 chars | 15% |
| Comprehensive | 280-300 chars | 5% |

**Note:** LinkedIn connection requests have a 300 character limit.

### Tone Distribution

| Tone | Description | Probability |
|------|-------------|-------------|
| Friendly | Approachable, personable | 30% |
| Professional | Business-focused, formal | 25% |
| Casual | Relaxed, colleague-like | 20% |
| Direct | To the point, no fluff | 15% |
| Warm | Personal, genuine interest | 10% |

### Opening Style Distribution

| Style | Example | Probability |
|-------|---------|-------------|
| Name First | "Hi Sarah," | 35% |
| Greeting First | "Hey there! I noticed..." | 25% |
| Context First | "I came across your profile..." | 20% |
| Question First | "Are you still working on...?" | 10% |
| Observation First | "Interesting background in..." | 10% |

### Code Location

```
lib/anti-detection/message-variance.ts
```

**Key Functions:**

| Function | Purpose |
|----------|---------|
| `getRandomMessageLength()` | Get target length category |
| `getRandomMessageTone()` | Get tone for AI generation |
| `getRandomOpeningStyle()` | Get opening style |
| `getMessageVarianceContext()` | Full variance context |

---

## Human-Like Delays

### Why Delays Matter

| Without Delays | With Delays |
|----------------|-------------|
| Message sent 50ms after trigger | Message sent 60-150s after trigger |
| Looks like automated script | Looks like human composing |
| LinkedIn flags as bot | LinkedIn sees natural behavior |

### Delay Stages

| Stage | Delay Range | Simulates |
|-------|-------------|-----------|
| Pre-Send | 30-90 seconds | Reading prospect's profile |
| Composing | 20-40s base + ~50ms/char | Thinking and typing |
| Between Messages | 2-5 minutes | Natural session breaks |

### Implementation

```typescript
// 1. Pre-send delay (simulates reading profile)
const preSendDelay = getPreSendDelayMs();
console.log(`⏳ Pre-send delay: ${Math.round(preSendDelay / 1000)}s`);
await new Promise(resolve => setTimeout(resolve, preSendDelay));

// 2. Composing delay (simulates typing)
const composingDelay = getComposingDelayMs(messageLength);
console.log(`⌨️  Composing delay: ${Math.round(composingDelay / 1000)}s`);
await new Promise(resolve => setTimeout(resolve, composingDelay));

// 3. Send message
await sendMessage();
```

### Total Delay Per Message

| Message Length | Total Delay |
|----------------|-------------|
| 100 chars | 55-135 seconds |
| 200 chars | 60-145 seconds |
| 300 chars | 65-155 seconds |

---

## Follow-Up Randomization

### The Problem with Fixed Intervals

**Before (Detectable):**
```
FU1: Exactly 5 days after CR accepted
FU2: Exactly 7 days after FU1
FU3: Exactly 5 days after FU2
FU4: Exactly 7 days after FU3
```

**After (Human-Like):**
```
FU1: 3-7 days after CR accepted (base 5 +/- 2)
FU2: 5-9 days after FU1 (base 7 +/- 2)
FU3: 3-7 days after FU2 (base 5 +/- 2)
FU4: 5-9 days after FU3 (base 7 +/- 2)
```

### Configuration

```typescript
const FOLLOW_UP_CONFIG = {
  baseIntervals: [5, 7, 5, 7],  // Base days between follow-ups
  varianceRange: 2,             // +/- 2 days variance
  skipProbability: 0.05,        // 5% chance to skip (human hesitation)
};
```

### Skip Probability

5% of follow-ups are randomly skipped, simulating:
- Human forgetting to follow up
- Deciding to wait longer
- Natural hesitation

When a follow-up is skipped, the system moves to the next one.

### Code Example

```typescript
const interval = getRandomizedFollowUpInterval(followUpIndex);

if (interval === -1) {
  // Random skip triggered
  console.log(`⏭️  Random skip for FU${followUpIndex + 1}`);
} else {
  const nextDueAt = new Date();
  nextDueAt.setDate(nextDueAt.getDate() + interval);
  console.log(`📅 Next FU in ${interval} days`);
}
```

---

## A/B Testing

### The Problem with Even/Odd Split

**Before (Detectable):**
```
Prospect 1: Variant A
Prospect 2: Variant B
Prospect 3: Variant A
Prospect 4: Variant B
...
```

This 50/50 alternating pattern is too mechanical.

### Natural Distribution

**After (Human-Like):**
```typescript
function getABTestVariant(prospectIndex, seed) {
  // Factor 1: Base random chance (60/40 instead of 50/50)
  const baseChance = Math.random();

  // Factor 2: Time-based variation
  const hour = new Date().getHours();
  const hourBias = hour < 12 ? 0.05 : -0.05;

  // Factor 3: Day-based variation
  const dayOfWeek = new Date().getDay();
  const dayBias = dayOfWeek % 2 === 0 ? 0.03 : -0.03;

  // Combined probability
  const probA = 0.55 + hourBias + dayBias;

  return baseChance < probA ? 'A' : 'B';
}
```

### Result

- ~55-60% get Variant A
- ~40-45% get Variant B
- Distribution varies by time of day and day of week
- No mechanical alternation

---

## UI Integration

### Campaign Steps Editor

The spintax feature is integrated into `app/components/CampaignStepsEditor.tsx`:

#### Toggle

```tsx
<label className="flex items-center gap-2 cursor-pointer">
  <span>Enable</span>
  <input
    type="checkbox"
    checked={spintaxEnabled}
    onChange={(e) => setSpintaxEnabled(e.target.checked)}
  />
</label>
```

#### Variation Count

When spintax is detected, shows:
```
┌─────────────────────────────────────────┐
│  9  unique variations    [Preview]      │
└─────────────────────────────────────────┘
```

#### Preview Panel

Shows 3 sample variations:
```
Sample variations:
#1 Hi Sarah, I noticed your work...
#2 Hello Sarah, I came across your work...
#3 Hey Sarah, I saw your work...
```

#### Safe Suggestions

Only suggests low-impact changes:

| Detected | Suggestion |
|----------|------------|
| "Hi" | `{Hi\|Hello\|Hey}` |
| "Hello" | `{Hello\|Hi\|Hey there}` |
| "Best" | `{Best\|Cheers\|Thanks}` |
| "I noticed" | `{I noticed\|I saw\|I came across}` |

#### Help Text

```
Syntax: Use {option1|option2|option3} to create variations.
Tip: Only vary greetings and closings. Keep your core message
unchanged for best CR rates.
```

---

## Technical Implementation

### File Structure

```
lib/anti-detection/
├── spintax.ts              # Spintax parser and processor
├── message-variance.ts     # Message variance system
└── comment-variance.ts     # Comment variance (separate system)

app/api/campaigns/direct/
├── send-connection-requests-fast/route.ts  # Queue creation with spintax
└── process-follow-ups/route.ts             # Follow-up processing

app/api/cron/
└── process-send-queue/route.ts             # CR sending with delays

app/components/
└── CampaignStepsEditor.tsx                 # UI with spintax toggle
```

### Processing Flow

```
1. User writes message with optional spintax
   "Hi {{first_name}}, I noticed your work at {{company_name}}..."
   or
   "{Hi|Hello} {{first_name}}, {I noticed|I saw} your work..."

2. Queue Creation (send-connection-requests-fast)
   ├─ Process spintax (deterministic per prospect)
   ├─ Personalize message (replace variables)
   ├─ Schedule with random 20-45 min intervals
   └─ Store in send_queue table

3. Queue Processing (process-send-queue)
   ├─ Apply pre-send delay (30-90s)
   ├─ Apply composing delay (20-60s)
   ├─ Send via Unipile API
   ├─ Check for LinkedIn warnings
   └─ Update status

4. Follow-Up Processing (process-follow-ups)
   ├─ Check connection accepted
   ├─ Process spintax in follow-up message
   ├─ Apply human-like delays
   ├─ Send message
   └─ Schedule next FU with randomized interval
```

### Database Tables

**send_queue**
```sql
CREATE TABLE send_queue (
  id UUID PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id),
  prospect_id UUID REFERENCES campaign_prospects(id),
  linkedin_user_id TEXT NOT NULL,
  message TEXT NOT NULL,              -- Already processed (spintax + personalization)
  scheduled_for TIMESTAMP NOT NULL,
  sent_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'pending',
  variant VARCHAR(1),                 -- 'A' or 'B' for A/B testing
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**campaign_prospects**
```sql
-- Relevant columns for follow-up randomization
follow_up_sequence_index INTEGER DEFAULT 0,
follow_up_due_at TIMESTAMP,
last_follow_up_at TIMESTAMP,
ab_variant VARCHAR(1)
```

### Hard Limits

```typescript
const MESSAGE_HARD_LIMITS = {
  // Daily limits per LinkedIn account
  MAX_CONNECTION_REQUESTS_PER_DAY: 25,
  MAX_MESSAGES_PER_DAY: 50,

  // Weekly limits
  MAX_CONNECTION_REQUESTS_PER_WEEK: 100,
  MAX_MESSAGES_PER_WEEK: 200,

  // Hourly limits (burst protection)
  MAX_CONNECTION_REQUESTS_PER_HOUR: 5,
  MAX_MESSAGES_PER_HOUR: 10,

  // Minimum gaps
  MIN_CR_GAP_MINUTES: 20,
  MIN_MESSAGE_GAP_MINUTES: 5,

  // Error handling
  MAX_ERRORS_BEFORE_PAUSE: 3,
  PAUSE_DURATION_HOURS: 24,
};
```

### Warning Detection

```typescript
const MESSAGE_WARNING_PATTERNS = [
  'unusual activity',
  'temporarily restricted',
  'invitation limit',
  'weekly limit',
  'too many requests',
  'slow down',
  'action blocked',
  'pending invitations',
  'can\'t send more',
];

function isMessageWarning(responseText) {
  for (const pattern of MESSAGE_WARNING_PATTERNS) {
    if (responseText.toLowerCase().includes(pattern)) {
      return { isWarning: true, pattern };
    }
  }
  return { isWarning: false };
}
```

When a warning is detected:
1. Log the warning
2. Reschedule message for 24 hours later
3. Return error to stop further processing

---

## Best Practices

### DO

1. **Use spintax for greetings only**
   ```
   {Hi|Hello|Hey} {first_name},
   ```

2. **Use spintax for closings only**
   ```
   {Best|Cheers|Thanks},
   Your Name
   ```

3. **Keep core message unchanged**
   ```
   I help companies like {company_name} solve [your value prop]...
   ```

4. **Test with preview before launching**
   - Click "Preview Variations" in the editor
   - Verify all variations make sense

5. **Start with fewer variations**
   - 3-4 greeting options is plenty
   - More variations = more to review

### DON'T

1. **Don't vary your value proposition**
   ```
   ❌ {I help with sales|I improve revenue|I grow businesses}
   ```

2. **Don't vary your CTA**
   ```
   ❌ {Would you like to chat|Can we talk|Let's connect}?
   ```

3. **Don't create too many variations**
   - 100+ variations = can't review quality
   - Stick to 5-20 variations max

4. **Don't use spintax in personalization variables**
   ```
   ❌ {{first_name|firstName}}
   ```

5. **Don't nest too deeply**
   ```
   ❌ {Hi {there {friend|buddy}|you}|Hello {world|everyone}}
   ```

### Example: Good Spintax Usage

```
{Hi|Hello|Hey} {first_name},

{I noticed|I came across|I saw} your work at {company_name} and was
impressed by your focus on [industry topic].

I help [target role]s like yourself [value proposition]. Would love
to connect and share some insights.

{Best|Cheers|Thanks},
Your Name
```

**Variations:** 3 x 3 x 3 = 27 unique messages
**Core message:** Unchanged
**CR rate impact:** Minimal

---

## Monitoring

### Logs to Watch

```
📤 Sending connection_request to John Smith
⏳ Pre-send delay: 45s (simulating profile view)
⌨️  Composing delay: 32s (simulating typing 180 chars)
🎲 Spintax: 9 variations, selected: "Hi, I noticed, Best"
✅ Connection request sent successfully
📅 Next FU interval: 6 days (randomized from base 5)
```

### Warning Logs

```
🚨 LINKEDIN WARNING DETECTED: "weekly limit"
🛑 Rescheduling for 24 hours
```

### Database Queries

**Check spintax usage:**
```sql
SELECT
  campaign_id,
  message,
  variant,
  status,
  scheduled_for
FROM send_queue
WHERE message LIKE '%{%|%}%'
ORDER BY created_at DESC
LIMIT 10;
```

**Check follow-up intervals:**
```sql
SELECT
  id,
  first_name,
  follow_up_sequence_index,
  follow_up_due_at,
  last_follow_up_at,
  EXTRACT(DAY FROM follow_up_due_at - last_follow_up_at) as interval_days
FROM campaign_prospects
WHERE follow_up_due_at IS NOT NULL
ORDER BY follow_up_due_at ASC;
```

---

## Summary

The Messaging Randomizer System protects client LinkedIn accounts while preserving CR acceptance rates through:

1. **Spintax** - User-controlled variations for greetings/closings only
2. **Deterministic processing** - Same prospect gets same variation
3. **Human-like delays** - 60-150 seconds per message
4. **Randomized intervals** - Follow-ups vary by +/- 2 days
5. **Natural A/B testing** - Not mechanical 50/50 split
6. **Warning detection** - Auto-pause on LinkedIn warnings

**The goal: Make automated activity indistinguishable from human behavior while never compromising the user's carefully crafted message.**

---

*Document maintained by SAM AI Platform team. For questions, contact the engineering team.*
