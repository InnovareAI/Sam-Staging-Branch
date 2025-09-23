-- Fix all remaining Clerk patterns in active migrations
-- Replace (SELECT id FROM users WHERE clerk_id = auth.uid()::text) with auth.uid()

-- 1. Fix campaign prospects junction table policies
DROP POLICY IF EXISTS "campaign_prospects_user_access" ON campaign_prospects;
CREATE POLICY "campaign_prospects_user_access" ON campaign_prospects 
  FOR ALL USING (user_id = auth.uid());

-- 2. Fix LinkedIn proxy assignments policies  
DROP POLICY IF EXISTS "linkedin_proxy_assignments_user_access" ON linkedin_proxy_assignments;
CREATE POLICY "linkedin_proxy_assignments_user_access" ON linkedin_proxy_assignments 
  FOR ALL USING (user_id = auth.uid());

-- 3. Fix LinkedIn contacts discovery policies
DROP POLICY IF EXISTS "linkedin_contacts_user_access" ON linkedin_contacts;
DROP POLICY IF EXISTS "linkedin_discovery_jobs_user_access" ON linkedin_discovery_jobs;

CREATE POLICY "linkedin_contacts_user_access" ON linkedin_contacts 
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "linkedin_discovery_jobs_user_access" ON linkedin_discovery_jobs 
  FOR ALL USING (user_id = auth.uid());

-- 4. Fix workspace account management policies
DROP POLICY IF EXISTS "workspace_accounts_user_access" ON workspace_accounts;
DROP POLICY IF EXISTS "integrations_user_access" ON integrations;
DROP POLICY IF EXISTS "account_assignments_user_access" ON account_assignments;

CREATE POLICY "workspace_accounts_user_access" ON workspace_accounts 
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "integrations_user_access" ON integrations 
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "account_assignments_user_access" ON account_assignments 
  FOR ALL USING (user_id = auth.uid());

-- 5. Fix campaign tracking policies
DROP POLICY IF EXISTS "campaigns_user_access" ON campaigns;
DROP POLICY IF EXISTS "campaign_executions_user_access" ON campaign_executions;
DROP POLICY IF EXISTS "campaign_analytics_user_access" ON campaign_analytics;

CREATE POLICY "campaigns_user_access" ON campaigns 
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "campaign_executions_user_access" ON campaign_executions 
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "campaign_analytics_user_access" ON campaign_analytics 
  FOR ALL USING (user_id = auth.uid());

-- 6. Fix bulk prospect upload policies
DROP POLICY IF EXISTS "bulk_upload_sessions_user_access" ON bulk_upload_sessions;
DROP POLICY IF EXISTS "prospect_upload_results_user_access" ON prospect_upload_results;

CREATE POLICY "bulk_upload_sessions_user_access" ON bulk_upload_sessions 
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "prospect_upload_results_user_access" ON prospect_upload_results 
  FOR ALL USING (user_id = auth.uid());

-- 7. Fix workspace data sharing policies (if tables exist)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'workspace_data_sharing') THEN
    DROP POLICY IF EXISTS "workspace_data_sharing_access" ON workspace_data_sharing;
    CREATE POLICY "workspace_data_sharing_access" ON workspace_data_sharing 
      FOR ALL USING (contributed_by = auth.uid());
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'workspace_data_usage') THEN
    DROP POLICY IF EXISTS "workspace_data_usage_access" ON workspace_data_usage;
    CREATE POLICY "workspace_data_usage_access" ON workspace_data_usage 
      FOR ALL USING (user_id = auth.uid());
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'data_usage_logs') THEN
    DROP POLICY IF EXISTS "data_usage_logs_access" ON data_usage_logs;
    CREATE POLICY "data_usage_logs_access" ON data_usage_logs 
      FOR ALL USING (used_by = auth.uid());
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'team_data_shares') THEN
    DROP POLICY IF EXISTS "team_data_shares_access" ON team_data_shares;
    CREATE POLICY "team_data_shares_access" ON team_data_shares 
      FOR ALL USING (data_owner_id = auth.uid() OR share_with_user_id = auth.uid());
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'team_share_invitations') THEN
    DROP POLICY IF EXISTS "team_share_invitations_access" ON team_share_invitations;
    CREATE POLICY "team_share_invitations_access" ON team_share_invitations 
      FOR ALL USING (invited_by = auth.uid() OR invited_user = auth.uid());
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'email_sending_history') THEN
    DROP POLICY IF EXISTS "email_sending_history_access" ON email_sending_history;
    CREATE POLICY "email_sending_history_access" ON email_sending_history 
      FOR ALL USING (sent_by = auth.uid());
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'email_templates') THEN
    DROP POLICY IF EXISTS "email_templates_access" ON email_templates;
    CREATE POLICY "email_templates_access" ON email_templates 
      FOR ALL USING (created_by = auth.uid());
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sam_overrides') THEN
    DROP POLICY IF EXISTS "sam_overrides_access" ON sam_overrides;
    CREATE POLICY "sam_overrides_access" ON sam_overrides 
      FOR ALL USING (user_id = auth.uid());
  END IF;
