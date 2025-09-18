-- Create ICP Configurations Table
-- Stores the 20 B2B market niche ICP configurations for user selection

-- Create ICP configurations table
CREATE TABLE IF NOT EXISTS icp_configurations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Basic Configuration Info
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  market_niche TEXT NOT NULL,
  industry_vertical TEXT NOT NULL,
  
  -- Target Profile Configuration
  target_profile JSONB NOT NULL DEFAULT '{}',
  
  -- Decision Makers Configuration
  decision_makers JSONB NOT NULL DEFAULT '{}',
  
  -- Pain Points & Triggers
  pain_points JSONB NOT NULL DEFAULT '{}',
  
  -- Buying Process Configuration
  buying_process JSONB NOT NULL DEFAULT '{}',
  
  -- Messaging Strategy Configuration
  messaging_strategy JSONB NOT NULL DEFAULT '{}',
  
  -- Success Metrics & Benchmarks
  success_metrics JSONB NOT NULL DEFAULT '{}',
  
  -- Additional Configuration
  tags TEXT[] DEFAULT '{}',
  complexity_level TEXT DEFAULT 'medium' CHECK (complexity_level IN ('simple', 'medium', 'complex')),
  is_active BOOLEAN DEFAULT TRUE,
  is_template BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  version TEXT DEFAULT '1.0'
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_icp_configurations_active ON icp_configurations(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_icp_configurations_market_niche ON icp_configurations(market_niche);
CREATE INDEX IF NOT EXISTS idx_icp_configurations_industry ON icp_configurations(industry_vertical);
CREATE INDEX IF NOT EXISTS idx_icp_configurations_tags ON icp_configurations USING gin(tags);

-- Create user ICP selections table (for users to save their selected/customized ICPs)
CREATE TABLE IF NOT EXISTS user_icp_selections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  workspace_id TEXT,
  
  -- ICP Configuration Reference
  base_icp_config_id UUID REFERENCES icp_configurations(id),
  
  -- User Customizations
  custom_name TEXT,
  custom_description TEXT,
  custom_target_profile JSONB DEFAULT '{}',
  custom_decision_makers JSONB DEFAULT '{}',
  custom_pain_points JSONB DEFAULT '{}',
  custom_buying_process JSONB DEFAULT '{}',
  custom_messaging_strategy JSONB DEFAULT '{}',
  custom_success_metrics JSONB DEFAULT '{}',
  
  -- Selection Status
  is_active BOOLEAN DEFAULT TRUE,
  is_primary BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- Create indexes for user selections
CREATE INDEX IF NOT EXISTS idx_user_icp_selections_user ON user_icp_selections(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_icp_selections_workspace ON user_icp_selections(workspace_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_icp_selections_primary ON user_icp_selections(user_id, is_primary) WHERE is_primary = TRUE;

-- Enable RLS
ALTER TABLE icp_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_icp_selections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ICP configurations (public read for templates)
CREATE POLICY "ICP configurations are readable by everyone" ON icp_configurations
  FOR SELECT USING (is_template = TRUE AND is_active = TRUE);

CREATE POLICY "ICP configurations are writable by authenticated users" ON icp_configurations
  FOR ALL TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

-- RLS Policies for user ICP selections
CREATE POLICY "Users can manage their own ICP selections" ON user_icp_selections
  FOR ALL USING (user_id = auth.uid()::uuid);

-- Function to get user's active ICP configuration
CREATE OR REPLACE FUNCTION get_user_active_icp(p_user_id UUID)
RETURNS TABLE(
  selection_id UUID,
  config_id UUID,
  name TEXT,
  display_name TEXT,
  market_niche TEXT,
  industry_vertical TEXT,
  target_profile JSONB,
  decision_makers JSONB,
  pain_points JSONB,
  buying_process JSONB,
  messaging_strategy JSONB,
  success_metrics JSONB,
  is_customized BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    us.id as selection_id,
    ic.id as config_id,
    COALESCE(us.custom_name, ic.name) as name,
    COALESCE(us.custom_name, ic.display_name) as display_name,
    ic.market_niche,
    ic.industry_vertical,
    CASE 
      WHEN us.custom_target_profile != '{}' THEN us.custom_target_profile 
      ELSE ic.target_profile 
    END as target_profile,
    CASE 
      WHEN us.custom_decision_makers != '{}' THEN us.custom_decision_makers 
      ELSE ic.decision_makers 
    END as decision_makers,
    CASE 
      WHEN us.custom_pain_points != '{}' THEN us.custom_pain_points 
      ELSE ic.pain_points 
    END as pain_points,
    CASE 
      WHEN us.custom_buying_process != '{}' THEN us.custom_buying_process 
      ELSE ic.buying_process 
    END as buying_process,
    CASE 
      WHEN us.custom_messaging_strategy != '{}' THEN us.custom_messaging_strategy 
      ELSE ic.messaging_strategy 
    END as messaging_strategy,
    CASE 
      WHEN us.custom_success_metrics != '{}' THEN us.custom_success_metrics 
      ELSE ic.success_metrics 
    END as success_metrics,
    (us.custom_target_profile != '{}' OR 
     us.custom_decision_makers != '{}' OR 
     us.custom_pain_points != '{}' OR 
     us.custom_buying_process != '{}' OR 
     us.custom_messaging_strategy != '{}' OR 
     us.custom_success_metrics != '{}') as is_customized
  FROM user_icp_selections us
  JOIN icp_configurations ic ON ic.id = us.base_icp_config_id
  WHERE us.user_id = p_user_id 
    AND us.is_active = TRUE 
    AND us.is_primary = TRUE
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to set user's primary ICP
CREATE OR REPLACE FUNCTION set_user_primary_icp(
  p_user_id UUID,
  p_config_id UUID,
  p_workspace_id TEXT DEFAULT 'default'
)
RETURNS UUID AS $$
DECLARE
  selection_id UUID;
BEGIN
  -- Deactivate current primary ICP
  UPDATE user_icp_selections 
  SET is_primary = FALSE, updated_at = NOW()
  WHERE user_id = p_user_id AND is_primary = TRUE;
  
  -- Check if user already has this ICP configuration
  SELECT id INTO selection_id
  FROM user_icp_selections
  WHERE user_id = p_user_id 
    AND base_icp_config_id = p_config_id
    AND workspace_id = p_workspace_id;
  
  IF selection_id IS NULL THEN
    -- Create new selection
    INSERT INTO user_icp_selections (
      user_id, 
      workspace_id, 
      base_icp_config_id, 
      is_active, 
      is_primary, 
      last_used_at
    ) VALUES (
      p_user_id, 
      p_workspace_id, 
      p_config_id, 
      TRUE, 
      TRUE, 
      NOW()
    ) RETURNING id INTO selection_id;
  ELSE
    -- Update existing selection
    UPDATE user_icp_selections 
    SET is_primary = TRUE, 
        is_active = TRUE, 
        last_used_at = NOW(),
        updated_at = NOW()
    WHERE id = selection_id;
  END IF;
  
  RETURN selection_id;
END;
$$ LANGUAGE plpgsql;

-- Add update trigger
CREATE OR REPLACE FUNCTION update_icp_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_icp_configurations_updated_at 
  BEFORE UPDATE ON icp_configurations 
  FOR EACH ROW EXECUTE FUNCTION update_icp_updated_at_column();

CREATE TRIGGER update_user_icp_selections_updated_at 
  BEFORE UPDATE ON user_icp_selections 
  FOR EACH ROW EXECUTE FUNCTION update_icp_updated_at_column();

COMMENT ON TABLE icp_configurations IS 'Template ICP configurations for 20 B2B market niches';
COMMENT ON TABLE user_icp_selections IS 'User-selected and customized ICP configurations';
COMMENT ON FUNCTION get_user_active_icp IS 'Get user''s currently active ICP configuration with customizations';
COMMENT ON FUNCTION set_user_primary_icp IS 'Set user''s primary ICP configuration';