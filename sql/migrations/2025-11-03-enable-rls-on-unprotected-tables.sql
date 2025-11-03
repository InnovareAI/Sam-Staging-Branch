-- =====================================================================
-- MIGRATION: Enable RLS on Unprotected Tables
-- Date: 2025-11-03
-- Priority: CRITICAL SECURITY
-- Purpose: Enable Row Level Security on tables that currently lack it
-- =====================================================================

-- IMPORTANT: This is a security-critical migration
-- Verify all policies are correct before deploying to production

-- BEGIN;

-- =====================================================================
-- Tables WITHOUT workspace_id - Need special handling
-- =====================================================================

-- =====================================================================
-- 1. knowledge_base - Enable RLS with workspace isolation
-- =====================================================================

DO $$
BEGIN
  -- Enable RLS
  ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

  -- Create workspace-scoped policy
  DROP POLICY IF EXISTS workspace_isolation_knowledge_base ON knowledge_base;
  CREATE POLICY workspace_isolation_knowledge_base ON knowledge_base
  FOR ALL USING (
      workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = auth.uid()
      )
  );

  RAISE NOTICE 'knowledge_base: RLS enabled with workspace isolation';
END $$;

-- =====================================================================
-- 2. workspace_members - Enable RLS with workspace isolation
-- =====================================================================

DO $$
BEGIN
  -- Enable RLS
  ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

  -- Create workspace-scoped policy
  DROP POLICY IF EXISTS workspace_isolation_workspace_members ON workspace_members;
  CREATE POLICY workspace_isolation_workspace_members ON workspace_members
  FOR ALL USING (
      workspace_id IN (
          SELECT workspace_id FROM workspace_members wm
          WHERE wm.user_id = auth.uid()
      )
  );

  RAISE NOTICE 'workspace_members: RLS enabled with workspace isolation';
END $$;

-- =====================================================================
-- 3. workspaces - Enable RLS
-- Special: Needs workspace_id first, but is the root table
-- =====================================================================

DO $$
BEGIN
  -- Enable RLS
  ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

  -- Create policy for workspace members
  DROP POLICY IF EXISTS workspace_access_workspaces ON workspaces;
  CREATE POLICY workspace_access_workspaces ON workspaces
  FOR ALL USING (
      id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = auth.uid()
      )
  );

  RAISE NOTICE 'workspaces: RLS enabled with member-based access';
END $$;

-- =====================================================================
-- 4. core_funnel_executions - Needs workspace_id first
-- =====================================================================

DO $$
BEGIN
  -- Add workspace_id if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'core_funnel_executions' AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE core_funnel_executions ADD COLUMN workspace_id UUID;

    -- Backfill from campaigns
    UPDATE core_funnel_executions cfe
    SET workspace_id = c.workspace_id
    FROM campaigns c
    WHERE cfe.campaign_id = c.id
      AND cfe.workspace_id IS NULL;

    -- Create index
    CREATE INDEX idx_core_funnel_executions_workspace_id ON core_funnel_executions(workspace_id);

    -- Add NOT NULL constraint (only if all rows have workspace_id)
    IF (SELECT COUNT(*) FROM core_funnel_executions WHERE workspace_id IS NULL) = 0 THEN
      ALTER TABLE core_funnel_executions ALTER COLUMN workspace_id SET NOT NULL;
    END IF;

    -- Add foreign key
    ALTER TABLE core_funnel_executions
    ADD CONSTRAINT fk_core_funnel_executions_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
  END IF;

  -- Enable RLS
  ALTER TABLE core_funnel_executions ENABLE ROW LEVEL SECURITY;

  -- Create workspace isolation policy
  DROP POLICY IF EXISTS workspace_isolation_core_funnel_executions ON core_funnel_executions;
  CREATE POLICY workspace_isolation_core_funnel_executions ON core_funnel_executions
  FOR ALL USING (
      workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = auth.uid()
      )
  );

  RAISE NOTICE 'core_funnel_executions: workspace_id added, RLS enabled';
END $$;

-- =====================================================================
-- 5. core_funnel_templates - Needs workspace_id first
-- =====================================================================

