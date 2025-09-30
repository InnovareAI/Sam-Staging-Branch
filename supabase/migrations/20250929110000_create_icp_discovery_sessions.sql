-- Create ICP Discovery Sessions Table
-- Tracks multi-phase strategic discovery for campaigns

CREATE TABLE IF NOT EXISTS sam_icp_discovery_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  thread_id UUID REFERENCES sam_conversation_threads(id) ON DELETE SET NULL,
  session_status TEXT NOT NULL DEFAULT 'in_progress' CHECK (session_status IN ('in_progress', 'completed', 'abandoned')),
  is_quick_flow BOOLEAN DEFAULT FALSE,
  discovery_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  discovery_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  red_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  shallow_answer_count INTEGER DEFAULT 0,
  questions_skipped INTEGER DEFAULT 0,
  phases_completed TEXT[] DEFAULT '{}',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_icp_discovery_workspace ON sam_icp_discovery_sessions(workspace_id, session_status);
CREATE INDEX IF NOT EXISTS idx_icp_discovery_user ON sam_icp_discovery_sessions(user_id, session_status);
CREATE INDEX IF NOT EXISTS idx_icp_discovery_campaign ON sam_icp_discovery_sessions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_icp_discovery_thread ON sam_icp_discovery_sessions(thread_id);
CREATE INDEX IF NOT EXISTS idx_icp_discovery_created_at ON sam_icp_discovery_sessions(created_at DESC);

-- Enable Row Level Security
ALTER TABLE sam_icp_discovery_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can manage discovery sessions in their workspace
CREATE POLICY IF NOT EXISTS "Users can view their workspace discovery sessions" ON sam_icp_discovery_sessions
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Users can modify their workspace discovery sessions" ON sam_icp_discovery_sessions
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Trigger to keep updated_at fresh
CREATE TRIGGER update_icp_discovery_sessions_updated_at
  BEFORE UPDATE ON sam_icp_discovery_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Helper function to upsert discovery payloads safely
CREATE OR REPLACE FUNCTION upsert_icp_discovery_payload(
  p_session_id UUID,
  p_payload JSONB,
  p_phases_completed TEXT[] DEFAULT NULL,
  p_shallow_delta INTEGER DEFAULT 0,
  p_questions_skipped_delta INTEGER DEFAULT 0,
  p_session_status TEXT DEFAULT NULL,
  p_completed_at TIMESTAMPTZ DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  UPDATE sam_icp_discovery_sessions
  SET
    discovery_payload = COALESCE(discovery_payload, '{}'::jsonb) || COALESCE(p_payload, '{}'::jsonb),
    phases_completed = CASE 
      WHEN p_phases_completed IS NOT NULL THEN ARRAY(SELECT DISTINCT UNNEST(phases_completed || p_phases_completed))
      ELSE phases_completed
    END,
    shallow_answer_count = GREATEST(0, shallow_answer_count + COALESCE(p_shallow_delta, 0)),
    questions_skipped = GREATEST(0, questions_skipped + COALESCE(p_questions_skipped_delta, 0)),
    session_status = COALESCE(p_session_status, session_status),
    completed_at = COALESCE(p_completed_at, completed_at),
    updated_at = NOW()
  WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION upsert_icp_discovery_payload(UUID, JSONB, TEXT[], INTEGER, INTEGER, TEXT, TIMESTAMPTZ) TO authenticated;
