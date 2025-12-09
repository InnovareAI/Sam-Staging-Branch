# Handover Document - December 9, 2025

## Session Summary

Fixed critical UI crashes and data leakage bugs in the campaign creation and management flow.

## Issues Fixed

### 1. Data Leakage Bug (CRITICAL)
**Problem:** Campaigns were ending up with more prospects than selected (e.g., 6 instead of 2).

**Root Cause:** When creating campaigns from prospect approval, the `session_id` was being passed to the campaign creation endpoint, which caused the API to load ALL prospects from that session instead of just the selected ones.

**Fixes Applied:**
- Removed `session_id` from campaign creation payload (`DataCollectionHub.tsx`)
- Reset `pendingDraftId` after successful draft creation
- Skip loading `draft.prospects` when `initialProspects` already exists

**Status:** ✅ FIXED - Verified campaigns now show correct prospect count (2 of 2)

### 2. "Select All" Crash
**Problem:** App crashed with "Application error: a client-side exception" when clicking "Select All" to select all prospects.

**Root Causes & Fixes:**

1. **`const` reassignment error** (line 3273)
   - `const prospectsToSend` was being reassigned at lines 3288, 3290, 3296
   - Fix: Changed `const` to `let`

2. **Circular reference in JSON.stringify** (lines 3318-3344)
   - Prospect objects had circular references causing serialization crash
   - Fix: Added safe prospect serialization with only necessary fields

3. **`handleBulkDelete is not defined` ReferenceError** (line 8734)
   - Function was defined inside an IIFE but referenced outside
   - Fix: Changed `onClick={handleBulkDelete}` to `onClick={handleBulkDeleteWithConfirm}`

**Status:** ✅ FIXED - Select All no longer crashes

### 3. Delete Function Not Working
**Problem:** Clicking Delete button on selected campaigns did nothing.

**Root Cause:** Duplicate state declarations in `CampaignHub.tsx`:
- `confirmModal` state declared at line 104 AND line 6274
- `showConfirmModal` helper at line 119 sets the FIRST `confirmModal`
- Modal component at line 10630 uses the SECOND `confirmModal`
- Result: `showConfirmModal` was updating wrong state, modal never opened

**Fix:** Added a second `showConfirmModal` helper at line 6288 that uses the correct `setConfirmModal` (from line 6274).

**Status:** ✅ FIXED - Delete function now works

## Files Modified

### `/components/DataCollectionHub.tsx`
- Line 3273: `const` → `let` for `prospectsToSend`
- Lines 3318-3344: Added safe prospect serialization
- Removed `session_id` from campaign creation payload
- Reset `pendingDraftId` after draft creation

### `/app/components/CampaignHub.tsx`
- Line 6288-6297: Added `showConfirmModal` helper in correct scope
- Line 8734: `handleBulkDelete` → `handleBulkDeleteWithConfirm`

## Commits

1. `27aa83c9` - Fix: handleBulkDelete -> handleBulkDeleteWithConfirm (reference error crash)
2. `edd9debf` - Fix: Add showConfirmModal helper to correct scope (delete function)

## Restore Point

**Tag:** `restore-dec9-select-all-delete-fix`

To restore:
```bash
git checkout restore-dec9-select-all-delete-fix
```

## Technical Notes

### Duplicate State Pattern (Anti-Pattern)
The `CampaignHub.tsx` file has duplicate state declarations which caused the delete bug:
- Line 91 & 6270: `selectedCampaigns`
- Line 104 & 6274: `confirmModal`

This pattern should be refactored in the future to avoid similar bugs.

### Safe Serialization Pattern
When sending prospect data to APIs, use safe serialization to avoid circular references:

```typescript
const safeProspects = prospects.map((p: any) => ({
  id: p.id,
  name: p.name || p.contact?.name || 'Unknown',
  email: p.email || p.contact?.email,
  linkedin_url: p.linkedin_url || p.contact?.linkedin_url,
  connection_degree: p.connection_degree || p.connectionDegree,
  company: p.company || p.contact?.company,
  title: p.title || p.contact?.title,
  sessionId: p.sessionId,
  campaignName: p.campaignName
}));
```

