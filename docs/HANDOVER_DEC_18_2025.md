# Handover Document - December 15-18, 2025

## Executive Summary

This document covers all major work completed from December 15-18, 2025. Over 100 commits implementing critical bug fixes, new features, and infrastructure improvements.

**Major Accomplishments:**

1. **Failed Prospects Management System** - Complete UI + API for handling failed campaign prospects
2. **CSV Upload → Campaign Transfer Fix** - Fixed critical bug where approved prospects weren't transferred
3. **Notification Router** - Unified Slack/Google Chat notification system with fallback
4. **Calendar Integrations** - Google Calendar, Outlook, Calendly, Cal.com via Unipile
5. **Meeting Agent** - Full meeting lifecycle management system
6. **Anti-Detection System** - Randomized CR spacing, delays, warning detection
7. **InMail Campaigns** - New InMail and Open InMail campaign types
8. **QA Monitor Improvements** - Smarter stuck campaign detection, email-only campaign handling
9. **Staging Environment** - Complete staging infrastructure setup
10. **Security Audit Fixes** - Critical vulnerability patches

---

## 1. Failed Prospects Management System

### Problem
When campaigns had failed prospects (bounced, error, rate limited), users had no way to:
- See which prospects failed
- Understand why they failed
- Download a list of failures
- Retry sending to failed prospects

### Solution

**New Files Created:**

| File | Purpose |
|------|---------|
| `app/api/campaigns/[id]/failed-prospects-csv/route.ts` | CSV download endpoint |
| `app/api/campaigns/[id]/reset-failed/route.ts` | Reset & retry endpoint |

**UI Changes (`app/components/CampaignHub.tsx`):**

Added "Failed" column to campaign table:
- Shows count of failed prospects (red text)
- Download icon → Downloads CSV of failed prospects
- Reset icon → Resets failed prospects to pending status

**Google Chat Integration (`lib/notifications/google-chat.ts`):**

New `sendFailedProspectsAlert()` function:
- Sends alert card when campaign has failed prospects
- Includes Download CSV and Reset & Retry buttons
- Shows top 3 error reasons

**Slack Integration (`lib/slack.ts`):**

New `notifyFailedProspects()` method:
- Parallel Slack notification for workspaces with Slack configured
- Same buttons (Download CSV, Reset & Retry)

**Notification Router (`lib/notifications/notification-router.ts`):**

New unified router:
- Checks workspace's notification preference (Slack vs Google Chat)
- Falls back to Google Chat if Slack fails
- Exports `sendFailedProspectsAlert()` and `sendRateLimitNotification()`

---

## 2. CSV Upload → Campaign Transfer Fix (CRITICAL)

### Problem
When users:
1. Upload CSV of prospects
2. Approve prospects in the approval flow
3. Assign a campaign to the session

The prospects were NOT being transferred to `campaign_prospects`. They stayed stuck in `prospect_approval_data`.

### Root Cause

In `app/api/prospect-approval/bulk-approve/route.ts` (line 205):

```typescript
if (sessionData?.campaign_id) {
  // Transfer logic only runs if campaign_id is already set
}
```

But CSV uploads create sessions with `campaign_id = NULL` by design (user picks campaign later).

### Fix Applied

Updated `app/api/prospect-approval/sessions/update-campaign/route.ts`:

When `campaign_id` is assigned to a session:
1. Check if session has already-approved prospects
2. If yes, transfer them to `campaign_prospects`
3. If campaign is active + has connection message, queue them to `send_queue`

**Key Code Added (lines 109-254):**

```typescript
// AUTO-TRANSFER: If campaign_id was just set, transfer any already-approved prospects
if (campaign_id) {
  const { data: approvedDecisions } = await adminClient
    .from('prospect_approval_decisions')
    .select('prospect_id')
    .eq('session_id', session_id)
    .eq('decision', 'approved');

  if (approvedDecisions && approvedDecisions.length > 0) {
    // Get prospect data, check for duplicates, insert to campaign_prospects
    // If campaign active, also queue to send_queue
  }
}
```

---

## 3. Calendar Integrations

### New Files

| File | Purpose |
|------|---------|
| `app/api/calendar/google/route.ts` | Google Calendar OAuth |
| `app/api/calendar/outlook/route.ts` | Outlook Calendar OAuth |
| `app/api/calendar/calendly/route.ts` | Calendly OAuth |
| `app/api/calendar/calcom/route.ts` | Cal.com OAuth |
| `app/api/calendar/unipile-webhook/route.ts` | Unipile calendar callbacks |
| `lib/calendar/unipile-calendar.ts` | Unipile Calendar API integration |

### Settings UI

Updated `app/(dashboard)/settings/page.tsx`:
- Single Calendar tile with provider selection modal
- Support for Google, Outlook, Calendly, Cal.com
- Connection status display

### Integration Flow

1. User clicks Calendar tile in Settings
2. Modal shows available providers
3. OAuth flow via Unipile
4. Calendar events sync to SAM for meeting management

---

## 4. Meeting Agent

### Documentation

Created comprehensive documentation: `docs/MEETING_AGENT.md`

### Capabilities

1. **Pre-Meeting Reminders** - Automated reminders before scheduled meetings
2. **Meeting Notes** - Capture and store meeting notes
3. **Follow-Up Scheduling** - Auto-schedule follow-up tasks
4. **CRM Sync** - Push meeting outcomes to connected CRM

### Cron Jobs

| Cron | Purpose |
|------|---------|
| `send-meeting-reminders` | Send reminders 24h/1h before meetings |
| `send-meeting-follow-ups` | Auto-send follow-up messages |
| `check-meeting-status` | Update meeting statuses |

---

## 5. Anti-Detection System Improvements

