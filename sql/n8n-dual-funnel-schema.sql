-- N8N Dual Funnel Database Schema
-- Supports both Core and Dynamic funnel systems for Sam AI

-- ============================================================================
-- CORE FUNNEL TABLES
-- ============================================================================

-- Core Funnel Templates (Pre-built, proven funnels)
CREATE TABLE IF NOT EXISTS core_funnel_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_type TEXT NOT NULL CHECK (funnel_type IN ('sam_signature', 'event_invitation', 'product_launch', 'partnership', 'nurture_sequence')),
  name TEXT NOT NULL,
  description TEXT,
  industry TEXT, -- 'technology', 'finance', 'healthcare', 'manufacturing', 'general'
  target_role TEXT, -- 'ceo', 'cto', 'cfo', 'founder', 'director', 'manager', 'general'
  company_size TEXT, -- 'startup', 'smb', 'mid_market', 'enterprise', 'general'
  
  -- N8N Integration
  n8n_workflow_id TEXT UNIQUE NOT NULL,
  n8n_workflow_json JSONB, -- Backup of workflow definition
  
  -- Performance Metrics
  total_executions INTEGER DEFAULT 0,
  avg_response_rate DECIMAL(5,2) DEFAULT 0,
  avg_conversion_rate DECIMAL(5,2) DEFAULT 0,
  avg_completion_time INTERVAL,
  
  -- Template Configuration
  step_count INTEGER NOT NULL,
  default_timing JSONB, -- Default timing between steps
  message_templates JSONB, -- Template messages for each step
  personalization_variables JSONB, -- Available variables for personalization
  
  -- Status and Metadata
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  created_by TEXT,
  tags TEXT[],
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Core Funnel Executions (Instances of core funnel runs)
CREATE TABLE IF NOT EXISTS core_funnel_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES core_funnel_templates(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  
  -- N8N Integration
  n8n_execution_id TEXT UNIQUE,
  n8n_workflow_id TEXT NOT NULL,
  
  -- Execution Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')),
  current_step INTEGER DEFAULT 1,
  
  -- Prospect Tracking
  prospects_total INTEGER NOT NULL,
  prospects_processed INTEGER DEFAULT 0,
  prospects_active INTEGER DEFAULT 0,
  prospects_completed INTEGER DEFAULT 0,
  prospects_failed INTEGER DEFAULT 0,
  
  -- Performance Metrics
  messages_sent INTEGER DEFAULT 0,
  responses_received INTEGER DEFAULT 0,
  meetings_booked INTEGER DEFAULT 0,
  unsubscribes INTEGER DEFAULT 0,
  
  -- Timing
  started_at TIMESTAMP,
  last_activity_at TIMESTAMP,
  estimated_completion_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Configuration
  execution_variables JSONB, -- Variables used for this execution
  timing_overrides JSONB, -- Custom timing for this execution
  
  -- Results and Analytics
  final_stats JSONB,
  performance_summary JSONB,
  error_details JSONB,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- DYNAMIC FUNNEL TABLES
-- ============================================================================

-- Dynamic Funnel Definitions (AI-generated, custom funnels)
CREATE TABLE IF NOT EXISTS dynamic_funnel_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  
  -- Funnel Identity
  name TEXT NOT NULL,
  description TEXT,
  ai_prompt TEXT NOT NULL, -- Original conversation prompt from Sam
  
  -- Target Configuration
  target_persona JSONB NOT NULL, -- Detailed prospect profile
  business_objective TEXT NOT NULL,
  value_proposition TEXT,
  
  -- Funnel Logic
  funnel_logic JSONB NOT NULL, -- Custom workflow logic and rules
  adaptation_rules JSONB, -- Rules for automatic adaptation
  
  -- N8N Integration
  n8n_workflow_json JSONB NOT NULL, -- Generated N8N workflow
  n8n_workflow_id TEXT UNIQUE,
  
  -- AI Generation Metadata
  created_by_sam BOOLEAN DEFAULT true,
  ai_model_used TEXT, -- Which AI model generated this funnel
  confidence_score DECIMAL(3,2), -- AI confidence in funnel design (0-1)
  generation_reasoning TEXT, -- AI's reasoning for funnel design
  
  -- Performance Learning
  execution_count INTEGER DEFAULT 0,
  adaptation_count INTEGER DEFAULT 0,
  avg_performance_score DECIMAL(3,2),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_experimental BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Dynamic Funnel Steps (Individual steps in dynamic funnels)
CREATE TABLE IF NOT EXISTS dynamic_funnel_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id UUID REFERENCES dynamic_funnel_definitions(id) ON DELETE CASCADE,
  
  -- Step Configuration
  step_order INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  step_type TEXT NOT NULL CHECK (step_type IN ('message', 'wait', 'condition', 'webhook', 'adaptation_point')),
  
  -- Trigger Conditions
  trigger_condition JSONB, -- Conditions for this step to execute
  timing_config JSONB, -- Timing configuration (delay, schedule, etc.)
  
  -- Message Content
  message_template TEXT,
  message_variables JSONB, -- Variables for personalization
  channel_config JSONB, -- LinkedIn, email, etc. configuration
  
  -- Logic and Flow
  success_action JSONB, -- What happens on success
  failure_action JSONB, -- What happens on failure
  adaptation_triggers JSONB, -- Triggers for funnel adaptation
  
  -- Performance Tracking
  execution_count INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 0,
  avg_response_time INTERVAL,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(funnel_id, step_order)
);

