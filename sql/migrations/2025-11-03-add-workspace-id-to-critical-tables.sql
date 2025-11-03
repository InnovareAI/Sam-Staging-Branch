-- =====================================================================
-- MIGRATION: Add workspace_id to Critical User-Generated Content Tables
-- Date: 2025-11-03
-- Priority: HIGH
-- Purpose: Add workspace isolation to tables containing user data
-- =====================================================================

-- IMPORTANT: Run this script in a transaction and verify results before committing
-- BEGIN;

-- =====================================================================
-- SECTION 1: Campaign Schedules
-- Parent: campaigns (has workspace_id)
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaign_schedules' AND column_name = 'workspace_id'
  ) THEN
    -- Add column
    ALTER TABLE campaign_schedules ADD COLUMN workspace_id UUID;

    -- Backfill from campaigns
    UPDATE campaign_schedules cs
    SET workspace_id = c.workspace_id
    FROM campaigns c
    WHERE cs.campaign_id = c.id
      AND cs.workspace_id IS NULL;

    -- Create index
    CREATE INDEX idx_campaign_schedules_workspace_id ON campaign_schedules(workspace_id);

    -- Add NOT NULL constraint
    ALTER TABLE campaign_schedules ALTER COLUMN workspace_id SET NOT NULL;

    -- Add foreign key
    ALTER TABLE campaign_schedules
    ADD CONSTRAINT fk_campaign_schedules_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

    -- Enable RLS (already enabled)
    -- Create workspace isolation policy
    DROP POLICY IF EXISTS workspace_isolation_campaign_schedules ON campaign_schedules;
    CREATE POLICY workspace_isolation_campaign_schedules ON campaign_schedules
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

    RAISE NOTICE 'campaign_schedules: workspace_id added and configured';
  ELSE
    RAISE NOTICE 'campaign_schedules: workspace_id already exists';
  END IF;
END $$;

-- =====================================================================
-- SECTION 2: SAM Conversation Messages
-- Parent: sam_conversation_threads (has workspace_id)
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sam_conversation_messages' AND column_name = 'workspace_id'
  ) THEN
    -- Add column
    ALTER TABLE sam_conversation_messages ADD COLUMN workspace_id UUID;

    -- Backfill from sam_conversation_threads
    UPDATE sam_conversation_messages scm
    SET workspace_id = sct.workspace_id
    FROM sam_conversation_threads sct
    WHERE scm.thread_id = sct.id
      AND scm.workspace_id IS NULL;

    -- Create index
    CREATE INDEX idx_sam_conversation_messages_workspace_id ON sam_conversation_messages(workspace_id);

    -- Add NOT NULL constraint
    ALTER TABLE sam_conversation_messages ALTER COLUMN workspace_id SET NOT NULL;

    -- Add foreign key
    ALTER TABLE sam_conversation_messages
    ADD CONSTRAINT fk_sam_conversation_messages_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

    -- Enable RLS (already enabled)
    -- Create workspace isolation policy
    DROP POLICY IF EXISTS workspace_isolation_sam_conversation_messages ON sam_conversation_messages;
    CREATE POLICY workspace_isolation_sam_conversation_messages ON sam_conversation_messages
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

    RAISE NOTICE 'sam_conversation_messages: workspace_id added and configured';
  ELSE
    RAISE NOTICE 'sam_conversation_messages: workspace_id already exists';
  END IF;
END $$;

-- =====================================================================
-- SECTION 3: SAM Funnel Messages
-- Parent: campaigns (has workspace_id)
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sam_funnel_messages' AND column_name = 'workspace_id'
  ) THEN
    -- Add column
    ALTER TABLE sam_funnel_messages ADD COLUMN workspace_id UUID;

    -- Backfill from campaigns
    UPDATE sam_funnel_messages sfm
    SET workspace_id = c.workspace_id
    FROM campaigns c
    WHERE sfm.campaign_id = c.id
      AND sfm.workspace_id IS NULL;

    -- Create index
    CREATE INDEX idx_sam_funnel_messages_workspace_id ON sam_funnel_messages(workspace_id);

    -- Add NOT NULL constraint
    ALTER TABLE sam_funnel_messages ALTER COLUMN workspace_id SET NOT NULL;

    -- Add foreign key
    ALTER TABLE sam_funnel_messages
    ADD CONSTRAINT fk_sam_funnel_messages_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

    -- Enable RLS (already enabled)
    -- Create workspace isolation policy
    DROP POLICY IF EXISTS workspace_isolation_sam_funnel_messages ON sam_funnel_messages;
    CREATE POLICY workspace_isolation_sam_funnel_messages ON sam_funnel_messages
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

    RAISE NOTICE 'sam_funnel_messages: workspace_id added and configured';
  ELSE
    RAISE NOTICE 'sam_funnel_messages: workspace_id already exists';
  END IF;
