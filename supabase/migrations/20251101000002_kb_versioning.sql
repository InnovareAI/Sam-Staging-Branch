-- Knowledge Base Versioning System
-- Tracks changes to KB items over time
-- Created: Nov 1, 2025

CREATE TABLE IF NOT EXISTS knowledge_base_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  kb_item_id UUID NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,

  -- Version metadata
  version_number INTEGER NOT NULL DEFAULT 1,
  change_type TEXT NOT NULL CHECK (change_type IN ('created', 'updated', 'validated', 'corrected', 'deleted')),
  change_description TEXT,

  -- Snapshot of data at this version
  content_snapshot JSONB NOT NULL, -- Full KB item at this point in time

  -- Change tracking
  changed_fields TEXT[], -- Array of field names that changed
  previous_values JSONB, -- Old values of changed fields
  new_values JSONB, -- New values of changed fields

  -- User tracking
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Metadata
  metadata JSONB -- Additional context like "validated_during_onboarding", "auto_corrected", etc.
);

-- Indexes
CREATE INDEX idx_kb_versions_workspace ON knowledge_base_versions(workspace_id);
CREATE INDEX idx_kb_versions_item ON knowledge_base_versions(kb_item_id);
CREATE INDEX idx_kb_versions_created ON knowledge_base_versions(created_at DESC);
CREATE INDEX idx_kb_versions_change_type ON knowledge_base_versions(change_type);

-- RLS Policies
ALTER TABLE knowledge_base_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view versions for their workspace"
  ON knowledge_base_versions
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert versions"
  ON knowledge_base_versions
  FOR INSERT
  WITH CHECK (true);

-- Add version tracking to knowledge_base table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_base'
    AND column_name = 'current_version'
  ) THEN
    ALTER TABLE knowledge_base
    ADD COLUMN current_version INTEGER DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_base'
    AND column_name = 'version_history_count'
  ) THEN
    ALTER TABLE knowledge_base
    ADD COLUMN version_history_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Function to create version snapshot on KB item update
CREATE OR REPLACE FUNCTION create_kb_version_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  changed_fields TEXT[];
  prev_values JSONB;
  new_values JSONB;
  change_type TEXT;
BEGIN
  -- Detect change type
  IF TG_OP = 'INSERT' THEN
    change_type := 'created';
    changed_fields := ARRAY['*']; -- All fields are new
    prev_values := NULL;
    new_values := row_to_json(NEW)::JSONB;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Determine specific change type
    IF NEW.is_active = false AND OLD.is_active = true THEN
      change_type := 'deleted';
    ELSIF OLD.tags IS NOT NULL AND 'needs-validation' = ANY(OLD.tags) AND NEW.tags IS NOT NULL AND NOT ('needs-validation' = ANY(NEW.tags)) THEN
      change_type := 'validated';
    ELSE
      change_type := 'updated';
    END IF;

    -- Track which fields changed
    changed_fields := ARRAY[]::TEXT[];
    prev_values := '{}'::JSONB;
    new_values := '{}'::JSONB;

    IF NEW.content != OLD.content THEN
      changed_fields := array_append(changed_fields, 'content');
      prev_values := prev_values || jsonb_build_object('content', OLD.content);
      new_values := new_values || jsonb_build_object('content', NEW.content);
    END IF;

    IF NEW.title != OLD.title THEN
      changed_fields := array_append(changed_fields, 'title');
      prev_values := prev_values || jsonb_build_object('title', OLD.title);
      new_values := new_values || jsonb_build_object('title', NEW.title);
    END IF;

    IF NEW.category != OLD.category THEN
      changed_fields := array_append(changed_fields, 'category');
      prev_values := prev_values || jsonb_build_object('category', OLD.category);
      new_values := new_values || jsonb_build_object('category', NEW.category);
    END IF;

    IF NEW.tags != OLD.tags THEN
      changed_fields := array_append(changed_fields, 'tags');
      prev_values := prev_values || jsonb_build_object('tags', OLD.tags);
      new_values := new_values || jsonb_build_object('tags', NEW.tags);
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  -- Only create version if there are actual changes (or it's a create)
  IF TG_OP = 'INSERT' OR array_length(changed_fields, 1) > 0 THEN
    -- Increment version number
    NEW.current_version := COALESCE(OLD.current_version, 0) + 1;

    -- Insert version snapshot
    INSERT INTO knowledge_base_versions (
      workspace_id,
      kb_item_id,
      version_number,
      change_type,
      content_snapshot,
      changed_fields,
      previous_values,
      new_values,
      created_by
    ) VALUES (
      NEW.workspace_id,
      NEW.id,
      NEW.current_version,
      change_type,
      row_to_json(NEW)::JSONB,
      changed_fields,
      prev_values,
      new_values,
      auth.uid()
    );

    -- Update version history count
    NEW.version_history_count := COALESCE(OLD.version_history_count, 0) + 1;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic version tracking
DROP TRIGGER IF EXISTS trigger_kb_version_snapshot ON knowledge_base;
CREATE TRIGGER trigger_kb_version_snapshot
  BEFORE INSERT OR UPDATE ON knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION create_kb_version_snapshot();

-- Function to get version history for a KB item
CREATE OR REPLACE FUNCTION get_kb_version_history(p_kb_item_id UUID, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  version_number INTEGER,
  change_type TEXT,
  changed_fields TEXT[],
  previous_values JSONB,
  new_values JSONB,
  created_by_name TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    kbv.version_number,
    kbv.change_type,
    kbv.changed_fields,
    kbv.previous_values,
    kbv.new_values,
    COALESCE(u.full_name, u.email, 'System') as created_by_name,
    kbv.created_at
  FROM knowledge_base_versions kbv
  LEFT JOIN users u ON kbv.created_by = u.id
  WHERE kbv.kb_item_id = p_kb_item_id
  ORDER BY kbv.version_number DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to compare two versions
CREATE OR REPLACE FUNCTION compare_kb_versions(
  p_kb_item_id UUID,
  p_version_a INTEGER,
  p_version_b INTEGER
)
RETURNS TABLE (
  field_name TEXT,
  version_a_value TEXT,
  version_b_value TEXT,
  changed BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH version_a AS (
    SELECT content_snapshot
    FROM knowledge_base_versions
    WHERE kb_item_id = p_kb_item_id AND version_number = p_version_a
  ),
  version_b AS (
    SELECT content_snapshot
    FROM knowledge_base_versions
    WHERE kb_item_id = p_kb_item_id AND version_number = p_version_b
  )
  SELECT
    key::TEXT as field_name,
    (SELECT content_snapshot->>key FROM version_a) as version_a_value,
    (SELECT content_snapshot->>key FROM version_b) as version_b_value,
    (SELECT content_snapshot->>key FROM version_a) IS DISTINCT FROM (SELECT content_snapshot->>key FROM version_b) as changed
  FROM (
    SELECT DISTINCT key
    FROM version_a, jsonb_object_keys(content_snapshot) as key
    UNION
    SELECT DISTINCT key
    FROM version_b, jsonb_object_keys(content_snapshot) as key
  ) all_keys;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE knowledge_base_versions IS 'Version history for all knowledge base items';
COMMENT ON FUNCTION get_kb_version_history IS 'Get version history for a specific KB item';
COMMENT ON FUNCTION compare_kb_versions IS 'Compare two versions of a KB item side-by-side';
