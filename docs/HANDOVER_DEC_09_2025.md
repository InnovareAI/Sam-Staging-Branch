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

## Next Session Priorities

1. Monitor commenting system for any duplicate issues
2. Test profile-based discovery with single post
3. Consider making limits configurable via database
4. Implement threaded replies when ready

---

**Last Updated:** December 9, 2025 (Session 2)
**Author:** Claude (AI Assistant)
