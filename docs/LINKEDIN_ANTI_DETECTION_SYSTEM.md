# LinkedIn Anti-Detection System

> **Last Updated:** December 13, 2025
> **Status:** Production - Live on all workspaces
> **Purpose:** Protect client LinkedIn accounts from detection and restrictions

---

## Table of Contents

1. [Overview](#overview)
2. [Hard Limits](#hard-limits)
3. [Human-Like Timing](#human-like-timing)
4. [Activity Patterns](#activity-patterns)
5. [Comment Variance](#comment-variance)
6. [LinkedIn Warning Detection](#linkedin-warning-detection)
7. [Per-Workspace Configuration](#per-workspace-configuration)
8. [Technical Implementation](#technical-implementation)
9. [Monitoring & Alerts](#monitoring--alerts)
10. [Troubleshooting](#troubleshooting)

---

## Overview

### Why This System Exists

LinkedIn actively detects and restricts automated activity. Detection can result in:
- Account restrictions (temporary or permanent)
- Feature limitations (commenting, messaging disabled)
- Account suspension
- Loss of client's professional network

### How Detection Works

LinkedIn's anti-bot systems look for:
1. **Timing patterns** - Actions at fixed intervals (e.g., exactly every 5 minutes)
2. **Volume patterns** - Same number of actions daily
3. **Content patterns** - Similar comment lengths, same phrases
4. **Behavioral anomalies** - Instant actions (no reading time), 24/7 activity

### Our Defense Strategy

**Make every action indistinguishable from human behavior:**
- Random timing with human-like delays
- Variable content (length, style, type)
- Natural activity patterns (sessions, breaks, skip days)
- Hard limits that never exceed LinkedIn's thresholds
- Automatic detection and pause on warnings

---

## Hard Limits

### Never Exceeded - These Protect Accounts

```typescript
const HARD_LIMITS = {
  // Daily limits per LinkedIn account
  MAX_COMMENTS_PER_DAY: 5,           // Never exceed 5 comments/day
  MAX_LIKES_PER_DAY: 20,             // Never exceed 20 likes/day
  MAX_PROFILE_VIEWS_PER_DAY: 30,     // Never exceed 30 profile views/day

  // Weekly limits per LinkedIn account
  MAX_COMMENTS_PER_WEEK: 25,         // Never exceed 25 comments/week
  MAX_CONNECTION_REQUESTS_PER_WEEK: 100, // LinkedIn's known limit

  // Hourly limits (burst protection)
  MAX_COMMENTS_PER_HOUR: 2,          // Never more than 2 comments in 1 hour
  MAX_ACTIONS_PER_HOUR: 10,          // Total actions (likes + comments + views)

  // Minimum gaps between same-type actions
  MIN_COMMENT_GAP_MINUTES: 30,       // At least 30 min between comments
  MIN_LIKE_GAP_SECONDS: 30,          // At least 30 sec between likes

  // Error thresholds
  MAX_ERRORS_BEFORE_PAUSE: 3,        // Pause after 3 consecutive errors
  PAUSE_DURATION_HOURS: 24,          // Pause for 24 hours after errors
};
```

### How Limits Are Enforced

Before posting any comment, the system:

1. **Queries activity counts** from the database
   - Comments today
   - Comments this week
   - Comments this hour

2. **Checks against hard limits**
   ```typescript
   if (commentsToday >= 5) → STOP
   if (commentsThisWeek >= 25) → STOP
   if (commentsThisHour >= 2) → STOP
   ```

3. **If limit hit:**
   - Comment is rescheduled for later
   - Returns immediately without posting
   - Logs the limit that was reached

---

## Human-Like Timing

### Delay Simulation

Every comment goes through multiple human-like delays:

| Stage | Delay Range | Simulates |
|-------|-------------|-----------|
| Profile View | 20-60 seconds | Reading author's background |
| Like-to-Comment | 10-30 seconds | Thinking before typing |
| Typing | 15-45 seconds | Reading post + typing response |
| **Total** | **45-135 seconds** | **Real human engagement time** |

### Implementation

```typescript
// 1. View author profile first (40% chance)
if (shouldViewProfile) {
  await delay(20000 + random(40000)); // 20-60 seconds
}

// 2. Like post BEFORE commenting (50% chance)
if (shouldLikeFirst) {
  await likePost();
  await delay(10000 + random(20000)); // 10-30 seconds
}

// 3. Typing delay (always)
await delay(15000 + random(30000)); // 15-45 seconds

// 4. Post comment
await postComment();
```

### Why These Delays Matter

| Without Delays | With Delays |
|----------------|-------------|
| Comment posted 50ms after page load | Comment posted 45-135s after "viewing" |
| Looks like automated script | Looks like human reading + typing |
| LinkedIn flags as bot | LinkedIn sees natural engagement |

---

## Activity Patterns

### Daily Patterns

| Pattern | Behavior | Probability |
|---------|----------|-------------|
| Business Hours | 80% of comments during 8am-6pm | Enforced |
| Evening Activity | 20% of comments 6pm-10pm | Natural variance |
| Night Activity | 0% comments 10pm-6am | Never post overnight |

### Weekly Patterns

| Day | Skip Probability | Comments Allowed |
|-----|------------------|------------------|
| Monday-Friday | 12% | Up to daily limit |
| Saturday | 40% | Reduced activity |
| **Sunday** | **100%** | **ZERO - Hard block** |

### Session-Based Activity

Humans don't space comments evenly - they comment in bursts:

```
Session 1 (2-4 comments):
  - Comment 1: 10:15 AM
  - Comment 2: 10:22 AM (7 min later)
  - Comment 3: 10:35 AM (13 min later)

[2-4 hour break]

Session 2 (2-4 comments):
  - Comment 4: 2:45 PM
  - Comment 5: 3:02 PM (17 min later)
```

### Holiday Blocking

**No comments on major holidays:**

```typescript
const HOLIDAYS_2024_2025 = [
  // 2024
  '2024-12-24', '2024-12-25', '2024-12-26', // Christmas
  '2024-12-31', // New Year's Eve
  // 2025
  '2025-01-01', // New Year's Day
  '2025-01-20', // MLK Day
  '2025-02-17', // Presidents Day
  '2025-04-18', '2025-04-21', // Easter weekend
  '2025-05-26', // Memorial Day
  '2025-07-04', // Independence Day
  '2025-09-01', // Labor Day
  '2025-10-13', // Columbus Day
  '2025-11-11', // Veterans Day
  '2025-11-27', '2025-11-28', // Thanksgiving
  '2025-12-24', '2025-12-25', '2025-12-26', // Christmas
  '2025-12-31', // New Year's Eve
  '2026-01-01', // New Year's Day
];
```

---

## Comment Variance

### Length Distribution

Comments vary naturally in length:

| Category | Length | Probability |
|----------|--------|-------------|
| Very Short | 15-50 chars | 10% |
| Short | 50-100 chars | 25% |
| Medium | 100-200 chars | 35% |
| Long | 200-350 chars | 20% |
| Very Long | 350-500 chars | 10% |

### Type Distribution

Comments vary in style:

| Type | Description | Probability |
|------|-------------|-------------|
| Question | Ends with a thoughtful question | 25% |
| Statement | Confident assertion, no question | 30% |
| Observation | Shares an insight | 20% |
| Story | Brief personal anecdote | 15% |
| Agreement | Agrees + adds insight | 10% |

### Emoji Variance

- 30% of comments include 1-2 relevant emojis
- 70% of comments have no emojis
- Emojis never at the start

### AI Prompt Instructions

Each comment gets variance instructions:

```
## VARIANCE INSTRUCTIONS (CRITICAL FOR ANTI-DETECTION)

**Length Target**: Aim for approximately 127 characters (category: medium)
- Short comments are okay and often more impactful
- Long comments should add significant value
- Don't force length - natural is best

**Comment Type**: QUESTION
End your comment with a thoughtful question that invites discussion.

**Style Variation**:
- Vary your opening style (don't always start with "Great point!")
- Mix up sentence structure
- Use different phrasings for similar ideas
- Include 1-2 relevant emojis naturally (not at the start)
```

---

## LinkedIn Warning Detection

### Detected Patterns

The system scans every API response for warning signs:

```typescript
const LINKEDIN_WARNING_PATTERNS = [
  'unusual activity',
  'temporarily restricted',
  'security check',
  'verify your identity',
  'rate limit',
  'too many requests',
  'slow down',
  'action blocked',
  'try again later',
  'suspicious activity',
];
```

### Automatic Response

If a warning is detected:

1. **Immediate logging**
   ```
   🚨 LINKEDIN WARNING DETECTED: "rate limit"
   🛑 PAUSING ALL COMMENTING FOR WORKSPACE xxx FOR 24 HOURS
   ```

2. **Pause all monitors** for that workspace
   ```sql
   UPDATE linkedin_post_monitors
   SET status = 'paused',
       metadata = {
         paused_reason: 'LinkedIn warning: rate limit',
         paused_at: '2025-12-13T12:00:00Z',
         auto_resume_at: '2025-12-14T12:00:00Z'
       }
   WHERE workspace_id = 'xxx';
   ```

3. **Reschedule all pending comments** for 24 hours later
   ```sql
   UPDATE linkedin_post_comments
   SET status = 'scheduled',
       scheduled_post_time = NOW() + INTERVAL '24 hours'
   WHERE workspace_id = 'xxx'
     AND status IN ('scheduled', 'posting');
   ```

4. **Return error to cron** (stops further processing)

---

## Per-Workspace Configuration

### Monitor Metadata

Each workspace can have custom settings in their monitor's `metadata` field:

```json
{
  "daily_comment_limit": 2,
  "skip_day_probability": 0.20,
  "randomizer_enabled": true,
  "comment_delay_min_hours": 1,
  "comment_delay_max_hours": 4
}
```

### Configuration Options

| Setting | Description | Default |
|---------|-------------|---------|
| `daily_comment_limit` | Max comments per day for this workspace | 5 |
| `skip_day_probability` | Chance to skip any given day (0-1) | 0.12 |
| `randomizer_enabled` | Enable per-workspace variance | true |
| `comment_delay_min_hours` | Minimum delay between comments | 0.5 |
| `comment_delay_max_hours` | Maximum delay between comments | 3 |

### Example: Brian's ChillMine Configuration

```json
{
  "daily_comment_limit": 2,
  "skip_day_probability": 0.20,
  "randomizer_enabled": true,
  "comment_delay_min_hours": 1,
  "comment_delay_max_hours": 4
}
```

This means:
- Max 2 comments per day (not the default 5)
- 20% chance to skip any day
- 1-4 hour random delay between comments

---

## Technical Implementation

### Key Files

| File | Purpose |
|------|---------|
| `lib/anti-detection/comment-variance.ts` | Core variance system, limits, warning detection |
| `app/api/cron/auto-generate-comments/route.ts` | Comment generation with skip days, holidays |
| `app/api/cron/process-comment-queue/route.ts` | Comment posting with delays, limits, warnings |

### Cron Flow

```
1. auto-generate-comments (every 30 min)
   ├─ Check: Is it Sunday? → STOP
   ├─ Check: Is it a holiday? → STOP
   ├─ Check: Random skip day? → STOP
   ├─ Check: Per-workspace limit reached? → SKIP workspace
   └─ Generate comments, schedule for later

2. process-comment-queue (every 30 min)
   ├─ Check: Is it a holiday? → STOP
   ├─ Check: Hard limits (day/week/hour) → STOP if exceeded
   ├─ Claim 1 comment for processing
   ├─ Apply human-like delays (profile view, like, typing)
   ├─ Post comment to LinkedIn
   ├─ Check: Warning in response? → PAUSE 24 hours
   └─ Update status, continue
```

### Database Tables

**linkedin_post_comments**
```sql
- id: UUID
- workspace_id: UUID
- post_id: UUID
- comment_text: TEXT
- status: scheduled | posting | posted | failed | skipped
- scheduled_post_time: TIMESTAMP
- posted_at: TIMESTAMP
- failure_reason: TEXT
```

**linkedin_post_monitors**
```sql
- id: UUID
- workspace_id: UUID
- status: active | paused
- metadata: JSONB (custom settings)
```

---

## Monitoring & Alerts

### Activity Logs

Every action is logged:

```
📤 Processing scheduled comments queue...
📋 Found 1 scheduled comments to post
📊 Activity stats: 2 today, 8 this week, 0 this hour
👤 Viewing author profile first (anti-detection)...
⏳ Profile view delay: 34s
👍 Liking post BEFORE comment (anti-detection)...
✅ Post liked (before comment)
⏳ Like-to-comment delay: 18s
⌨️ Typing delay: 29s
✅ Comment posted to LinkedIn
```

### Warning Logs

If limits or warnings are hit:

```
🛑 HARD LIMIT REACHED: Daily comment limit reached (5/5)
```

```
🚨 LINKEDIN WARNING DETECTED: "rate limit"
🛑 PAUSING ALL COMMENTING FOR WORKSPACE xxx FOR 24 HOURS
```

### Monitoring Queries

**Check today's activity per workspace:**
```sql
SELECT
  workspace_id,
  COUNT(*) as comments_today,
  MIN(posted_at) as first_comment,
  MAX(posted_at) as last_comment
FROM linkedin_post_comments
WHERE status = 'posted'
  AND posted_at >= CURRENT_DATE
GROUP BY workspace_id;
```

**Check paused monitors:**
```sql
SELECT
  id,
  workspace_id,
  status,
  metadata->>'paused_reason' as reason,
  metadata->>'auto_resume_at' as resume_at
FROM linkedin_post_monitors
WHERE status = 'paused';
```

---

## Troubleshooting

### Comments Not Posting

1. **Check if limits are hit**
   ```sql
   SELECT COUNT(*) FROM linkedin_post_comments
   WHERE workspace_id = 'xxx'
     AND status = 'posted'
     AND posted_at >= CURRENT_DATE;
   ```

2. **Check if monitor is paused**
   ```sql
   SELECT status, metadata FROM linkedin_post_monitors
   WHERE workspace_id = 'xxx';
   ```

3. **Check if it's a skip day**
   - Sunday? Always skipped
   - Holiday? Check list above
   - Random skip? Check logs

### Monitor Auto-Paused

If a monitor was auto-paused due to LinkedIn warning:

1. **Check the reason**
   ```sql
   SELECT metadata->>'paused_reason' FROM linkedin_post_monitors
   WHERE id = 'xxx';
   ```

2. **Wait for auto-resume** (24 hours after pause)

3. **Or manually resume** (if you've verified the issue is resolved)
   ```sql
   UPDATE linkedin_post_monitors
   SET status = 'active',
       metadata = metadata - 'paused_reason' - 'paused_at' - 'auto_resume_at'
   WHERE id = 'xxx';
   ```

### Adjusting Limits

To change limits for a specific workspace:

```sql
UPDATE linkedin_post_monitors
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'),
  '{daily_comment_limit}',
  '3'::jsonb
)
WHERE workspace_id = 'xxx';
```

---

## Summary

This anti-detection system protects client LinkedIn accounts through:

1. **Hard limits** that never exceed LinkedIn's thresholds
2. **Human-like timing** with realistic delays
3. **Natural patterns** with sessions, breaks, and skip days
4. **Content variance** in length, style, and type
5. **Automatic warning detection** with instant 24-hour pause
6. **Per-workspace configuration** for custom limits

**The goal: Make automated activity indistinguishable from human behavior.**

---

*Document maintained by SAM AI Platform team. For questions, contact the engineering team.*