### Rate Limits (`lib/anti-detection/message-variance.ts`)

```typescript
export const MESSAGE_HARD_LIMITS = {
  MAX_CR_PER_DAY: 25,           // Connection requests per day
  MAX_MESSAGES_PER_DAY: 100,    // Messages per day
  MAX_INMAILS_PER_DAY: 25,      // InMails per day
  MAX_OPEN_INMAILS_PER_MONTH: 100, // Open InMails per month
  MIN_CR_GAP_MINUTES: 20,       // Minimum 20 min between CRs
  MIN_MESSAGE_GAP_MINUTES: 5,   // Minimum 5 min between messages
};
```

### Integration Points

Updated files to use centralized limits:
- `app/api/cron/process-send-queue/route.ts`
- `app/api/cron/queue-pending-prospects/route.ts`
- `app/api/campaigns/direct/send-connection-requests-fast/route.ts`

### LinkedIn Warning Detection

```typescript
const WARNING_PATTERNS = [
  'too many connection requests',
  'exceeded', 'temporarily restricted',
  'unusual activity', 'slow down',
  'limit reached', 'action blocked', 'try again later'
];
```

When detected, messages are rescheduled 24 hours instead of failing.

---

## 6. InMail Campaign Support

### New Campaign Types

| Type | Use Case |
|------|----------|
| `inmail` | Send InMails to 2nd/3rd degree connections |
| `open_inmail` | Send free InMails to Open Profile members |

### Credit Checking

`app/api/linkedin/inmail-credits/route.ts`:
- Checks InMail credit balance
- Detects Open Profile status on prospects
- Warns if insufficient credits

### UI Updates

- Campaign type selector includes InMail options
- Credit balance display in campaign setup
- Open Profile indicator on prospect cards

---

## 7. QA Monitor Improvements

### Smarter Stuck Campaign Detection

Updated `app/api/agents/qa-monitor/route.ts`:

1. **Skip email-only campaigns** - They use `email_queue`, not `send_queue`
2. **Batch .in() queries** - Prevent Supabase errors with large arrays
3. **Better error grouping** - Top 3 errors per campaign
4. **Removed noise** - No more Reply Agent coverage alerts

### Realtime Error Monitor

`app/api/agents/realtime-error-monitor/route.ts`:
- Always sends status to Google Chat (even success)
- Batched queries for performance
- Clearer error categorization

---

## 8. Staging Environment

### Infrastructure

| Environment | URL | Netlify Site |
|-------------|-----|--------------|
| Production | app.meet-sam.com | devin-next-gen-prod |
| Staging | sam-staging.netlify.app | sam-staging |

### Staging Database

- URL: `https://cuiqpollusiqkewpvplm.supabase.co`
- Separate from production
- For testing new features

### Deployment Commands

```bash
npm run deploy:staging      # Deploy to staging
npm run deploy:production   # Deploy to production (with checks)
```

---

## 9. Security Audit Fixes

Commit `d1a757d4` - SECURITY: Fix critical vulnerabilities

### Issues Fixed

1. **SQL Injection** - Parameterized all dynamic queries
2. **XSS Prevention** - Sanitized user input in HTML responses
3. **Auth Bypass** - Added missing auth checks on admin endpoints
4. **Rate Limiting** - Added rate limits on auth endpoints

---

## 10. LinkedIn Account Detection Fixes (CRITICAL - Dec 18)

### Problem
Campaign creation and execution was failing with "LinkedIn account not found" errors, even when accounts existed.

### Root Cause
Multiple issues:
1. System only checked `workspace_accounts` table, but LinkedIn accounts can also be in `user_unipile_accounts`
2. Status check only accepted 'connected', but accounts could also be 'active'
3. Campaign creation didn't auto-assign LinkedIn account from either table

### Fixes Applied (Dec 18)

1. **`app/api/campaigns/route.ts`** (lines 365-385, 534-548):
   - Added fallback to check `user_unipile_accounts` when `workspace_accounts` empty
   - Accept both 'connected' and 'active' connection statuses
   ```typescript
   // FIX (Dec 18): Fallback to user_unipile_accounts if workspace_accounts doesn't have it
   if (!linkedinAccount) {
     const { data: unipileAccounts } = await supabase
       .from('user_unipile_accounts')
       .select('id, account_name, connection_status')
       .eq('workspace_id', workspace_id)
       .eq('platform', 'LINKEDIN')
       .in('connection_status', ['connected', 'active'])
       .limit(1);
     if (unipileAccounts?.[0]) {
       linkedinAccount = { id: unipileAccounts[0].id, account_name: unipileAccounts[0].account_name };
     }
   }
   ```

2. **`app/api/campaigns/direct/send-connection-requests-fast/route.ts`** (lines 114-161):
   - Removed JOIN on workspace_accounts, now fetches LinkedIn account separately
   - Checks both tables for LinkedIn account
   - Accepts both 'connected' and 'active' statuses

3. **`app/api/campaigns/activate/route.ts`**:
   - Check both `workspace_accounts` AND `user_unipile_accounts`
   - Accept both 'connected' and 'active' status

4. **`app/api/linkedin-search/route.ts`**:
   - Accept 'active' status from `user_unipile_accounts`

5. **Provider ID validation**:
   - Recognize both `ACo` and `ACw` prefixes as valid LinkedIn IDs

### Two LinkedIn Account Tables

The system has TWO tables that store LinkedIn accounts:

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `workspace_accounts` | Workspace-level account associations | `id`, `unipile_account_id`, `account_type`, `connection_status`, `is_active` |
| `user_unipile_accounts` | User-level Unipile connections | `id`, `unipile_account_id`, `platform`, `connection_status` |

**Important**: Always check BOTH tables when looking up LinkedIn accounts.

---

