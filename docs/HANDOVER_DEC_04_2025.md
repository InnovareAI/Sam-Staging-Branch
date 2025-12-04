# Handover Document - December 4, 2025

## Session Summary

Fixed critical campaign draft save issues that were blocking users from creating campaigns.

---

## Issues Fixed

### 1. Database CHECK Constraint Error

**Problem:** Campaign draft save failing with error:
```
Failed to create draft: new row for relation "campaigns" violates check constraint "campaigns_type_check"
```

**Root Cause:**
- The `campaigns` table has TWO type columns with different constraints:
  - `campaign_type` column - has `campaigns_campaign_type_check` constraint allowing 'connector', 'messenger', 'email', etc.
  - `type` column - has old `campaigns_type_check` constraint only allowing 'linkedin', 'email', etc.
- The API was setting BOTH columns, but frontend uses 'connector'/'messenger' which the old `type` constraint rejects

**Fix:** Removed `type` column from insert/update in `/api/campaigns/draft/route.ts`

**File Changed:** [app/api/campaigns/draft/route.ts](app/api/campaigns/draft/route.ts)
- Line 73-74: Removed `type: campaignType` from UPDATE
- Line 185-186: Removed `type: campaignType` from INSERT

---

### 2. Duplicate Toast Notifications

**Problem:** Two toast notifications appearing when saving draft - one success, one failure

**Root Cause:**
- Save Draft buttons had inline fetch code that showed toasts
- Auto-save useEffect (2 second debounce) also triggered and called `saveDraft()`
- Two parallel API calls racing = two toasts

**Fix:**
- Replaced inline fetch code with single `saveDraft(true)` function call
- Updated `saveDraft` function to show proper messages when `force=true`
- Added query cache invalidation for draft list refresh

**File Changed:** [app/components/CampaignHub.tsx](app/components/CampaignHub.tsx)
- Lines 2521-2571: Updated `saveDraft` function with proper error handling
- Lines 5161-5168: Step 1 Save Draft button now uses `saveDraft(true)`
- Lines 5179-5186: Step 2 Save Draft button now uses `saveDraft(true)`

---

## Commits

1. `c5d2ed24` - Fix campaign draft save - remove type column to avoid CHECK constraint
2. `f332809e` - Fix duplicate toast notifications on Save Draft

---

## Deployments

Both fixes deployed to production: https://app.meet-sam.com

---

## Testing

To test:
1. Go to Campaign Hub
2. Click "New Campaign"
3. Enter campaign name
4. Click "Save Draft"
5. Should see SINGLE success toast: "Campaign draft saved! Find it in 'In Progress' tab."
6. Draft should appear in "In Progress" tab

---

## Technical Notes

### Campaign Type Values

Frontend campaign types:
- `connector` - 2nd/3rd degree LinkedIn connections (sends CR + follow-ups)
- `messenger` - 1st degree connections (sends messages to already-connected prospects)
- `email` - Email campaigns
- `multichannel` - Multi-channel campaigns

Database columns:
- `campaign_type` (VARCHAR) - **USE THIS** - accepts all frontend values
- `type` (VARCHAR) - **DEPRECATED** - has old constraint, don't use

### Auto-Save Behavior

- Auto-save triggers 2 seconds after any form field change
- Auto-save is SILENT (no toast) unless `force=true`
- Manual "Save Draft" button calls `saveDraft(true)` which shows toast
- Only one API call per user action (no race conditions)

---

## Related Files

- `/sql/migrations/014-messenger-campaign-support.sql` - Added `campaigns_campaign_type_check` constraint
- `/supabase/migrations/20250923180000_create_campaign_tables.sql` - Original campaign table creation

---

## Previous Session Context

From Dec 3, 2025:
- Added timezone dropdown to campaign modal
- Removed redundant "Message Timing & Cadence" section
- Completed database-first architecture for prospects (workspace_prospects → campaign_prospects)

---

## Next Steps

1. Monitor for any additional constraint issues
2. Consider migrating old `type` column data to `campaign_type` and dropping `type` column
3. Add SQL migration to drop the old `campaigns_type_check` constraint (optional cleanup)
