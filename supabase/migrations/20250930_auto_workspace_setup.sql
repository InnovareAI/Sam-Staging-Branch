-- Auto-create workspace and assign to new users on signup
-- This ensures every new user has a workspace automatically

-- Step 1: Create function to handle new user workspace setup
CREATE OR REPLACE FUNCTION public.handle_new_user_workspace()
RETURNS TRIGGER AS $$
DECLARE
  new_workspace_id UUID;
  user_email TEXT;
  workspace_slug TEXT;
BEGIN
  -- Get user email from auth.users
  SELECT email INTO user_email FROM auth.users WHERE id = NEW.id;
  
  -- Generate workspace slug from email (first part before @)
  workspace_slug := LOWER(REGEXP_REPLACE(SPLIT_PART(user_email, '@', 1), '[^a-z0-9]', '-', 'g'));
  
  -- Make slug unique by appending random suffix if needed
  IF EXISTS (SELECT 1 FROM workspaces WHERE slug = workspace_slug) THEN
    workspace_slug := workspace_slug || '-' || SUBSTR(MD5(RANDOM()::TEXT), 1, 6);
  END IF;
  
  -- Create new workspace for the user
  INSERT INTO workspaces (name, slug, owner_id)
  VALUES (
    user_email || '''s Workspace',
    workspace_slug,
    NEW.id
  )
  RETURNING id INTO new_workspace_id;
  
  -- Add user as workspace member with owner role
  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, NEW.id, 'owner');
  
  -- Set this as the user's current workspace
  NEW.current_workspace_id := new_workspace_id;
  
  RAISE NOTICE 'Created workspace % for user %', new_workspace_id, NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Create trigger to run on new user insert
DROP TRIGGER IF EXISTS on_user_created_workspace ON public.users;

CREATE TRIGGER on_user_created_workspace
  BEFORE INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_workspace();

-- Step 3: Backfill existing users without workspaces
DO $$
DECLARE
  user_record RECORD;
  new_workspace_id UUID;
  workspace_slug TEXT;
BEGIN
  FOR user_record IN 
    SELECT u.id, au.email 
    FROM users u
    JOIN auth.users au ON u.id = au.id
    WHERE u.current_workspace_id IS NULL
  LOOP
    -- Generate workspace slug
    workspace_slug := LOWER(REGEXP_REPLACE(SPLIT_PART(user_record.email, '@', 1), '[^a-z0-9]', '-', 'g'));
    
    -- Make unique if needed
    IF EXISTS (SELECT 1 FROM workspaces WHERE slug = workspace_slug) THEN
      workspace_slug := workspace_slug || '-' || SUBSTR(MD5(RANDOM()::TEXT), 1, 6);
    END IF;
    
    -- Create workspace
    INSERT INTO workspaces (name, slug, owner_id)
    VALUES (
      user_record.email || '''s Workspace',
      workspace_slug,
      user_record.id
    )
    RETURNING id INTO new_workspace_id;
    
    -- Add membership
    INSERT INTO workspace_members (workspace_id, user_id, role)
    VALUES (new_workspace_id, user_record.id, 'owner')
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
    
    -- Update user
    UPDATE users 
    SET current_workspace_id = new_workspace_id
    WHERE id = user_record.id;
    
    RAISE NOTICE 'Backfilled workspace % for user %', new_workspace_id, user_record.id;
  END LOOP;
END $$;

-- Step 4: Verify results
SELECT 
  COUNT(*) as total_users,
  COUNT(current_workspace_id) as users_with_workspace,
  COUNT(*) - COUNT(current_workspace_id) as users_without_workspace
FROM users;

COMMENT ON FUNCTION public.handle_new_user_workspace() IS 
'Automatically creates a workspace and assigns it to new users on signup';

COMMENT ON TRIGGER on_user_created_workspace ON public.users IS 
'Ensures every new user gets their own workspace automatically';