## 11. Commenting Agent Improvements

### Quality Scoring

New scoring system for AI-generated comments:
- Length check (min 50 chars)
- Banned phrase detection
- Originality score
- Relevance to post content

### Relationship Memory

Track author interactions:
- Previous comments to same author
- Response rates
- Engagement history

### Randomized Openers

Added variety to comment openings to avoid detection:
```typescript
const OPENER_SUGGESTIONS = [
  "Great point about...",
  "This resonates because...",
  "Interesting perspective on...",
  // ... 20+ variations
];
```

---

## 12. Follow-Up Agent V2

### Improvements

1. **Reply Detection** - Stop ALL follow-ups when prospect replies (any channel)
2. **Randomized Intervals** - Variable days between follow-ups
3. **Skip Probability** - 5% chance to naturally drop off
4. **Spintax Support** - Message variations per prospect

### Integration

Updated `app/api/cron/send-approved-follow-ups/route.ts`:
- Check for replies before sending
- Apply randomized delays
- Process spintax

---

## 13. Data Upload Validation

### New Feature

Added validation modal after data upload:
- Shows preview of parsed data
- Highlights missing required fields
- Allows user to cancel before import

### Files Modified

- `app/components/DataUploadModal.tsx`
- `app/api/prospect-approval/upload-csv/route.ts`

---

## 14. Stale Invitation Withdrawal

### New Cron Job

`netlify/functions/withdraw-stale-invitations.ts`:
- Runs daily
- Withdraws LinkedIn invitations older than 21 days
- Frees up connection request quota
- Logs withdrawn count to Google Chat

---

## Files Created (Dec 15-18)

| File | Purpose |
|------|---------|
| `app/api/campaigns/[id]/failed-prospects-csv/route.ts` | CSV download |
| `app/api/campaigns/[id]/reset-failed/route.ts` | Reset failed |
| `lib/notifications/notification-router.ts` | Unified notifications |
| `app/api/calendar/*/route.ts` | Calendar integrations |
| `lib/calendar/unipile-calendar.ts` | Calendar API |
| `lib/linkedin-utils.ts` | **Centralized LinkedIn URL/slug utilities** |
| `docs/MEETING_AGENT.md` | Meeting agent docs |
| `docs/STAGING_ENVIRONMENT.md` | Staging docs |
| `netlify/functions/withdraw-stale-invitations.ts` | Stale invite cron |

---

## Files Modified (Major Changes)

| File | Changes |
|------|---------|
| `app/api/prospect-approval/sessions/update-campaign/route.ts` | Auto-transfer fix |
| `app/api/agents/qa-monitor/route.ts` | Skip email-only, batch queries |
| `app/api/cron/process-send-queue/route.ts` | Anti-detection delays |
| `app/api/cron/queue-pending-prospects/route.ts` | Batch .in() queries |
| `app/components/CampaignHub.tsx` | Failed column, reset button |
| `lib/slack.ts` | Failed prospects notification |
| `lib/notifications/google-chat.ts` | Failed prospects alert |
| `app/(dashboard)/settings/page.tsx` | Calendar integrations |

---

## Bug Fixes Summary

| Bug | Fix |
|-----|-----|
| CSV prospects not transferred to campaigns | Update-campaign now transfers approved prospects |
| QA monitor failing on large campaigns | Batched .in() queries |
| LinkedIn account not found on activation | Check both tables, accept 'active' status |
| LinkedIn account not found on campaign creation | Check both `workspace_accounts` AND `user_unipile_accounts` |
| LinkedIn account not found on execution | Separate account fetch instead of JOIN, check both tables |
| Failed prospects invisible | Added Failed column + CSV download |
| Follow-ups sent after reply | Stop ALL follow-ups on any reply |
| InMail credits not checked | Added credit balance API |
| Stale invitations wasting quota | Auto-withdraw after 21 days |
| Provider ID validation too strict | Accept ACw prefix |
| **"User ID does not match format" errors** | **Centralized `extractLinkedInSlug()` across all 8 entry points** |
| **Batch inserts failing ALL records silently** | **Converted to one-by-one inserts with individual error tracking** |
| **Duplicate messages sent (race condition)** | **Optimistic locking: claim items with `status='processing'` before send** |
| **Rate limited items marked as failed** | **Keep `status='pending'`, auto-retry in 1 hour** |
| **Spintax stripping personalization braces** | **Removed spintax entirely, direct string replacement only** |
| **Chatbot slow via OpenRouter hop** | **Direct Claude SDK call, deprecated OpenRouter endpoint** |
| **Follow-up limit too low (4-5)** | **Increased to 15 follow-ups for all campaign types** |
| **Wrong account types (email as linkedin)** | **Fixed tl@ and jf@ accounts to 'email' type** |

---

## Production URLs

- **App**: https://app.meet-sam.com
- **Staging**: https://sam-staging.netlify.app
- **Supabase (Prod)**: https://latxadqrvrrrcvkktrog.supabase.co
- **Supabase (Staging)**: https://cuiqpollusiqkewpvplm.supabase.co

---

## Known Design Decisions

### Data Approval → Campaign Creation Flow

The frontend has **TWO** campaign creation flows with different behaviors:

1. **Flow 1** (CampaignHub.tsx lines 3920-4100):
   - Passes `session_id` to API
   - Auto-transfers ALL approved prospects from session

2. **Flow 2** (CampaignHub.tsx lines 7270-7635 - approval screen):
   - Does NOT pass `session_id` (intentional Dec 8 fix)
   - Prevents data leakage when user selects subset of prospects
   - Requires manual prospect transfer or using `update-campaign` endpoint

**Current Behavior**: When creating campaigns from the approval screen, prospects must be transferred manually OR the session must be linked to the campaign via the `update-campaign/route.ts` endpoint.

