-- SuperAdmin Analytics and Tracking Tables
-- Run this migration to enable real data tracking for the superadmin dashboard

-- ============================================================================
-- USER SUBSCRIPTION TRACKING
-- ============================================================================

-- Add subscription fields to users table if they don't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT CHECK (subscription_status IN ('trial', 'active', 'cancelled', 'expired'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_plan TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS billing_cycle TEXT;

-- Create index for subscription queries
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);
CREATE INDEX IF NOT EXISTS idx_users_trial_ends_at ON users(trial_ends_at);
CREATE INDEX IF NOT EXISTS idx_users_cancelled_at ON users(cancelled_at);

-- ============================================================================
-- CONVERSATION ANALYTICS
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversation_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID REFERENCES sam_conversation_threads(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Session metrics
  duration_seconds INTEGER,
  message_count INTEGER DEFAULT 0,
  
  -- Completion metrics
  completion_status TEXT CHECK (completion_status IN ('completed', 'abandoned', 'in_progress')),
  completion_rate DECIMAL(5,2),
  
  -- Persona/mode tracking
  persona_used TEXT, -- 'discovery', 'icp_research', 'script_position', 'general'
  thread_type TEXT,
  
  -- Engagement metrics
  user_engagement_score DECIMAL(5,2),
  response_quality_score DECIMAL(5,2),
  
  -- Industry/vertical
  industry TEXT,
  company_size TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_conv_analytics_thread ON conversation_analytics(thread_id);
CREATE INDEX IF NOT EXISTS idx_conv_analytics_workspace ON conversation_analytics(workspace_id);
CREATE INDEX IF NOT EXISTS idx_conv_analytics_user ON conversation_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_analytics_persona ON conversation_analytics(persona_used);
CREATE INDEX IF NOT EXISTS idx_conv_analytics_industry ON conversation_analytics(industry);
CREATE INDEX IF NOT EXISTS idx_conv_analytics_created ON conversation_analytics(created_at);

-- Enable RLS
ALTER TABLE conversation_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Super admins can view all conversation analytics"
  ON conversation_analytics FOR SELECT
  USING (
    auth.email() IN ('tl@innovareai.com', 'cl@innovareai.com')
  );

CREATE POLICY "Users can view their own conversation analytics"
  ON conversation_analytics FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================================
-- SYSTEM HEALTH LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_health_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Component identification
  component TEXT NOT NULL, -- 'database', 'api', 'storage', 'memory', 'email', 'auth'
  component_detail TEXT, -- Specific service or endpoint
  
  -- Status tracking
  status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
  
  -- Performance metrics
  response_time_ms INTEGER,
  cpu_usage DECIMAL(5,2),
  memory_usage DECIMAL(5,2),
  storage_usage DECIMAL(5,2),
  
  -- Error tracking
  error_count INTEGER DEFAULT 0,
  error_message TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_health_logs_component ON system_health_logs(component);
CREATE INDEX IF NOT EXISTS idx_health_logs_status ON system_health_logs(status);
CREATE INDEX IF NOT EXISTS idx_health_logs_created ON system_health_logs(created_at);

-- Enable RLS
ALTER TABLE system_health_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Super admins can view all health logs"
  ON system_health_logs FOR ALL
  USING (
    auth.email() IN ('tl@innovareai.com', 'cl@innovareai.com')
  );

-- ============================================================================
-- SYSTEM ALERTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Alert classification
  alert_type TEXT NOT NULL CHECK (alert_type IN ('critical', 'warning', 'info')),
  component TEXT NOT NULL,
  
  -- Alert details
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  
  -- Resolution tracking
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_alerts_type ON system_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON system_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON system_alerts(created_at);

-- Enable RLS
ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Super admins can manage all alerts"
  ON system_alerts FOR ALL
  USING (
    auth.email() IN ('tl@innovareai.com', 'cl@innovareai.com')
  );

-- ============================================================================
-- QA AGENT AUTO-FIX LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS qa_autofix_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Issue identification
  issue_type TEXT NOT NULL,
  issue_description TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  
  -- Fix details
  fix_applied TEXT,
  fix_status TEXT CHECK (fix_status IN ('success', 'failed', 'manual_required')),
  
  -- Context
  affected_component TEXT,
  affected_file TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_qa_logs_status ON qa_autofix_logs(fix_status);
CREATE INDEX IF NOT EXISTS idx_qa_logs_created ON qa_autofix_logs(created_at);

-- Enable RLS
ALTER TABLE qa_autofix_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Super admins can view all QA logs"
  ON qa_autofix_logs FOR ALL
  USING (
    auth.email() IN ('tl@innovareai.com', 'cl@innovareai.com')
  );

-- ============================================================================
-- DEPLOYMENT LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS deployment_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Deployment identification
  deployment_name TEXT NOT NULL,
  deployment_type TEXT NOT NULL, -- 'feature', 'hotfix', 'integration', 'config'
  
  -- Target and scope
  target_workspaces UUID[], -- NULL means all workspaces
  target_count INTEGER,
  
  -- Execution
  deployment_mode TEXT CHECK (deployment_mode IN ('test', 'production')),
  status TEXT CHECK (status IN ('pending', 'in_progress', 'success', 'failed', 'partial')),
  
  -- Results
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  error_message TEXT,
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  
  -- User tracking
  deployed_by UUID REFERENCES auth.users(id),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deploy_logs_status ON deployment_logs(status);
CREATE INDEX IF NOT EXISTS idx_deploy_logs_type ON deployment_logs(deployment_type);
CREATE INDEX IF NOT EXISTS idx_deploy_logs_created ON deployment_logs(created_at);

-- Enable RLS
ALTER TABLE deployment_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Super admins can manage deployment logs"
  ON deployment_logs FOR ALL
  USING (
    auth.email() IN ('tl@innovareai.com', 'cl@innovareai.com')
  );

-- ============================================================================
-- USER SESSION TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Session metrics
  session_start TIMESTAMP WITH TIME ZONE NOT NULL,
  session_end TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  
  -- Activity tracking
  pages_visited INTEGER DEFAULT 0,
  actions_performed INTEGER DEFAULT 0,
  
  -- Metadata
  user_agent TEXT,
  ip_address TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON user_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sessions_start ON user_sessions(session_start);

-- Enable RLS
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Super admins can view all sessions"
  ON user_sessions FOR SELECT
  USING (
    auth.email() IN ('tl@innovareai.com', 'cl@innovareai.com')
  );

CREATE POLICY "Users can view their own sessions"
  ON user_sessions FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to log system health
CREATE OR REPLACE FUNCTION log_system_health(
  p_component TEXT,
  p_status TEXT,
  p_response_time_ms INTEGER DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO system_health_logs (
    component,
    status,
    response_time_ms,
    error_message
  ) VALUES (
    p_component,
    p_status,
    p_response_time_ms,
    p_error_message
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Function to create system alert
CREATE OR REPLACE FUNCTION create_system_alert(
  p_alert_type TEXT,
  p_component TEXT,
  p_title TEXT,
  p_message TEXT,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_alert_id UUID;
BEGIN
  INSERT INTO system_alerts (
    alert_type,
    component,
    title,
    message,
    metadata
  ) VALUES (
    p_alert_type,
    p_component,
    p_title,
    p_message,
    p_metadata
  )
  RETURNING id INTO v_alert_id;
  
  RETURN v_alert_id;
END;
$$;

-- Function to track conversation analytics
CREATE OR REPLACE FUNCTION track_conversation_analytics(
  p_thread_id UUID,
  p_persona_used TEXT,
  p_industry TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_analytics_id UUID;
  v_workspace_id UUID;
  v_user_id UUID;
  v_message_count INTEGER;
BEGIN
  -- Get thread details
  SELECT 
    user_id,
    organization_id
  INTO v_user_id, v_workspace_id
  FROM sam_conversation_threads
  WHERE id = p_thread_id;
  
  -- Count messages
  SELECT COUNT(*)
  INTO v_message_count
  FROM sam_conversation_messages
  WHERE thread_id = p_thread_id;
  
  -- Insert or update analytics
  INSERT INTO conversation_analytics (
    thread_id,
    workspace_id,
    user_id,
    message_count,
    persona_used,
    industry,
    completion_status
  ) VALUES (
    p_thread_id,
    v_workspace_id,
    v_user_id,
    v_message_count,
    p_persona_used,
    p_industry,
    'in_progress'
  )
  ON CONFLICT (thread_id) DO UPDATE SET
    message_count = v_message_count,
    updated_at = NOW()
  RETURNING id INTO v_analytics_id;
  
  RETURN v_analytics_id;
END;
$$;

-- ============================================================================
-- INITIAL DATA / BACKFILL
-- ============================================================================

-- Set existing users to trial status if created within last 30 days
UPDATE users 
SET 
  subscription_status = 'trial',
  trial_ends_at = created_at + INTERVAL '30 days'
WHERE 
  subscription_status IS NULL
  AND created_at > NOW() - INTERVAL '30 days';

-- Set older users to active
UPDATE users 
SET subscription_status = 'active'
WHERE 
  subscription_status IS NULL
  AND created_at <= NOW() - INTERVAL '30 days';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify tables created
SELECT 
  schemaname, 
  tablename 
FROM pg_tables 
WHERE tablename IN (
  'conversation_analytics',
  'system_health_logs',
  'system_alerts',
  'qa_autofix_logs',
  'deployment_logs',
  'user_sessions'
)
ORDER BY tablename;

-- Verify user subscription columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN (
    'subscription_status',
    'trial_ends_at',
    'cancelled_at',
    'cancellation_reason'
  );
