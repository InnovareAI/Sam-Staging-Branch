-- Create Sam Template System Tables
-- Migration: 20250918150000_create_template_system_tables

-- Template Library Table
CREATE TABLE IF NOT EXISTS sam_template_library (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('connection_request', 'follow_up_1', 'follow_up_2', 'follow_up_3', 'email', 'sequence')),
  content TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  industry TEXT,
  campaign_type TEXT,
  target_audience TEXT,
  performance_data JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT sam_template_name_length CHECK (char_length(name) >= 3 AND char_length(name) <= 100),
  CONSTRAINT sam_template_content_length CHECK (char_length(content) >= 10 AND char_length(content) <= 10000)
);

-- Template Performance Tracking Table
CREATE TABLE IF NOT EXISTS template_performance_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  template_id UUID REFERENCES sam_template_library(id) ON DELETE CASCADE,
  campaign_id UUID, -- References campaigns table if needed
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  performance_data JSONB DEFAULT '{}',
  context JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_performance_data CHECK (
    performance_data IS NOT NULL AND 
    jsonb_typeof(performance_data) = 'object'
  )
);

-- Sam Learning Feedback Table
CREATE TABLE IF NOT EXISTS sam_learning_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES sam_template_library(id) ON DELETE SET NULL,
  user_feedback JSONB DEFAULT '{}',
  performance_context JSONB DEFAULT '{}',
  context JSONB DEFAULT '{}',
  learning_timestamp TIMESTAMPTZ DEFAULT NOW(),
  confidence_score DECIMAL(3,2) DEFAULT 0.5 CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
  
  -- Constraints
  CONSTRAINT valid_user_feedback CHECK (
    user_feedback IS NOT NULL AND 
    jsonb_typeof(user_feedback) = 'object'
  )
);

-- Create Performance Indexes
CREATE INDEX IF NOT EXISTS idx_sam_template_library_workspace_id ON sam_template_library(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sam_template_library_type ON sam_template_library(type);
CREATE INDEX IF NOT EXISTS idx_sam_template_library_industry ON sam_template_library(industry);
CREATE INDEX IF NOT EXISTS idx_sam_template_library_campaign_type ON sam_template_library(campaign_type);
CREATE INDEX IF NOT EXISTS idx_sam_template_library_tags ON sam_template_library USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_sam_template_library_active ON sam_template_library(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sam_template_library_usage ON sam_template_library(usage_count DESC);

CREATE INDEX IF NOT EXISTS idx_template_performance_workspace_id ON template_performance_tracking(workspace_id);
CREATE INDEX IF NOT EXISTS idx_template_performance_template_id ON template_performance_tracking(template_id);
CREATE INDEX IF NOT EXISTS idx_template_performance_user_id ON template_performance_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_template_performance_recorded_at ON template_performance_tracking(recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_sam_learning_workspace_id ON sam_learning_feedback(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sam_learning_user_id ON sam_learning_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_sam_learning_template_id ON sam_learning_feedback(template_id);
CREATE INDEX IF NOT EXISTS idx_sam_learning_timestamp ON sam_learning_feedback(learning_timestamp DESC);

-- Enable Row Level Security
ALTER TABLE sam_template_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_performance_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE sam_learning_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sam_template_library
CREATE POLICY IF NOT EXISTS "Users can access templates from their workspace" ON sam_template_library
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for template_performance_tracking  
CREATE POLICY IF NOT EXISTS "Users can access performance data from their workspace" ON template_performance_tracking
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM profiles WHERE id = auth.uid()
    )
  );

-- RLS Policies for sam_learning_feedback
CREATE POLICY IF NOT EXISTS "Users can access learning feedback from their workspace" ON sam_learning_feedback
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Insert trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sam_template_library_updated_at 
  BEFORE UPDATE ON sam_template_library 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to safely increment usage count
CREATE OR REPLACE FUNCTION increment_template_usage(template_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE sam_template_library 
  SET 
    usage_count = usage_count + 1,
    performance_data = jsonb_set(
      COALESCE(performance_data, '{}'),
      '{total_usage}',
      to_jsonb(COALESCE((performance_data->>'total_usage')::int, 0) + 1)
    ),
    updated_at = NOW()
  WHERE id = template_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_template_usage(UUID) TO authenticated;