---

## 15. Duplicate Message Race Condition Fix (CRITICAL - Dec 18)

### Problem

The queue processor had a race condition that caused the same message to be sent 2-3 times to real LinkedIn contacts. Multiple concurrent cron jobs would process the same queue item before the status was updated.

**Evidence of duplicates:**
- Ivonne: 3 messages within 12 seconds
- Carl: 2 messages within 10 seconds
- Chudi: 3 messages within 17 seconds
- Gilad: 2 messages within 9 seconds

### Root Cause

1. Cron job A fetches queue item with `status='pending'`
2. Cron job B fetches same item (still `pending`) before A updates it
3. Both jobs send the message
4. Both jobs update status to `sent`
5. Prospect receives duplicate messages

### Solution: Optimistic Concurrency Control

**File: `app/api/cron/process-send-queue/route.ts`**

```typescript
// ATOMIC LOCK: Claim the item by setting status to 'processing'
// This UPDATE only succeeds if status is still 'pending'
const { data: claimedItem, error: claimError } = await supabase
  .from('send_queue')
  .update({ status: 'processing', updated_at: new Date().toISOString() })
  .eq('id', item.id)
  .eq('status', 'pending')  // ← Only succeeds if still pending
  .select()
  .single();

if (claimError || !claimedItem) {
  // Another cron job already claimed this item - skip it
  console.log(`⏭️ Item ${item.id} already claimed by another process`);
  continue;
}

// Now safe to process - we have exclusive lock
```

### Key Changes

1. **Lines 483-504**: Atomic lock via `UPDATE ... WHERE status='pending'`
2. **Line 1014**: Fixed warning handler to reset status to `'pending'` (was leaving items stuck)
3. **Cleanup**: Deleted 6 duplicate messages from `linkedin_messages` table

---

## 16. Rate Limit Auto-Retry (Dec 18)

### Problem

When LinkedIn rate limits occurred, queue items were marked as `failed` and prospects marked as `rate_limited`, which:
1. Required manual intervention to retry
2. Violated database constraints (invalid status)

### Solution

**File: `app/api/cron/process-send-queue/route.ts`**

Rate limited items now:
1. Stay in `pending` status (not `failed`)
2. Prospect status stays as `approved` (not `rate_limited`)
3. `scheduled_for` is updated to 1 hour later for automatic retry

```typescript
// Rate limit detection (expanded)
const RATE_LIMIT_PATTERNS = [
  'rate limit', 'too many requests', '429',
  'temporarily restricted', 'slow down'
];

// On rate limit: reschedule for 1 hour later
if (isRateLimited) {
  const retryTime = new Date(Date.now() + 60 * 60 * 1000); // +1 hour
  await supabase
    .from('send_queue')
    .update({
      status: 'pending',  // Keep pending, not failed
      scheduled_for: retryTime.toISOString(),
      error_message: 'Rate limited - auto-retry in 1 hour'
    })
    .eq('id', item.id);
  // Prospect status unchanged (stays approved)
}
```

---

## 17. Spintax & A/B Testing Removal (BREAKING CHANGE - Dec 18)

### Problem

Spintax was causing bugs where personalization variables like `{company_name}` were being processed as single-option spintax and having their braces stripped. This caused messages to show literal `{company_name}` text instead of the actual company name.

### Solution

**Completely removed spintax and A/B testing features.**

**Files Modified:**
- `app/api/campaigns/direct/send-connection-requests-fast/route.ts` - Removed spintax imports/processing
- `app/api/campaigns/direct/process-follow-ups/route.ts` - Removed spintax imports/processing
- `app/components/CampaignStepsEditor.tsx` - Removed spintax UI toggle
- `lib/anti-detection/spintax.ts` - Deprecated with warning header

**Personalization now uses direct string replacement only:**
- `{first_name}` → prospect first name
- `{last_name}` → prospect last name
- `{company_name}` → normalized company name
- `{title}` → prospect title

---

## 18. OpenRouter Removal - Direct Claude SDK (Dec 18)

### Problem

The chatbot was making an unnecessary API hop through `/api/sam/openrouter` which added latency and complexity.

### Solution

**Updated `/api/sam/chat` to call Claude SDK directly.**

**Files Modified:**
- `app/api/sam/chat/route.ts` - Now uses Claude SDK directly
- `app/api/sam/openrouter/route.ts` - Returns 410 Gone (deprecated)
- `lib/llm/llm-router.ts` - Simplified to use Claude only
- `lib/services/inbox-agent.ts` - Uses `ANTHROPIC_API_KEY` only
- `lib/llm/openrouter-client.ts` - Deprecated

**Result:** Chatbot now uses Claude Haiku directly for fast responses with no intermediate API calls.

---

## 19. Follow-Up Limit Increase & Unified Personalization (Dec 18)

### Changes

1. **Max follow-ups increased from 4-5 to 15** for all campaign types
2. **Unified personalization** across all campaign endpoints using `lib/personalization.ts`
3. **All placeholder formats now work**: `{first_name}`, `{{first_name}}`, `{firstName}`

**Files Updated:**
- `app/api/campaigns/email/send-emails-queued/route.ts`
- `app/api/campaigns/email/execute/route.ts`
- `app/api/campaigns/email/reachinbox/route.ts`
- `app/api/campaigns/linkedin/execute/route.ts`

---

## 20. Campaign Account Type Fixes (Dec 18)

### Problem

Two workspace accounts (`tl@innovareai.com` and `jf@innovareai.com`) were mislabeled as `linkedin` type when they are actually Google OAuth (email) accounts. This caused campaigns to fail when trying to use them for LinkedIn operations.

### Solution