-- Dynamic Funnel Executions (Instances of dynamic funnel runs)
CREATE TABLE IF NOT EXISTS dynamic_funnel_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id UUID REFERENCES dynamic_funnel_definitions(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  
  -- N8N Integration
  n8n_execution_id TEXT UNIQUE,
  n8n_workflow_id TEXT NOT NULL,
  
  -- Execution Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')),
  current_step INTEGER DEFAULT 1,
  total_steps INTEGER NOT NULL,
  
  -- Prospect Distribution (Track prospects at each step)
  prospects_total INTEGER NOT NULL,
  prospects_in_step JSONB DEFAULT '{}', -- { "step_1": 100, "step_2": 85, ... }
  prospects_completed INTEGER DEFAULT 0,
  prospects_failed INTEGER DEFAULT 0,
  
  -- Adaptation Tracking
  adaptation_history JSONB DEFAULT '[]', -- Track all adaptations made during execution
  adaptation_triggers_fired JSONB DEFAULT '[]', -- Track triggered adaptations
  current_adaptation_version INTEGER DEFAULT 1,
  
  -- Performance Metrics
  step_performance JSONB DEFAULT '{}', -- Performance metrics per step
  overall_performance_score DECIMAL(3,2),
  response_patterns JSONB, -- Patterns in prospect responses
  
  -- Timing
  started_at TIMESTAMP,
  last_adaptation_at TIMESTAMP,
  estimated_completion_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Results
  performance_metrics JSONB,
  learning_insights JSONB, -- Insights generated for future funnels
  error_details JSONB,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- SHARED PERFORMANCE AND ANALYTICS TABLES
-- ============================================================================

-- Unified Funnel Performance Metrics
CREATE TABLE IF NOT EXISTS funnel_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  
  -- Funnel Identification
  funnel_type TEXT NOT NULL CHECK (funnel_type IN ('core', 'dynamic')),
  template_or_definition_id UUID NOT NULL, -- References either core template or dynamic definition
  execution_id UUID, -- References either core or dynamic execution
  
  -- Standard Metrics
  prospects_total INTEGER NOT NULL,
  prospects_contacted INTEGER DEFAULT 0,
  prospects_responded INTEGER DEFAULT 0,
  prospects_converted INTEGER DEFAULT 0,
  prospects_unsubscribed INTEGER DEFAULT 0,
  
  -- Calculated Rates
  response_rate DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN prospects_contacted > 0 
    THEN (prospects_responded::DECIMAL / prospects_contacted::DECIMAL) * 100 
    ELSE 0 END
  ) STORED,
  conversion_rate DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN prospects_responded > 0 
    THEN (prospects_converted::DECIMAL / prospects_responded::DECIMAL) * 100 
    ELSE 0 END
  ) STORED,
  unsubscribe_rate DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN prospects_contacted > 0 
    THEN (prospects_unsubscribed::DECIMAL / prospects_contacted::DECIMAL) * 100 
    ELSE 0 END
  ) STORED,
  
  -- Step-by-Step Performance
  step_performance JSONB DEFAULT '{}', -- Detailed metrics per funnel step
  
  -- Timing Metrics
  avg_response_time INTERVAL,
  avg_conversion_time INTERVAL,
  funnel_completion_rate DECIMAL(5,2),
  
  -- Quality Metrics
  response_sentiment_scores JSONB, -- AI-analyzed sentiment of responses
  message_quality_scores JSONB, -- AI-assessed message quality
  personalization_effectiveness DECIMAL(3,2),
  
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Funnel Step Logs (Detailed logging for both funnel types)
CREATE TABLE IF NOT EXISTS funnel_step_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id TEXT NOT NULL, -- N8N execution ID
  funnel_type TEXT NOT NULL CHECK (funnel_type IN ('core', 'dynamic')),
  
  -- Step Information
  prospect_id UUID REFERENCES campaign_prospects(id),
  step_identifier TEXT NOT NULL, -- Step name for core, step_order for dynamic
  step_type TEXT NOT NULL,
  
  -- Execution Details
  result TEXT NOT NULL CHECK (result IN ('success', 'failure', 'pending', 'skipped')),
  execution_time_ms INTEGER,
  
  -- Data and Context
  input_data JSONB,
  output_data JSONB,
  error_details JSONB,
  
  -- Metadata
  n8n_node_id TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Funnel Adaptation Logs (Track AI adaptations for dynamic funnels)
