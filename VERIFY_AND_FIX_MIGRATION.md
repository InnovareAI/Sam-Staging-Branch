# Verify & Fix KB Analytics Migration

The migration script showed errors. Let's verify what actually got created.

## Step 1: Check What Exists

Run this in Supabase SQL Editor:

```sql
-- Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'knowledge_base_document_usage'
) as table_exists;

-- Check if functions exist
SELECT COUNT(*) as function_count
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'record_document_usage',
    'get_document_usage_analytics',
    'get_section_usage_summary'
  );

-- Should return: 3 functions
```

## Step 2: If Functions Missing (function_count < 3)

The migration didn't fully apply. **Re-run the entire migration**:

1. Open: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql/new
2. Copy **entire contents** of: `supabase/migrations/20251015000000_create_kb_usage_analytics.sql`
3. Paste into SQL Editor
4. Click **"Run"**
5. Wait for "Success. No rows returned"

## Step 3: Verify Functions Work

```sql
-- Test with a real workspace
SELECT * FROM get_document_usage_analytics(
  (SELECT id FROM workspaces WHERE name LIKE '%3cubed%' OR name LIKE '%InnovareAI%' LIMIT 1),
  30
) LIMIT 5;
```

**Expected**: Should return rows (may be empty if no usage yet) without errors.

## Step 4: Test API Route

After verifying functions exist, test the API:

1. Login to: https://app.meet-sam.com
2. Go to: Knowledge Base → Usage Analytics
3. Should load without "Failed to fetch analytics" error

## Common Issues

### Issue: "function public.get_document_usage_analytics does not exist"
**Fix**: Functions weren't created. Re-run migration (Step 2)

### Issue: "permission denied for function"
**Fix**: Functions missing SECURITY DEFINER. Re-run migration (Step 2)

### Issue: "relation knowledge_base_document_usage does not exist"
**Fix**: Table wasn't created. Re-run migration (Step 2)

### Issue: Still getting "Unauthorized"
**Fix**: Make sure you're logged in. Try logging out and back in.

## Quick Fix Script

If Step 2 doesn't work, run this simplified version:

```sql
-- Quick fix: Create functions only (assumes table already exists)

CREATE OR REPLACE FUNCTION public.get_document_usage_analytics(
    p_workspace_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    document_id UUID,
    document_title TEXT,
    section TEXT,
    total_uses INTEGER,
    unique_threads INTEGER,
    avg_relevance NUMERIC,
    last_used_at TIMESTAMPTZ,
    days_since_last_use INTEGER,
    usage_trend TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id AS document_id,
        d.filename AS document_title,
        d.section_id AS section,
        COALESCE(COUNT(u.id), 0)::INTEGER AS total_uses,
        COALESCE(COUNT(DISTINCT u.thread_id), 0)::INTEGER AS unique_threads,
        AVG(u.relevance_score) AS avg_relevance,
        MAX(u.used_at) AS last_used_at,
        CASE
          WHEN MAX(u.used_at) IS NULL THEN NULL
          ELSE EXTRACT(DAY FROM NOW() - MAX(u.used_at))::INTEGER
        END AS days_since_last_use,
        CASE
            WHEN COUNT(u.id) FILTER (WHERE u.used_at >= NOW() - INTERVAL '7 days') >
                 COUNT(u.id) FILTER (WHERE u.used_at >= NOW() - INTERVAL '14 days' AND u.used_at < NOW() - INTERVAL '7 days')
            THEN 'increasing'
            WHEN COUNT(u.id) FILTER (WHERE u.used_at >= NOW() - INTERVAL '7 days') <
                 COUNT(u.id) FILTER (WHERE u.used_at >= NOW() - INTERVAL '14 days' AND u.used_at < NOW() - INTERVAL '7 days')
            THEN 'decreasing'
            ELSE 'stable'
        END AS usage_trend
    FROM public.knowledge_base_documents d
    LEFT JOIN public.knowledge_base_document_usage u
        ON d.id = u.document_id
        AND u.used_at >= NOW() - (p_days || ' days')::INTERVAL
    WHERE d.workspace_id = p_workspace_id
        AND COALESCE(d.is_active, true) = true
    GROUP BY d.id, d.filename, d.section_id
    ORDER BY total_uses DESC NULLS LAST;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_document_usage_analytics TO authenticated;
```

---

**Next**: After running the fix, refresh the Analytics page in your browser.
