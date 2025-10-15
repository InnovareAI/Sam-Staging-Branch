# Apply KB Analytics Migration

## Quick Start (Supabase Dashboard - Recommended)

The Supabase JavaScript client cannot execute DDL statements directly, so we need to use the Supabase Dashboard SQL Editor.

### Steps:

1. **Open Supabase SQL Editor**
   - Go to: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql/new
   - Or navigate to: Dashboard → SQL Editor → New Query

2. **Copy the Migration SQL**
   - Open: `supabase/migrations/20251015000000_create_kb_usage_analytics.sql`
   - Copy the entire contents (202 lines)

3. **Execute the Migration**
   - Paste the SQL into the SQL Editor
   - Click **"Run"** (bottom right)
   - Wait for confirmation: "Success. No rows returned"

4. **Verify Migration**
   Run this query to confirm tables were created:
   ```sql
   SELECT table_name
   FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name LIKE '%knowledge_base%usage%';
   ```

   Expected result: `knowledge_base_document_usage`

5. **Test the Functions**
   ```sql
   -- Test get_document_usage_analytics (should return empty initially)
   SELECT * FROM get_document_usage_analytics(
     (SELECT id FROM workspaces LIMIT 1),
     30
   );

   -- Test get_section_usage_summary
   SELECT * FROM get_section_usage_summary(
     (SELECT id FROM workspaces LIMIT 1),
     30
   );
   ```

## What Gets Created

### Tables:
- ✅ `knowledge_base_document_usage` - Tracks every SAM document retrieval

### Columns Added to `knowledge_base_documents`:
- ✅ `usage_count` - Total times document was used
- ✅ `last_used_at` - Timestamp of last use
- ✅ `last_used_in_thread_id` - Last conversation thread ID
- ✅ `first_used_at` - First time document was ever used

### Functions:
- ✅ `record_document_usage()` - Called automatically by SAM
- ✅ `get_document_usage_analytics()` - Returns document-level stats
- ✅ `get_section_usage_summary()` - Returns section-level aggregates

### Performance:
- ✅ 8 indexes created for fast queries
- ✅ RLS policies for workspace isolation

## Post-Migration

### 1. Restart Dev Server
```bash
npm run dev
```

### 2. Test the Features

**Analytics Dashboard:**
- Go to Knowledge Base → Usage Analytics (new tab)
- Select time range (7/30/90 days)
- View document and section analytics

**Export:**
- Click "Export" dropdown in Analytics
- Download as JSON, CSV, or Markdown

**Automatic Tracking:**
- Have a conversation with SAM
- Ask SAM questions that require KB docs
- Check Analytics - usage will appear automatically

### 3. Monitor Usage
```sql
-- See recent usage
SELECT
  d.filename,
  u.used_at,
  u.query_context
FROM knowledge_base_document_usage u
JOIN knowledge_base_documents d ON d.id = u.document_id
ORDER BY u.used_at DESC
LIMIT 10;
```

## Troubleshooting

### Migration Fails with "already exists"
The migration uses `IF NOT EXISTS` - safe to run multiple times.

### No data showing in Analytics
1. Ensure SAM conversations are happening
2. Check that documents exist in KB
3. Run test query above to see raw data

### Permission errors
Verify RLS policies were created:
```sql
SELECT * FROM pg_policies
WHERE tablename = 'knowledge_base_document_usage';
```

## Rollback (if needed)

```sql
-- WARNING: This deletes all usage analytics data
DROP TABLE IF EXISTS knowledge_base_document_usage CASCADE;

ALTER TABLE knowledge_base_documents
  DROP COLUMN IF EXISTS usage_count,
  DROP COLUMN IF EXISTS last_used_at,
  DROP COLUMN IF EXISTS last_used_in_thread_id,
  DROP COLUMN IF EXISTS first_used_at;

DROP FUNCTION IF EXISTS record_document_usage CASCADE;
DROP FUNCTION IF EXISTS get_document_usage_analytics CASCADE;
DROP FUNCTION IF EXISTS get_section_usage_summary CASCADE;
```

---

**Migration File:** `supabase/migrations/20251015000000_create_kb_usage_analytics.sql`
**Created:** 2025-10-15
**Status:** Ready to apply