1. Fixed account types from `'linkedin'` to `'email'`
2. Fixed 2 campaigns that were using wrong accounts
3. Reset 11 failed queue items that were blocked by wrong account type

---

## 21. LinkedIn User ID Standardization (CRITICAL - Dec 18)

### Problem

The `linkedin_user_id` field in `campaign_prospects` and `send_queue` tables was being populated inconsistently across the codebase:
- Some entry points stored **full URLs** (e.g., `https://linkedin.com/in/john-doe`)
- Some stored **vanity slugs** (e.g., `john-doe`)
- Some stored **provider IDs** (e.g., `ACoAAA...` or `ACwAAA...`)

This caused **"User ID does not match provider's expected format"** errors from Unipile API when processing the queue, because Unipile expects slugs or provider IDs, NOT full URLs.

A database CHECK constraint was added to prevent URLs:
```sql
ALTER TABLE send_queue
ADD CONSTRAINT linkedin_user_id_no_urls
CHECK (linkedin_user_id NOT LIKE '%linkedin.com%');
```

But only 3 files had been updated to comply - the other entry points would fail silently on batch inserts, losing prospect data.

### Solution

#### 1. Created Centralized Utility Module

**New File: `lib/linkedin-utils.ts`**

```typescript
/**
 * Extract LinkedIn vanity slug from URL, or return provider_id/slug as-is
 * Handles: full URLs, vanity slugs, provider IDs (ACo/ACw)
 */
export function extractLinkedInSlug(urlOrSlug: string | null | undefined): string | null {
  if (!urlOrSlug) return null;
  const trimmed = urlOrSlug.trim();
  if (!trimmed) return null;

  // Already a provider ID - return as-is
  if (trimmed.startsWith('ACo') || trimmed.startsWith('ACw')) return trimmed;

  // Already a slug (no URL characters) - return as-is
  if (!trimmed.includes('/') && !trimmed.includes('http')) return trimmed;

  // Extract slug from full URL
  const match = trimmed.match(/linkedin\.com\/in\/([^\/\?#]+)/i);
  return match ? match[1] : trimmed;
}

/**
 * Get the best LinkedIn identifier from a prospect object
 * Priority: linkedin_provider_id > provider_id > extracted slug from URL
 */
export function getBestLinkedInIdentifier(prospect: any): string | null;

/**
 * Check if a string is a LinkedIn provider ID
 */
export function isLinkedInProviderId(value: string): boolean;

/**
 * Check if a string is a LinkedIn URL
 */
export function isLinkedInUrl(value: string): boolean;

/**
 * Normalize LinkedIn URL to hash (vanity name only)
 */
export function normalizeLinkedInUrl(url: string | null | undefined): string | null;
```

#### 2. Updated All Entry Points

| File | Changes |
|------|---------|
| `app/api/cron/queue-pending-prospects/route.ts` | Slug extraction + one-by-one inserts |
| `app/api/campaigns/upload-prospects/route.ts` | Slug extraction |
| `app/api/prospect-approval/upload-csv/route.ts` | Slug extraction |
| `app/api/prospects/add-to-campaign/route.ts` | Slug extraction + one-by-one inserts |
| `app/api/campaigns/direct/send-connection-requests-fast/route.ts` | Slug extraction + one-by-one inserts |
| `app/api/campaigns/direct/send-messages-queued/route.ts` | Slug extraction + one-by-one inserts |
| `app/api/campaigns/transfer-prospects/route.ts` | Slug extraction + one-by-one inserts |

#### 3. Converted Batch Inserts to One-by-One

**Problem**: Supabase batch inserts fail ALL records if ANY single record violates a constraint. This caused silent data loss.

**Before (dangerous):**
```typescript
const { error } = await supabase
  .from('send_queue')
  .insert(queueRecords); // If 1 fails, ALL 50 fail silently
```

**After (safe):**
```typescript
let insertedCount = 0;
const insertErrors: string[] = [];

for (const record of queueRecords) {
  const { error: insertError } = await supabase
    .from('send_queue')
    .insert(record);

  if (insertError) {
    insertErrors.push(`${record.linkedin_user_id}: ${insertError.message}`);
    if (insertErrors.length <= 3) {
      console.warn(`⚠️ Failed to insert: ${insertError.message}`);
    }
  } else {
    insertedCount++;
  }
}

console.log(`✅ Inserted ${insertedCount}/${queueRecords.length} records`);
if (insertErrors.length > 0) {
  console.error(`❌ ${insertErrors.length} inserts failed`);
}
```

### Key Files with Detailed Changes

**`app/api/cron/queue-pending-prospects/route.ts`** (CRITICAL - runs every 5 minutes):
- Lines 12-13: Added import for `extractLinkedInSlug`, `getBestLinkedInIdentifier`
- Line 148: Use `getBestLinkedInIdentifier(prospect) || extractLinkedInSlug(prospect.linkedin_url)` for `linkedin_user_id`
- Lines 165-185: Converted batch insert to one-by-one with error tracking

**`app/api/campaigns/transfer-prospects/route.ts`**:
- Line 4: Added import for `extractLinkedInSlug`
- Line 231: `linkedin_user_id: extractLinkedInSlug(contact.linkedin_provider_id || linkedinUrl)`
- Lines 247-269: One-by-one inserts with error tracking

**`app/api/prospects/add-to-campaign/route.ts`**:
- Line 3: Added import for `extractLinkedInSlug`
- Line 125: `linkedin_user_id: extractLinkedInSlug(p.linkedin_provider_id || p.linkedin_url)`
- Lines 147-175: One-by-one upserts with error tracking

### LinkedIn ID Format Reference

