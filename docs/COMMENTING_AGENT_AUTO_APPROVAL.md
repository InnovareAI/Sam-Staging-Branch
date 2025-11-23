# LinkedIn Commenting Agent - Auto-Approval Feature

**Date:** November 23, 2025
**Feature:** Automatic comment approval during active hours

## Overview

The auto-approval feature allows LinkedIn comments to be automatically approved and posted if they are generated during a user-defined time window. This eliminates the need for manual approval during business hours while maintaining control outside of active hours.

## How It Works

### 1. Configuration

Users configure the auto-approval window when creating a commenting campaign:

- **Auto-Approve Enabled**: Toggle on/off
- **Auto-Approve Start Time**: When the approval window begins (e.g., 09:00)
- **Auto-Approve End Time**: When the approval window ends (e.g., 17:00)
- **Timezone**: The timezone for the approval window (e.g., America/New_York)

### 2. Comment Generation Flow

```
1. N8N discovers LinkedIn post matching campaign criteria
2. AI generates comment using Claude
3. Comment added to linkedin_comment_queue table
4. Auto-approval service checks:
   - Is auto-approval enabled for this monitor?
   - Is current time (in monitor's timezone) within approval window?
5a. IF YES → Comment auto-approved and marked for posting
5b. IF NO → Comment requires manual approval (HITL workflow)
```

### 3. Database Schema

**Migration 014** adds these columns to `linkedin_post_monitors`:

```sql
auto_approve_enabled BOOLEAN DEFAULT FALSE
auto_approve_start_time TIME DEFAULT '09:00:00'
auto_approve_end_time TIME DEFAULT '17:00:00'
timezone VARCHAR(100) DEFAULT 'America/New_York'
```

### 4. Implementation

**Service Layer:** `lib/services/auto-approval-service.ts`

Key functions:
- `shouldAutoApproveComment(monitorId)` - Checks if current time is within approval window
- `autoApproveQueuedComment(queueId, userId)` - Marks comment as approved
- `isTimeInRange(time, start, end)` - Handles time range checks (including overnight ranges)

**UI Component:** `app/components/CommentingCampaignModal.tsx`

Auto-approval controls in Advanced Settings section (lines 583-629).

## Usage

### Creating a Campaign with Auto-Approval

1. Click "Create Commenting Campaign"
2. Fill in campaign details (hashtags, keywords, etc.)
3. Open "Advanced Settings"
4. Enable "Auto-Approve Comments" toggle
5. Set start time (e.g., 09:00 for 9 AM)
6. Set end time (e.g., 17:00 for 5 PM)
7. Select timezone (defaults to America/New_York)
8. Create campaign

### Example Scenarios

**Scenario 1: Business Hours (9 AM - 5 PM ET)**
- Start: 09:00
- End: 17:00
- Timezone: America/New_York
- Result: Comments generated between 9 AM - 5 PM ET are auto-approved

**Scenario 2: Overnight (10 PM - 6 AM PT)**
- Start: 22:00
- End: 06:00
- Timezone: America/Los_Angeles
- Result: Comments generated between 10 PM - 6 AM PT are auto-approved (handles overnight range)

**Scenario 3: Auto-Approval Disabled**
- Enabled: false
- Result: ALL comments require manual approval regardless of time

## Integration with N8N Workflows

The auto-approval service should be called from the N8N "Comment Generator" workflow:

```javascript
// After generating comment and adding to queue
const monitorId = $input.item.json.monitor_id;
const queueId = $input.item.json.queue_id;

// Call auto-approval service
const response = await fetch('https://app.meet-sam.com/api/linkedin-commenting/auto-approve', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ monitorId, queueId })
});

const result = await response.json();

if (result.autoApproved) {
  // Proceed to posting workflow
  return { status: 'auto_approved', queueId };
} else {
  // Send to HITL approval workflow
  return { status: 'pending_approval', queueId };
}
```

## API Endpoint (To Be Created)

**POST** `/api/linkedin-commenting/auto-approve`

Request:
```json
{
  "monitorId": "uuid",
  "queueId": "uuid"
}
```

Response:
```json
{
  "autoApproved": true,
  "reason": "Within approval window (09:00-17:00 America/New_York)"
}
```

## Testing

### Manual Test Script

```bash
node scripts/js/test-auto-approval.mjs
```

Test script should:
1. Create a test monitor with auto-approval enabled
2. Generate a comment
3. Check if auto-approval logic works correctly
4. Clean up test data

### Test Cases

1. ✅ Comment generated during approval window → Auto-approved
2. ✅ Comment generated outside approval window → Requires manual approval
3. ✅ Auto-approval disabled → Requires manual approval
4. ✅ Overnight window (22:00-06:00) → Correctly handles range
5. ✅ Timezone conversion → Uses monitor's timezone, not server time

## Benefits

1. **Reduced Manual Work**: No need to approve every comment during business hours
2. **Timezone Control**: Set approval window based on your local business hours
3. **Safety**: Comments outside business hours still require manual review
4. **Flexibility**: Can disable auto-approval for sensitive campaigns
5. **Audit Trail**: Auto-approved comments still show `approved_by` and `approved_at` timestamps

## Migration Required

Before using this feature, run migration 014:

```sql
-- In Supabase SQL Editor
\i sql/migrations/014-add-timezone-to-commenting-monitors.sql
```

Or copy/paste the migration SQL directly into Supabase SQL Editor.

## Next Steps

1. Run migration 014 in Supabase
2. Deploy updated UI code
3. Create `/api/linkedin-commenting/auto-approve` endpoint
4. Update N8N "Comment Generator" workflow to call auto-approval service
5. Test with real commenting campaign

## Related Files

- Migration: `sql/migrations/014-add-timezone-to-commenting-monitors.sql`
- Service: `lib/services/auto-approval-service.ts`
- UI: `app/components/CommentingCampaignModal.tsx`
- API (to create): `app/api/linkedin-commenting/auto-approve/route.ts`
