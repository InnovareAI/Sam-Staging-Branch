-- Test KB Analytics Functions
-- Run this in Supabase SQL Editor to verify everything works

-- 1. Check if the usage tracking table exists
SELECT
  table_name,
  'EXISTS' as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'knowledge_base_document_usage';

-- 2. Check if columns were added to knowledge_base_documents
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'knowledge_base_documents'
  AND column_name IN ('usage_count', 'last_used_at', 'first_used_at', 'last_used_in_thread_id');

-- 3. Check if functions exist
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('record_document_usage', 'get_document_usage_analytics', 'get_section_usage_summary');

-- 4. Test get_document_usage_analytics function
-- Replace YOUR_WORKSPACE_ID with an actual workspace ID
SELECT * FROM get_document_usage_analytics(
  (SELECT id FROM workspaces LIMIT 1),
  30
) LIMIT 5;

-- 5. Test get_section_usage_summary function
SELECT * FROM get_section_usage_summary(
  (SELECT id FROM workspaces LIMIT 1),
  30
);

-- 6. Check RLS policies
SELECT
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'knowledge_base_document_usage';
