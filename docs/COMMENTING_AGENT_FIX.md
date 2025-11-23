# LinkedIn Commenting Agent - Schema Cache Fix

**Date:** November 23, 2025
**Issue:** Campaign creation failing with "Internal server error"
**Root Cause:** Supabase PostgREST schema cache out of sync after table creation

## Problem

Error when creating a monitor:
```
Could not find the 'created_by' column of 'linkedin_post_monitors' in the schema cache
Code: PGRST204
```

The table exists and the column exists in PostgreSQL, but PostgREST's API cache doesn't know about it.

## Solution: Reload Schema Cache

### Option 1: Via Supabase Dashboard (Recommended)

1. Open Supabase Dashboard: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog
2. Go to **API** section (left sidebar)
3. Click **"Reload Schema Cache"** button
4. Wait 5-10 seconds

### Option 2: Via SQL

Run this in Supabase SQL Editor:

```sql
NOTIFY pgrst, 'reload schema';
```

### Option 3: Via API

```bash
curl -X POST 'https://latxadqrvrrrcvkktrog.supabase.co/rest/v1/rpc/reload_schema_cache' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

## Verification

After reloading the cache, test monitor creation:

```bash
node scripts/js/test-monitor-creation.mjs
```

Should see:
```
✅ Monitor created successfully!
```

## Why This Happens

PostgREST (the REST API layer) caches the database schema for performance. When you:
1. Create new tables via SQL migration
2. Add/remove columns

The cache needs to be manually reloaded to recognize the changes.

## Files Involved

- **API Route:** `app/api/linkedin-commenting/monitors/route.ts`
- **Migration:** `sql/migrations/20251123_create_linkedin_commenting_tables.sql`
- **Test Script:** `scripts/js/check-commenting-setup.mjs`

## Related Documentation

- CLAUDE.md Section: "🔴 Open Issues → LinkedIn Commenting Agent"
- PostgREST Schema Cache: https://postgrest.org/en/stable/admin.html#schema-cache-reload