CREATE TABLE IF NOT EXISTS funnel_adaptation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id UUID REFERENCES dynamic_funnel_definitions(id) ON DELETE CASCADE,
  execution_id TEXT, -- N8N execution ID
  
  -- Adaptation Event
  event_type TEXT NOT NULL CHECK (event_type IN ('adaptation_triggered', 'adaptation_applied', 'step_failure', 'response_pattern_detected')),
  trigger_reason TEXT NOT NULL,
  
  -- Adaptation Details
  step_order INTEGER,
  original_config JSONB,
  adapted_config JSONB,
  adaptation_reasoning TEXT,
  
  -- Performance Impact
  before_performance JSONB,
  after_performance JSONB,
  adaptation_effectiveness DECIMAL(3,2),
  
  -- AI Metadata
  ai_model_used TEXT,
  confidence_score DECIMAL(3,2),
  
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Webhook Error Logs (Error tracking for N8N webhooks)
CREATE TABLE IF NOT EXISTS webhook_error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  
  -- Error Details
  event_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_code TEXT,
  stack_trace TEXT,
  
  -- Request Context
  payload_data JSONB,
  request_headers JSONB,
  
  -- Resolution
  resolved BOOLEAN DEFAULT false,
  resolution_notes TEXT,
  resolved_at TIMESTAMP,
  
  timestamp TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- ENHANCED CAMPAIGNS TABLE FOR FUNNEL SUPPORT
-- ============================================================================

-- Add funnel-specific columns to existing campaigns table
DO $$ 
BEGIN
  -- Add columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'funnel_type') THEN
    ALTER TABLE campaigns ADD COLUMN funnel_type TEXT CHECK (funnel_type IN ('core', 'dynamic'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'core_template_id') THEN
    ALTER TABLE campaigns ADD COLUMN core_template_id UUID REFERENCES core_funnel_templates(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'dynamic_definition_id') THEN
    ALTER TABLE campaigns ADD COLUMN dynamic_definition_id UUID REFERENCES dynamic_funnel_definitions(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'n8n_workflow_id') THEN
    ALTER TABLE campaigns ADD COLUMN n8n_workflow_id TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'n8n_execution_id') THEN
    ALTER TABLE campaigns ADD COLUMN n8n_execution_id TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'funnel_configuration') THEN
    ALTER TABLE campaigns ADD COLUMN funnel_configuration JSONB DEFAULT '{}';
  END IF;
END $$;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Core Funnel Indexes
CREATE INDEX IF NOT EXISTS idx_core_templates_industry_role ON core_funnel_templates(industry, target_role);
CREATE INDEX IF NOT EXISTS idx_core_templates_funnel_type ON core_funnel_templates(funnel_type);
CREATE INDEX IF NOT EXISTS idx_core_templates_performance ON core_funnel_templates(avg_response_rate DESC, avg_conversion_rate DESC);

