-- Verify sam_conversation_messages table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'sam_conversation_messages'
ORDER BY ordinal_position;

-- Test query to see if we can access the table
SELECT * FROM sam_conversation_messages LIMIT 1;