| Format | Example | When Used |
|--------|---------|-----------|
| Provider ID | `ACoAAA1234567890ABC` or `ACwAAB9876543210XYZ` | Returned by Unipile API, stored in `linkedin_provider_id` |
| Vanity Slug | `john-doe-123` | Profile URL path, what we extract and store |
| Full URL | `https://linkedin.com/in/john-doe-123` | Never store in `linkedin_user_id` |

### Why This Matters

1. **Unipile API Compatibility**: The API rejects full URLs, expects slugs or provider IDs
2. **Data Integrity**: One-by-one inserts prevent batch failures from losing all records
3. **Debugging**: Individual errors are logged with prospect identifiers
4. **Consistency**: All entry points now use the same utility functions

---

## 22. Commenting Agent Content Expiration (Dec 18)

### Problem

Discovered posts and pending comments were accumulating indefinitely in the database. Users had to manually manage old content, and stale posts were consuming AI generation capacity instead of fresh, relevant posts.

### Solution

Implemented automatic content expiration on the next business day:

1. **Posts discovered but not commented on** → expire at 6 AM UTC next business day
2. **Comments pending approval** → expire at 6 AM UTC next business day
3. **Weekend posts** → expire Monday 6 AM UTC
4. **After expiration** → `discover-posts` cron will scrape fresh posts

### Database Changes

**Migration: `sql/migrations/053-commenting-content-expiration.sql`**

```sql
-- New columns
ALTER TABLE linkedin_posts_discovered
ADD COLUMN expires_at TIMESTAMPTZ,
ADD COLUMN expired_at TIMESTAMPTZ;

ALTER TABLE linkedin_post_comments
ADD COLUMN expires_at TIMESTAMPTZ,
ADD COLUMN expired_at TIMESTAMPTZ;

-- Function to calculate next business day 6 AM UTC
CREATE FUNCTION get_next_business_day_6am_utc(from_timestamp TIMESTAMPTZ)
RETURNS TIMESTAMPTZ;

-- Auto-set triggers for new posts/comments
CREATE TRIGGER post_set_expiration BEFORE INSERT ON linkedin_posts_discovered;
CREATE TRIGGER comment_set_expiration BEFORE INSERT ON linkedin_post_comments;

-- Function called by cron to expire old content
CREATE FUNCTION expire_commenting_content()
RETURNS TABLE(posts_expired INTEGER, comments_expired INTEGER);

-- Monitoring view
CREATE VIEW v_commenting_expiration_status;
```

### New Files

| File | Purpose |
|------|---------|
| `netlify/functions/expire-comment-content.ts` | Netlify scheduled function wrapper |
| `app/api/cron/expire-comment-content/route.ts` | API route that performs expiration |

### Cron Schedule

**Added to `netlify.toml`:**
```toml
[functions."expire-comment-content"]
  schedule = "0 6 * * 1-5"  # Daily at 6 AM UTC, Mon-Fri
```

### Flow

1. **Post discovered** → trigger sets `expires_at` to next business day 6 AM UTC
2. **Comment generated** → trigger sets `expires_at` to next business day 6 AM UTC
3. **Cron runs at 6 AM UTC** → marks expired posts/comments as `status='expired'`
4. **Next discovery run** → only finds non-expired posts, scrapes fresh content

### Backfill

Existing discovered posts and pending comments were backfilled with `expires_at = NOW() + 1 hour` to clear the backlog immediately.

---

## 23. CRITICAL: Cross-Workspace Deduplication Fix (Dec 19)

### Problem

A **critical workspace isolation vulnerability** was discovered in the `queue-pending-prospects` cron job. The cross-campaign deduplication logic was checking **ALL workspaces** instead of filtering by the current workspace, causing:

1. **Misleading "already in another campaign" messages** - Prospects were incorrectly skipped because they existed in a completely different workspace
2. **Potential data leakage concern** - The system was reading data across tenant boundaries (though no actual data was shared between workspaces)

### User Impact

When Sebastian Henkel's campaign tried to queue prospects:
1. System checked if prospects existed in **ANY** workspace's campaigns
2. Found matches in **Rony Chatterjee's workspace** (different tenant!)
3. Logged: `"🚫 Skipping [Name] - already contacted"`
4. UI showed: **"Duplicate or already in another campaign"**

The message was technically true from the broken system's perspective, but it was looking at the **wrong workspace's data**.

### Root Cause

**File: `app/api/cron/queue-pending-prospects/route.ts`**

**Old Code (VULNERABLE):**
```typescript
// Check if linkedin_user_id was ALREADY SENT in ANY campaign's send_queue
const { data: previouslySent } = await supabase
  .from('send_queue')
  .select('linkedin_user_id')
  .in('status', ['sent', 'pending', 'failed', 'skipped'])
  .in('linkedin_user_id', batch);
  // ❌ NO workspace filter! Checked ALL workspaces

// Check if linkedin_url exists in ANY campaign_prospects
const { data: previouslyContacted } = await supabase
  .from('campaign_prospects')
  .select('linkedin_url')
  .in('status', contactedStatuses)
  .in('linkedin_url', batch);
  // ❌ NO workspace_id filter! Checked ALL workspaces
```

### Fix Applied

**Commit: `cc22a341` - "CRITICAL FIX: Add workspace isolation to cross-campaign deduplication"**

**New Code (FIXED):**
```typescript
// CRITICAL FIX (Dec 19): Filter by workspace to prevent cross-workspace deduplication
// Get campaigns in this workspace first
const { data: workspaceCampaigns } = await supabase
  .from('campaigns')
  .select('id')
  .eq('workspace_id', campaign.workspace_id);
const workspaceCampaignIds = (workspaceCampaigns || []).map(c => c.id);

// 3a. Check send_queue ONLY within same workspace
const { data: previouslySent } = await supabase
  .from('send_queue')
  .select('linkedin_user_id')
  .in('campaign_id', workspaceCampaignIds) // ✅ WORKSPACE FILTER
  .in('status', ['sent', 'pending', 'failed', 'skipped'])
  .in('linkedin_user_id', batch);

// 3b. Check campaign_prospects ONLY within same workspace
const { data: previouslyContacted } = await supabase
  .from('campaign_prospects')
  .select('linkedin_url')
  .eq('workspace_id', campaign.workspace_id) // ✅ WORKSPACE FILTER
  .in('status', contactedStatuses)
  .in('linkedin_url', batch);
```

