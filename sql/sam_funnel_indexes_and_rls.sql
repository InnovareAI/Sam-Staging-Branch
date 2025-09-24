-- Sam Funnel Indexes and RLS - Deploy AFTER core tables
-- Execute this in Supabase Dashboard after sam_funnel_core_tables.sql

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_sam_funnel_executions_campaign ON sam_funnel_executions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sam_funnel_executions_workspace ON sam_funnel_executions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sam_funnel_executions_template ON sam_funnel_executions(template_id);
CREATE INDEX IF NOT EXISTS idx_sam_funnel_executions_status ON sam_funnel_executions(status);

CREATE INDEX IF NOT EXISTS idx_sam_funnel_messages_execution ON sam_funnel_messages(execution_id);
CREATE INDEX IF NOT EXISTS idx_sam_funnel_messages_prospect ON sam_funnel_messages(prospect_id);
CREATE INDEX IF NOT EXISTS idx_sam_funnel_messages_scheduled ON sam_funnel_messages(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_sam_funnel_messages_status ON sam_funnel_messages(status);

CREATE INDEX IF NOT EXISTS idx_sam_funnel_responses_execution ON sam_funnel_responses(execution_id);
CREATE INDEX IF NOT EXISTS idx_sam_funnel_responses_prospect ON sam_funnel_responses(prospect_id);
CREATE INDEX IF NOT EXISTS idx_sam_funnel_responses_type ON sam_funnel_responses(response_type);
CREATE INDEX IF NOT EXISTS idx_sam_funnel_responses_approval ON sam_funnel_responses(approval_status);

CREATE INDEX IF NOT EXISTS idx_sam_funnel_analytics_execution ON sam_funnel_analytics(execution_id);
CREATE INDEX IF NOT EXISTS idx_sam_funnel_analytics_template ON sam_funnel_analytics(template_id);

-- Enable Row Level Security
ALTER TABLE sam_funnel_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sam_funnel_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sam_funnel_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE sam_funnel_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE sam_funnel_template_performance ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sam_funnel_executions' 
    AND policyname = 'Users can access executions in their workspace'
  ) THEN
    CREATE POLICY "Users can access executions in their workspace" ON sam_funnel_executions
      FOR ALL USING (workspace_id = current_setting('app.current_workspace_id', true));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sam_funnel_messages' 
    AND policyname = 'Users can access messages in their workspace'
  ) THEN
    CREATE POLICY "Users can access messages in their workspace" ON sam_funnel_messages
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM sam_funnel_executions sfe 
          WHERE sfe.id = execution_id 
          AND sfe.workspace_id = current_setting('app.current_workspace_id', true)
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sam_funnel_responses' 
    AND policyname = 'Users can access responses in their workspace'
  ) THEN
    CREATE POLICY "Users can access responses in their workspace" ON sam_funnel_responses
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM sam_funnel_executions sfe 
          WHERE sfe.id = execution_id 
          AND sfe.workspace_id = current_setting('app.current_workspace_id', true)
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sam_funnel_analytics' 
    AND policyname = 'Users can access analytics in their workspace'
  ) THEN
    CREATE POLICY "Users can access analytics in their workspace" ON sam_funnel_analytics
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM sam_funnel_executions sfe 
          WHERE sfe.id = execution_id 
          AND sfe.workspace_id = current_setting('app.current_workspace_id', true)
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sam_funnel_template_performance' 
    AND policyname = 'All users can access template performance'
  ) THEN
    CREATE POLICY "All users can access template performance" ON sam_funnel_template_performance
      FOR SELECT USING (true);
  END IF;
END $$;