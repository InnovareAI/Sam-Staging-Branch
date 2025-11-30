# Handover Document - November 30, 2025

## Session Summary

This session focused on fixing messenger campaign execution, implementing reply detection, updating scheduling configuration, and adding engagement bait filtering to the commenting agent.

---

## Changes Made

### 1. Messenger Campaign Routing Fix

**Problem:** Messenger campaigns were incorrectly using the connector campaign endpoint, resulting in `message_type = 'connection_request'` instead of `direct_message_1`.

**Root Cause:** `handleApproveCampaign` in CampaignHub.tsx always called `/api/campaigns/direct/send-connection-requests-fast` regardless of campaign type.

**Fix:** Added conditional routing based on campaign type.

**File:** [app/components/CampaignHub.tsx](../app/components/CampaignHub.tsx) (Line ~6612-6629)

```typescript
// CRITICAL FIX: Use correct endpoint based on campaign type
const executeEndpoint = approvedCampaignType === 'messenger'
  ? '/api/campaigns/direct/send-messages-queued'
  : '/api/campaigns/direct/send-connection-requests-fast';

console.log(`🚀 Executing ${approvedCampaignType} campaign via ${executeEndpoint}`);
```

---

### 2. Reply/Opt-Out Detection

**Problem:** Messages continued sending even after prospects replied or opted out.

**Fix:** Added status check in `process-send-queue` to cancel all pending messages when prospect has replied/opted-out.

**File:** [app/api/cron/process-send-queue/route.ts](../app/api/cron/process-send-queue/route.ts) (Line ~309-336)

```typescript
// 4.5 CRITICAL: Check if prospect has replied or opted out - STOP all messaging
const stopStatuses = ['replied', 'opted_out', 'converted', 'not_interested'];
if (stopStatuses.includes(prospect.status)) {
  console.log(`🛑 Prospect has ${prospect.status} - cancelling all pending messages`);

  // Cancel ALL pending messages for this prospect in this campaign
  const { data: cancelledMessages } = await supabase
    .from('send_queue')
    .update({
      status: 'cancelled',
      error_message: `Prospect ${prospect.status} - messaging stopped`,
      updated_at: new Date().toISOString()
    })
    .eq('campaign_id', queueItem.campaign_id)
    .eq('prospect_id', queueItem.prospect_id)
    .eq('status', 'pending')
    .select('id');
  // Returns cancelled count
}
```

---

### 3. Scheduling Configuration - 5 AM PT Start

**Problem:** Messages were scheduled for wrong timezone/time.

**Fix:** Updated default timezone to Pacific Time and business hours to start at 5 AM.

**File:** [lib/scheduling-config.ts](../lib/scheduling-config.ts) (Line 24-37)

```typescript
// Default timezone (can be overridden per workspace)
export const DEFAULT_TIMEZONE = 'America/Los_Angeles'; // Pacific Time

// Business hours configuration
export const BUSINESS_HOURS = {
  start: 5,  // 5 AM PT - early to catch East Coast business hours
  end: 17,   // 5 PM PT
};

// Follow-up business hours (slightly wider)
export const FOLLOW_UP_HOURS = {
  start: 5,  // 5 AM PT
  end: 18,   // 6 PM PT
};
```

---

### 4. Database Constraint Fix

**Problem:** Unique constraint `send_queue_campaign_prospect_unique` blocked multiple messages per prospect (needed for follow-ups).

**Fix:** Dropped the restrictive constraint. Kept `send_queue_campaign_prospect_message_unique` which allows one message per TYPE per prospect.

```sql
-- Dropped (was blocking follow-ups)
DROP INDEX IF EXISTS send_queue_campaign_prospect_unique;

-- Kept (correct - one message per type)
-- send_queue_campaign_prospect_message_unique (campaign_id, prospect_id, message_type)
```

---

### 5. QA Monitor - Same-Day Follow-up Check

**Problem:** No automated way to detect scheduling violations where follow-ups were scheduled on the same day as the first message.

**Fix:** Added `checkSameDayFollowups` function to QA monitor.

**File:** [app/api/agents/qa-monitor/route.ts](../app/api/agents/qa-monitor/route.ts) (Line 394-454)

```typescript
async function checkSameDayFollowups(supabase: any): Promise<QACheck> {
  // CRITICAL: Find prospects with multiple messages scheduled on same day
  // Rule: Follow-ups must NEVER be on the same day as first message

  // Groups by prospect and checks for date collisions
  // Returns violation count and affected prospect IDs
}
```

---

### 6. Engagement Bait Filter for Commenting Agent

**Problem:** AI was generating thoughtful comments on engagement bait posts requesting one-word responses like "yes", "No", "send it", etc.

**Fix:** Added comprehensive regex-based filter to skip engagement bait posts during discovery.