### Files Modified

| File | Lines | Change |
|------|-------|--------|
| `app/api/cron/queue-pending-prospects/route.ts` | 140-163 | Added workspace campaign ID filter for send_queue check |
| `app/api/cron/queue-pending-prospects/route.ts` | 165-189 | Added `.eq('workspace_id', campaign.workspace_id)` for campaign_prospects check |

### Verification Results

A comprehensive audit was performed and confirmed:

| Check | Sebastian Henkel | Rony Chatterjee | Overlap |
|-------|------------------|-----------------|---------|
| LinkedIn URLs | 791 prospects | 210 prospects | **0** |
| LinkedIn User IDs | Checked | Checked | **0** |
| Send Queue | 0 entries | 0 entries | **0** |
| Email Queue | 0 entries | 0 entries | **0** |

**Verdict: NO actual data breach occurred** - The bug caused prospects to be incorrectly skipped with a confusing message, but no prospect data was actually shared between workspaces.

### Timeline

- **Dec 5, 2025:** Cross-campaign deduplication added (WITHOUT workspace isolation)
- **Dec 5-19:** Bug period - prospects incorrectly skipped across workspaces
- **Dec 19, 2025:** Critical fix deployed - workspace isolation enforced
- **Current:** Deduplication now properly workspace-isolated

### Why This Matters

This fix ensures proper multi-tenant data isolation:
- Workspace A's campaigns only check against Workspace A's historical data
- Workspace B's prospects are completely invisible to Workspace A's deduplication
- Legal compliance maintained - no cross-tenant data access

---

## 24. Silent Retry for Rate Limits and Network Failures (Dec 19)

### Problem

The QA monitor was being flooded with false alerts from two types of expected, temporary failures:

1. **Rate Limits (429)** - LinkedIn/Unipile API throttling (expected behavior, not an error)
2. **Network Failures** - "fetch failed" errors from transient network issues or API outages

**User Requirement:** Rate limits are NOT errors - they're expected behavior. The system should silently retry without alerting.

### Root Cause

The queue processor was marking these temporary failures as `status='failed'` with an `error_message`, which triggered QA monitor alerts. Both monitors (`qa-monitor` and `realtime-error-monitor`) reported every item with an error_message as a problem.

**Unipile API Outage (Dec 19):**
- API endpoint `api6.unipile.com:13670` was down
- Caused "fetch failed" errors across all LinkedIn campaigns
- These network errors were incorrectly reported as campaign failures

### Solution: Silent Retry Convention

Introduced a new convention to distinguish temporary failures from permanent errors:

| Status | Error Message | Meaning | Action |
|--------|---------------|---------|--------|
| `pending` | `NULL` | Waiting for retry (NOT an error) | Silent retry - no alert |
| `failed` | `"text"` | Actual permanent failure | Report to QA monitor |

### Changes Made

**1. `app/api/cron/process-send-queue/route.ts` - Network Failures**

```typescript
// Network failures (fetch failed, timeouts, DNS errors)
if (isNetworkError) {
  const retryTime = new Date(Date.now() + 30 * 60 * 1000); // +30 minutes
  await supabase
    .from('send_queue')
    .update({
      status: 'pending',
      scheduled_for: retryTime.toISOString(),
      error_message: null  // ✅ NULL = silent retry
    })
    .eq('id', item.id);

  console.log(`🔄 Network error for ${item.linkedin_user_id} - retry in 30 min (silent)`);
  continue; // Skip to next item, no notification
}
```

**2. `app/api/cron/process-send-queue/route.ts` - Rate Limits**

```typescript
// Rate limit detection (429, "too many requests", etc.)
if (isRateLimited) {
  const retryTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // +24 hours

  // Reschedule ALL pending items for this account
  await supabase
    .from('send_queue')
    .update({
      status: 'pending',
      scheduled_for: retryTime.toISOString(),
      error_message: null  // ✅ NULL = silent retry
    })
    .eq('linkedin_account_id', item.linkedin_account_id)
    .in('status', ['pending', 'processing']);

  console.log(`⏸️ Rate limit on account ${accountName} - ALL pending rescheduled for 24h (silent)`);
  break; // Stop processing this account entirely
}
```

**3. `app/api/agents/qa-monitor/route.ts` - Skip Silent Retries**

```typescript
// Check for recent errors (skip items with NULL error_message)
const { data: recentErrors } = await supabase
  .from('send_queue')
  .select('*')
  .eq('campaign_id', campaign.id)
  .in('status', ['failed', 'pending'])
  .not('error_message', 'is', null)  // ✅ Skip silent retries
  .gte('updated_at', oneDayAgo.toISOString());
```

**4. `app/api/agents/realtime-error-monitor/route.ts` - Skip Silent Retries**

```typescript
// Check for errors in last 15 minutes (skip NULL error_message)
const { data: recentErrors } = await supabase
  .from('send_queue')
  .select('*')
  .in('status', ['failed', 'pending'])
  .not('error_message', 'is', null)  // ✅ Skip silent retries
  .gte('updated_at', fifteenMinsAgo.toISOString());
```

### Retry Schedules

| Failure Type | Retry Delay | Scope |
|--------------|-------------|-------|
| Network error (fetch failed, timeout) | 30 minutes | Single item only |
| Rate limit (429, too many requests) | 24 hours | ALL pending items for that account |

