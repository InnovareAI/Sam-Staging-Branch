-- COMPREHENSIVE CLERK REMOVAL: Fix ALL migrations with clerk_id references
-- This replaces ALL clerk_id references with proper Supabase auth.uid() patterns

-- 1. Drop ALL existing policies that reference clerk_id
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

-- 4. Fix ALL functions that reference clerk_id patterns
-- Replace (SELECT id FROM users WHERE clerk_id = auth.uid()::text) with auth.uid()

-- Drop and recreate functions without clerk_id dependencies
DROP FUNCTION IF EXISTS bulk_upload_prospects CASCADE;
DROP FUNCTION IF EXISTS create_campaign_with_prospects CASCADE;
DROP FUNCTION IF EXISTS share_workspace_data CASCADE;
DROP FUNCTION IF EXISTS get_workspace_shared_data CASCADE;
DROP FUNCTION IF EXISTS create_data_share_invitation CASCADE;
DROP FUNCTION IF EXISTS accept_data_share_invitation CASCADE;
DROP FUNCTION IF EXISTS send_campaign_email CASCADE;
DROP FUNCTION IF EXISTS get_email_sending_history CASCADE;
DROP FUNCTION IF EXISTS create_sam_override CASCADE;
DROP FUNCTION IF EXISTS get_user_sam_overrides CASCADE;
DROP FUNCTION IF EXISTS apply_sam_override CASCADE;

-- 5. Create/Fix critical RLS policies using ONLY Supabase auth
-- Users table (should already exist from emergency cleanup)
DROP POLICY IF EXISTS "users_auth_select" ON users;
DROP POLICY IF EXISTS "users_auth_update" ON users;  
DROP POLICY IF EXISTS "users_auth_insert" ON users;

CREATE POLICY "users_auth_select" ON users 
  FOR SELECT USING (auth.uid() = id);
  
CREATE POLICY "users_auth_update" ON users 
  FOR UPDATE USING (auth.uid() = id);
  
CREATE POLICY "users_auth_insert" ON users 
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Workspaces table
DROP POLICY IF EXISTS "workspaces_member_select" ON workspaces;
DROP POLICY IF EXISTS "workspaces_owner_manage" ON workspaces;

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
DROP POLICY IF EXISTS "workspace_members_view" ON workspace_members;
DROP POLICY IF EXISTS "workspace_members_admin_manage" ON workspace_members;

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

-- Campaign tracking tables
DROP POLICY IF EXISTS "campaigns_user_access" ON campaigns;
DROP POLICY IF EXISTS "campaign_prospects_user_access" ON campaign_prospects;
DROP POLICY IF EXISTS "campaign_executions_user_access" ON campaign_executions;
DROP POLICY IF EXISTS "campaign_analytics_user_access" ON campaign_analytics;

CREATE POLICY "campaigns_user_access" ON campaigns 
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "campaign_prospects_user_access" ON campaign_prospects 
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "campaign_executions_user_access" ON campaign_executions 
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "campaign_analytics_user_access" ON campaign_analytics 
  FOR ALL USING (user_id = auth.uid());

-- Workspace accounts table
DROP POLICY IF EXISTS "workspace_accounts_user_access" ON workspace_accounts;
DROP POLICY IF EXISTS "integrations_user_access" ON integrations;
DROP POLICY IF EXISTS "account_assignments_user_access" ON account_assignments;

CREATE POLICY "workspace_accounts_user_access" ON workspace_accounts 
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "integrations_user_access" ON integrations 
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "account_assignments_user_access" ON account_assignments 
  FOR ALL USING (user_id = auth.uid());

-- Bulk prospect upload tables
DROP POLICY IF EXISTS "bulk_upload_sessions_user_access" ON bulk_upload_sessions;
DROP POLICY IF EXISTS "prospect_upload_results_user_access" ON prospect_upload_results;

CREATE POLICY "bulk_upload_sessions_user_access" ON bulk_upload_sessions 
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "prospect_upload_results_user_access" ON prospect_upload_results 
  FOR ALL USING (user_id = auth.uid());

