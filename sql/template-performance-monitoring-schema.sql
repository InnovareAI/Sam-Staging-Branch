-- Template Performance & Response Rate Monitoring System
-- Tracks message template effectiveness, response rates, and conversion metrics

-- Message templates with A/B testing support
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Template identification
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'connection_request', 'follow_up_1', 'follow_up_2', 'break_up'
  template_text TEXT NOT NULL,
  variables JSONB DEFAULT '[]', -- ['first_name', 'company_name', 'industry']
  
  -- A/B testing
  is_active BOOLEAN DEFAULT true,
  variant_group TEXT, -- Group templates for A/B testing
  variant_letter TEXT, -- 'A', 'B', 'C'
  
  -- Performance tracking
  times_used INTEGER DEFAULT 0,
  total_responses INTEGER DEFAULT 0,
  positive_responses INTEGER DEFAULT 0,
  meeting_requests INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  
  -- Calculated metrics (updated by triggers)
  response_rate DECIMAL(5,2) DEFAULT 0.0, -- percentage
  positive_rate DECIMAL(5,2) DEFAULT 0.0, -- percentage of positive responses
  conversion_rate DECIMAL(5,2) DEFAULT 0.0, -- percentage leading to meetings/deals
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique template names per workspace
  UNIQUE(workspace_id, name)
);