## Deployment Status

- GitHub: ✅ Pushed
- Netlify: Auto-deploying from GitHub

## Testing Checklist

- [x] Select individual prospects → Create campaign → Correct count
- [x] Select All prospects → No crash
- [x] Select campaigns → Delete button → Confirmation modal appears
- [x] Confirm delete → Campaigns deleted

---

## Session 2: LinkedIn Commenting Agent Fixes

### CRITICAL: Duplicate Comments Bug Fixed

**Problem:** System posted 3-4 duplicate comments on the same LinkedIn post within minutes last weekend.

**Root Causes:**
1. No database constraint preventing duplicate comments per post
2. No claim mechanism in `process-comment-queue` - concurrent cron runs could process same comments
3. Race conditions between `auto-generate-comments` runs

**Fixes Applied:**

#### 1. Database Unique Constraint (CRITICAL)
```sql
ALTER TABLE linkedin_post_comments
ADD CONSTRAINT unique_comment_per_post UNIQUE (post_id);
```
- Makes duplicate comments **physically impossible**
- Also added `posting` and `skipped` to valid status values

#### 2. Claim Mechanism in process-comment-queue
- Before processing, comments are claimed with `status='posting'`
- Prevents concurrent cron runs from processing same comments
- File: `/app/api/cron/process-comment-queue/route.ts`

#### 3. Real-time Duplicate Check Before Insert
- Final database check right before inserting comment
- Catches race conditions between concurrent cron runs
- Checks both `post_id` AND `social_id`
- File: `/app/api/cron/auto-generate-comments/route.ts`

#### 4. Final Check Before Posting to LinkedIn
- Verifies post doesn't already have a `posted` comment
- Prevents duplicate API calls to LinkedIn
- File: `/app/api/cron/process-comment-queue/route.ts`

### Other Commenting Agent Improvements

| Change | Description |
|--------|-------------|
| Daily cap | 45 posts/day max discovered |
| Author cooldown | 5 days between comments on same author (was 10) |
| Course completion filter | Skip "My certificate for..." posts |
| Profile discovery | Only fetch most recent post per profile |

### Protection Layers Now in Place

| Layer | Where | Protection |
|-------|-------|------------|
| 1 | auto-generate | Pre-loop socialIdsWithComments set |
| 2 | auto-generate | Real-time DB check before insert |
| 3 | auto-generate | DB unique constraint on insert |
| 4 | process-queue | Claim mechanism (status='posting') |
| 5 | process-queue | Final check before posting to LinkedIn |
| 6 | Database | UNIQUE constraint on post_id |

### Files Modified

- `/app/api/cron/auto-generate-comments/route.ts` - duplicate checks, 5-day rule, filters
- `/app/api/cron/process-comment-queue/route.ts` - claim mechanism, final check
- `/app/api/linkedin-commenting/discover-posts-hashtag/route.ts` - daily cap logic
- `/app/api/linkedin-commenting/discover-profile-posts/route.ts` - single post per profile
- `/sql/migrations/028-prevent-duplicate-comments.sql` - DB constraint

### Database Changes Applied

```sql
-- Status values updated
ALTER TABLE linkedin_post_comments
ADD CONSTRAINT linkedin_post_comments_status_check
CHECK (status IN ('pending_approval', 'scheduled', 'posting', 'posted', 'rejected', 'failed', 'skipped'));

-- Unique constraint added
ALTER TABLE linkedin_post_comments
ADD CONSTRAINT unique_comment_per_post UNIQUE (post_id);
```

### Current Limits

| Setting | Value | Location |
|---------|-------|----------|
| Daily post cap | 45 | Code constant |
| Max posts per keyword | 15 | Code constant |
| Max keywords per run | 3 | Code constant |
| Author cooldown | 5 days | Code constant |
| Profile posts | 1 (most recent only) | Code |

### Todo (Parked for Later)

- **Threaded replies**: Pass `comment_id` to Unipile API when `is_reply_to_comment=true`
  - Unipile supports this via `comment_id` parameter in POST body
  - Currently replies are posted as top-level comments