END $$;

-- =====================================================================
-- SECTION 4: SAM Funnel Responses
-- Parent: sam_funnel_executions (has workspace_id)
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sam_funnel_responses' AND column_name = 'workspace_id'
  ) THEN
    -- Add column
    ALTER TABLE sam_funnel_responses ADD COLUMN workspace_id UUID;

    -- Backfill from sam_funnel_executions
    UPDATE sam_funnel_responses sfr
    SET workspace_id = sfe.workspace_id
    FROM sam_funnel_executions sfe
    WHERE sfr.execution_id = sfe.id
      AND sfr.workspace_id IS NULL;

    -- Create index
    CREATE INDEX idx_sam_funnel_responses_workspace_id ON sam_funnel_responses(workspace_id);

    -- Add NOT NULL constraint
    ALTER TABLE sam_funnel_responses ALTER COLUMN workspace_id SET NOT NULL;

    -- Add foreign key
    ALTER TABLE sam_funnel_responses
    ADD CONSTRAINT fk_sam_funnel_responses_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

    -- Enable RLS (already enabled)
    -- Create workspace isolation policy
    DROP POLICY IF EXISTS workspace_isolation_sam_funnel_responses ON sam_funnel_responses;
    CREATE POLICY workspace_isolation_sam_funnel_responses ON sam_funnel_responses
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

    RAISE NOTICE 'sam_funnel_responses: workspace_id added and configured';
  ELSE
    RAISE NOTICE 'sam_funnel_responses: workspace_id already exists';
  END IF;
END $$;

-- =====================================================================
-- SECTION 5: SAM Funnel Analytics
-- Parent: sam_funnel_executions (has workspace_id)
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sam_funnel_analytics' AND column_name = 'workspace_id'
  ) THEN
    -- Add column
    ALTER TABLE sam_funnel_analytics ADD COLUMN workspace_id UUID;

    -- Backfill from sam_funnel_executions
    UPDATE sam_funnel_analytics sfa
    SET workspace_id = sfe.workspace_id
    FROM sam_funnel_executions sfe
    WHERE sfa.execution_id = sfe.id
      AND sfa.workspace_id IS NULL;

    -- Create index
    CREATE INDEX idx_sam_funnel_analytics_workspace_id ON sam_funnel_analytics(workspace_id);

    -- Add NOT NULL constraint
    ALTER TABLE sam_funnel_analytics ALTER COLUMN workspace_id SET NOT NULL;

    -- Add foreign key
    ALTER TABLE sam_funnel_analytics
    ADD CONSTRAINT fk_sam_funnel_analytics_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

    -- Enable RLS (already enabled)
    -- Create workspace isolation policy
    DROP POLICY IF EXISTS workspace_isolation_sam_funnel_analytics ON sam_funnel_analytics;
    CREATE POLICY workspace_isolation_sam_funnel_analytics ON sam_funnel_analytics
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

    RAISE NOTICE 'sam_funnel_analytics: workspace_id added and configured';
  ELSE
    RAISE NOTICE 'sam_funnel_analytics: workspace_id already exists';
  END IF;
END $$;

-- =====================================================================
-- SECTION 6: Prospect Approval Decisions
-- Parent: prospect_approval_sessions (has workspace_id)
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prospect_approval_decisions' AND column_name = 'workspace_id'
  ) THEN
    -- Add column
    ALTER TABLE prospect_approval_decisions ADD COLUMN workspace_id UUID;

    -- Backfill from prospect_approval_sessions
    UPDATE prospect_approval_decisions pad
    SET workspace_id = pas.workspace_id
    FROM prospect_approval_sessions pas
    WHERE pad.session_id = pas.id
      AND pad.workspace_id IS NULL;

    -- Create index
    CREATE INDEX idx_prospect_approval_decisions_workspace_id ON prospect_approval_decisions(workspace_id);

    -- Add NOT NULL constraint
    ALTER TABLE prospect_approval_decisions ALTER COLUMN workspace_id SET NOT NULL;

    -- Add foreign key
    ALTER TABLE prospect_approval_decisions
    ADD CONSTRAINT fk_prospect_approval_decisions_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

    -- Enable RLS (already enabled)
    -- Create workspace isolation policy
    DROP POLICY IF EXISTS workspace_isolation_prospect_approval_decisions ON prospect_approval_decisions;
    CREATE POLICY workspace_isolation_prospect_approval_decisions ON prospect_approval_decisions
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

    RAISE NOTICE 'prospect_approval_decisions: workspace_id added and configured';
  ELSE
    RAISE NOTICE 'prospect_approval_decisions: workspace_id already exists';
  END IF;
