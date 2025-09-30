-- Fix tenant isolation for campaign and n8n orchestration tables
-- Applies scoped RLS policies and secures helper views

BEGIN;

-- =====================================================================
-- Campaign tables: scope access to workspace membership
-- =====================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'campaigns'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Enable all operations for service role" ON campaigns';
    EXECUTE 'DROP POLICY IF EXISTS "campaigns_user_access" ON campaigns';
    EXECUTE 'CREATE POLICY "Authenticated members manage campaigns" ON campaigns FOR ALL TO authenticated USING (workspace_id IS NOT NULL AND workspace_id::uuid IN (SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid())) WITH CHECK (workspace_id IS NOT NULL AND workspace_id::uuid IN (SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()))';
    EXECUTE 'CREATE POLICY "Service role manages campaigns" ON campaigns FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'campaign_prospects'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Enable all operations for service role" ON campaign_prospects';
    EXECUTE 'DROP POLICY IF EXISTS "campaign_prospects_user_access" ON campaign_prospects';
    EXECUTE 'CREATE POLICY "Authenticated members manage campaign prospects" ON campaign_prospects FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM campaigns c JOIN workspace_members wm ON wm.workspace_id = c.workspace_id::uuid WHERE c.id = campaign_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM campaigns c JOIN workspace_members wm ON wm.workspace_id = c.workspace_id::uuid WHERE c.id = campaign_id AND wm.user_id = auth.uid()))';
    EXECUTE 'CREATE POLICY "Service role manages campaign prospects" ON campaign_prospects FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END
$$;

-- =====================================================================
-- n8n orchestration tables: scope to workspace membership
-- =====================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'workspace_n8n_workflows'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Enable all access for workspace workflows" ON workspace_n8n_workflows';
    EXECUTE 'CREATE POLICY "Members manage workspace workflows" ON workspace_n8n_workflows FOR ALL TO authenticated USING (workspace_id IS NOT NULL AND workspace_id::uuid IN (SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid())) WITH CHECK (workspace_id IS NOT NULL AND workspace_id::uuid IN (SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()))';
    EXECUTE 'CREATE POLICY "Service role manages workspace workflows" ON workspace_n8n_workflows FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'n8n_campaign_executions'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Enable all access for campaign executions" ON n8n_campaign_executions';
    EXECUTE 'CREATE POLICY "Members manage n8n executions" ON n8n_campaign_executions FOR ALL TO authenticated USING (workspace_id IS NOT NULL AND workspace_id::uuid IN (SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid())) WITH CHECK (workspace_id IS NOT NULL AND workspace_id::uuid IN (SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()))';
    EXECUTE 'CREATE POLICY "Service role manages n8n executions" ON n8n_campaign_executions FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'workflow_deployment_history'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Enable all access for deployment history" ON workflow_deployment_history';
    EXECUTE 'CREATE POLICY "Members manage deployment history" ON workflow_deployment_history FOR ALL TO authenticated USING (workspace_id IS NOT NULL AND workspace_id::uuid IN (SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid())) WITH CHECK (workspace_id IS NOT NULL AND workspace_id::uuid IN (SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()))';
    EXECUTE 'CREATE POLICY "Service role manages deployment history" ON workflow_deployment_history FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'workspace_workflow_credentials'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Enable all access for workflow credentials" ON workspace_workflow_credentials';
    EXECUTE 'CREATE POLICY "Members manage workflow credentials" ON workspace_workflow_credentials FOR ALL TO authenticated USING (workspace_id IS NOT NULL AND workspace_id::uuid IN (SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid())) WITH CHECK (workspace_id IS NOT NULL AND workspace_id::uuid IN (SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()))';
    EXECUTE 'CREATE POLICY "Service role manages workflow credentials" ON workspace_workflow_credentials FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END
$$;

-- =====================================================================
-- Secure campaign_linkedin_accounts view (invoke-time privileges)
-- =====================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname = 'public'
      AND viewname = 'campaign_linkedin_accounts'
  ) THEN
    EXECUTE 'ALTER VIEW public.campaign_linkedin_accounts SET (security_invoker = true)';
  END IF;
END
$$;

COMMIT;