CREATE INDEX IF NOT EXISTS idx_core_executions_campaign ON core_funnel_executions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_core_executions_template ON core_funnel_executions(template_id);
CREATE INDEX IF NOT EXISTS idx_core_executions_status ON core_funnel_executions(status);
CREATE INDEX IF NOT EXISTS idx_core_executions_n8n ON core_funnel_executions(n8n_execution_id);

-- Dynamic Funnel Indexes
CREATE INDEX IF NOT EXISTS idx_dynamic_definitions_campaign ON dynamic_funnel_definitions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_dynamic_definitions_n8n ON dynamic_funnel_definitions(n8n_workflow_id);
CREATE INDEX IF NOT EXISTS idx_dynamic_definitions_performance ON dynamic_funnel_definitions(avg_performance_score DESC);

CREATE INDEX IF NOT EXISTS idx_dynamic_steps_funnel_order ON dynamic_funnel_steps(funnel_id, step_order);
CREATE INDEX IF NOT EXISTS idx_dynamic_steps_type ON dynamic_funnel_steps(step_type);

CREATE INDEX IF NOT EXISTS idx_dynamic_executions_funnel ON dynamic_funnel_executions(funnel_id);
CREATE INDEX IF NOT EXISTS idx_dynamic_executions_campaign ON dynamic_funnel_executions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_dynamic_executions_status ON dynamic_funnel_executions(status);

-- Performance Metrics Indexes
CREATE INDEX IF NOT EXISTS idx_performance_metrics_campaign ON funnel_performance_metrics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_funnel_type ON funnel_performance_metrics(funnel_type);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_rates ON funnel_performance_metrics(response_rate DESC, conversion_rate DESC);

-- Funnel Step Logs Indexes
CREATE INDEX IF NOT EXISTS idx_funnel_step_logs_execution ON funnel_step_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_funnel_step_logs_prospect ON funnel_step_logs(prospect_id);
CREATE INDEX IF NOT EXISTS idx_funnel_step_logs_timestamp ON funnel_step_logs(timestamp);

-- Funnel Adaptation Logs Indexes
CREATE INDEX IF NOT EXISTS idx_adaptation_logs_definition ON funnel_adaptation_logs(definition_id);
CREATE INDEX IF NOT EXISTS idx_adaptation_logs_execution ON funnel_adaptation_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_adaptation_logs_timestamp ON funnel_adaptation_logs(timestamp);

-- Webhook Error Logs Indexes
CREATE INDEX IF NOT EXISTS idx_webhook_errors_execution ON webhook_error_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_webhook_errors_workflow ON webhook_error_logs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_webhook_errors_timestamp ON webhook_error_logs(timestamp);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update performance metrics automatically
CREATE OR REPLACE FUNCTION update_funnel_performance_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Update core funnel template metrics
  IF TG_TABLE_NAME = 'core_funnel_executions' AND NEW.status = 'completed' THEN
    UPDATE core_funnel_templates 
    SET 
      total_executions = total_executions + 1,
      avg_response_rate = (
        SELECT AVG((prospects_responded::DECIMAL / prospects_contacted::DECIMAL) * 100)
        FROM core_funnel_executions 
        WHERE template_id = NEW.template_id AND status = 'completed' AND prospects_contacted > 0
      ),
      avg_conversion_rate = (
        SELECT AVG((meetings_booked::DECIMAL / prospects_responded::DECIMAL) * 100)
        FROM core_funnel_executions 
        WHERE template_id = NEW.template_id AND status = 'completed' AND prospects_responded > 0
      ),
      updated_at = NOW()
    WHERE id = NEW.template_id;
  END IF;
  
  -- Update dynamic funnel definition metrics
  IF TG_TABLE_NAME = 'dynamic_funnel_executions' AND NEW.status = 'completed' THEN
    UPDATE dynamic_funnel_definitions 
    SET 
      execution_count = execution_count + 1,
      avg_performance_score = COALESCE(NEW.overall_performance_score, avg_performance_score),
      updated_at = NOW()
    WHERE id = NEW.funnel_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_update_core_funnel_metrics ON core_funnel_executions;
