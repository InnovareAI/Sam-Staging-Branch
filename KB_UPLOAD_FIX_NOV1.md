# Knowledge Base Upload Fix - November 1, 2025

## Issue

Error when uploading documents to knowledge base:
```
Document not found or missing workspace context
```

## Root Cause

**Table mismatch between upload and processing routes:**

1. `upload-document/route.ts` inserts into `knowledge_base` table
2. `process-document/route.ts` was querying `knowledge_base_documents` table
3. These are two different tables!

## Fix Applied

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

## Files Changed

```
✅ app/api/knowledge-base/process-document/route.ts
   - Line 155: Changed table from knowledge_base_documents → knowledge_base
   - Line 156: Added source_metadata to SELECT
   - Line 165: Changed section_id → category
   - Line 173-187: Updated to store in source_metadata.ai_analysis
```

## Related Files

- `app/api/knowledge-base/upload-document/route.ts` - Uploads to knowledge_base table (no changes needed)
- `supabase/migrations/20251006000002_add_source_tracking_to_knowledge.sql` - Defines knowledge_base schema

---

**Status:** ✅ Fixed
**Tested:** Pending user verification
**Impact:** HIGH - Fixes critical KB upload functionality
