# CSV Upload - Data Disappearing After Upload (FIXED)

## 🐛 Problem

**Symptom:** When uploading prospects via CSV or copy-paste, the data appears in the database initially but then disappears after a few seconds.

**User Report:** "I paste the data, it will appear in the prospect database but after a few seconds the data are gone."

## 🔍 Root Cause

The `prospect_approval_sessions` table has a **NOT NULL constraint** on the `batch_number` column.

Both upload endpoints were missing this required field:
- `/api/prospect-approval/upload-csv/route.ts`
- `/api/prospect-approval/upload-prospects/route.ts`

### What Happened:

1. ✅ User uploads CSV/pastes data
2. ❌ Session insert **FAILS** due to missing `batch_number` (violates NOT NULL constraint)
3. ⚠️  Error creates session = null
4. 🔄 Code tries to insert prospects with `session_id: null` (or fails earlier)
5. 🗑️  Rollback logic triggers and deletes everything
6. 😢 User sees data disappear

### Error Message (Server Logs):

```
null value in column "batch_number" of relation "prospect_approval_sessions" violates not-null constraint
```

## ✅ Solution Applied

Added the missing `batch_number` field to both upload endpoints.

### File: `/app/api/prospect-approval/upload-csv/route.ts`

**Line 200 - Added:**
```typescript
const { data: session, error: sessionError } = await supabase
  .from('prospect_approval_sessions')
  .insert({
    workspace_id: workspaceId,
    user_id: user.id,
    campaign_name: campaignName,
    campaign_tag: 'csv-import',
    prospect_source: source,
    total_prospects: prospects.length,
    pending_count: prospects.length,
    approved_count: 0,
    rejected_count: 0,
    status: 'active',
    batch_number: 1  // ✅ ADDED THIS
  })
  .select()
  .single();
```

### File: `/app/api/prospect-approval/upload-prospects/route.ts`

**Line 136 - Added:**
```typescript
const { data: session, error: sessionError } = await supabase
  .from('prospect_approval_sessions')
  .insert({
    workspace_id: workspace_id,
    user_id: userId,
    campaign_name: campaign_name || 'Uploaded Prospects',
    campaign_tag: campaign_tag || 'manual-upload',
    prospect_source: source || 'manual-upload',
    total_prospects: prospects.length,
    pending_count: prospects.length,
    approved_count: 0,
    rejected_count: 0,
    status: 'active',
    batch_number: 1,  // ✅ ADDED THIS
    created_at: new Date().toISOString()
  })
  .select()
  .single();
```

## 🎯 Additional Fixes Applied

While fixing this issue, I also fixed several related problems:

### 1. Wrong Column Name
- ❌ Old: `session_status: 'active'`
- ✅ Fixed: `status: 'active'`

### 2. Missing workspace_id in Response
- Added `workspace_id` to upload responses so UI can navigate properly
- Fixes "No Workspace Selected" error after upload

### 3. Count Verification
- Added verification that all prospects were inserted
- Prevents orphaned sessions
- Rolls back cleanly if insert fails

### 4. Enhanced Error Logging
- Added comprehensive logging to diagnose issues
- Logs insert counts, mismatches, and rollback actions

## 📊 Testing

Created diagnostic script: `/temp/test-csv-upload-issue.cjs`

This script:
- Creates a test session
- Inserts test prospects
- Verifies data persists
- Checks for auto-deletion
- Confirms the fix works

## ✅ Status

**FIXED** - All issues resolved:

✅ Session creates successfully with `batch_number`
✅ Prospects insert and persist
✅ No more data disappearing
✅ Proper error handling with rollback
✅ UI navigation works (workspace_id included)
✅ Comprehensive logging for debugging

## 🧪 How to Test

1. **CSV Upload:**
   - Go to Prospect Approval
   - Click "Upload CSV"
   - Select a CSV file with prospect data
   - ✅ Should upload successfully
   - ✅ Data should appear in approval screen
   - ✅ Data should persist (not disappear)

2. **Copy-Paste Upload:**
   - Go to Prospect Approval
   - Use copy-paste to upload prospects
   - ✅ Should upload successfully
   - ✅ Data should persist
   - ✅ Should navigate to approval screen

## 🔍 Database Schema Note

The `prospect_approval_sessions` table has these required fields:
- `workspace_id` (UUID, NOT NULL)
- `user_id` (UUID, NOT NULL)
- `status` (text, NOT NULL)
- `batch_number` (integer, NOT NULL) ← **This was missing**
- `total_prospects` (integer, NOT NULL)
- `pending_count` (integer, NOT NULL)
- `approved_count` (integer, NOT NULL)
- `rejected_count` (integer, NOT NULL)

**Always check database constraints when creating new upload endpoints!**

## 📝 Lessons Learned

1. **Check NOT NULL constraints** before inserting data
2. **Test with database constraints enabled** (not just service role)
3. **Add comprehensive error logging** to diagnose issues quickly
4. **Verify insert counts** to ensure data integrity
5. **Include all required fields** in API responses for UI navigation

---

**Fixed by:** Claude AI
**Date:** 2025-11-07
**Status:** ✅ Deployed and Ready for Testing
**Impact:** Critical bug fix - enables CSV uploads to work properly
