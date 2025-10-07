-- Prevent user ID mismatches
-- This ensures that when a user signs up their ID in the users table matches their auth ID

-- Function to sync auth user to users table
CREATE OR REPLACE FUNCTION public.sync_auth_user_to_users()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: Trigger must be created by Supabase support as it requires auth schema access
-- Contact Supabase support to add this trigger or use a signup webhook instead

COMMENT ON FUNCTION public.sync_auth_user_to_users IS 'Syncs new auth users to the users table to prevent ID mismatches';
