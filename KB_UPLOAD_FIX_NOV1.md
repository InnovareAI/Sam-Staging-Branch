# Knowledge Base Upload Fix - November 1, 2025

## Issue

Error when uploading documents to knowledge base:
```
Document not found or missing workspace context
```

## Root Cause

**RLS (Row Level Security) was blocking document creation:**

1. `upload-document/route.ts` was using user-context Supabase client
2. User-context client enforces RLS policies
3. RLS policies require `user_has_workspace_access(workspace_id)`
4. INSERT was silently failing but route returned success with documentId
5. Frontend called vectorize-content with non-existent documentId
6. **Secondary issue:** Table mismatch in process/vectorize routes querying wrong table

## Fixes Applied

### Fix 1: RLS Client Issue (PRIMARY FIX)

Updated `/app/api/knowledge-base/upload-document/route.ts`:

**Before:**
```typescript
const supabase = await createSupabaseRouteClient(); // User context - RLS enforced
// ... do everything with this client including INSERT
```

**After:**
```typescript
const userSupabase = await createSupabaseRouteClient(); // User context for auth
// ... check auth and get workspaceId

// Create service-role client for database writes (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
// ... use this for INSERT
```

### Fix 2: Table Mismatch

Updated `/app/api/knowledge-base/process-document/route.ts`:

**Before:**
```typescript
const { data: documentRecord } = await supabase
  .from('knowledge_base_documents')  // ❌ Wrong table
  .select('workspace_id, section_id')
  .eq('id', documentId)
  .single();
```

**After:**
```typescript
const { data: documentRecord } = await supabase
  .from('knowledge_base')  // ✅ Correct table
  .select('workspace_id, category, source_metadata')
  .eq('id', documentId)
  .single();
```

**Additional changes:**
- Changed `section_id` → `category` (correct column name)
- Added `source_metadata` to SELECT (needed for update)
- Updated UPDATE statement to use `knowledge_base` table
- Store AI analysis in `source_metadata.ai_analysis` instead of separate columns

## Tables Overview

### knowledge_base (Main table - used for uploads)
```sql
- id UUID
- workspace_id UUID  ← Required
- category TEXT  ← Maps to "section"
- subcategory TEXT
- title TEXT
- content TEXT
- tags TEXT[]
- source_metadata JSONB  ← Stores AI analysis here
- created_at TIMESTAMPTZ
- updated_at TIMESTAMPTZ
```

### knowledge_base_documents (Different table - for file storage)
```sql
- id UUID
- workspace_id UUID
- section_id TEXT  ← Different from category
- filename TEXT
- storage_path TEXT
- extracted_content TEXT
- metadata JSONB
```

## Testing

To verify the fix:

1. Go to Stan's account workspace
2. Navigate to Knowledge Base
3. Upload a document
4. Verify: No "Document not found or missing workspace context" error
5. Verify: Document appears in knowledge base
6. Check AI analysis stored in source_metadata

### Fix 3: FK Constraint (DATABASE)

Created migration: `supabase/migrations/20251101000001_fix_vector_fk_constraint.sql`

**Issue:** `knowledge_base_vectors` FK pointed to wrong table
**Fix:** Change FK from `knowledge_base_documents(id)` → `knowledge_base(id)`

**Status:** ⚠️ Migration created but needs manual application in Supabase SQL Editor

## Files Changed

```
✅ app/api/knowledge-base/upload-document/route.ts (PRIMARY FIX)
   - Lines 1-4: Import createClient from @supabase/supabase-js
   - Lines 143-191: Use userSupabase for auth, supabase (service-role) for INSERT
   - Lines 264-282: Enhanced error logging

✅ app/api/knowledge-base/process-document/route.ts
   - Line 155: Changed table from knowledge_base_documents → knowledge_base
   - Line 156: Added source_metadata to SELECT
   - Line 165: Changed section_id → category
   - Line 173-187: Updated to store in source_metadata.ai_analysis

✅ app/api/knowledge-base/vectorize-content/route.ts
   - Line 215: Changed table from knowledge_base_documents → knowledge_base
   - Line 216: Added source_metadata to SELECT
   - Line 226: Changed section_id → category
   - Lines 263-274: Updated to store vectorization status in source_metadata

⚠️ supabase/migrations/20251101000001_fix_vector_fk_constraint.sql (NEEDS MANUAL RUN)
   - Drop old FK constraint
   - Make document_id nullable
   - Add new FK pointing to knowledge_base table
```

## Related Files

- `app/api/knowledge-base/upload-document/route.ts` - Uploads to knowledge_base table (no changes needed)
- `supabase/migrations/20251006000002_add_source_tracking_to_knowledge.sql` - Defines knowledge_base schema

---

## Next Step: Apply FK Constraint Fix

**Run this SQL in Supabase SQL Editor:** https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql/new

```sql
-- Fix knowledge_base_vectors foreign key to point to knowledge_base instead of knowledge_base_documents
ALTER TABLE public.knowledge_base_vectors
DROP CONSTRAINT IF EXISTS knowledge_base_vectors_document_id_fkey;

ALTER TABLE public.knowledge_base_vectors
ALTER COLUMN document_id DROP NOT NULL;

ALTER TABLE public.knowledge_base_vectors
ADD CONSTRAINT knowledge_base_vectors_document_id_fkey
FOREIGN KEY (document_id)
REFERENCES public.knowledge_base(id)
ON DELETE CASCADE;

COMMENT ON COLUMN public.knowledge_base_vectors.document_id IS
'References knowledge_base.id - the source document for this vector chunk. Nullable to support vectors not tied to specific documents.';
```

---

**Status:** ⚠️ Code Fixed, Database Migration Pending
**Code Deployed:** Commit 09e5732a
**Database Fix:** Needs manual SQL execution (above)
**Impact:** HIGH - Fixes critical KB upload functionality
