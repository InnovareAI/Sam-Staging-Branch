-- Create campaign schedules table for scheduling campaigns
CREATE TABLE IF NOT EXISTS campaign_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    
    -- Scheduling details
    scheduled_start_time TIMESTAMPTZ NOT NULL,
    scheduled_end_time TIMESTAMPTZ,
    timezone TEXT DEFAULT 'UTC',
    
    -- Actual execution times
    actual_start_time TIMESTAMPTZ,
    actual_end_time TIMESTAMPTZ,
    
    -- Repeat configuration
    repeat_frequency TEXT DEFAULT 'none' CHECK (repeat_frequency IN ('none', 'daily', 'weekly', 'monthly')),
    repeat_until TIMESTAMPTZ,
    
    -- Schedule status
    schedule_status TEXT DEFAULT 'scheduled' CHECK (schedule_status IN ('scheduled', 'active', 'paused', 'completed', 'cancelled')),
    
    -- Control settings
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
    max_daily_messages INTEGER,
    
    -- Pause/resume tracking
    paused_at TIMESTAMPTZ,
    resumed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Notes and metadata
    notes TEXT,
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaign_schedules_campaign_id ON campaign_schedules(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_schedules_scheduled_start_time ON campaign_schedules(scheduled_start_time);
CREATE INDEX IF NOT EXISTS idx_campaign_schedules_status ON campaign_schedules(schedule_status);
CREATE INDEX IF NOT EXISTS idx_campaign_schedules_active_schedules ON campaign_schedules(scheduled_start_time, scheduled_end_time) 
    WHERE schedule_status IN ('scheduled', 'active');

-- Enable RLS
ALTER TABLE campaign_schedules ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view schedules for their workspace campaigns" ON campaign_schedules
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM campaigns c
            WHERE c.id = campaign_schedules.campaign_id
            AND c.workspace_id = (auth.jwt() ->> 'user_metadata')::json ->> 'workspace_id'
        )
    );

CREATE POLICY "Users can create schedules for their workspace campaigns" ON campaign_schedules
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM campaigns c
            WHERE c.id = campaign_schedules.campaign_id
            AND c.workspace_id = (auth.jwt() ->> 'user_metadata')::json ->> 'workspace_id'
        )
    );

CREATE POLICY "Users can update schedules for their workspace campaigns" ON campaign_schedules
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM campaigns c
            WHERE c.id = campaign_schedules.campaign_id
            AND c.workspace_id = (auth.jwt() ->> 'user_metadata')::json ->> 'workspace_id'
        )
    );

CREATE POLICY "Users can delete schedules for their workspace campaigns" ON campaign_schedules
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM campaigns c
            WHERE c.id = campaign_schedules.campaign_id
            AND c.workspace_id = (auth.jwt() ->> 'user_metadata')::json ->> 'workspace_id'
        )
    );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_campaign_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_campaign_schedules_updated_at ON campaign_schedules;
CREATE TRIGGER trigger_update_campaign_schedules_updated_at
    BEFORE UPDATE ON campaign_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_schedules_updated_at();

-- Add approval fields to campaign_messages table if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_messages' AND column_name = 'approval_status') THEN
        ALTER TABLE campaign_messages ADD COLUMN approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_messages' AND column_name = 'approved_by') THEN
        ALTER TABLE campaign_messages ADD COLUMN approved_by UUID REFERENCES auth.users(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_messages' AND column_name = 'approved_at') THEN
        ALTER TABLE campaign_messages ADD COLUMN approved_at TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_messages' AND column_name = 'rejection_reason') THEN
        ALTER TABLE campaign_messages ADD COLUMN rejection_reason TEXT;
    END IF;
END $$;

-- Create index for message approval queries
CREATE INDEX IF NOT EXISTS idx_campaign_messages_approval_status ON campaign_messages(approval_status);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_approved_at ON campaign_messages(approved_at);

COMMENT ON TABLE campaign_schedules IS 'Stores campaign scheduling information for automated execution';
COMMENT ON COLUMN campaign_schedules.repeat_frequency IS 'How often the campaign should repeat: none, daily, weekly, monthly';
COMMENT ON COLUMN campaign_schedules.schedule_status IS 'Current status: scheduled, active, paused, completed, cancelled';
COMMENT ON COLUMN campaign_schedules.priority IS 'Execution priority: low, normal, high';
COMMENT ON COLUMN campaign_schedules.max_daily_messages IS 'Maximum messages to send per day for this schedule';