-- EMERGENCY: Complete authentication system cleanup
-- Fixes critical Clerk/Supabase auth inconsistencies causing authentication failures

-- 1. Drop ALL Clerk-dependent policies that still exist
DO $$ 
DECLARE
    pol record;
BEGIN
    -- Find and drop any remaining policies that reference clerk_id
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE definition LIKE '%clerk_id%'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                      pol.policyname, pol.schemaname, pol.tablename);
        RAISE NOTICE 'Dropped Clerk-dependent policy: %.%', pol.tablename, pol.policyname;
    END LOOP;
END $$;

-- 2. Drop Clerk columns if they still exist
ALTER TABLE IF EXISTS users DROP COLUMN IF EXISTS clerk_id CASCADE;
ALTER TABLE IF EXISTS organizations DROP COLUMN IF EXISTS clerk_org_id CASCADE;
ALTER TABLE IF EXISTS workspaces DROP COLUMN IF EXISTS clerk_id CASCADE;

-- 3. Drop Clerk indexes if they exist
DROP INDEX IF EXISTS idx_users_clerk_id;
DROP INDEX IF EXISTS idx_organizations_clerk_org_id;

-- 4. Create/Fix critical RLS policies using ONLY Supabase auth
-- Users table
CREATE POLICY "users_auth_select" ON users 
  FOR SELECT USING (auth.uid() = id);
  
CREATE POLICY "users_auth_update" ON users 
  FOR UPDATE USING (auth.uid() = id);
  
CREATE POLICY "users_auth_insert" ON users 
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Workspaces table  
CREATE POLICY "workspaces_member_select" ON workspaces 
  FOR SELECT USING (
    id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspaces_owner_manage" ON workspaces 
  FOR ALL USING (owner_id = auth.uid());

-- Workspace members table
CREATE POLICY "workspace_members_view" ON workspace_members 
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members wm2
      WHERE wm2.user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_members_admin_manage" ON workspace_members 
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members wm2
      WHERE wm2.user_id = auth.uid() 
      AND wm2.role IN ('owner', 'admin')
    )
  );

-- Integrations table
CREATE POLICY "integrations_user_manage" ON integrations 
  FOR ALL USING (user_id = auth.uid());

-- Workspace accounts table  
CREATE POLICY "workspace_accounts_member_manage" ON workspace_accounts 
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- 5. Fix orphaned workspace data
UPDATE workspaces 
SET owner_id = (
  SELECT id FROM auth.users 
  WHERE email IN ('tl@innovareai.com', 'cl@innovareai.com') 
  LIMIT 1
)
WHERE owner_id IS NULL;

-- 6. Create emergency admin access for troubleshooting
CREATE POLICY "emergency_admin_access_workspaces" ON workspaces 
  FOR ALL USING (
    auth.email() IN ('tl@innovareai.com', 'cl@innovareai.com')
  );

CREATE POLICY "emergency_admin_access_workspace_members" ON workspace_members 
  FOR ALL USING (
    auth.email() IN ('tl@innovareai.com', 'cl@innovareai.com')  
  );

CREATE POLICY "emergency_admin_access_users" ON users 
  FOR ALL USING (
    auth.email() IN ('tl@innovareai.com', 'cl@innovareai.com')
  );

-- 7. Service role policies for API operations
CREATE POLICY "service_role_full_access_workspaces" ON workspaces 
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_full_access_workspace_members" ON workspace_members 
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_full_access_users" ON users 
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_full_access_integrations" ON integrations 
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_full_access_workspace_accounts" ON workspace_accounts 
  FOR ALL USING (auth.role() = 'service_role');

-- 8. Ensure auto-user creation trigger exists and works
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 9. Clean up any remaining test data
DELETE FROM workspaces WHERE name LIKE '%test%' OR name LIKE '%example%';
DELETE FROM users WHERE email LIKE '%test@example.com%';

-- Final verification
DO $$
DECLARE
    clerk_references integer;
BEGIN
    -- Count remaining Clerk references
    SELECT COUNT(*) INTO clerk_references
    FROM pg_policies 
    WHERE definition LIKE '%clerk_id%';
    
    IF clerk_references > 0 THEN
        RAISE WARNING 'Still found % Clerk references in policies!', clerk_references;
    ELSE
        RAISE NOTICE 'SUCCESS: All Clerk references removed from database';
    END IF;
END $$;

COMMENT ON MIGRATION IS 'EMERGENCY: Complete Clerk removal and authentication system cleanup to fix critical auth failures';