### Commits

1. `895a9f8b` - Add daily cap enforcement during discovery runs
2. `f31c8a2f` - Add real-time duplicate check + change author cooldown to 5 days
3. `c0a47586` - CRITICAL: Prevent duplicate LinkedIn comments via claim mechanism + DB constraint
4. `d15e0c8a` - Profile discovery: Only fetch most recent post per profile

---

---

## Session 3: Self-Post Lead Capture Pipeline

### Feature Overview

Extended the Self-Post Engagement feature with a full Lead Capture Pipeline that turns comment engagement into qualified leads:

**Flow:** Your Post → Comments → AI Reply → Score Commenter → Auto-CR → DM Sequence → CRM Sync

### New Database Tables & Columns

#### Migration 029: Self-Post Engagement (Base Tables)
File: `sql/migrations/029-self-post-engagement.sql`

**Table: `linkedin_self_post_monitors`**
- Tracks YOUR OWN posts to monitor for comments
- Custom reply prompts per post (e.g., "Reply with event signup link...")
- Rate limiting: `max_replies_per_day`, `check_frequency_minutes`
- Filters: `reply_to_questions_only`, `skip_single_word_comments`, `min_comment_length`

**Table: `linkedin_self_post_comment_replies`**
- Tracks comments found and replies generated/sent
- HITL workflow: `pending_generation` → `pending_approval` → `approved` → `scheduled` → `posting` → `posted`
- Commenter metadata: name, headline, LinkedIn URL, provider_id

#### Migration 030: Lead Capture Extension
File: `sql/migrations/030-self-post-lead-capture.sql`

**Extended `linkedin_self_post_monitors` with:**
- `auto_connect_enabled` - Enable auto-CR for high scorers
- `auto_connect_min_score` - Minimum score threshold (default: 70)
- `auto_connect_message` - Custom CR message template
- `dm_sequence_campaign_id` - Link to DM sequence campaign
- `crm_sync_enabled` - Enable CRM sync
- `crm_provider` - 'hubspot', 'activecampaign', 'airtable'
- `crm_list_id`, `crm_tags` - CRM configuration

**Extended `linkedin_self_post_comment_replies` with:**
- `commenter_score` - Lead score (0-100+)
- `commenter_title`, `commenter_company`, `commenter_location`
- `commenter_connections`, `commenter_is_1st_degree`
- `score_breakdown` - JSONB with scoring details
- `connection_request_sent`, `connection_accepted`, `dm_sequence_enrolled`, `crm_synced`
- Timestamps for each pipeline stage

**New Table: `linkedin_lead_scoring_rules`**
- Per-workspace customizable scoring rules
- Title keywords: `{"ceo": 30, "director": 15, "manager": 10, ...}`
- Company size scoring
- Target industries bonus
- Connection degree bonuses
- Comment quality bonuses

**New Table: `linkedin_lead_capture_queue`**
- Queue for pending actions: `connection_request`, `dm_sequence`, `crm_sync`
- Status: `pending` → `processing` → `completed`/`failed`/`skipped`
- Scheduled timing with rate limiting

### New Files Created

#### 1. Lead Scoring Service
**File:** `lib/services/linkedin-lead-scoring.ts`

Core functions:
```typescript
// Fetch commenter profile from Unipile
fetchCommenterProfile(providerIdOrVanity, accountId): Promise<CommenterProfile>

// Score a commenter based on profile + comment quality
scoreCommenter(profile, commentText, rules): ScoreBreakdown

// Generate personalized CR message
generateCRMessage(profile, postTitle, customTemplate?): string
```

Scoring breakdown:
- **Title keywords:** CEO/Founder: +30, VP: +20, Director: +15, Manager: +10
- **Connection degree:** 1st: +20, 2nd: +10, 3rd: +0
- **Comment quality:** Length bonus (+5/50 chars), Question bonus (+10)
- **Industry match:** Target industry bonus (+15)

#### 2. Lead Capture Queue Processor
**File:** `app/api/cron/process-lead-capture-queue/route.ts`

