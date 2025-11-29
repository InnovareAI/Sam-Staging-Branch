# Handover: Prospect Delete Fix (November 29, 2025)

## Summary

Fixed the bulk delete functionality in DataCollectionHub that was failing with "Prospect not found" errors.

## Problem

Users reported:
1. Delete appeared to work but data reappeared after a few seconds
2. After initial fix, got "Failed to delete: Prospect not found" error

## Root Cause

The `prospect_approval_data` table has TWO ID columns:

| Column | Type | Example |
|--------|------|---------|
| `id` | UUID | `4256f10a-319f-44cd-a275-4e1f4187cd03` |
| `prospect_id` | TEXT | `csv_1763400720708_yliptbkzi` |

The UI sends `prospect_id` (client-generated IDs), but the delete API was querying by `id` (UUID) - hence nothing was found.

## Fixes Applied

### 1. Frontend - Response Validation (commit c58f51ce → ef4f2ee9)

**File**: `/app/components/DataCollectionHub.tsx`

Previously, `bulkDeleteSelected` fired off DELETE requests without checking responses. Fixed to:
- Check `response.ok && data.success` for each delete
- Only remove successfully deleted items from UI
- Show proper error messages for failures

### 2. Backend - Correct Column Query (commit e481c45c)

**File**: `/app/api/prospect-approval/delete/route.ts`

Changed from:
```typescript
// WRONG - queries UUID column
.eq('id', prospectId)
```

To:
```typescript
// CORRECT - queries client-generated ID column
.eq('prospect_id', prospectId)
// Then delete by actual UUID
.eq('id', approvalProspect.id)
```

## Files Changed

| File | Change |
|------|--------|
| `/app/api/prospect-approval/delete/route.ts` | Search by `prospect_id` column, delete by `id` UUID |
| `/app/components/DataCollectionHub.tsx` | Proper response checking for bulk delete |

## Database Schema Reference

```sql
-- prospect_approval_data table structure
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
prospect_id       TEXT NOT NULL  -- Client-generated IDs (csv_xxx, prospect_xxx)
session_id        UUID NOT NULL
workspace_id      UUID
name              TEXT
title             TEXT
-- ... other fields
```

## Testing

1. Go to DataCollectionHub
2. Select one or more prospects
3. Click delete button in action bar
4. Verify prospects are deleted and don't reappear after 30 seconds

## Related Commits

```
e481c45c Fix delete API to search by prospect_id instead of id
ef4f2ee9 Move delete button to action bar for visibility
c58f51ce Add bulk delete button for selected prospects
```

## Key Learnings

1. **Always check database schema** - The table had two ID columns with different purposes
2. **Client IDs vs Database IDs** - UI uses client-generated IDs (`csv_xxx`), database uses UUIDs internally
3. **React Query auto-refresh** - DataCollectionHub refreshes every 30 seconds (`refetchInterval: 30000`), which made it look like deletes were "reverting"

## Status

- **Deployed**: November 29, 2025
- **Tested**: Pending user verification
- **GitHub**: Pushed to main branch