DO $$
BEGIN
  -- Add workspace_id if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'core_funnel_templates' AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE core_funnel_templates ADD COLUMN workspace_id UUID;

    -- For templates, we need to determine which workspace owns them
    -- Option 1: Assign to all workspaces (global templates)
    -- Option 2: Find first usage and assign to that workspace
    -- Using Option 2 - find from core_funnel_executions
    UPDATE core_funnel_templates cft
    SET workspace_id = (
        SELECT c.workspace_id
        FROM core_funnel_executions cfe
        JOIN campaigns c ON cfe.campaign_id = c.id
        WHERE cfe.template_id = cft.id
        LIMIT 1
    )
    WHERE cft.workspace_id IS NULL;

    -- For remaining templates without executions, assign to first workspace
    UPDATE core_funnel_templates
    SET workspace_id = (SELECT id FROM workspaces ORDER BY created_at LIMIT 1)
    WHERE workspace_id IS NULL;

    -- Create index
    CREATE INDEX idx_core_funnel_templates_workspace_id ON core_funnel_templates(workspace_id);

    -- Add NOT NULL constraint
    IF (SELECT COUNT(*) FROM core_funnel_templates WHERE workspace_id IS NULL) = 0 THEN
      ALTER TABLE core_funnel_templates ALTER COLUMN workspace_id SET NOT NULL;
    END IF;

    -- Add foreign key
    ALTER TABLE core_funnel_templates
    ADD CONSTRAINT fk_core_funnel_templates_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
  END IF;

  -- Enable RLS
  ALTER TABLE core_funnel_templates ENABLE ROW LEVEL SECURITY;

  -- Create workspace isolation policy
  DROP POLICY IF EXISTS workspace_isolation_core_funnel_templates ON core_funnel_templates;
  CREATE POLICY workspace_isolation_core_funnel_templates ON core_funnel_templates
  FOR ALL USING (
      workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = auth.uid()
      )
  );

  RAISE NOTICE 'core_funnel_templates: workspace_id added, RLS enabled';
END $$;

-- =====================================================================
-- 6. dynamic_funnel_definitions - Needs workspace_id first
-- =====================================================================

DO $$
BEGIN
  -- Add workspace_id if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dynamic_funnel_definitions' AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE dynamic_funnel_definitions ADD COLUMN workspace_id UUID;

    -- Backfill from campaigns
    UPDATE dynamic_funnel_definitions dfd
    SET workspace_id = c.workspace_id
    FROM campaigns c
    WHERE dfd.campaign_id = c.id
      AND dfd.workspace_id IS NULL;

    -- Create index
    CREATE INDEX idx_dynamic_funnel_definitions_workspace_id ON dynamic_funnel_definitions(workspace_id);

    -- Add NOT NULL constraint
    IF (SELECT COUNT(*) FROM dynamic_funnel_definitions WHERE workspace_id IS NULL) = 0 THEN
      ALTER TABLE dynamic_funnel_definitions ALTER COLUMN workspace_id SET NOT NULL;
    END IF;

    -- Add foreign key
    ALTER TABLE dynamic_funnel_definitions
    ADD CONSTRAINT fk_dynamic_funnel_definitions_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
  END IF;

  -- Enable RLS
  ALTER TABLE dynamic_funnel_definitions ENABLE ROW LEVEL SECURITY;

  -- Create workspace isolation policy
  DROP POLICY IF EXISTS workspace_isolation_dynamic_funnel_definitions ON dynamic_funnel_definitions;
  CREATE POLICY workspace_isolation_dynamic_funnel_definitions ON dynamic_funnel_definitions
  FOR ALL USING (
      workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = auth.uid()
      )
  );

  RAISE NOTICE 'dynamic_funnel_definitions: workspace_id added, RLS enabled';
END $$;

-- =====================================================================
-- 7. dynamic_funnel_executions - Needs workspace_id first
-- =====================================================================

