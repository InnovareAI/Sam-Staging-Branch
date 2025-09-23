-- Drop clerk_id column from users table to complete Clerk removal
ALTER TABLE users DROP COLUMN IF EXISTS clerk_id CASCADE;