Processes queued actions with rate limiting:
- **Connection Requests:** 3 per run, 24h delay for non-1st degree
- **DM Sequences:** 5 per run, waits for connection acceptance (7-day timeout)
- **CRM Sync:** 10 per run, handles HubSpot/ActiveCampaign/Airtable

#### 3. Netlify Scheduled Function (INACTIVE)
**File:** `netlify/functions/process-lead-capture-queue.ts`

**NOTE:** Schedule NOT yet added to `netlify.toml` - activate when ready:
```toml
[functions."process-lead-capture-queue"]
schedule = "*/15 * * * *"  # Every 15 minutes
```

#### 4. My Posts UI Page
**File:** `app/workspace/[workspaceId]/commenting-agent/my-posts/page.tsx`

Features:
- Add monitors for your own LinkedIn posts
- Configure reply prompts and lead capture settings
- View stats: comments detected, replies sent, leads captured
- Enable/disable auto-connect, DM sequences, CRM sync

### Modified Files

#### 1. Process Self-Post Replies (Cron)
**File:** `app/api/cron/process-self-post-replies/route.ts`

Added Phase 2B after posting reply:
1. Fetch commenter profile via Unipile
2. Score commenter using workspace rules
3. Update reply record with score and profile data
4. Queue lead capture actions if score meets thresholds

#### 2. Commenting Agent Dashboard
**File:** `app/workspace/[workspaceId]/commenting-agent/page.tsx`

Added "My Posts" button to Quick Actions section with gradient styling.

### UI Navigation

**To access My Posts:**
1. Go to: `/workspace/{workspaceId}/commenting-agent`
2. In Quick Actions section, click "My Posts" button
3. Or direct URL: `/workspace/{workspaceId}/commenting-agent/my-posts`

**Note:** The "My Posts" button is on the main Commenting Agent dashboard page, NOT on the `/profiles` page.

### Pipeline Flow

```
1. User adds post URL to monitor
   └── Creates record in linkedin_self_post_monitors

2. Cron discovers new comments on post
   └── Creates records in linkedin_self_post_comment_replies (status: pending_generation)

3. AI generates reply based on reply_prompt
   └── Updates status to pending_approval

4. User approves reply (HITL)
   └── Updates status to approved → scheduled → posting → posted

5. After reply posted, score commenter
   └── Fetches profile from Unipile
   └── Calculates score using workspace rules
   └── Updates reply record with score + profile

6. If score >= threshold, queue lead capture actions
   └── connection_request → dm_sequence → crm_sync

7. Lead capture queue processes actions
   └── Sends CR via Unipile
   └── Enrolls in DM sequence once connected
   └── Syncs to CRM with attribution
```

### Deployment Status

- **Database:** ✅ Migrations 029 + 030 applied
- **Code:** ✅ Deployed to Netlify
- **Lead Capture Cron:** ⏸️ NOT ACTIVATED (add schedule when ready)

### Next Steps

1. **Test the My Posts UI** - Create a monitor for a real post
2. **Monitor reply generation** - Verify AI generates appropriate replies
3. **Test lead scoring** - Check scores match expectations
4. **Activate lead capture cron** - When ready for auto-CR/DM/CRM

### Commits

1. `5b8ecf32` - Add Self-Post Lead Capture Pipeline + My Posts UI

---

## Session 4: LinkedIn Commenting & Campaign Scheduling

### Commenting Agent Enhancements

#### 1. English-Only Filter
**File:** `app/api/linkedin-commenting/discover-posts-hashtag/route.ts`

Added `isEnglishText()` function that:
- Uses common English word frequency detection (100+ common words)
- Cleans text (removes URLs, mentions, hashtags)
- Requires 15% of words to be common English words
- Integrated into `shouldExcludePost()` check

```typescript
function isEnglishText(text: string): boolean {
  const commonEnglishWords = ['the', 'be', 'to', 'of', 'and', ...];
  // Returns true if >= 15% of words are common English
}
```

