-- Enhanced Memory Management System
-- Automatic 7-day persistence with user-controlled memory restore

-- Add memory management columns to sam_conversations
ALTER TABLE sam_conversations 
ADD COLUMN IF NOT EXISTS memory_archived BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS memory_archive_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS memory_importance_score INTEGER DEFAULT 1 CHECK (memory_importance_score BETWEEN 1 AND 10),
ADD COLUMN IF NOT EXISTS memory_tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS user_bookmarked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auto_archive_eligible BOOLEAN DEFAULT TRUE;

-- Create memory snapshots table for persistent 7-day archives
CREATE TABLE IF NOT EXISTS memory_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL,
  snapshot_date TIMESTAMPTZ DEFAULT NOW(),
  conversation_count INTEGER NOT NULL,
  total_messages INTEGER NOT NULL,
  memory_summary TEXT, -- AI-generated summary of the memory period
  conversation_ids UUID[] NOT NULL, -- Array of conversation IDs included
  archived_conversations JSONB NOT NULL, -- Full conversation data
  importance_score INTEGER DEFAULT 5,
  user_notes TEXT,
  restore_count INTEGER DEFAULT 0,
  last_restored_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create memory preferences table
CREATE TABLE IF NOT EXISTS user_memory_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  organization_id TEXT NOT NULL,
  auto_archive_enabled BOOLEAN DEFAULT TRUE,
  archive_frequency_days INTEGER DEFAULT 7 CHECK (archive_frequency_days > 0),
  max_active_conversations INTEGER DEFAULT 20,
  memory_retention_days INTEGER DEFAULT 90, -- How long to keep snapshots
  importance_threshold INTEGER DEFAULT 3, -- Minimum importance for auto-archive
  auto_restore_on_login BOOLEAN DEFAULT FALSE,
  memory_notifications BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient memory operations
CREATE INDEX IF NOT EXISTS idx_sam_conversations_memory_archive ON sam_conversations(user_id, memory_archived, created_at) WHERE memory_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_sam_conversations_importance ON sam_conversations(user_id, memory_importance_score, created_at);
CREATE INDEX IF NOT EXISTS idx_memory_snapshots_user_date ON memory_snapshots(user_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_memory_snapshots_organization ON memory_snapshots(organization_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_memory_preferences_user ON user_memory_preferences(user_id);

-- Function to calculate conversation importance score
CREATE OR REPLACE FUNCTION calculate_conversation_importance(
  p_conversation_id UUID
) RETURNS INTEGER AS $$
DECLARE
  conv RECORD;
  importance_score INTEGER := 1;
  message_length INTEGER;
  has_knowledge BOOLEAN;
  has_files BOOLEAN;
  response_quality INTEGER;
BEGIN
  SELECT * INTO conv FROM sam_conversations WHERE id = p_conversation_id;
  
  IF NOT FOUND THEN
    RETURN 1;
  END IF;
  
  -- Base score from message length
  message_length := length(conv.message) + length(conv.response);
  IF message_length > 1000 THEN importance_score := importance_score + 3;
  ELSIF message_length > 500 THEN importance_score := importance_score + 2;
  ELSIF message_length > 200 THEN importance_score := importance_score + 1;
  END IF;
  
  -- Boost for knowledge extraction
  IF conv.knowledge_extracted = TRUE THEN
    importance_score := importance_score + 2;
  END IF;
  
  -- Boost for file uploads
  IF conv.metadata->>'filesUploaded' IS NOT NULL AND (conv.metadata->>'filesUploaded')::integer > 0 THEN
    importance_score := importance_score + 2;
  END IF;
  
  -- Boost for user bookmarks
  IF conv.user_bookmarked = TRUE THEN
    importance_score := importance_score + 5;
  END IF;
  
  -- Boost for privacy/sensitive content
  IF array_length(conv.privacy_tags, 1) > 0 THEN
    importance_score := importance_score + 1;
  END IF;
  
  -- Cap at 10
  importance_score := LEAST(importance_score, 10);
  
  RETURN importance_score;
END;
$$ LANGUAGE plpgsql;

-- Function to create memory snapshot
CREATE OR REPLACE FUNCTION create_memory_snapshot(
  p_user_id UUID,
  p_organization_id TEXT,
  p_days_back INTEGER DEFAULT 7
) RETURNS UUID AS $$
DECLARE
  snapshot_id UUID;
  conversation_data JSONB;
  conversation_ids UUID[];
  conversation_count INTEGER;
  total_messages INTEGER;
  memory_summary TEXT;
  avg_importance DECIMAL;
BEGIN
  -- Get conversations from the specified period
  SELECT 
    array_agg(id),
    count(*),
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'message', message,
        'response', response,
        'created_at', created_at,
        'metadata', metadata,
        'importance_score', memory_importance_score,
        'knowledge_classification', knowledge_classification,
        'privacy_tags', privacy_tags
      ) ORDER BY created_at ASC
    )
  INTO conversation_ids, conversation_count, conversation_data
  FROM sam_conversations 
  WHERE user_id = p_user_id 
    AND organization_id = p_organization_id
    AND created_at >= NOW() - INTERVAL '1 day' * p_days_back
    AND memory_archived = FALSE
    AND auto_archive_eligible = TRUE;
  
  IF conversation_count = 0 THEN
    RAISE NOTICE 'No conversations found for memory snapshot';
    RETURN NULL;
  END IF;
  
  -- Calculate total messages and average importance
  total_messages := conversation_count * 2; -- user + assistant messages
  
  SELECT AVG(memory_importance_score) INTO avg_importance
  FROM sam_conversations 
  WHERE id = ANY(conversation_ids);
  
  -- Generate basic memory summary (could be enhanced with AI)
  memory_summary := format(
    'Memory snapshot from %s days ago containing %s conversations with %s total messages. Average importance: %s/10.',
    p_days_back,
    conversation_count,
    total_messages,
    ROUND(avg_importance, 1)
  );
  
  -- Create snapshot
  INSERT INTO memory_snapshots (
    user_id,
    organization_id,
    conversation_count,
    total_messages,
    memory_summary,
    conversation_ids,
    archived_conversations,
    importance_score
  ) VALUES (
    p_user_id,
    p_organization_id,
    conversation_count,
    total_messages,
    memory_summary,
    conversation_ids,
    conversation_data,
    LEAST(ROUND(avg_importance)::INTEGER, 10)
  ) RETURNING id INTO snapshot_id;
  
  -- Mark conversations as archived
  UPDATE sam_conversations 
  SET memory_archived = TRUE,
      memory_archive_date = NOW(),
      updated_at = NOW()
  WHERE id = ANY(conversation_ids);
  
  RETURN snapshot_id;