-- Message sends with template tracking
CREATE TABLE IF NOT EXISTS message_sends (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES workspace_prospects(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES message_templates(id) ON DELETE CASCADE,
  
  -- Message details
  linkedin_account_id TEXT NOT NULL, -- Unipile account used
  message_text TEXT NOT NULL, -- Final personalized message
  personalization_method TEXT DEFAULT 'template_only', -- 'template_only', 'ai_enhanced', 'fully_custom'
  personalization_cost DECIMAL(10,6) DEFAULT 0.0, -- LLM cost for personalization
  
  -- Timing and status
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  linkedin_message_id TEXT, -- LinkedIn's internal message ID if available
  delivery_status TEXT DEFAULT 'sent', -- 'sent', 'delivered', 'failed', 'rate_limited'
  
  -- Response tracking
  response_received BOOLEAN DEFAULT false,
  response_type TEXT, -- 'positive', 'negative', 'neutral', 'auto_reply', 'out_of_office'
  response_text TEXT,
  response_received_at TIMESTAMPTZ,
  response_classification_confidence DECIMAL(3,2), -- 0.0-1.0
  
  -- Engagement metrics
  profile_viewed BOOLEAN DEFAULT false,
  profile_viewed_at TIMESTAMPTZ,
  connection_accepted BOOLEAN DEFAULT false,
  connection_accepted_at TIMESTAMPTZ,
  meeting_requested BOOLEAN DEFAULT false,
  meeting_scheduled BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Response analysis and classification
CREATE TABLE IF NOT EXISTS message_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_send_id UUID NOT NULL REFERENCES message_sends(id) ON DELETE CASCADE,
  
  -- Response content
  response_text TEXT NOT NULL,
  response_received_at TIMESTAMPTZ NOT NULL,
  
  -- AI classification
  sentiment_score DECIMAL(3,2), -- -1.0 to 1.0
  intent_classification TEXT, -- 'interested', 'not_interested', 'information_request', 'meeting_request', 'referral'
  urgency_level TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
  requires_human_review BOOLEAN DEFAULT false,
  
  -- Business outcomes
  leads_to_meeting BOOLEAN DEFAULT false,
  leads_to_deal BOOLEAN DEFAULT false,
  deal_value DECIMAL(12,2),
  
  -- Processing status
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  human_reviewed_at TIMESTAMPTZ,
  human_reviewer_id UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Template performance analytics view
CREATE OR REPLACE VIEW template_performance_analytics AS
SELECT 
  mt.id,
  mt.workspace_id,
  mt.name,
  mt.category,
  mt.variant_group,
  mt.variant_letter,
  mt.is_active,
  
  -- Usage metrics
  mt.times_used,
  COALESCE(sends.total_sends, 0) as actual_sends,
  
  -- Response metrics  
  COALESCE(sends.responses_received, 0) as responses_received,
  COALESCE(sends.positive_responses, 0) as positive_responses,
  COALESCE(sends.meeting_requests, 0) as meeting_requests,
  COALESCE(sends.connections_accepted, 0) as connections_accepted,
  
  -- Calculated rates
  CASE 
    WHEN COALESCE(sends.total_sends, 0) > 0 
    THEN ROUND((COALESCE(sends.responses_received, 0)::decimal / sends.total_sends * 100), 2)
    ELSE 0.0 
  END as actual_response_rate,
  
  CASE 
    WHEN COALESCE(sends.responses_received, 0) > 0 
    THEN ROUND((COALESCE(sends.positive_responses, 0)::decimal / sends.responses_received * 100), 2)
    ELSE 0.0 
  END as positive_response_rate,
  
  CASE 
    WHEN COALESCE(sends.total_sends, 0) > 0 
    THEN ROUND((COALESCE(sends.meeting_requests, 0)::decimal / sends.total_sends * 100), 2)
    ELSE 0.0 
  END as conversion_rate,
  
  -- Cost metrics
  COALESCE(sends.total_personalization_cost, 0) as total_personalization_cost,
  CASE 
    WHEN COALESCE(sends.total_sends, 0) > 0 
    THEN ROUND((COALESCE(sends.total_personalization_cost, 0) / sends.total_sends), 6)
    ELSE 0.0 
  END as cost_per_message,
  
  -- Time metrics
  mt.created_at,
  mt.updated_at

FROM message_templates mt
LEFT JOIN (
  SELECT 
    template_id,
    COUNT(*) as total_sends,
    COUNT(CASE WHEN response_received THEN 1 END) as responses_received,
    COUNT(CASE WHEN response_type = 'positive' THEN 1 END) as positive_responses,
    COUNT(CASE WHEN meeting_requested THEN 1 END) as meeting_requests,
    COUNT(CASE WHEN connection_accepted THEN 1 END) as connections_accepted,
    SUM(personalization_cost) as total_personalization_cost
  FROM message_sends 
  GROUP BY template_id
) sends ON mt.id = sends.template_id;

-- Function to update template performance metrics
CREATE OR REPLACE FUNCTION update_template_performance()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the message_templates table with latest metrics
  UPDATE message_templates 
  SET 
    times_used = (
      SELECT COUNT(*) FROM message_sends WHERE template_id = NEW.template_id
    ),
    total_responses = (
      SELECT COUNT(*) FROM message_sends 
      WHERE template_id = NEW.template_id AND response_received = true
    ),
    positive_responses = (
      SELECT COUNT(*) FROM message_sends 
      WHERE template_id = NEW.template_id AND response_type = 'positive'
    ),
    meeting_requests = (
      SELECT COUNT(*) FROM message_sends 
      WHERE template_id = NEW.template_id AND meeting_requested = true
    ),
    updated_at = NOW()
  WHERE id = NEW.template_id;
  
  -- Recalculate rates
  UPDATE message_templates 
  SET 
    response_rate = CASE 
      WHEN times_used > 0 THEN ROUND((total_responses::decimal / times_used * 100), 2)
      ELSE 0.0 
    END,
    positive_rate = CASE 
      WHEN total_responses > 0 THEN ROUND((positive_responses::decimal / total_responses * 100), 2)
      ELSE 0.0 
    END,
    conversion_rate = CASE 
      WHEN times_used > 0 THEN ROUND((meeting_requests::decimal / times_used * 100), 2)
      ELSE 0.0 
    END
  WHERE id = NEW.template_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update template performance
CREATE TRIGGER update_template_performance_trigger
  AFTER INSERT OR UPDATE ON message_sends
  FOR EACH ROW
  EXECUTE FUNCTION update_template_performance();

-- Function to get top performing templates
CREATE OR REPLACE FUNCTION get_top_performing_templates(
  p_workspace_id UUID,
  p_category TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  template_id UUID,
  template_name TEXT,
  category TEXT,
  variant_info TEXT,
  sends INTEGER,
  responses INTEGER,
  response_rate DECIMAL,
  positive_rate DECIMAL,
  conversion_rate DECIMAL,
  cost_per_message DECIMAL,
  performance_score DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tpa.id,
    tpa.name,
    tpa.category,
    CASE 
      WHEN tpa.variant_group IS NOT NULL 
      THEN tpa.variant_group || ' - ' || tpa.variant_letter
      ELSE 'Single Version'
    END,
    tpa.actual_sends,
    tpa.responses_received,
    tpa.actual_response_rate,
    tpa.positive_response_rate,
    tpa.conversion_rate,
    tpa.cost_per_message,
    -- Performance score: weighted combination of metrics
    ROUND(
      (tpa.actual_response_rate * 0.4 + 
       tpa.positive_response_rate * 0.3 + 
       tpa.conversion_rate * 0.3) *
      -- Penalty for high cost
      CASE WHEN tpa.cost_per_message > 0.01 THEN 0.8 ELSE 1.0 END *
      -- Bonus for sufficient sample size
      CASE WHEN tpa.actual_sends >= 10 THEN 1.0 ELSE 0.7 END,
      2
    ) as performance_score
  FROM template_performance_analytics tpa
  WHERE tpa.workspace_id = p_workspace_id
    AND tpa.is_active = true
    AND (p_category IS NULL OR tpa.category = p_category)
    AND tpa.actual_sends > 0
  ORDER BY performance_score DESC, tpa.actual_response_rate DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_message_templates_workspace_id ON message_templates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_category ON message_templates(category);
CREATE INDEX IF NOT EXISTS idx_message_templates_variant_group ON message_templates(variant_group);
CREATE INDEX IF NOT EXISTS idx_message_sends_template_id ON message_sends(template_id);
CREATE INDEX IF NOT EXISTS idx_message_sends_sent_at ON message_sends(sent_at);
CREATE INDEX IF NOT EXISTS idx_message_sends_response_received ON message_sends(response_received);
CREATE INDEX IF NOT EXISTS idx_message_responses_message_send_id ON message_responses(message_send_id);

-- Enable Row Level Security
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_responses ENABLE ROW LEVEL SECURITY;

-- RLS policies for message_templates
CREATE POLICY "Users can manage templates in their workspaces" ON message_templates
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- RLS policies for message_sends
CREATE POLICY "Users can access sends in their workspaces" ON message_sends
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- RLS policies for message_responses
CREATE POLICY "Users can access responses in their workspaces" ON message_responses
  FOR ALL USING (
    message_send_id IN (
      SELECT ms.id FROM message_sends ms
      JOIN workspace_members wm ON ms.workspace_id = wm.workspace_id
      WHERE wm.user_id = auth.uid()
    )
  );

-- Insert default templates for testing
INSERT INTO message_templates (workspace_id, name, category, template_text, variables, variant_group, variant_letter)
SELECT 
  w.id,
  'Connection Request A',
  'connection_request',
  'Hi {{first_name}}, I noticed you''re working at {{company_name}} in the {{industry}} space. Would love to connect and share insights that could benefit your growth initiatives.',
  '["first_name", "company_name", "industry"]',
  'connection_test',
  'A'
FROM workspaces w
WHERE w.name ILIKE '%chillmine%'
ON CONFLICT (workspace_id, name) DO NOTHING;

INSERT INTO message_templates (workspace_id, name, category, template_text, variables, variant_group, variant_letter)
SELECT 
  w.id,
  'Connection Request B',
  'connection_request',
  'Hello {{first_name}}! Impressed by {{company_name}}''s work in {{industry}}. I''d love to connect and discuss potential synergies between our approaches.',
  '["first_name", "company_name", "industry"]',
  'connection_test',
  'B'
FROM workspaces w
WHERE w.name ILIKE '%chillmine%'
ON CONFLICT (workspace_id, name) DO NOTHING;

-- Success message
DO $$ BEGIN
  RAISE NOTICE '🎯 Template Performance Monitoring System Deployed Successfully!';
  RAISE NOTICE '✅ Tables: message_templates, message_sends, message_responses';
  RAISE NOTICE '✅ View: template_performance_analytics';
  RAISE NOTICE '✅ Function: get_top_performing_templates()';
  RAISE NOTICE '✅ Triggers: Auto-update template performance metrics';
  RAISE NOTICE '✅ RLS: Workspace-based security policies';
  RAISE NOTICE '✅ Sample templates: A/B test variants created for ChillMine';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Ready to track:';
  RAISE NOTICE '  - Response rates by template';
  RAISE NOTICE '  - A/B testing performance';  
  RAISE NOTICE '  - Cost-per-message optimization';
  RAISE NOTICE '  - Conversion tracking';
  RAISE NOTICE '  - Real-time performance analytics';
END $$;