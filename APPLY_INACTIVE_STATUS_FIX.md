# Fix for Campaign Status Update Issue

## Problem
Campaigns cannot be saved with "inactive" status because the database CHECK constraint doesn't include it.

**Error Message:** "Failed to update status: Failed to update campaign"

## Root Cause
The database constraint at `supabase/migrations/20251017000002_fix_campaigns_table_conflicts.sql` only allows:
- draft, active, paused, completed, archived

But the application code uses "inactive" throughout:
- UI dropdown shows "Inactive - Campaign ready to activate"
- API routes create campaigns with status='inactive' by default
- Campaign activation endpoint expects campaigns in 'inactive' status

## Solution
Add 'inactive' to the allowed campaign statuses in the database.

## How to Apply the Fix

### Option 1: Supabase Dashboard (RECOMMENDED)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog
2. Navigate to: **SQL Editor** (left sidebar)
3. Click **New Query**
4. Paste the following SQL:

```sql
-- Add 'inactive' to campaigns status constraint
-- Fix: Database was rejecting 'inactive' status updates

-- Drop existing status constraint
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_status_check;

-- Add updated status constraint including 'inactive'
ALTER TABLE campaigns
ADD CONSTRAINT campaigns_status_check
CHECK (status IN ('draft', 'inactive', 'active', 'paused', 'completed', 'archived'));
```

5. Click **Run** (or press Ctrl/Cmd + Enter)
6. Verify you see success message

### Option 2: Supabase CLI (if you have it installed)

```bash
# From project root
supabase db push
```

This will apply all pending migrations including `20251021000000_add_inactive_status.sql`

## Verification

After applying the fix, test it:

1. Go to https://app.meet-sam.com
2. Open any campaign
3. Try changing the campaign status to "Inactive"
4. Verify no error appears
5. Check that the status updates successfully

## Files Changed

- ✅ Created: `supabase/migrations/20251021000000_add_inactive_status.sql`
- 📝 This instruction file: `APPLY_INACTIVE_STATUS_FIX.md`

## Technical Details

The migration file updates the CHECK constraint on the `campaigns` table's `status` column to include all valid statuses that the application uses:

| Status    | Description |
|-----------|-------------|
| draft     | Being created |
| inactive  | Ready to activate |
| active    | Running |
| paused    | Temporarily stopped |
| completed | Finished |
| archived  | Historical |