DO $$
BEGIN
  -- Add workspace_id if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dynamic_funnel_executions' AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE dynamic_funnel_executions ADD COLUMN workspace_id UUID;

    -- Backfill from campaigns
    UPDATE dynamic_funnel_executions dfe
    SET workspace_id = c.workspace_id
    FROM campaigns c
    WHERE dfe.campaign_id = c.id
      AND dfe.workspace_id IS NULL;

    -- Create index
    CREATE INDEX idx_dynamic_funnel_executions_workspace_id ON dynamic_funnel_executions(workspace_id);

    -- Add NOT NULL constraint
    IF (SELECT COUNT(*) FROM dynamic_funnel_executions WHERE workspace_id IS NULL) = 0 THEN
      ALTER TABLE dynamic_funnel_executions ALTER COLUMN workspace_id SET NOT NULL;
    END IF;

    -- Add foreign key
    ALTER TABLE dynamic_funnel_executions
    ADD CONSTRAINT fk_dynamic_funnel_executions_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
  END IF;

  -- Enable RLS
  ALTER TABLE dynamic_funnel_executions ENABLE ROW LEVEL SECURITY;

  -- Create workspace isolation policy
  DROP POLICY IF EXISTS workspace_isolation_dynamic_funnel_executions ON dynamic_funnel_executions;
  CREATE POLICY workspace_isolation_dynamic_funnel_executions ON dynamic_funnel_executions
  FOR ALL USING (
      workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = auth.uid()
      )
  );

  RAISE NOTICE 'dynamic_funnel_executions: workspace_id added, RLS enabled';
END $$;

-- =====================================================================
-- 8. dynamic_funnel_steps - Needs workspace_id first
-- =====================================================================

DO $$
BEGIN
  -- Add workspace_id if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dynamic_funnel_steps' AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE dynamic_funnel_steps ADD COLUMN workspace_id UUID;

    -- Backfill from dynamic_funnel_definitions
    UPDATE dynamic_funnel_steps dfs
    SET workspace_id = dfd.workspace_id
    FROM dynamic_funnel_definitions dfd
    WHERE dfs.funnel_id = dfd.id
      AND dfs.workspace_id IS NULL;

    -- Create index
    CREATE INDEX idx_dynamic_funnel_steps_workspace_id ON dynamic_funnel_steps(workspace_id);

    -- Add NOT NULL constraint
    IF (SELECT COUNT(*) FROM dynamic_funnel_steps WHERE workspace_id IS NULL) = 0 THEN
      ALTER TABLE dynamic_funnel_steps ALTER COLUMN workspace_id SET NOT NULL;
    END IF;

    -- Add foreign key
    ALTER TABLE dynamic_funnel_steps
    ADD CONSTRAINT fk_dynamic_funnel_steps_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
  END IF;

  -- Enable RLS
  ALTER TABLE dynamic_funnel_steps ENABLE ROW LEVEL SECURITY;

  -- Create workspace isolation policy
  DROP POLICY IF EXISTS workspace_isolation_dynamic_funnel_steps ON dynamic_funnel_steps;
  CREATE POLICY workspace_isolation_dynamic_funnel_steps ON dynamic_funnel_steps
  FOR ALL USING (
      workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = auth.uid()
      )
  );

  RAISE NOTICE 'dynamic_funnel_steps: workspace_id added, RLS enabled';
END $$;

-- =====================================================================
-- 9. funnel_adaptation_logs - Needs workspace_id first
-- =====================================================================

