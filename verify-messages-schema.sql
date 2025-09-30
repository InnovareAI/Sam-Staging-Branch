-- Verify sam_conversation_messages table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'sam_conversation_messages'
ORDER BY ordinal_position;

-- Also check if RLS is enabled
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'sam_conversation_messages';