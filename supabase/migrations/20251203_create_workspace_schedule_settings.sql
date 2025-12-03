-- Create workspace_schedule_settings table for system-wide scheduling
-- This replaces per-feature scheduling with unified workspace-level settings

CREATE TABLE IF NOT EXISTS workspace_schedule_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Timezone for this workspace (IANA format)
  timezone TEXT NOT NULL DEFAULT 'America/New_York',

  -- Weekly schedule (JSON with per-day settings)
  -- Example: { "monday": { "enabled": true, "start": "07:00", "end": "22:00" }, ... }
  weekly_schedule JSONB NOT NULL DEFAULT '{
    "monday": {"enabled": true, "start": "07:00", "end": "22:00"},
    "tuesday": {"enabled": true, "start": "07:00", "end": "22:00"},
    "wednesday": {"enabled": true, "start": "07:00", "end": "22:00"},
    "thursday": {"enabled": true, "start": "07:00", "end": "22:00"},
    "friday": {"enabled": true, "start": "07:00", "end": "22:00"},
    "saturday": {"enabled": true, "start": "10:00", "end": "19:00"},
    "sunday": {"enabled": true, "start": "11:30", "end": "17:00"}
  }'::jsonb,

  -- Custom inactive dates (holidays, time off, etc.)
  -- Array of { id, start_date, end_date, description? }
  inactive_dates JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure one settings per workspace
  CONSTRAINT unique_workspace_schedule UNIQUE (workspace_id)
);

-- Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_workspace_schedule_settings_workspace_id
  ON workspace_schedule_settings(workspace_id);

-- Enable RLS
ALTER TABLE workspace_schedule_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their workspace schedule settings"
  ON workspace_schedule_settings FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their workspace schedule settings"
  ON workspace_schedule_settings FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their workspace schedule settings"
  ON workspace_schedule_settings FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Allow service role full access
CREATE POLICY "Service role has full access to schedule settings"
  ON workspace_schedule_settings FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Add comment
COMMENT ON TABLE workspace_schedule_settings IS 'Workspace-level schedule settings for all automated actions (campaigns, commenting agent, etc.)';