DO $$
BEGIN
  -- Add workspace_id if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'funnel_adaptation_logs' AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE funnel_adaptation_logs ADD COLUMN workspace_id UUID;

    -- Check for funnel_id or execution_id column to backfill
    -- Assuming there's a funnel_id linking to dynamic_funnel_definitions or executions
    -- Adjust this based on actual schema
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'funnel_adaptation_logs' AND column_name = 'funnel_id'
    ) THEN
        UPDATE funnel_adaptation_logs fal
        SET workspace_id = dfd.workspace_id
        FROM dynamic_funnel_definitions dfd
        WHERE fal.funnel_id = dfd.id
          AND fal.workspace_id IS NULL;
    END IF;

    -- For any remaining nulls, assign to first workspace
    UPDATE funnel_adaptation_logs
    SET workspace_id = (SELECT id FROM workspaces ORDER BY created_at LIMIT 1)
    WHERE workspace_id IS NULL;

    -- Create index
    CREATE INDEX idx_funnel_adaptation_logs_workspace_id ON funnel_adaptation_logs(workspace_id);

    -- Add NOT NULL constraint
    IF (SELECT COUNT(*) FROM funnel_adaptation_logs WHERE workspace_id IS NULL) = 0 THEN
      ALTER TABLE funnel_adaptation_logs ALTER COLUMN workspace_id SET NOT NULL;
    END IF;

    -- Add foreign key
    ALTER TABLE funnel_adaptation_logs
    ADD CONSTRAINT fk_funnel_adaptation_logs_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
  END IF;

  -- Enable RLS
  ALTER TABLE funnel_adaptation_logs ENABLE ROW LEVEL SECURITY;

  -- Create workspace isolation policy
  DROP POLICY IF EXISTS workspace_isolation_funnel_adaptation_logs ON funnel_adaptation_logs;
  CREATE POLICY workspace_isolation_funnel_adaptation_logs ON funnel_adaptation_logs
  FOR ALL USING (
      workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = auth.uid()
      )
  );

  RAISE NOTICE 'funnel_adaptation_logs: workspace_id added, RLS enabled';
END $$;

-- =====================================================================
-- 10. funnel_performance_metrics - Needs workspace_id first
-- =====================================================================

DO $$
BEGIN
  -- Add workspace_id if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'funnel_performance_metrics' AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE funnel_performance_metrics ADD COLUMN workspace_id UUID;

    -- Check for funnel_id column to backfill
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'funnel_performance_metrics' AND column_name = 'funnel_id'
    ) THEN
        UPDATE funnel_performance_metrics fpm
        SET workspace_id = dfd.workspace_id
        FROM dynamic_funnel_definitions dfd
        WHERE fpm.funnel_id = dfd.id
          AND fpm.workspace_id IS NULL;
    END IF;

    -- For any remaining nulls, assign to first workspace
    UPDATE funnel_performance_metrics
    SET workspace_id = (SELECT id FROM workspaces ORDER BY created_at LIMIT 1)
    WHERE workspace_id IS NULL;

    -- Create index
    CREATE INDEX idx_funnel_performance_metrics_workspace_id ON funnel_performance_metrics(workspace_id);

    -- Add NOT NULL constraint
    IF (SELECT COUNT(*) FROM funnel_performance_metrics WHERE workspace_id IS NULL) = 0 THEN
      ALTER TABLE funnel_performance_metrics ALTER COLUMN workspace_id SET NOT NULL;
    END IF;

    -- Add foreign key
    ALTER TABLE funnel_performance_metrics
    ADD CONSTRAINT fk_funnel_performance_metrics_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
  END IF;

  -- Enable RLS
  ALTER TABLE funnel_performance_metrics ENABLE ROW LEVEL SECURITY;

  -- Create workspace isolation policy
  DROP POLICY IF EXISTS workspace_isolation_funnel_performance_metrics ON funnel_performance_metrics;
  CREATE POLICY workspace_isolation_funnel_performance_metrics ON funnel_performance_metrics
  FOR ALL USING (
      workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = auth.uid()
      )
  );

  RAISE NOTICE 'funnel_performance_metrics: workspace_id added, RLS enabled';
END $$;

-- =====================================================================
-- 11. funnel_step_logs - Needs workspace_id first
-- =====================================================================