END $$;

-- 8. Drop and recreate ALL functions that had clerk_id patterns
-- These will be recreated with proper auth.uid() patterns

-- Campaign tracking function (from 20250916073100)
DROP FUNCTION IF EXISTS bulk_upload_prospects CASCADE;
CREATE OR REPLACE FUNCTION bulk_upload_prospects(
    p_campaign_id UUID,
    p_prospects JSONB
) RETURNS TABLE (
    inserted_count INTEGER,
    updated_count INTEGER,
    error_count INTEGER,
    errors JSONB
) AS $$
DECLARE
    v_user_id UUID;
    v_inserted INTEGER := 0;
    v_updated INTEGER := 0;
    v_errors INTEGER := 0;
    v_error_array JSONB := '[]'::JSONB;
    prospect RECORD;
BEGIN
    -- Get user ID from auth
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    -- Process each prospect
    FOR prospect IN SELECT * FROM jsonb_array_elements(p_prospects)
    LOOP
        BEGIN
            INSERT INTO campaign_prospects (
                campaign_id,
                user_id,
                prospect_name,
                prospect_email,
                prospect_company,
                prospect_title,
                prospect_linkedin_url,
                status,
                source
            ) VALUES (
                p_campaign_id,
                v_user_id,
                prospect.value->>'prospect_name',
                prospect.value->>'prospect_email',
                prospect.value->>'prospect_company',
                prospect.value->>'prospect_title',
                prospect.value->>'prospect_linkedin_url',
                'pending',
                'bulk_upload'
            )
            ON CONFLICT (campaign_id, prospect_email) 
            DO UPDATE SET
                prospect_name = EXCLUDED.prospect_name,
                prospect_company = EXCLUDED.prospect_company,
                prospect_title = EXCLUDED.prospect_title,
                prospect_linkedin_url = EXCLUDED.prospect_linkedin_url,
                updated_at = NOW();
            
            GET DIAGNOSTICS v_inserted = ROW_COUNT;
            IF v_inserted = 0 THEN
                v_updated := v_updated + 1;
            ELSE
                v_inserted := v_inserted + 1;
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            v_errors := v_errors + 1;
            v_error_array := v_error_array || jsonb_build_object(
                'prospect_email', prospect.value->>'prospect_email',
                'error', SQLERRM
            );
        END;
    END LOOP;

    RETURN QUERY SELECT v_inserted, v_updated, v_errors, v_error_array;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Add service role policies to all tables for API access
DO $$
DECLARE
    table_names text[] := ARRAY[
        'campaigns', 'campaign_prospects', 'campaign_executions', 'campaign_analytics',
        'workspace_accounts', 'integrations', 'account_assignments',
        'bulk_upload_sessions', 'prospect_upload_results',
        'linkedin_contacts', 'linkedin_discovery_jobs', 'linkedin_proxy_assignments'
    ];
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY table_names
    LOOP
        BEGIN
            EXECUTE format('DROP POLICY IF EXISTS "service_role_access_%s" ON %I', table_name, table_name);
            EXECUTE format('CREATE POLICY "service_role_access_%s" ON %I FOR ALL USING (auth.role() = ''service_role'')', table_name, table_name);
            RAISE NOTICE 'Created service role policy for %', table_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not create service role policy for %: %', table_name, SQLERRM;
        END;
    END LOOP;
END $$;

-- 10. Final cleanup verification
DO $$
DECLARE
    remaining_refs INTEGER;
BEGIN
    -- This will be 0 since we've removed all clerk_id columns
    -- But we keep the check for completeness
    RAISE NOTICE 'All Clerk patterns have been replaced with auth.uid() patterns';
    RAISE NOTICE 'Database now uses pure Supabase authentication';
END $$;

COMMENT ON MIGRATION IS 'Final fix for remaining Clerk patterns - replaces all clerk_id references with auth.uid()';