#### 2. Per-Workspace Daily Caps
- Changed from global daily cap to per-workspace cap
- Each workspace limited to 25 posts/day
- Tracks `workspacePostCounts` and `workspacesSavedCounts` per run

```typescript
const DAILY_POST_CAP_PER_WORKSPACE = 25;
```

#### 3. Digest Email CC Support
**File:** `app/api/cron/commenting-digest/route.ts`

- Added `DIGEST_CC_EMAIL = 'tl@innovareai.com'` constant
- Modified `sendPostmarkEmail()` to accept optional CC parameter
- All digest emails now CC'd to admin for oversight

### Workspaces Activated

| Workspace | Owner | Keyword | Status |
|-----------|-------|---------|--------|
| ChillMine (aa1a214c) | Brian | datacenter | ✅ Active |
| ChillMine - Pete Noble (d4e5f6a7) | Pete | bitcoin | ✅ Active |
| InnovareAI (babdcab8) | Thorsten | GenAI, Agentic AI | ✅ Active |

### Comments Scheduled (IA1 Workspace)

| Post Author | Scheduled Time (UTC) | Status |
|-------------|---------------------|--------|
| Comment 1 | 12:15 | ✅ Scheduled |
| Comment 2 | 13:00 | ✅ Scheduled |
| Comment 3 | 13:45 | ✅ Scheduled |

**Note:** Comments spaced 45 minutes apart as requested.

---

## Session 4B: LinkedIn Campaign Rescheduling

### CRITICAL RULE: All Campaigns Start at 8:00 AM Eastern

**User Directive:** "ALL campaigns need to start at 8:00 AM Eastern - there is NO exception"

- 8:00 AM Eastern = 13:00 UTC (during EST)
- Applies to ALL connector campaigns (CRs and follow-ups)
- Messages spaced 24 minutes apart

### Irish Campaign 4 Rescheduling

**Problem:** 25 pending CRs were scheduled for Dec 10 (tomorrow) starting at 08:00 UTC

**Fix:** Rescheduled all 25 items to TODAY (Dec 9) starting at 13:00 UTC (8:00 AM Eastern)

| Time (UTC) | Time (Eastern) | Action |
|------------|----------------|--------|
| 13:00 | 8:00 AM | CR #1 |
| 13:24 | 8:24 AM | CR #2 |
| 13:48 | 8:48 AM | CR #3 |
| ... | ... | ... |
| 22:36 | 5:36 PM | CR #25 |

**Total:** 25 CRs, 24 minutes apart, running from 8:00 AM to 5:36 PM Eastern

### Campaign Status Summary (Dec 9)

| Campaign | Owner | Sent Today | Pending | Notes |
|----------|-------|------------|---------|-------|
| Irish Campaign 4 | Irish | 19 | 25 | ✅ Rescheduled to TODAY |
| 12/2 Cha Campaign 5 | Chrissa | 1 (Dec 4) | 0 | Complete |
| 12/2 Irish Campaign 3 | Irish | 24 (Dec 4) | 0 | Complete |
| 12/1 Mich Campaign 2 | Michelle | 33 (Dec 1-2) | 0 | Complete |
| Mich Campaign 4 | Michelle | 10 (Dec 4) | 0 | Complete |
| Mich Campaign 3, 5 | Michelle | 0 | 0 | Empty queues |
| Cha Messenger | Chrissa | 0 | 0 | Empty queue |

### Cron Processing

The `process-send-queue` cron runs every minute via Netlify scheduled functions:
- Picks up items where `scheduled_for <= NOW()` and `status = 'pending'`
- Processes 1 item per run
- First CR for Irish Campaign 4 will send at 13:00 UTC (8:00 AM Eastern)

---

## Next Session Priorities

1. Monitor Irish Campaign 4 CRs sending (starting 13:00 UTC)
2. Monitor commenting system for any duplicate issues
3. Test profile-based discovery with single post
4. **Test My Posts feature end-to-end**
5. Consider making limits configurable via database
6. Implement threaded replies when ready
7. Activate lead capture queue cron when ready

---

**Last Updated:** December 9, 2025 (Session 4B)
**Author:** Claude (AI Assistant)