DO $$
BEGIN
  -- Add workspace_id if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'funnel_step_logs' AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE funnel_step_logs ADD COLUMN workspace_id UUID;

    -- Check for step_id column to backfill
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'funnel_step_logs' AND column_name = 'step_id'
    ) THEN
        UPDATE funnel_step_logs fsl
        SET workspace_id = dfs.workspace_id
        FROM dynamic_funnel_steps dfs
        WHERE fsl.step_id = dfs.id
          AND fsl.workspace_id IS NULL;
    END IF;

    -- For any remaining nulls, assign to first workspace
    UPDATE funnel_step_logs
    SET workspace_id = (SELECT id FROM workspaces ORDER BY created_at LIMIT 1)
    WHERE workspace_id IS NULL;

    -- Create index
    CREATE INDEX idx_funnel_step_logs_workspace_id ON funnel_step_logs(workspace_id);

    -- Add NOT NULL constraint
    IF (SELECT COUNT(*) FROM funnel_step_logs WHERE workspace_id IS NULL) = 0 THEN
      ALTER TABLE funnel_step_logs ALTER COLUMN workspace_id SET NOT NULL;
    END IF;

    -- Add foreign key
    ALTER TABLE funnel_step_logs
    ADD CONSTRAINT fk_funnel_step_logs_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
  END IF;

  -- Enable RLS
  ALTER TABLE funnel_step_logs ENABLE ROW LEVEL SECURITY;

  -- Create workspace isolation policy
  DROP POLICY IF EXISTS workspace_isolation_funnel_step_logs ON funnel_step_logs;
  CREATE POLICY workspace_isolation_funnel_step_logs ON funnel_step_logs
  FOR ALL USING (
      workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = auth.uid()
      )
  );

  RAISE NOTICE 'funnel_step_logs: workspace_id added, RLS enabled';
END $$;

-- =====================================================================
-- 12. webhook_error_logs - Needs workspace_id first
-- =====================================================================

DO $$
BEGIN
  -- Add workspace_id if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'webhook_error_logs' AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE webhook_error_logs ADD COLUMN workspace_id UUID;

    -- Webhook errors are tricky - might need campaign_id or another reference
    -- For now, assign to first workspace or make nullable
    UPDATE webhook_error_logs
    SET workspace_id = (SELECT id FROM workspaces ORDER BY created_at LIMIT 1)
    WHERE workspace_id IS NULL;

    -- Create index
    CREATE INDEX idx_webhook_error_logs_workspace_id ON webhook_error_logs(workspace_id);

    -- May want to keep this nullable for system-level errors
    -- Commenting out NOT NULL constraint
    -- IF (SELECT COUNT(*) FROM webhook_error_logs WHERE workspace_id IS NULL) = 0 THEN
    --   ALTER TABLE webhook_error_logs ALTER COLUMN workspace_id SET NOT NULL;
    -- END IF;

    -- Add foreign key
    ALTER TABLE webhook_error_logs
    ADD CONSTRAINT fk_webhook_error_logs_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL;
  END IF;

  -- Enable RLS
  ALTER TABLE webhook_error_logs ENABLE ROW LEVEL SECURITY;

  -- Create workspace isolation policy (allows NULL workspace_id for system errors)
  DROP POLICY IF EXISTS workspace_isolation_webhook_error_logs ON webhook_error_logs;
  CREATE POLICY workspace_isolation_webhook_error_logs ON webhook_error_logs
  FOR ALL USING (
      workspace_id IS NULL OR workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE user_id = auth.uid()
      )
  );

  RAISE NOTICE 'webhook_error_logs: workspace_id added, RLS enabled';
END $$;

-- =====================================================================
-- VERIFICATION QUERIES
-- =====================================================================

DO $$
DECLARE
    table_rec RECORD;
    rls_enabled BOOLEAN;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RLS VERIFICATION RESULTS';
    RAISE NOTICE '========================================';

    FOR table_rec IN
        SELECT unnest(ARRAY[
            'knowledge_base',
            'workspace_members',
            'workspaces',
            'core_funnel_executions',
            'core_funnel_templates',
            'dynamic_funnel_definitions',
            'dynamic_funnel_executions',
            'dynamic_funnel_steps',
            'funnel_adaptation_logs',
            'funnel_performance_metrics',
            'funnel_step_logs',
            'webhook_error_logs'
        ]) AS table_name
    LOOP
        EXECUTE format('SELECT relrowsecurity FROM pg_class WHERE relname = %L', table_rec.table_name) INTO rls_enabled;
        RAISE NOTICE '% : RLS = %', table_rec.table_name, COALESCE(rls_enabled::TEXT, 'NOT FOUND');
    END LOOP;
END $$;

-- COMMIT;
-- Or ROLLBACK; if verification fails
