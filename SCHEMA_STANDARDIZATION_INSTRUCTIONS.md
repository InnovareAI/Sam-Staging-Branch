# Schema Standardization - Implementation Instructions

## Problem Statement

**Issue**: Stan Bounev's Blue Label Labs workspace shows 97 prospects in the count, but the list displays empty. This affects ALL workspaces due to inconsistent column naming between tables.

**Root Cause**: Schema mismatch between tables
- `workspace_prospects` uses: `linkedin_profile_url`, `email_address`, `job_title`
- `campaign_prospects` uses: `linkedin_url`, `email`, `title`
- Frontend queries expect the shorter names, causing empty results

**Impact**: ALL workspaces affected, not just Blue Label Labs

---

## Solution: Standardize Column Names

This migration renames columns in `workspace_prospects` to match `campaign_prospects`, ensuring ONE consistent naming convention across ALL workspaces.

---

## Step 1: Apply SQL Migration

### Option A: Via Supabase Dashboard (Recommended)

1. Go to: https://supabase.com/dashboard
2. Select your project
3. Navigate to: SQL Editor (left sidebar)
4. Click: "New query"
5. Copy the entire contents of: `sql/standardize-prospect-schema.sql`
6. Paste into the SQL editor
7. Click: "Run" button
8. Wait for confirmation: "Success. No rows returned"

### Option B: Via Command Line

```bash
# From project root
psql $DATABASE_URL < sql/standardize-prospect-schema.sql
```

---

## Step 2: Verify Migration Success

Run the verification script:

```bash
node scripts/js/verify-schema-standardization.mjs
```

**Expected Output:**
```
✅ New column names:
   linkedin_url: ✓
   email: ✓
   title: ✓

❌ Old column names (should NOT exist):
   linkedin_profile_url: ✓ Removed
   email_address: ✓ Removed
   job_title: ✓ Removed

✅ MIGRATION SUCCESSFUL! Schema is now standardized.
```

---

## Step 3: Update Application Code

### A. Update API Routes

File: `app/api/prospects/route.ts`

**Before (lines 48-52):**
```typescript
if (search) {
  query = query.or(`
    full_name.ilike.%${search}%,
    email_address.ilike.%${search}%,  // OLD
    company_name.ilike.%${search}%,
    job_title.ilike.%${search}%      // OLD
  `);
}
```

**After:**
```typescript
if (search) {
  query = query.or(`
    full_name.ilike.%${search}%,
    email.ilike.%${search}%,          // NEW
    company_name.ilike.%${search}%,
    title.ilike.%${search}%           // NEW
  `);
}
```

**And lines 77-81:**
```typescript
if (search) {
  countQuery = countQuery.or(`
    full_name.ilike.%${search}%,
    email.ilike.%${search}%,          // NEW
    company_name.ilike.%${search}%,
    title.ilike.%${search}%           // NEW
  `);
}
```

### B. Update Workspace Prospect Manager

File: `lib/workspace-prospect-manager.ts`

**Lines 12-13 (interface):**
```typescript
export interface WorkspaceProspect {
  id: string
  workspace_id: string
  email?: string                    // NEW (was email_address)
  linkedin_url?: string             // NEW (was linkedin_profile_url)
  phone_number?: string
  company_domain?: string
  full_name?: string
  first_name?: string
  last_name?: string
  title?: string                    // NEW (was job_title)
  company_name?: string
  location?: string
  assigned_to?: string
  prospect_status: 'new' | 'assigned' | 'contacted' | 'replied' | 'qualified' | 'converted' | 'closed'
  contact_count: number
  last_contacted_at?: string
  last_contacted_by?: string
  prospect_hash: string
}
```

**Lines 69-74 (deduplication fields):**
```typescript
private static readonly DEDUPLICATION_FIELDS = [
  'email',              // NEW (was email_address)
  'linkedin_url',       // NEW (was linkedin_profile_url)
  'phone_number',
  'company_domain'
]
```