-- LinkedIn contact tables
DROP POLICY IF EXISTS "linkedin_contacts_user_access" ON linkedin_contacts;
DROP POLICY IF EXISTS "linkedin_discovery_jobs_user_access" ON linkedin_discovery_jobs;

CREATE POLICY "linkedin_contacts_user_access" ON linkedin_contacts 
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "linkedin_discovery_jobs_user_access" ON linkedin_discovery_jobs 
  FOR ALL USING (user_id = auth.uid());

-- LinkedIn proxy assignments
DROP POLICY IF EXISTS "linkedin_proxy_assignments_user_access" ON linkedin_proxy_assignments;

CREATE POLICY "linkedin_proxy_assignments_user_access" ON linkedin_proxy_assignments 
  FOR ALL USING (user_id = auth.uid());

-- Data sharing tables (if they exist)
DROP POLICY IF EXISTS "workspace_data_sharing_access" ON workspace_data_sharing;
DROP POLICY IF EXISTS "workspace_data_usage_access" ON workspace_data_usage;
DROP POLICY IF EXISTS "data_usage_logs_access" ON data_usage_logs;

CREATE POLICY "workspace_data_sharing_access" ON workspace_data_sharing 
  FOR ALL USING (contributed_by = auth.uid());

CREATE POLICY "workspace_data_usage_access" ON workspace_data_usage 
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "data_usage_logs_access" ON data_usage_logs 
  FOR ALL USING (used_by = auth.uid());

-- Selective team sharing tables (if they exist)  
DROP POLICY IF EXISTS "team_data_shares_access" ON team_data_shares;
DROP POLICY IF EXISTS "team_share_invitations_access" ON team_share_invitations;

CREATE POLICY "team_data_shares_access" ON team_data_shares 
  FOR ALL USING (data_owner_id = auth.uid() OR share_with_user_id = auth.uid());

CREATE POLICY "team_share_invitations_access" ON team_share_invitations 
  FOR ALL USING (invited_by = auth.uid() OR invited_user = auth.uid());

-- Email sending tables (if they exist)
DROP POLICY IF EXISTS "email_sending_history_access" ON email_sending_history;
DROP POLICY IF EXISTS "email_templates_access" ON email_templates;

CREATE POLICY "email_sending_history_access" ON email_sending_history 
  FOR ALL USING (sent_by = auth.uid());

CREATE POLICY "email_templates_access" ON email_templates 
  FOR ALL USING (created_by = auth.uid());

-- SAM override tables (if they exist)
DROP POLICY IF EXISTS "sam_overrides_access" ON sam_overrides;

CREATE POLICY "sam_overrides_access" ON sam_overrides 
  FOR ALL USING (user_id = auth.uid());

-- 6. Emergency admin access for troubleshooting (from emergency cleanup)
CREATE POLICY "emergency_admin_access_all_tables" ON users 
  FOR ALL USING (
    auth.email() IN ('tl@innovareai.com', 'cl@innovareai.com')
  );

-- 7. Service role policies for API operations (from emergency cleanup)
CREATE POLICY "service_role_full_access_all" ON users 
  FOR ALL USING (auth.role() = 'service_role');

-- Apply service role policies to all major tables
DO $$
DECLARE
    table_name text;
    tables_to_update text[] := ARRAY[
        'workspaces', 'workspace_members', 'campaigns', 'campaign_prospects',
        'workspace_accounts', 'integrations', 'linkedin_contacts',
        'bulk_upload_sessions', 'prospect_upload_results'
    ];
BEGIN
    FOREACH table_name IN ARRAY tables_to_update
    LOOP
        BEGIN
            EXECUTE format('CREATE POLICY "service_role_full_access_%s" ON %I FOR ALL USING (auth.role() = ''service_role'')', table_name, table_name);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not create service role policy for table %: %', table_name, SQLERRM;
        END;
    END LOOP;
END $$;

-- 8. Ensure auto-user creation trigger exists and works (from emergency cleanup)
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

COMMENT ON MIGRATION IS 'COMPREHENSIVE: Complete removal of ALL Clerk references and replacement with Supabase auth patterns';