CREATE TRIGGER trigger_update_core_funnel_metrics
  AFTER UPDATE ON core_funnel_executions
  FOR EACH ROW 
  EXECUTE FUNCTION update_funnel_performance_metrics();

DROP TRIGGER IF EXISTS trigger_update_dynamic_funnel_metrics ON dynamic_funnel_executions;
CREATE TRIGGER trigger_update_dynamic_funnel_metrics
  AFTER UPDATE ON dynamic_funnel_executions
  FOR EACH ROW 
  EXECUTE FUNCTION update_funnel_performance_metrics();

-- Function to automatically update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create update triggers for all tables
CREATE TRIGGER trigger_core_templates_updated_at BEFORE UPDATE ON core_funnel_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_core_executions_updated_at BEFORE UPDATE ON core_funnel_executions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_dynamic_definitions_updated_at BEFORE UPDATE ON dynamic_funnel_definitions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_dynamic_steps_updated_at BEFORE UPDATE ON dynamic_funnel_steps FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_dynamic_executions_updated_at BEFORE UPDATE ON dynamic_funnel_executions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_performance_metrics_updated_at BEFORE UPDATE ON funnel_performance_metrics FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- VIEWS FOR ANALYTICS
-- ============================================================================

-- Core Funnel Performance View
CREATE OR REPLACE VIEW core_funnel_performance_view AS
SELECT 
  t.id as template_id,
  t.name as template_name,
  t.funnel_type,
  t.industry,
  t.target_role,
  t.total_executions,
  t.avg_response_rate,
  t.avg_conversion_rate,
  COUNT(e.id) as active_executions,
  AVG(e.prospects_processed) as avg_prospects_per_execution,
  MAX(e.updated_at) as last_execution_date
FROM core_funnel_templates t
LEFT JOIN core_funnel_executions e ON t.id = e.template_id AND e.status = 'running'
WHERE t.is_active = true
GROUP BY t.id, t.name, t.funnel_type, t.industry, t.target_role, t.total_executions, t.avg_response_rate, t.avg_conversion_rate;

-- Dynamic Funnel Performance View
CREATE OR REPLACE VIEW dynamic_funnel_performance_view AS
SELECT 
  d.id as definition_id,
  d.name as funnel_name,
  d.campaign_id,
  d.target_persona,
  d.execution_count,
  d.adaptation_count,
  d.avg_performance_score,
  COUNT(e.id) as active_executions,
  AVG(e.overall_performance_score) as current_avg_performance,
  MAX(e.updated_at) as last_execution_date
FROM dynamic_funnel_definitions d
LEFT JOIN dynamic_funnel_executions e ON d.id = e.funnel_id AND e.status = 'running'
WHERE d.is_active = true
GROUP BY d.id, d.name, d.campaign_id, d.target_persona, d.execution_count, d.adaptation_count, d.avg_performance_score;

-- Combined Campaign Funnel View
CREATE OR REPLACE VIEW campaign_funnel_overview AS
SELECT 
  c.id as campaign_id,
  c.name as campaign_name,
  c.funnel_type,
  CASE 
    WHEN c.funnel_type = 'core' THEN ct.name
    WHEN c.funnel_type = 'dynamic' THEN dd.name
    ELSE 'Unknown'
  END as funnel_name,
  c.status as campaign_status,
  c.n8n_workflow_id,
  c.n8n_execution_id,
  pm.prospects_total,
  pm.prospects_contacted,
  pm.prospects_responded,
  pm.prospects_converted,
  pm.response_rate,
  pm.conversion_rate,
  c.created_at as campaign_created_at,
  c.updated_at as campaign_updated_at
FROM campaigns c
LEFT JOIN core_funnel_templates ct ON c.core_template_id = ct.id
LEFT JOIN dynamic_funnel_definitions dd ON c.dynamic_definition_id = dd.id
LEFT JOIN funnel_performance_metrics pm ON c.id = pm.campaign_id
WHERE c.funnel_type IS NOT NULL;

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO sam_ai_user;
-- GRANT SELECT ON core_funnel_performance_view TO sam_ai_user;
-- GRANT SELECT ON dynamic_funnel_performance_view TO sam_ai_user;
-- GRANT SELECT ON campaign_funnel_overview TO sam_ai_user;