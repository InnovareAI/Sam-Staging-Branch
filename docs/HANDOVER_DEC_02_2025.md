# Handover Document - December 2, 2025

## Session Summary

Investigated user complaint about LinkedIn follow-ups and replies not working. Found and fixed critical data inconsistency bug.

## Issues Found & Fixed

### 1. Status Mismatch Bug (CRITICAL)

**Problem**: 9 prospects had `connection_accepted_at` set but `status` was still `connection_request_sent` instead of `connected`.

**Impact**: Follow-ups never sent because the cron job filters by `status = 'connected'`.

**Root Cause**: Likely race condition between multiple redundant cron jobs that were all trying to update connection status.

**Fix Applied**:
```sql
UPDATE campaign_prospects
SET status = 'connected', updated_at = NOW()
WHERE connection_accepted_at IS NOT NULL
  AND status = 'connection_request_sent';
-- Updated 9 rows
```

### 2. Reply Status Mismatch

**Problem**: Victor Austin Nweke had `responded_at` set but status was `connected` instead of `replied`.

**Fix Applied**:
```sql
UPDATE campaign_prospects
SET status = 'replied', follow_up_due_at = NULL, updated_at = NOW()
WHERE responded_at IS NOT NULL
  AND status != 'replied';
-- Updated 1 row
```

### 3. Duplicate Cron Jobs (Removed)

**Problem**: Three cron jobs doing the same connection-acceptance check, causing race conditions:
- `/api/cron/poll-accepted-connections` (kept - primary)
- `/api/cron/check-accepted-connections` (deleted - used wrong status filter)
- `/api/cron/check-relations` (deleted - duplicate)

**Fix**: Deleted redundant cron job files.

### 4. QA Monitor Enhancement

Added new check to detect and auto-fix status mismatches:

**File**: `/app/api/agents/qa-monitor/route.ts`

**New Functions**:
- `checkStatusMismatch()` - Detects prospects with timestamp/status inconsistencies
- `autoFixStatusMismatch()` - Auto-fixes detected mismatches

**Checks For**:
1. `connection_accepted_at` set but `status != 'connected'`
2. `responded_at` set but `status != 'replied'`

**Schedule**: Runs daily at 6 AM UTC, auto-fixes issues and posts to Google Chat.

## Current System Status

| Component | Status |
|-----------|--------|
| Reply detection | Working (Chetas Patel reply detected Dec 1) |
| Reply polling cron | Running every 15 mins |
| Connection polling | Running every 15 mins |
| Follow-up sending | 8 prospects queued, starts at 5 AM PT |
| QA Monitor | Enhanced with status mismatch detection |

## Files Modified

1. **Deleted**:
   - `app/api/cron/check-accepted-connections/route.ts`
   - `app/api/cron/check-relations/route.ts`

2. **Modified**:
   - `app/api/agents/qa-monitor/route.ts` - Added status mismatch check
   - `app/integrations/crm/page.tsx` - Fixed import path (build error)

## Commits

- `a366b2b7` - Remove duplicate connection-acceptance cron jobs
- `6c5a3463` - Add status mismatch detection and auto-fix to QA monitor

## Business Hours Configuration

Follow-ups send during:
- **Hours**: 5 AM - 6 PM Pacific Time
- **Days**: Monday - Friday (no weekends)
- **Holidays**: Skipped (comprehensive list in `/lib/scheduling-config.ts`)

## Key Files Reference

| Purpose | File |
|---------|------|
| Follow-up sending | `/app/api/cron/send-follow-ups/route.ts` |
| Connection polling | `/app/api/cron/poll-accepted-connections/route.ts` |
| Reply polling | `/app/api/cron/poll-message-replies/route.ts` |
| QA Monitor | `/app/api/agents/qa-monitor/route.ts` |
| Scheduling config | `/lib/scheduling-config.ts` |

---

## Session 2: CSV Upload Prospect Transfer Bug

### 5. Prospect Approval Session Counter Bug (CRITICAL)

