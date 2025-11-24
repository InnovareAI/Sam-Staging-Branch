-- Create linkedin_post_comments table for storing AI-generated comments
-- This table stores comments that are pending approval, approved, or rejected

CREATE TABLE IF NOT EXISTS linkedin_post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  monitor_id UUID REFERENCES linkedin_post_monitors(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES linkedin_posts_discovered(id) ON DELETE CASCADE,

  -- Comment content
  comment_text TEXT NOT NULL,
  edited_comment_text TEXT, -- If user edits the AI-generated comment

  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending_approval',
  -- Status values: 'pending_approval', 'approved', 'rejected', 'posted', 'failed'

  -- Timestamps
  generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMP,
  rejected_at TIMESTAMP,
  posted_at TIMESTAMP,
  scheduled_post_time TIMESTAMP,

  -- Metadata
  generation_metadata JSONB, -- Model used, tokens, confidence score, etc.
  post_response JSONB, -- Response from LinkedIn API when posted
  failure_reason TEXT, -- If posting failed

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('pending_approval', 'approved', 'rejected', 'posted', 'failed'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_linkedin_post_comments_workspace
  ON linkedin_post_comments(workspace_id);

CREATE INDEX IF NOT EXISTS idx_linkedin_post_comments_monitor
  ON linkedin_post_comments(monitor_id);

CREATE INDEX IF NOT EXISTS idx_linkedin_post_comments_post
  ON linkedin_post_comments(post_id);

CREATE INDEX IF NOT EXISTS idx_linkedin_post_comments_status
  ON linkedin_post_comments(status);

CREATE INDEX IF NOT EXISTS idx_linkedin_post_comments_pending
  ON linkedin_post_comments(workspace_id, status)
  WHERE status = 'pending_approval';

-- RLS Policies
ALTER TABLE linkedin_post_comments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view comments in their workspace
CREATE POLICY "Users can view comments in their workspace"
  ON linkedin_post_comments
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can insert comments in their workspace
CREATE POLICY "Users can insert comments in their workspace"
  ON linkedin_post_comments
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can update comments in their workspace
CREATE POLICY "Users can update comments in their workspace"
  ON linkedin_post_comments
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can delete comments in their workspace
CREATE POLICY "Users can delete comments in their workspace"
  ON linkedin_post_comments
  FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Add comment
COMMENT ON TABLE linkedin_post_comments IS 'Stores AI-generated LinkedIn comments awaiting approval';
COMMENT ON COLUMN linkedin_post_comments.status IS 'Comment workflow status: pending_approval, approved, rejected, posted, failed';
COMMENT ON COLUMN linkedin_post_comments.generation_metadata IS 'Metadata about AI generation (model, tokens, confidence)';
