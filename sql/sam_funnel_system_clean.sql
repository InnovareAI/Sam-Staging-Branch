-- Sam Funnel System Database Schema
-- Execute this in Supabase Dashboard → SQL Editor

-- Sam Funnel Executions (Main execution tracking)
CREATE TABLE IF NOT EXISTS sam_funnel_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  template_id TEXT NOT NULL, -- References sam-funnel-templates.ts
  
  -- Execution Details
  execution_type TEXT DEFAULT 'sam_funnel' CHECK (execution_type IN ('sam_funnel', 'sam_funnel_extended')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')),
  
  -- Prospect Tracking
  prospects_total INTEGER NOT NULL,
  prospects_scheduled INTEGER DEFAULT 0,
  prospects_active INTEGER DEFAULT 0,
  prospects_completed INTEGER DEFAULT 0,
  prospects_responded INTEGER DEFAULT 0,
  
  -- Timing
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  estimated_completion_date TIMESTAMP WITH TIME ZONE,
  actual_completion_date TIMESTAMP WITH TIME ZONE,
  
  -- Schedule Configuration
  schedule JSONB DEFAULT '{}', -- Calculated schedule dates
  personalization_data JSONB DEFAULT '{}', -- Custom variables
  client_messaging JSONB, -- Client-provided messaging overrides
  
  -- Performance Metrics
  response_rate DECIMAL(5,2) DEFAULT 0.00,
  conversion_rate DECIMAL(5,2) DEFAULT 0.00,
  meeting_booking_rate DECIMAL(5,2) DEFAULT 0.00,
  opt_out_rate DECIMAL(5,2) DEFAULT 0.00,
  
  -- A/B Testing Results
  cta_test_results JSONB DEFAULT '{}', -- Results by CTA variation
  
  -- Metadata
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sam Funnel Messages (Individual scheduled messages)
CREATE TABLE IF NOT EXISTS sam_funnel_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id UUID REFERENCES sam_funnel_executions(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES campaign_prospects(id) ON DELETE CASCADE,
  
  -- Message Details
  step_number INTEGER NOT NULL,
  step_type TEXT NOT NULL CHECK (step_type IN ('connection_request', 'follow_up', 'goodbye', 'email')),
  message_template TEXT NOT NULL,
  subject TEXT,
  
  -- Scheduling
  scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_date TIMESTAMP WITH TIME ZONE,
  week_number INTEGER NOT NULL,
  weekday TEXT NOT NULL,
  
  -- Sam Funnel Specific
  mandatory_element TEXT CHECK (mandatory_element IN ('competence_validation', 'free_trial', 'loom_video', 'second_cta', 'goodbye_qualification')),
  cta_variation TEXT, -- For A/B testing 2nd CTA
  
  -- Status and Results
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sent', 'delivered', 'read', 'responded', 'failed', 'cancelled')),
  response_received BOOLEAN DEFAULT false,
  response_type TEXT CHECK (response_type IN ('positive', 'negative', 'question', 'objection', 'opt_out', 'qualification')),
  response_content TEXT,
  
  -- Conditions and Logic
  conditions JSONB DEFAULT '[]',
  skip_reason TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sam Funnel Responses (Prospect responses and qualifications)
CREATE TABLE IF NOT EXISTS sam_funnel_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id UUID REFERENCES sam_funnel_executions(id) ON DELETE CASCADE,
  message_id UUID REFERENCES sam_funnel_messages(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES campaign_prospects(id) ON DELETE CASCADE,
  
  -- Response Details
  response_type TEXT NOT NULL CHECK (response_type IN ('positive', 'negative', 'question', 'objection', 'opt_out', 'qualification', 'meeting_request')),
  response_content TEXT NOT NULL,
  response_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Qualification Responses (from goodbye message)
  qualification_option TEXT CHECK (qualification_option IN ('a', 'b', 'c', 'd')),
  qualification_meaning TEXT,
  
  -- SAM AI Processing
  sam_analysis JSONB, -- SAM's analysis of the response
  sam_suggested_reply TEXT, -- SAM's drafted response
  sam_confidence_score DECIMAL(3,2), -- 0.00 to 1.00
  
  -- HITL Approval
  requires_approval BOOLEAN DEFAULT true,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'modified')),
  final_reply TEXT, -- Approved reply to send
  
  -- Actions Taken
  action_taken TEXT CHECK (action_taken IN ('replied', 'scheduled_follow_up', 'marked_dnc', 'booked_meeting', 'sent_calendar_link')),
  action_date TIMESTAMP WITH TIME ZONE,
  follow_up_scheduled_date TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sam Funnel Performance Analytics
CREATE TABLE IF NOT EXISTS sam_funnel_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id UUID REFERENCES sam_funnel_executions(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL,
  
  -- Step-by-Step Performance
  step_number INTEGER NOT NULL,
  step_type TEXT NOT NULL,
  mandatory_element TEXT,
  
  -- Metrics
  messages_sent INTEGER DEFAULT 0,
  messages_delivered INTEGER DEFAULT 0,
  messages_read INTEGER DEFAULT 0,
  responses_received INTEGER DEFAULT 0,
  positive_responses INTEGER DEFAULT 0,
  negative_responses INTEGER DEFAULT 0,
  opt_outs INTEGER DEFAULT 0,
  
  -- Calculated Rates
  delivery_rate DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN messages_sent > 0 
    THEN (messages_delivered::DECIMAL / messages_sent::DECIMAL) * 100 
    ELSE 0 END
  ) STORED,
  response_rate DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN messages_delivered > 0 
    THEN (responses_received::DECIMAL / messages_delivered::DECIMAL) * 100 
    ELSE 0 END
  ) STORED,
  positive_response_rate DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN responses_received > 0 
    THEN (positive_responses::DECIMAL / responses_received::DECIMAL) * 100 
    ELSE 0 END
  ) STORED,
  
  -- A/B Testing Results (for step 5 - 2nd CTA)
  cta_variation TEXT,
  cta_performance_score DECIMAL(5,2),
  
  -- Timing Analysis
  avg_response_time INTERVAL,
  best_performing_day TEXT,
  best_performing_time TIME,
  
  -- Last Updated
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sam Funnel Template Performance (Aggregated across all executions)
CREATE TABLE IF NOT EXISTS sam_funnel_template_performance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id TEXT NOT NULL UNIQUE,
  template_type TEXT NOT NULL CHECK (template_type IN ('linkedin', 'email')),
  
  -- Aggregate Statistics
  total_executions INTEGER DEFAULT 0,
  total_prospects INTEGER DEFAULT 0,
  total_messages_sent INTEGER DEFAULT 0,
  total_responses INTEGER DEFAULT 0,
  total_positive_responses INTEGER DEFAULT 0,
  total_meetings_booked INTEGER DEFAULT 0,
  total_opt_outs INTEGER DEFAULT 0,
  
  -- Performance Rates
  avg_response_rate DECIMAL(5,2) DEFAULT 0.00,
  avg_conversion_rate DECIMAL(5,2) DEFAULT 0.00,
  avg_meeting_booking_rate DECIMAL(5,2) DEFAULT 0.00,
  avg_opt_out_rate DECIMAL(5,2) DEFAULT 0.00,
  
  -- Step Performance Breakdown
  step_performance JSONB DEFAULT '{}', -- Performance by step number
  
  -- A/B Test Winners
  best_performing_cta TEXT, -- Winning CTA variation
  cta_test_confidence DECIMAL(5,2), -- Statistical confidence
  
  -- Timing Insights
  best_start_day TEXT, -- Best day to start campaigns
  optimal_timing JSONB, -- Timing recommendations
  
  -- Continuous Improvement
  version_history JSONB DEFAULT '[]', -- Track template improvements
  last_optimization_date TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_sam_funnel_executions_campaign ON sam_funnel_executions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sam_funnel_executions_workspace ON sam_funnel_executions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sam_funnel_executions_template ON sam_funnel_executions(template_id);