**Lines 87-98 (RPC call parameters):**
```typescript
const { data, error } = await supabase.rpc('add_or_get_workspace_prospect', {
  p_workspace_id: workspace_id,
  p_email: prospectData.email || null,                      // NEW
  p_linkedin_url: prospectData.linkedin_url || null,        // NEW
  p_phone_number: prospectData.phone_number || null,
  p_company_domain: prospectData.company_domain || null,
  p_full_name: prospectData.full_name || null,
  p_first_name: prospectData.first_name || null,
  p_last_name: prospectData.last_name || null,
  p_title: prospectData.title || null,                      // NEW
  p_company_name: prospectData.company_name || null,
  p_location: prospectData.location || null,
  p_data_source: data_source
})
```

**Lines 184-195 (duplicate detection):**
```typescript
if (prospectData.email) {
  orConditions.push({ email: prospectData.email })          // NEW
}
if (prospectData.linkedin_url) {
  orConditions.push({ linkedin_url: prospectData.linkedin_url })  // NEW
}
if (prospectData.phone_number) {
  orConditions.push({ phone_number: prospectData.phone_number })
}
if (prospectData.company_domain) {
  orConditions.push({ company_domain: prospectData.company_domain })
}
```

---

## Step 4: Test Stan's Workspace

Run verification script for Blue Label Labs:

```bash
node scripts/js/list-all-prospects.mjs
```

**Expected Output:**
```
✅ Found 97 prospects

Available columns:
added_by, company_name, created_at, email, first_name, id,
linkedin_url, location, title, updated_at, workspace_id

First 20 Prospects:
============================================================
1. Ryan Cloutier
   Company: CISSP
   LinkedIn: https://www.linkedin.com/in/...

2. Sanjay Bakshi
   Company: Mentor
   LinkedIn: https://www.linkedin.com/in/...

[... etc ...]

✅ ALL DATA IS INTACT AND ACCESSIBLE!
```

---

## Step 5: Verify Across All Workspaces

Check that the fix works for all workspaces:

```bash
# Sendingcell workspace
node scripts/js/check-sendingcell.mjs

# Innovare AI workspace
# (add similar check script if needed)
```

---

## Rollback Plan (If Issues Occur)

If the migration causes problems, rollback with:

```sql
-- Rename columns back to original names
ALTER TABLE workspace_prospects
  RENAME COLUMN linkedin_url TO linkedin_profile_url;

ALTER TABLE workspace_prospects
  RENAME COLUMN email TO email_address;

ALTER TABLE workspace_prospects
  RENAME COLUMN title TO job_title;

-- Restore original unique constraint
ALTER TABLE workspace_prospects
  DROP CONSTRAINT IF EXISTS workspace_prospects_workspace_id_linkedin_url_key;

ALTER TABLE workspace_prospects
  ADD CONSTRAINT workspace_prospects_workspace_id_linkedin_profile_url_key
  UNIQUE (workspace_id, linkedin_profile_url);
```

---

## Post-Migration Checklist

- [ ] SQL migration applied successfully
- [ ] Verification script confirms new column names
- [ ] Old column names no longer exist
- [ ] api/prospects/route.ts updated
- [ ] workspace-prospect-manager.ts updated
- [ ] Stan's prospects display correctly (97 visible)
- [ ] Sendingcell prospects display correctly
- [ ] No errors in Supabase logs
- [ ] Frontend displays prospects in all workspaces

---

## Files Modified

1. `sql/standardize-prospect-schema.sql` - Migration SQL ✅ Created
2. `scripts/js/verify-schema-standardization.mjs` - Verification script ✅ Created
3. `app/api/prospects/route.ts` - API route updates (⏳ Pending)
4. `lib/workspace-prospect-manager.ts` - Library updates (⏳ Pending)

---

## Contact

If you encounter issues during migration:
1. Check Supabase SQL editor logs
2. Run verification script
3. Check application error logs
4. Use rollback plan if needed