**Problem**: Michelle uploaded 50 prospects via CSV, approved all 50, but they never transferred to `campaign_prospects`. Campaign showed 0 prospects.

**Root Cause**: `updateSessionCounts()` in `/app/api/prospect-approval/decisions/route.ts` was using **user client with RLS** instead of admin client. RLS blocked accurate counts, causing:
- `prospect_approval_decisions`: 50 approved ✓
- `prospect_approval_data`: 50 approved ✓
- `prospect_approval_sessions`: 29 approved, 21 pending ✗ (WRONG)

The `/api/prospect-approval/complete` endpoint checks `pending_count > 0` and refused to transfer prospects because it thought 21 were still pending.

**Fix Applied**:
```typescript
// Before: Used RLS-restricted user client
async function updateSessionCounts(supabase: any, sessionId: string) {
  const { count } = await supabase.from('prospect_approval_decisions')...

// After: Uses admin client to bypass RLS
async function updateSessionCounts(_supabase: any, sessionId: string) {
  const adminClient = supabaseAdmin()
  const { count } = await adminClient.from('prospect_approval_decisions')...
```

**File**: `/app/api/prospect-approval/decisions/route.ts` (lines 282-322)

### 6. Manual Data Fix for Michelle's Campaign

**Session ID**: `b9a1edd9-331e-464b-b63a-6e0a9fde66fb`
**Campaign ID**: `8422f78a-d653-480d-8a6d-8f0b3e57c2b4` (12/2 Mich Campaign 3)

**Fixes Applied**:
```sql
-- 1. Fixed session counters
UPDATE prospect_approval_sessions
SET approved_count = 50, pending_count = 0
WHERE id = 'b9a1edd9-331e-464b-b63a-6e0a9fde66fb';

-- 2. Transferred 50 prospects to campaign_prospects
INSERT INTO campaign_prospects (campaign_id, workspace_id, first_name, ...)
SELECT '8422f78a-d653-480d-8a6d-8f0b3e57c2b4', ...
FROM prospect_approval_data
WHERE session_id = 'b9a1edd9-331e-464b-b63a-6e0a9fde66fb';

-- 3. Deleted orphaned draft campaign
DELETE FROM campaigns WHERE id = 'b12b36a6-3703-4d70-af3a-4ba5d79077c9';
```

### 7. CSV Upload Missing LinkedIn URLs

**Problem**: Michelle's 50 prospects have **NO LinkedIn URLs** - the CSV was missing the LinkedIn column.

| Campaign | Prospects | With LinkedIn |
|----------|-----------|---------------|
| 12/2 Mich Campaign 3 | 50 | **0** ❌ |
| 12/1 Mich Campaign 2 | 33 | 33 ✅ |

**Impact**: Connector (LinkedIn) campaigns require LinkedIn URLs. These prospects cannot receive connection requests.

**CSV Header Requirements**: LinkedIn column must be named one of:
- `linkedin`
- `linkedin url`
- `linkedin profile`
- `profile url`

**Action Required**: Michelle needs to re-upload CSV with LinkedIn URLs included.

## Files Modified (Session 2)

1. **Modified**:
   - `app/api/prospect-approval/decisions/route.ts` - Fixed `updateSessionCounts()` to use admin client

## Current Campaign Status

| User | Campaign | Prospects | LinkedIn URLs | Status |
|------|----------|-----------|---------------|--------|
| Michelle | 12/2 Mich Campaign 3 | 50 | 0 | ⚠️ Needs LinkedIn URLs |
| Michelle | 12/1 Mich Campaign 2 | 33 | 33 | ✅ Active |
| Charissa | 12/2 Cha Campaign 5 | 35 | 35 | ✅ Active |

## Next Steps

1. Monitor follow-ups starting at 5 AM PT to verify they send
2. QA Monitor will run at 6 AM UTC - check Google Chat for report
3. **Michelle**: Re-upload CSV with LinkedIn URL column for "12/2 Mich Campaign 3"
4. Consider adding monitoring dashboard for cron job health
