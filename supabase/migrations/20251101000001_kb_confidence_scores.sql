-- Knowledge Base Confidence Scoring System
-- Tracks validation status and confidence for all KB items
-- Created: Nov 1, 2025

CREATE TABLE IF NOT EXISTS knowledge_base_confidence_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kb_item_id UUID NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,

  -- Confidence metrics
  confidence_score DECIMAL(3, 2) NOT NULL DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  source_type TEXT NOT NULL CHECK (source_type IN ('user_input', 'website_auto', 'document_upload', 'ai_inference')),
  validation_status TEXT NOT NULL DEFAULT 'pending' CHECK (validation_status IN ('pending', 'validated', 'rejected', 'corrected')),

  -- Validation history
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES users(id),
  validation_feedback JSONB, -- { original_value, corrected_value, reason }

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(kb_item_id)
);

-- Indexes for performance
CREATE INDEX idx_kb_confidence_workspace ON knowledge_base_confidence_scores(workspace_id);
CREATE INDEX idx_kb_confidence_status ON knowledge_base_confidence_scores(validation_status);
CREATE INDEX idx_kb_confidence_score ON knowledge_base_confidence_scores(confidence_score);
CREATE INDEX idx_kb_confidence_source ON knowledge_base_confidence_scores(source_type);

-- RLS Policies (tenant isolation)
ALTER TABLE knowledge_base_confidence_scores ENABLE ROW LEVEL SECURITY;

-- Users can view confidence scores for their workspace
CREATE POLICY "Users can view confidence scores for their workspace"
  ON knowledge_base_confidence_scores
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Users can update confidence scores for their workspace
CREATE POLICY "Users can update confidence scores for their workspace"
  ON knowledge_base_confidence_scores
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- System can insert confidence scores
CREATE POLICY "System can insert confidence scores"
  ON knowledge_base_confidence_scores
  FOR INSERT
  WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_kb_confidence_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_kb_confidence_updated_at
  BEFORE UPDATE ON knowledge_base_confidence_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_kb_confidence_updated_at();

-- Add source_type and confidence_score to knowledge_base if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_base'
    AND column_name = 'source_type'
  ) THEN
    ALTER TABLE knowledge_base
    ADD COLUMN source_type TEXT DEFAULT 'user_input'
    CHECK (source_type IN ('user_input', 'website_auto', 'document_upload', 'ai_inference', 'sam_discovery'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_base'
    AND column_name = 'auto_confidence'
  ) THEN
    ALTER TABLE knowledge_base
    ADD COLUMN auto_confidence DECIMAL(3, 2) DEFAULT 1.0
    CHECK (auto_confidence >= 0 AND auto_confidence <= 1);
  END IF;
END $$;

-- Add icp_completion_percentage to knowledge_base_icps if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_base_icps'
    AND column_name = 'completion_percentage'
  ) THEN
    ALTER TABLE knowledge_base_icps
    ADD COLUMN completion_percentage INTEGER DEFAULT 0
    CHECK (completion_percentage >= 0 AND completion_percentage <= 100);
  END IF;
END $$;

-- Helper function to get low-confidence items for validation
CREATE OR REPLACE FUNCTION get_validation_needed_items(p_workspace_id UUID, p_threshold DECIMAL DEFAULT 0.8)
RETURNS TABLE (
  kb_item_id UUID,
  category TEXT,
  title TEXT,
  content TEXT,
  confidence_score DECIMAL,
  source_type TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.category,
    kb.title,
    kb.content,
    kcs.confidence_score,
    kcs.source_type,
    kb.created_at
  FROM knowledge_base kb
  JOIN knowledge_base_confidence_scores kcs ON kb.id = kcs.kb_item_id
  WHERE kb.workspace_id = p_workspace_id
    AND kcs.validation_status = 'pending'
    AND kcs.confidence_score < p_threshold
    AND kb.is_active = true
  ORDER BY kcs.confidence_score ASC, kb.created_at DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE knowledge_base_confidence_scores IS 'Tracks confidence and validation status for all KB items';
COMMENT ON FUNCTION get_validation_needed_items IS 'Returns KB items that need user validation (low confidence, pending status)';
