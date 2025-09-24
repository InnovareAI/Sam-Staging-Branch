-- Sam Funnel Core Tables - Deploy in Supabase Dashboard
-- Execute this AFTER workspace_accounts table is created

-- 1. Sam Funnel Executions
CREATE TABLE IF NOT EXISTS sam_funnel_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  execution_type TEXT DEFAULT 'sam_funnel' CHECK (execution_type IN ('sam_funnel', 'sam_funnel_extended')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')),
  prospects_total INTEGER NOT NULL,
  prospects_scheduled INTEGER DEFAULT 0,
  prospects_active INTEGER DEFAULT 0,
  prospects_completed INTEGER DEFAULT 0,
  prospects_responded INTEGER DEFAULT 0,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  estimated_completion_date TIMESTAMP WITH TIME ZONE,
  actual_completion_date TIMESTAMP WITH TIME ZONE,
  schedule JSONB DEFAULT '{}',
  personalization_data JSONB DEFAULT '{}',
  client_messaging JSONB,
  response_rate DECIMAL(5,2) DEFAULT 0.00,
  conversion_rate DECIMAL(5,2) DEFAULT 0.00,
  meeting_booking_rate DECIMAL(5,2) DEFAULT 0.00,
  opt_out_rate DECIMAL(5,2) DEFAULT 0.00,
  cta_test_results JSONB DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Sam Funnel Messages
CREATE TABLE IF NOT EXISTS sam_funnel_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id UUID REFERENCES sam_funnel_executions(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES campaign_prospects(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  step_type TEXT NOT NULL CHECK (step_type IN ('connection_request', 'follow_up', 'goodbye', 'email')),
  message_template TEXT NOT NULL,
  subject TEXT,
  scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_date TIMESTAMP WITH TIME ZONE,
  week_number INTEGER NOT NULL,
  weekday TEXT NOT NULL,
  mandatory_element TEXT CHECK (mandatory_element IN ('competence_validation', 'free_trial', 'loom_video', 'second_cta', 'goodbye_qualification')),
  cta_variation TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sent', 'delivered', 'read', 'responded', 'failed', 'cancelled')),
  response_received BOOLEAN DEFAULT false,
  response_type TEXT CHECK (response_type IN ('positive', 'negative', 'question', 'objection', 'opt_out', 'qualification')),
  response_content TEXT,
  conditions JSONB DEFAULT '[]',
  skip_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Sam Funnel Responses
CREATE TABLE IF NOT EXISTS sam_funnel_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id UUID REFERENCES sam_funnel_executions(id) ON DELETE CASCADE,
  message_id UUID REFERENCES sam_funnel_messages(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES campaign_prospects(id) ON DELETE CASCADE,
  response_type TEXT NOT NULL CHECK (response_type IN ('positive', 'negative', 'question', 'objection', 'opt_out', 'qualification', 'meeting_request')),
  response_content TEXT NOT NULL,
  response_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  qualification_option TEXT CHECK (qualification_option IN ('a', 'b', 'c', 'd')),
  qualification_meaning TEXT,
  sam_analysis JSONB,
  sam_suggested_reply TEXT,
  sam_confidence_score DECIMAL(3,2),
  requires_approval BOOLEAN DEFAULT true,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'modified')),
  final_reply TEXT,
  action_taken TEXT CHECK (action_taken IN ('replied', 'scheduled_follow_up', 'marked_dnc', 'booked_meeting', 'sent_calendar_link')),
  action_date TIMESTAMP WITH TIME ZONE,
  follow_up_scheduled_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Sam Funnel Analytics
CREATE TABLE IF NOT EXISTS sam_funnel_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id UUID REFERENCES sam_funnel_executions(id) ON DELETE CASCADE,
  template_id TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  step_type TEXT NOT NULL,
  mandatory_element TEXT,
  messages_sent INTEGER DEFAULT 0,
  messages_delivered INTEGER DEFAULT 0,
  messages_read INTEGER DEFAULT 0,
  responses_received INTEGER DEFAULT 0,
  positive_responses INTEGER DEFAULT 0,
  negative_responses INTEGER DEFAULT 0,
  opt_outs INTEGER DEFAULT 0,
  cta_variation TEXT,
  cta_performance_score DECIMAL(5,2),
  avg_response_time INTERVAL,
  best_performing_day TEXT,
  best_performing_time TIME,
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Sam Funnel Template Performance
CREATE TABLE IF NOT EXISTS sam_funnel_template_performance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id TEXT NOT NULL UNIQUE,
  template_type TEXT NOT NULL CHECK (template_type IN ('linkedin', 'email')),
  total_executions INTEGER DEFAULT 0,
  total_prospects INTEGER DEFAULT 0,
  total_messages_sent INTEGER DEFAULT 0,
  total_responses INTEGER DEFAULT 0,
  total_positive_responses INTEGER DEFAULT 0,
  total_meetings_booked INTEGER DEFAULT 0,
  total_opt_outs INTEGER DEFAULT 0,
  avg_response_rate DECIMAL(5,2) DEFAULT 0.00,
  avg_conversion_rate DECIMAL(5,2) DEFAULT 0.00,
  avg_meeting_booking_rate DECIMAL(5,2) DEFAULT 0.00,
  avg_opt_out_rate DECIMAL(5,2) DEFAULT 0.00,
  step_performance JSONB DEFAULT '{}',
  best_performing_cta TEXT,
  cta_test_confidence DECIMAL(5,2),
  best_start_day TEXT,
  optimal_timing JSONB,
  version_history JSONB DEFAULT '[]',
  last_optimization_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);