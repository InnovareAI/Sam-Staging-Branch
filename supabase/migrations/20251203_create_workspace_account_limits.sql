-- Create workspace_account_limits table
-- Stores LinkedIn and Email account limits and warmup settings per workspace

CREATE TABLE IF NOT EXISTS workspace_account_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- LinkedIn limits stored as JSONB
  linkedin_limits JSONB NOT NULL DEFAULT '{
    "warmup": {
      "enabled": true,
      "start_limit": 5,
      "end_limit": 25,
      "increase_by": 2,
      "step_length_days": 3
    },
    "daily_limits": {
      "connection_requests": 20,
      "follow_up_messages": 50,
      "inmails": 10,
      "company_follows": 10,
      "event_invites": 10
    },
    "range_limits": {
      "connection_requests": { "min": 10, "max": 30 },
      "messages": { "min": 20, "max": 100 },
      "inmails": { "min": 5, "max": 20 }
    },
    "settings": {
      "delete_pending_requests_after_days": 14,
      "capitalize_names": true,
      "adjust_hourly_limits": true,
      "send_without_connector_message": false
    }
  }'::jsonb,

  -- Email limits stored as JSONB
  email_limits JSONB NOT NULL DEFAULT '{
    "warmup": {
      "enabled": true,
      "start_limit": 10,
      "end_limit": 100,
      "increase_by": 10,
      "step_length_days": 7
    },
    "daily_limits": {
      "emails_per_day": 100,
      "emails_per_hour": 20
    }
  }'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(workspace_id)
);

-- Create index for workspace lookup
CREATE INDEX IF NOT EXISTS idx_workspace_account_limits_workspace_id
  ON workspace_account_limits(workspace_id);

-- Enable RLS
ALTER TABLE workspace_account_limits ENABLE ROW LEVEL SECURITY;

-- RLS policies for workspace_account_limits
CREATE POLICY "workspace_account_limits_select_policy" ON workspace_account_limits
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_account_limits_insert_policy" ON workspace_account_limits
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_account_limits_update_policy" ON workspace_account_limits
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_account_limits_delete_policy" ON workspace_account_limits
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Grant permissions
GRANT ALL ON workspace_account_limits TO authenticated;
GRANT ALL ON workspace_account_limits TO service_role;

-- Add comment
COMMENT ON TABLE workspace_account_limits IS 'Stores LinkedIn and Email account limits and warmup settings per workspace';