CREATE INDEX IF NOT EXISTS idx_sam_funnel_executions_status ON sam_funnel_executions(status);
CREATE INDEX IF NOT EXISTS idx_sam_funnel_executions_dates ON sam_funnel_executions(start_date, estimated_completion_date);

CREATE INDEX IF NOT EXISTS idx_sam_funnel_messages_execution ON sam_funnel_messages(execution_id);
CREATE INDEX IF NOT EXISTS idx_sam_funnel_messages_prospect ON sam_funnel_messages(prospect_id);
CREATE INDEX IF NOT EXISTS idx_sam_funnel_messages_scheduled ON sam_funnel_messages(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_sam_funnel_messages_step ON sam_funnel_messages(step_number, step_type);
CREATE INDEX IF NOT EXISTS idx_sam_funnel_messages_status ON sam_funnel_messages(status);
CREATE INDEX IF NOT EXISTS idx_sam_funnel_messages_cta_variation ON sam_funnel_messages(cta_variation);

CREATE INDEX IF NOT EXISTS idx_sam_funnel_responses_execution ON sam_funnel_responses(execution_id);
CREATE INDEX IF NOT EXISTS idx_sam_funnel_responses_prospect ON sam_funnel_responses(prospect_id);
CREATE INDEX IF NOT EXISTS idx_sam_funnel_responses_type ON sam_funnel_responses(response_type);
CREATE INDEX IF NOT EXISTS idx_sam_funnel_responses_approval ON sam_funnel_responses(approval_status);
CREATE INDEX IF NOT EXISTS idx_sam_funnel_responses_qualification ON sam_funnel_responses(qualification_option);

CREATE INDEX IF NOT EXISTS idx_sam_funnel_analytics_execution ON sam_funnel_analytics(execution_id);
CREATE INDEX IF NOT EXISTS idx_sam_funnel_analytics_template ON sam_funnel_analytics(template_id);
CREATE INDEX IF NOT EXISTS idx_sam_funnel_analytics_step ON sam_funnel_analytics(step_number, step_type);
CREATE INDEX IF NOT EXISTS idx_sam_funnel_analytics_cta ON sam_funnel_analytics(cta_variation);

-- Enable RLS
ALTER TABLE sam_funnel_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sam_funnel_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sam_funnel_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE sam_funnel_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE sam_funnel_template_performance ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$ 
BEGIN
  -- Sam Funnel Executions access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sam_funnel_executions' 
    AND policyname = 'Users can access executions in their workspace'
  ) THEN
    CREATE POLICY "Users can access executions in their workspace" ON sam_funnel_executions
      FOR ALL USING (workspace_id = current_setting('app.current_workspace_id', true));
  END IF;

  -- Sam Funnel Messages access
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

  -- Sam Funnel Responses access
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

  -- Sam Funnel Analytics access
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

  -- Template Performance (global access for learning)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sam_funnel_template_performance' 
    AND policyname = 'All users can access template performance'
  ) THEN
    CREATE POLICY "All users can access template performance" ON sam_funnel_template_performance
      FOR SELECT USING (true);
  END IF;
END $$;

-- Function to update execution performance metrics
CREATE OR REPLACE FUNCTION update_sam_funnel_execution_metrics(p_execution_id UUID)
RETURNS VOID AS $$
DECLARE
  v_prospects_responded INTEGER;
  v_prospects_converted INTEGER;
  v_prospects_total INTEGER;
  v_response_rate DECIMAL(5,2);
  v_conversion_rate DECIMAL(5,2);
BEGIN
  -- Get current counts
  SELECT 
    COUNT(DISTINCT CASE WHEN sfr.response_type IS NOT NULL THEN sfr.prospect_id END),
    COUNT(DISTINCT CASE WHEN sfr.response_type = 'positive' THEN sfr.prospect_id END),
    sfe.prospects_total
  INTO v_prospects_responded, v_prospects_converted, v_prospects_total
  FROM sam_funnel_executions sfe
  LEFT JOIN sam_funnel_responses sfr ON sfe.id = sfr.execution_id
  WHERE sfe.id = p_execution_id
  GROUP BY sfe.prospects_total;

  -- Calculate rates
  v_response_rate := CASE WHEN v_prospects_total > 0 
    THEN (v_prospects_responded::DECIMAL / v_prospects_total::DECIMAL) * 100 
    ELSE 0 END;
  
  v_conversion_rate := CASE WHEN v_prospects_responded > 0 
    THEN (v_prospects_converted::DECIMAL / v_prospects_responded::DECIMAL) * 100 
    ELSE 0 END;

  -- Update execution record
  UPDATE sam_funnel_executions 
  SET 
    prospects_responded = v_prospects_responded,
    response_rate = v_response_rate,
    conversion_rate = v_conversion_rate,
    updated_at = NOW()
  WHERE id = p_execution_id;
