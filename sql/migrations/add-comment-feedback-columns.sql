-- Migration: Add feedback and digest tracking columns to linkedin_post_comments
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog/sql/new

-- Add feedback columns
ALTER TABLE linkedin_post_comments
ADD COLUMN IF NOT EXISTS user_feedback VARCHAR(10),
ADD COLUMN IF NOT EXISTS feedback_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS digest_sent_at TIMESTAMPTZ;

-- Add comments
COMMENT ON COLUMN linkedin_post_comments.user_feedback IS 'User rating: good or bad';
COMMENT ON COLUMN linkedin_post_comments.feedback_at IS 'When user submitted feedback';
COMMENT ON COLUMN linkedin_post_comments.digest_sent_at IS 'When this comment was included in a digest email';

-- Create feedback log table for ML training
CREATE TABLE IF NOT EXISTS comment_feedback_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID REFERENCES linkedin_post_comments(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  rating VARCHAR(10) NOT NULL,
  comment_text TEXT,
  generation_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for feedback analysis
CREATE INDEX IF NOT EXISTS idx_comment_feedback_log_workspace
ON comment_feedback_log(workspace_id, created_at DESC);

-- Add RLS policies for feedback log
ALTER TABLE comment_feedback_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage feedback log" ON comment_feedback_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users can view their workspace feedback" ON comment_feedback_log
  FOR SELECT TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );
