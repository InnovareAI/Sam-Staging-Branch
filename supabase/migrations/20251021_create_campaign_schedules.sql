-- Create campaign_schedules table for scheduling campaigns
CREATE TABLE IF NOT EXISTS campaign_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,

  -- Scheduling details
  scheduled_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  scheduled_end_time TIMESTAMP WITH TIME ZONE,
  timezone TEXT DEFAULT 'UTC',

  -- Repeat settings
  repeat_frequency TEXT DEFAULT 'none' CHECK (repeat_frequency IN ('none', 'daily', 'weekly', 'monthly')),
  repeat_until TIMESTAMP WITH TIME ZONE,

  -- Priority and limits
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  max_daily_messages INTEGER,

  -- Status tracking
  schedule_status TEXT DEFAULT 'scheduled' CHECK (schedule_status IN ('scheduled', 'active', 'paused', 'completed', 'cancelled')),
  actual_start_time TIMESTAMP WITH TIME ZONE,
  paused_at TIMESTAMP WITH TIME ZONE,
  resumed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_campaign_schedules_campaign_id ON campaign_schedules(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_schedules_status ON campaign_schedules(schedule_status);
CREATE INDEX IF NOT EXISTS idx_campaign_schedules_start_time ON campaign_schedules(scheduled_start_time);

-- Enable RLS
ALTER TABLE campaign_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for campaign_schedules
CREATE POLICY "Users can view schedules for their workspace campaigns"
  ON campaign_schedules
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = campaign_schedules.campaign_id
      AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create schedules for their workspace campaigns"
  ON campaign_schedules
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns c
      JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = campaign_schedules.campaign_id
      AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update schedules for their workspace campaigns"
  ON campaign_schedules
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = campaign_schedules.campaign_id
      AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete schedules for their workspace campaigns"
  ON campaign_schedules
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      JOIN workspace_members wm ON wm.workspace_id = c.workspace_id
      WHERE c.id = campaign_schedules.campaign_id
      AND wm.user_id = auth.uid()
    )
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_campaign_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER campaign_schedules_updated_at
  BEFORE UPDATE ON campaign_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_schedules_updated_at();

COMMENT ON TABLE campaign_schedules IS 'Scheduling information for campaigns';
COMMENT ON COLUMN campaign_schedules.campaign_id IS 'The campaign being scheduled';
COMMENT ON COLUMN campaign_schedules.scheduled_start_time IS 'When the campaign should start';
COMMENT ON COLUMN campaign_schedules.scheduled_end_time IS 'When the campaign should end (optional)';
COMMENT ON COLUMN campaign_schedules.repeat_frequency IS 'How often the campaign repeats';
COMMENT ON COLUMN campaign_schedules.schedule_status IS 'Current status of the schedule';