END;
$$ LANGUAGE plpgsql;

-- Function to handle qualification responses
CREATE OR REPLACE FUNCTION process_qualification_response(
  p_execution_id UUID,
  p_message_id UUID,
  p_prospect_id UUID,
  p_qualification_option TEXT,
  p_response_content TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_action TEXT;
  v_follow_up_date TIMESTAMP WITH TIME ZONE;
  result JSONB;
BEGIN
  -- Determine action based on qualification option
  CASE p_qualification_option
    WHEN 'a' THEN 
      v_action := 'schedule_follow_up';
      v_follow_up_date := NOW() + INTERVAL '3 weeks';
    WHEN 'b' THEN 
      v_action := 'mark_dnc';
    WHEN 'c' THEN 
      v_action := 'send_calendar_link';
    WHEN 'd' THEN 
      v_action := 'mark_dnc_and_unsubscribe';
    ELSE
      v_action := 'requires_manual_review';
  END CASE;

  -- Insert response record
  INSERT INTO sam_funnel_responses (
    execution_id,
    message_id,
    prospect_id,
    response_type,
    response_content,
    qualification_option,
    qualification_meaning,
    action_taken,
    follow_up_scheduled_date,
    requires_approval
  ) VALUES (
    p_execution_id,
    p_message_id,
    p_prospect_id,
    'qualification',
    p_response_content,
    p_qualification_option,
    CASE p_qualification_option
      WHEN 'a' THEN 'Not right time - follow up later'
      WHEN 'b' THEN 'Has solution - remove from list'
      WHEN 'c' THEN 'Interested - schedule meeting'
      WHEN 'd' THEN 'Not interested - opt out'
    END,
    v_action,
    v_follow_up_date,
    p_qualification_option = 'c' -- Only calendar booking requires approval
  );

  -- Update prospect status
  UPDATE campaign_prospects 
  SET 
    status = CASE 
      WHEN p_qualification_option = 'a' THEN 'follow_up_scheduled'
      WHEN p_qualification_option = 'b' THEN 'dnc'
      WHEN p_qualification_option = 'c' THEN 'meeting_requested'
      WHEN p_qualification_option = 'd' THEN 'opted_out'
    END,
    follow_up_date = v_follow_up_date,
    updated_at = NOW()
  WHERE id = p_prospect_id;

  -- Return result
  result := jsonb_build_object(
    'action', v_action,
    'follow_up_date', v_follow_up_date,
    'requires_approval', p_qualification_option = 'c'
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update execution metrics when responses are added
CREATE OR REPLACE FUNCTION trigger_update_execution_metrics()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_sam_funnel_execution_metrics(NEW.execution_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sam_funnel_response_metrics
  AFTER INSERT OR UPDATE ON sam_funnel_responses
  FOR EACH ROW 
  EXECUTE FUNCTION trigger_update_execution_metrics();

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_sam_funnel_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sam_funnel_executions_updated_at 
  BEFORE UPDATE ON sam_funnel_executions 
  FOR EACH ROW EXECUTE FUNCTION update_sam_funnel_updated_at();

CREATE TRIGGER trigger_sam_funnel_messages_updated_at 
  BEFORE UPDATE ON sam_funnel_messages 
  FOR EACH ROW EXECUTE FUNCTION update_sam_funnel_updated_at();

CREATE TRIGGER trigger_sam_funnel_responses_updated_at 
  BEFORE UPDATE ON sam_funnel_responses 
  FOR EACH ROW EXECUTE FUNCTION update_sam_funnel_updated_at();