-- Prevent user ID mismatches between auth.users and public.users
-- This ensures that when a user signs up, their ID in the users table matches their auth ID

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS sync_auth_user_to_users ON auth.users;
DROP FUNCTION IF EXISTS sync_auth_user_to_users();

-- Function to sync auth user to users table
CREATE OR REPLACE FUNCTION sync_auth_user_to_users()
RETURNS TRIGGER AS $$
BEGIN
  -- When a new user is created in auth.users, ensure they exist in public.users with the same ID
  INSERT INTO public.users (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
CREATE TRIGGER sync_auth_user_to_users
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_auth_user_to_users();

-- Also add unique constraint on email if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_email_key'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);
  END IF;
END $$;

COMMENT ON FUNCTION sync_auth_user_to_users IS 'Automatically syncs new auth users to the users table to prevent ID mismatches';