END;
$$ LANGUAGE plpgsql;

-- Function to restore memory snapshot
CREATE OR REPLACE FUNCTION restore_memory_snapshot(
  p_snapshot_id UUID,
  p_user_id UUID
) RETURNS TABLE(conversation_data JSONB) AS $$
DECLARE
  snapshot RECORD;
BEGIN
  -- Get snapshot data
  SELECT * INTO snapshot FROM memory_snapshots 
  WHERE id = p_snapshot_id AND user_id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Memory snapshot not found or access denied';
  END IF;
  
  -- Update restore statistics
  UPDATE memory_snapshots 
  SET restore_count = restore_count + 1,
      last_restored_at = NOW(),
      updated_at = NOW()
  WHERE id = p_snapshot_id;
  
  -- Return conversation data
  RETURN QUERY SELECT snapshot.archived_conversations;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-archive old memories based on user preferences
CREATE OR REPLACE FUNCTION auto_archive_memories() RETURNS INTEGER AS $$
DECLARE
  processed_count INTEGER := 0;
  user_prefs RECORD;
  snapshot_id UUID;
BEGIN
  -- Process each user with auto-archive enabled
  FOR user_prefs IN 
    SELECT ump.*, u.id as user_id
    FROM user_memory_preferences ump
    JOIN users u ON u.id = ump.user_id
    WHERE ump.auto_archive_enabled = TRUE
  LOOP
    -- Check if user has conversations older than their preference
    IF EXISTS (
      SELECT 1 FROM sam_conversations 
      WHERE user_id = user_prefs.user_id
        AND memory_archived = FALSE
        AND auto_archive_eligible = TRUE
        AND created_at <= NOW() - INTERVAL '1 day' * user_prefs.archive_frequency_days
        AND memory_importance_score >= user_prefs.importance_threshold
    ) THEN
      -- Create memory snapshot
      snapshot_id := create_memory_snapshot(
        user_prefs.user_id,
        user_prefs.organization_id,
        user_prefs.archive_frequency_days
      );
      
      IF snapshot_id IS NOT NULL THEN
        processed_count := processed_count + 1;
      END IF;
    END IF;
  END LOOP;
  
  RETURN processed_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate importance scores
CREATE OR REPLACE FUNCTION update_conversation_importance() RETURNS TRIGGER AS $$
BEGIN
  NEW.memory_importance_score := calculate_conversation_importance(NEW.id);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trigger_conversation_importance'
  ) THEN
    CREATE TRIGGER trigger_conversation_importance
      BEFORE INSERT OR UPDATE ON sam_conversations
      FOR EACH ROW
      EXECUTE FUNCTION update_conversation_importance();
  END IF;
END$$;

-- RLS Policies for memory tables
ALTER TABLE memory_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memory_preferences ENABLE ROW LEVEL SECURITY;

-- Memory snapshots policies
CREATE POLICY "Users can view their own memory snapshots" ON memory_snapshots
  FOR SELECT USING (user_id = auth.uid()::uuid);

CREATE POLICY "Users can create their own memory snapshots" ON memory_snapshots
  FOR INSERT WITH CHECK (user_id = auth.uid()::uuid);

CREATE POLICY "Users can update their own memory snapshots" ON memory_snapshots
  FOR UPDATE USING (user_id = auth.uid()::uuid);

-- Memory preferences policies
CREATE POLICY "Users can manage their own memory preferences" ON user_memory_preferences
  FOR ALL USING (user_id = auth.uid()::uuid);

-- Default memory preferences for existing users
INSERT INTO user_memory_preferences (user_id, organization_id)
SELECT DISTINCT 
  u.id,
  COALESCE(sc.organization_id, 'default')
FROM users u
LEFT JOIN sam_conversations sc ON sc.user_id = u.id
WHERE NOT EXISTS (
  SELECT 1 FROM user_memory_preferences ump WHERE ump.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

COMMENT ON TABLE memory_snapshots IS 'Persistent memory snapshots with 7-day auto-archival and user restore capability';
COMMENT ON TABLE user_memory_preferences IS 'User preferences for memory management and auto-archival';
COMMENT ON FUNCTION create_memory_snapshot IS 'Creates a memory snapshot from recent conversations';
COMMENT ON FUNCTION restore_memory_snapshot IS 'Restores conversation data from a memory snapshot';
COMMENT ON FUNCTION auto_archive_memories IS 'Background job function for automatic memory archival';