### Why Different Scopes?

- **Network errors:** Isolated to one prospect - only retry that specific item
- **Rate limits:** Account-wide restriction - reschedule ALL pending items for that LinkedIn account to prevent cascading rate limits

### Detection Patterns

**Rate Limit Patterns:**
```typescript
const RATE_LIMIT_PATTERNS = [
  'rate limit', 'too many requests', '429',
  'temporarily restricted', 'slow down',
  'limit reached', 'quota exceeded'
];
```

**Network Error Patterns:**
```typescript
const NETWORK_ERROR_PATTERNS = [
  'fetch failed', 'network error', 'timeout',
  'ECONNREFUSED', 'ETIMEDOUT', 'DNS',
  'unable to connect'
];
```

### Files Modified

| File | Lines | Change |
|------|-------|--------|
| `app/api/cron/process-send-queue/route.ts` | Network error handling | Set `error_message=NULL` for 30min retry |
| `app/api/cron/process-send-queue/route.ts` | Rate limit handling | Set `error_message=NULL`, reschedule ALL pending for account |
| `app/api/agents/qa-monitor/route.ts` | Error query | Added `.not('error_message', 'is', null)` |
| `app/api/agents/realtime-error-monitor/route.ts` | Error query | Added `.not('error_message', 'is', null)` |

### Commit Reference

**Commit:** `DEC19_SILENT_RETRY_FIX`

### Result

- QA monitor no longer reports rate limits as errors
- Network outages don't trigger false alerts
- Temporary failures silently retry on their schedule
- Only actual permanent failures (invalid prospect data, LinkedIn restrictions, etc.) are reported

---

## 25. Vanity Slug Resolution at Queue Creation (Dec 19)

### Problem

Queue items were being created with LinkedIn vanity slugs (e.g., `john-doe`) instead of provider IDs (e.g., `ACoAAABEykQB...`), causing Unipile API to reject requests with **"User ID does not match provider's expected format"** errors.

**Evidence:**
- 21+ format errors appearing hourly in send_queue
- Error pattern: `"Error: User ID does not match format expected by provider. Please verify the user ID for provider linkedin"`

### Root Cause

Queue insertion code at 3 critical entry points was copying `linkedin_user_id` directly from `campaign_prospects` without resolving vanity slugs to provider IDs first. If the prospect data contained a vanity slug, it would be inserted into send_queue as-is, failing when the queue processor attempted to send.

### Solution

Created centralized resolution utility and added provider ID resolution BEFORE insertion at all queue creation points.

**New File: `lib/resolve-linkedin-id.ts`**

```typescript
/**
 * Resolve LinkedIn vanity slug or provider_id to a valid provider_id
 * Returns as-is if already a provider_id (starts with ACo/ACw)
 * Calls Unipile API to resolve vanity slug → provider_id
 */
export async function resolveToProviderId(
  linkedinId: string,
  accountId: string
): Promise<string>
```

**Resolution Logic:**
1. Check if already in provider_id format (`ACo` or `ACw` prefix)
2. If yes, return as-is
3. If no (vanity slug), call Unipile API to resolve to provider_id
4. Update both `send_queue` and `campaign_prospects` with resolved provider_id
5. Fail-safe: Queue processor also resolves if creation-time resolution fails

### Files Modified

| File | Lines | Change |
|------|-------|--------|
| `app/api/prospect-approval/bulk-approve/route.ts` | Queue insert | Added `resolveToProviderId()` before insertion |
| `app/api/campaigns/direct/send-connection-requests-fast/route.ts` | Queue insert | Added resolution + update campaign_prospects |
| `app/api/campaigns/direct/send-messages-queued/route.ts` | Queue insert | Added resolution + update campaign_prospects |
| `lib/resolve-linkedin-id.ts` | NEW | Provider ID resolution utility |

**Example Fix (bulk-approve/route.ts):**

```typescript
// BEFORE (broken):
linkedin_user_id: prospect.linkedin_user_id  // Could be vanity slug

// AFTER (fixed):
const resolvedId = await resolveToProviderId(
  prospect.linkedin_user_id || extractLinkedInSlug(prospect.linkedin_url),
  linkedinAccountId
);
linkedin_user_id: resolvedId  // Always provider_id
```

### Manual Cleanup

Created and ran `temp/fix-failed-format-errors.mjs` to resolve 14 existing failed entries:
- Read failed items with "does not match format" errors
- Resolved vanity slugs to provider IDs via Unipile API
- Updated send_queue with resolved provider IDs
- Reset status from `failed` to `pending` for retry

### Verification

After deployment:
- ✅ No new format errors appearing
- ✅ Queue items created with provider IDs only
- ✅ Vanity slugs automatically resolved during creation
- ✅ Fail-safe resolution in queue processor (fallback)

### Commit Reference

**Commit:** `893d1b50` - "fix: resolve vanity slugs to provider IDs at queue creation"

---

## Next Steps

### Immediate
- [x] Test CSV upload → campaign transfer flow end-to-end
- [x] Standardize linkedin_user_id handling across all entry points
- [x] Add content expiration for commenting agent
- [x] Fix cross-workspace deduplication vulnerability (CRITICAL)
- [ ] Monitor QA monitor for false positives

### Short-term
- [ ] Complete Slack notification connection to QA monitor
- [ ] Add InMail campaign support to queue processor
- [ ] Implement Meeting Agent cron jobs

### Long-term
- [ ] Social Listening Agent
- [ ] Competitor Intel Agent
- [ ] Additional CRM adapters (Salesforce, Pipedrive, etc.)

---

*Last Updated: December 19, 2025 20:00 UTC*
