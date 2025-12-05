# Handover: Campaign Activation Fix (December 5, 2025)

## Summary

Fixed the Activate button on draft campaigns in Campaign Hub. Multiple cascading issues were discovered and resolved.

## Issues Fixed

### 1. Wrong API Endpoint (404 Error)
- **Problem**: Frontend called non-existent `PUT /api/campaigns/${id}/status`
- **Fix**: Changed to `POST /api/campaigns/activate` with `{ campaignId, workspaceId }` body
- **File**: `app/components/CampaignHub.tsx`

### 2. Async Client Not Awaited (TypeError)
- **Problem**: `Cannot read properties of undefined (reading 'getUser')`
- **Root Cause**: `createClient()` returns a Promise but was called without `await`
- **Fix**: Added `await createClient()`
- **File**: `app/api/campaigns/activate/route.ts`

### 3. Connector Campaigns Routed to Email Endpoint
- **Problem**: Connector/LinkedIn campaigns were being sent to `/api/campaigns/email/send-emails-queued`
- **Fix**: Updated routing logic:
  - `connector`, `linkedin`, `messenger` → `/api/campaigns/direct/send-connection-requests-fast`
  - `email` → `/api/campaigns/email/send-emails-queued`
- **File**: `app/api/campaigns/activate/route.ts` (lines 70-82)

### 4. Internal API Call Auth Failure (401 Unauthorized)
- **Problem**: Activate endpoint calls execution endpoint via `fetch()` without cookies
- **Fix**: Added `x-internal-trigger: campaign-activation` header
- **Files**:
  - `app/api/campaigns/activate/route.ts` (line 94)
  - `app/api/campaigns/direct/send-connection-requests-fast/route.ts` (accepts trigger)

### 5. Wrong Column Name (Database Error)
- **Problem**: `Could not find the 'activated_at' column of 'campaigns' in the schema cache`
- **Fix**: Changed `activated_at` to `launched_at` (correct column name)
- **File**: `app/api/campaigns/activate/route.ts` (lines 57-64, 107-112)

## Additional Changes

### Cross-Campaign Deduplication (queue-pending-prospects)
Added deduplication to prevent "Should delay", "Cannot resend yet" errors:
- Checks if LinkedIn URL already exists in ANY campaign's send_queue
- Checks if prospect was already contacted in ANY campaign
- Skips duplicates with log message
- **File**: `app/api/cron/queue-pending-prospects/route.ts` (lines 106-177)

### Empty Draft Campaign Cleanup
- Deleted 17 draft campaigns with 0 prospects
- Kept 2 draft campaigns that had prospects

### UI Improvement
- Activate button now disabled for campaigns with 0 prospects
- Shows tooltip explaining why

## Code References

### Campaign Activation Flow
```
User clicks Activate
    ↓
POST /api/campaigns/activate
    ↓
1. Auth check (getUser)
2. Workspace membership check
3. Campaign status check (must be draft/inactive)
4. Update status to 'active', set launched_at
5. Call execution endpoint based on campaign_type:
   - connector/linkedin/messenger → /api/campaigns/direct/send-connection-requests-fast
   - email → /api/campaigns/email/send-emails-queued
6. If execution fails, rollback to inactive
```

### Key Code Sections

**Routing Logic** (`app/api/campaigns/activate/route.ts:70-82`):
```typescript
let executeEndpoint = '/api/campaigns/direct/send-connection-requests-fast'

if (campaign.campaign_type === 'email') {
  executeEndpoint = '/api/campaigns/email/send-emails-queued'
} else if (campaign.campaign_type === 'connector' ||
           campaign.campaign_type === 'linkedin' ||
           campaign.campaign_type === 'messenger') {
  executeEndpoint = '/api/campaigns/direct/send-connection-requests-fast'
}
```

**Internal Trigger Header** (`app/api/campaigns/activate/route.ts:88-99`):
```typescript
const executeResponse = await fetch(
  `${process.env.NEXT_PUBLIC_APP_URL}${executeEndpoint}`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-trigger': 'campaign-activation'  // Bypasses auth
    },
    body: JSON.stringify({ campaignId })
  }
)
```

## Database Schema Reference

### campaigns table (relevant columns)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| status | VARCHAR | draft, active, inactive, paused, completed |
| campaign_type | VARCHAR | connector, linkedin, messenger, email |
| launched_at | TIMESTAMP | When campaign was activated (NOT activated_at) |
| workspace_id | UUID | Foreign key to workspaces |

## Verification

Campaign `51493910-28f0-4cb0-9e5c-531f1efbaa70` successfully activated:
- Status: `active`
- Launched at: `2025-12-05T15:17:57.488+00:00`
- Moved from Drafts tab to Active tab

## Files Modified

1. `app/api/campaigns/activate/route.ts` - Main fixes
2. `app/api/campaigns/direct/send-connection-requests-fast/route.ts` - Accept activation trigger
3. `app/components/CampaignHub.tsx` - Frontend endpoint fix, disabled button for 0 prospects
4. `app/api/cron/queue-pending-prospects/route.ts` - Cross-campaign deduplication

## Deployment

- Deployed to production: https://app.meet-sam.com
- Commit: `e0f6ba9c`
- Deploy URL: `https://6932e9b3328b107162eae840--devin-next-gen-prod.netlify.app`
