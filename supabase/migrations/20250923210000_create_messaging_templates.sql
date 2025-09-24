-- Messaging Templates System for Sam-First Campaigns
-- Migration: 20250923210000_create_messaging_templates.sql

-- Main messaging templates table
CREATE TABLE IF NOT EXISTS messaging_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  template_name TEXT NOT NULL,
  campaign_type TEXT CHECK (campaign_type IN ('sam_signature', 'event_invitation', 'product_launch', 'partnership', 'custom')),
  industry TEXT,
  target_role TEXT,
  target_company_size TEXT CHECK (target_company_size IN ('startup', 'smb', 'mid_market', 'enterprise')),
  connection_message TEXT NOT NULL,
  alternative_message TEXT,
  follow_up_messages JSONB DEFAULT '[]'::jsonb,
  language TEXT DEFAULT 'en',
  tone TEXT DEFAULT 'professional',
  performance_metrics JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workspace_id, template_name)
);

-- Template performance tracking
CREATE TABLE IF NOT EXISTS template_performance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES messaging_templates(id) ON DELETE CASCADE,
  campaign_id UUID,
  total_sent INTEGER DEFAULT 0,
  total_responses INTEGER DEFAULT 0,
  response_rate DECIMAL(5,2) DEFAULT 0.00,
  connection_rate DECIMAL(5,2) DEFAULT 0.00,
  meeting_rate DECIMAL(5,2) DEFAULT 0.00,
  date_start DATE,
  date_end DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Template components (for dynamic assembly)
CREATE TABLE IF NOT EXISTS template_components (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  component_type TEXT CHECK (component_type IN ('opening', 'pain_point', 'value_prop', 'cta', 'closing')),
  industry TEXT,
  role TEXT,
  language TEXT DEFAULT 'en',
  content TEXT NOT NULL,
  performance_score DECIMAL(3,2) DEFAULT 0.00,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messaging_templates_workspace ON messaging_templates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_messaging_templates_campaign_type ON messaging_templates(campaign_type);
CREATE INDEX IF NOT EXISTS idx_messaging_templates_industry ON messaging_templates(industry);
CREATE INDEX IF NOT EXISTS idx_template_performance_template_id ON template_performance(template_id);
CREATE INDEX IF NOT EXISTS idx_template_components_type ON template_components(component_type);
CREATE INDEX IF NOT EXISTS idx_template_components_industry ON template_components(industry);

-- Enable RLS
ALTER TABLE messaging_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_components ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$ 
BEGIN
  -- Messaging templates access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'messaging_templates' 
    AND policyname = 'Users can access templates in their workspace'
  ) THEN
    CREATE POLICY "Users can access templates in their workspace" ON messaging_templates
      FOR ALL USING (workspace_id = current_setting('app.current_workspace_id', true));
  END IF;

  -- Template performance access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'template_performance' 
    AND policyname = 'Users can access performance in their workspace'
  ) THEN
    CREATE POLICY "Users can access performance in their workspace" ON template_performance
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM messaging_templates mt 
          WHERE mt.id = template_id 
          AND mt.workspace_id = current_setting('app.current_workspace_id', true)
        )
      );
  END IF;

  -- Template components (global access for now)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'template_components' 
    AND policyname = 'All users can access template components'
  ) THEN
    CREATE POLICY "All users can access template components" ON template_components
      FOR ALL USING (true);
  END IF;
END $$;

-- Functions for template management
CREATE OR REPLACE FUNCTION update_template_performance(
  p_template_id UUID,
  p_campaign_id UUID,
  p_sent INTEGER,
  p_responses INTEGER
) RETURNS VOID AS $$
DECLARE
  v_response_rate DECIMAL(5,2);
BEGIN
  v_response_rate := CASE WHEN p_sent > 0 THEN (p_responses::DECIMAL / p_sent::DECIMAL) * 100 ELSE 0 END;
  
  INSERT INTO template_performance (
    template_id, campaign_id, total_sent, total_responses, response_rate, date_start, date_end
  ) VALUES (
    p_template_id, p_campaign_id, p_sent, p_responses, v_response_rate, CURRENT_DATE, CURRENT_DATE
  )
  ON CONFLICT (template_id, campaign_id) DO UPDATE SET
    total_sent = EXCLUDED.total_sent,
    total_responses = EXCLUDED.total_responses,
    response_rate = EXCLUDED.response_rate,
    date_end = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Function to get templates by criteria
CREATE OR REPLACE FUNCTION get_templates_by_criteria(
  p_workspace_id TEXT,
  p_industry TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL,
  p_campaign_type TEXT DEFAULT NULL
) RETURNS TABLE (
  id UUID,
  template_name TEXT,
  campaign_type TEXT,
  industry TEXT,
  target_role TEXT,
  connection_message TEXT,
  alternative_message TEXT,
  follow_up_messages JSONB,
  avg_response_rate DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mt.id,
    mt.template_name,
    mt.campaign_type,
    mt.industry,
    mt.target_role,
    mt.connection_message,
    mt.alternative_message,
    mt.follow_up_messages,
    COALESCE(AVG(tp.response_rate), 0.00) as avg_response_rate
  FROM messaging_templates mt
  LEFT JOIN template_performance tp ON mt.id = tp.template_id
  WHERE mt.workspace_id = p_workspace_id
    AND mt.is_active = true
    AND (p_industry IS NULL OR mt.industry = p_industry)
    AND (p_role IS NULL OR mt.target_role = p_role)
    AND (p_campaign_type IS NULL OR mt.campaign_type = p_campaign_type)
  GROUP BY mt.id, mt.template_name, mt.campaign_type, mt.industry, mt.target_role, 
           mt.connection_message, mt.alternative_message, mt.follow_up_messages
  ORDER BY avg_response_rate DESC, mt.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_messaging_templates_updated_at
  BEFORE UPDATE ON messaging_templates
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();