END $$;

-- =====================================================================
-- SECTION 7: Prospect Learning Logs
-- Parent: prospect_approval_sessions (has workspace_id)
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prospect_learning_logs' AND column_name = 'workspace_id'
  ) THEN
    -- Add column
    ALTER TABLE prospect_learning_logs ADD COLUMN workspace_id UUID;

    -- Backfill from prospect_approval_sessions
    UPDATE prospect_learning_logs pll
    SET workspace_id = pas.workspace_id
    FROM prospect_approval_sessions pas
    WHERE pll.session_id = pas.id
      AND pll.workspace_id IS NULL;

    -- Create index
    CREATE INDEX idx_prospect_learning_logs_workspace_id ON prospect_learning_logs(workspace_id);

    -- Add NOT NULL constraint
    ALTER TABLE prospect_learning_logs ALTER COLUMN workspace_id SET NOT NULL;

    -- Add foreign key
    ALTER TABLE prospect_learning_logs
    ADD CONSTRAINT fk_prospect_learning_logs_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

    -- Enable RLS (already enabled)
    -- Create workspace isolation policy
    DROP POLICY IF EXISTS workspace_isolation_prospect_learning_logs ON prospect_learning_logs;
    CREATE POLICY workspace_isolation_prospect_learning_logs ON prospect_learning_logs
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

    RAISE NOTICE 'prospect_learning_logs: workspace_id added and configured';
  ELSE
    RAISE NOTICE 'prospect_learning_logs: workspace_id already exists';
  END IF;
END $$;

-- =====================================================================
-- SECTION 8: Prospect Search Results
-- Parent: prospect_search_jobs (has workspace_id)
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prospect_search_results' AND column_name = 'workspace_id'
  ) THEN
    -- Add column
    ALTER TABLE prospect_search_results ADD COLUMN workspace_id UUID;

    -- Backfill from prospect_search_jobs
    UPDATE prospect_search_results psr
    SET workspace_id = psj.workspace_id
    FROM prospect_search_jobs psj
    WHERE psr.job_id = psj.id
      AND psr.workspace_id IS NULL;

    -- Create index
    CREATE INDEX idx_prospect_search_results_workspace_id ON prospect_search_results(workspace_id);

    -- Add NOT NULL constraint
    ALTER TABLE prospect_search_results ALTER COLUMN workspace_id SET NOT NULL;

    -- Add foreign key
    ALTER TABLE prospect_search_results
    ADD CONSTRAINT fk_prospect_search_results_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

    -- Enable RLS (already enabled)
    -- Create workspace isolation policy
    DROP POLICY IF EXISTS workspace_isolation_prospect_search_results ON prospect_search_results;
    CREATE POLICY workspace_isolation_prospect_search_results ON prospect_search_results
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

    RAISE NOTICE 'prospect_search_results: workspace_id added and configured';
  ELSE
    RAISE NOTICE 'prospect_search_results: workspace_id already exists';
  END IF;
END $$;

-- =====================================================================
-- VERIFICATION QUERIES
-- =====================================================================

-- Check all tables have workspace_id and correct counts
DO $$
DECLARE
    table_rec RECORD;
    ws_count INTEGER;
    total_count INTEGER;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICATION RESULTS';
    RAISE NOTICE '========================================';

    FOR table_rec IN
        SELECT unnest(ARRAY[
            'campaign_schedules',
            'sam_conversation_messages',
            'sam_funnel_messages',
            'sam_funnel_responses',
            'sam_funnel_analytics',
            'prospect_approval_decisions',
            'prospect_learning_logs',
            'prospect_search_results'
        ]) AS table_name
    LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I WHERE workspace_id IS NOT NULL', table_rec.table_name) INTO ws_count;
        EXECUTE format('SELECT COUNT(*) FROM %I', table_rec.table_name) INTO total_count;
        RAISE NOTICE '% : % / % rows have workspace_id', table_rec.table_name, ws_count, total_count;
    END LOOP;
END $$;

-- COMMIT;
-- Or ROLLBACK; if verification fails
