-- Drop clerk_id column from users table
-- This completes the Clerk to Supabase authentication migration

-- First, let's see the current state
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name = 'clerk_id';

-- Drop the clerk_id column completely
ALTER TABLE users DROP COLUMN IF EXISTS clerk_id CASCADE;

-- Verify the column is gone
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;