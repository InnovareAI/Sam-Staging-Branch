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

### 6. Reply Detection Not Working (CRITICAL)
- **Problem**: `poll-message-replies` cron never detected prospect replies
- **Root Cause**: Comparing `msg.sender.provider_id` (like `ACoAAB...`) directly to `prospect.linkedin_user_id` which is stored as a URL (`http://linkedin.com/in/vanity`)
- **Fix**: Extract vanity from prospect and also compare to `sender.public_identifier`
- **File**: `app/api/cron/poll-message-replies/route.ts` (lines 163-172)
- **Example**: Alfred Collins Ayamba replied but wasn't detected. Manually updated his status.

**Before (broken)**:
```javascript
const senderId = msg.sender?.provider_id || msg.sender_id;
return senderId === prospect.linkedin_user_id;  // Never matches!
```

**After (fixed)**:
```javascript
const prospectVanity = extractVanity(prospect.linkedin_user_id);
const senderVanity = msg.sender?.public_identifier;
return senderId === prospect.linkedin_user_id ||
       (prospectVanity && senderVanity === prospectVanity);
```

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

1. `app/api/campaigns/activate/route.ts` - Main activation fixes
2. `app/api/campaigns/direct/send-connection-requests-fast/route.ts` - Accept activation trigger
3. `app/components/CampaignHub.tsx` - Frontend endpoint fix, disabled button for 0 prospects
4. `app/api/cron/queue-pending-prospects/route.ts` - Cross-campaign deduplication
5. `app/api/cron/poll-message-replies/route.ts` - **CRITICAL** reply detection fix

### 7. Campaign Type Auto-Override Bug
- **Problem**: When user selected "Messenger" campaign type, it auto-changed to "Connector"
- **Root Cause**: `userSelectedCampaignType` wasn't being set to `true` in certain scenarios:
  - When loading a saved draft
  - When syncing from `initialCampaignType` prop
- **Fix**: Added `setUserSelectedCampaignType(true)` to both:
  - Draft loading effect (line 2599)
  - Initial campaign type sync effect (line 1886)
- **File**: `app/components/CampaignHub.tsx`

### 8. Company Website Field Support
- **Problem**: CSV uploads couldn't capture company website URLs
- **Fix**: Added `company_website` column to prospect tables and full pipeline support
- **Migration**: `sql/migrations/030-add-company-website-to-prospects.sql`
- **Files modified**:
  - `app/api/prospect-approval/upload-csv/route.ts` - Header mappings for website fields
  - `app/api/campaigns/add-approved-prospects/route.ts` - Extract and store company_website
- **Column is optional**: Works gracefully when not provided in CSV

**CSV Header mappings added**:
```javascript
'website': 'companyWebsite',
'company website': 'companyWebsite',
'company_website': 'companyWebsite',
'company url': 'companyWebsite',
'url': 'companyWebsite'
```

## Deployment

- Deployed to production: https://app.meet-sam.com
- Latest commit: `d10af1e5`

## Impact

1. **Reply Detection**: All future prospect replies will now be properly detected by the polling cron. Before this fix, NO replies were being detected.

2. **Campaign Type Selection**: Users can now reliably select "Messenger" campaign type without it being auto-overridden to "Connector".

3. **Company Website**: CSV uploads can now include company website URLs which will be stored and available for personalization.

### 9. Reply Agent Draft Creation Bug (CRITICAL)
- **Problem**: When prospect replied, `triggerReplyAgent` silently failed to create draft
- **Root Causes**:
  1. `prospect.company` field doesn't exist - actual field is `company_name`
  2. `draft_text` column has NOT NULL constraint but code didn't set it
- **Fixes**:
  - Changed `prospect.company` to `prospect.company_name || prospect.company` (line 368)
  - Added placeholder `draft_text: '[Pending AI generation]'` (line 370)
- **File**: `app/api/cron/poll-message-replies/route.ts`
- **Verified**: Alfred Collins Ayamba's reply now creates draft, AI generates response, status = `pending_approval`

### 10. Reply Detection Provider ID vs URL Format
- **Problem**: `poll-message-replies` compared URL-format `linkedin_user_id` to provider_id format from Unipile
- **Root Cause**: `prospect.linkedin_user_id` stored as URL but `chat.attendee_provider_id` uses Unipile format (`ACoAADB...`)
- **Fix**:
  - Check if `linkedin_user_id` starts with 'ACo' (already provider_id) - use directly
  - Otherwise extract vanity and call `/api/v1/users/{vanity}?account_id=` to get provider_id
- **File**: `app/api/cron/poll-message-replies/route.ts` (lines 141-173)