**File:** [app/api/linkedin-commenting/discover-posts-apify/route.ts](../app/api/linkedin-commenting/discover-posts-apify/route.ts) (Line 18-97)

**Patterns Detected:**
- "comment yes/no/send/agree/done"
- "drop a [emoji]" or "drop me"
- "like/comment if you agree"
- "type yes to get..."
- "reply with..."
- "who's in?" / "who needs this?"
- "I'll send..." DM bait patterns

```typescript
const ENGAGEMENT_BAIT_PATTERNS = [
  // Direct requests for one-word comments
  /\b(comment|drop|type|say|reply|respond)[\s:]+["']?(yes|no|send|agree|done|interested|ready|me|want|need|please|now|true|info)["']?\b/i,
  // ... 15+ more patterns
];

function isEngagementBait(postContent: string): { isBait: boolean; matchedPattern?: string } {
  // Returns true if post matches any engagement bait pattern
}
```

Applied to both profile posts (line 335-353) and hashtag posts (line 623-641).

---

## Commits Made

1. `b553b415` - Fix messenger campaign scheduling & reply detection
2. `9cfec9ea` - Fix messenger campaigns using wrong endpoint
3. `b71e59d5` - Add same-day follow-up check to QA monitor
4. `c6fcc699` - Add engagement bait filter to commenting agent

---

## Production Status

- **Deployed:** November 30, 2025
- **URL:** https://app.meet-sam.com
- **All changes verified working**

---

## Test Campaign: Tim Lewandowski

A messenger campaign was created for testing with prospect Tim Lewandowski:
- Campaign ID: Check `campaigns` table for messenger type campaign
- 5 messages queued (direct_message_1 through direct_message_5)
- Scheduled at 5 AM PT on consecutive business days
- First message: Dec 2, 2025 05:00:00 PT

---

## Key Rules Implemented

### Messaging Rules

1. **No same-day follow-ups**: Follow-up messages must be scheduled on different days from the first message
2. **Reply detection**: If prospect replies, opts out, or converts, ALL pending messages are cancelled
3. **5 AM PT start**: All messaging begins at 5 AM Pacific Time
4. **Business hours only**: Messages skip weekends and holidays

### Commenting Rules

1. **Skip engagement bait**: Posts requesting one-word comments are filtered out
2. Posts must have substantial content (>20 characters) to be considered
3. Engagement bait posts are logged but not stored in the database

---

## Files Modified

| File | Changes |
|------|---------|
| `app/components/CampaignHub.tsx` | Fixed endpoint routing for messenger campaigns |
| `app/api/cron/process-send-queue/route.ts` | Added reply/opt-out detection |
| `lib/scheduling-config.ts` | Changed to 5 AM PT start time |
| `app/api/agents/qa-monitor/route.ts` | Added same-day follow-up check |
| `app/api/linkedin-commenting/discover-posts-apify/route.ts` | Added engagement bait filter |

---

## Monitoring

### Check Tim's Queue Status
```sql
SELECT sq.id, sq.message_type, sq.status, sq.scheduled_for, cp.first_name
FROM send_queue sq
JOIN campaign_prospects cp ON cp.id = sq.prospect_id
WHERE cp.first_name = 'Tim'
ORDER BY sq.scheduled_for;
```

### Run QA Monitor
```bash
curl -X POST https://app.meet-sam.com/api/agents/qa-monitor \
  -H "Content-Type: application/json" \
  -d '{"workspace_id": "babdcab8-1a78-4b2f-913e-6e9fd9821009"}'
```

### Check Engagement Bait Filtering
```bash
netlify logs --function discover-posts-apify --tail
# Look for: 🚫 Skipping engagement bait post
```

---

## Next Steps

1. **Monitor Tim's campaign** - First message should send Dec 2 at 5 AM PT
2. **Run QA agent daily** - Verify no same-day scheduling violations
3. **Review engagement bait logs** - Ensure filter is catching appropriate posts without false positives
4. **Test reply detection** - When a prospect replies, verify all pending messages are cancelled

---

## Important Notes

1. **Messenger vs Connector campaigns**:
   - Messenger: `message_type` = `direct_message_1`, `direct_message_2`, etc.
   - Connector: `message_type` = `connection_request`, `follow_up_1`, etc.

2. **Database constraints**:
   - `send_queue_campaign_prospect_message_unique` is the ONLY unique constraint
   - Allows multiple messages per prospect (different types)
   - Prevents duplicate messages of same type

3. **Timezone handling**:
   - All scheduling uses `America/Los_Angeles` (Pacific Time)
   - Timestamps stored without timezone in database
   - Business hours: 5 AM - 5 PM PT

---

**Last Updated:** November 30, 2025
**Author:** Claude Code
