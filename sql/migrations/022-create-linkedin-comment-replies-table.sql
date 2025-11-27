-- Migration: Create linkedin_comment_replies table for tracking replies to LinkedIn comments
-- Created: 2025-11-27

-- Table to store our replies to other people's comments on LinkedIn posts
CREATE TABLE IF NOT EXISTS linkedin_comment_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES linkedin_posts_discovered(id) ON DELETE CASCADE,
  original_comment_id TEXT NOT NULL, -- The Unipile/LinkedIn ID of the comment we're replying to
  original_comment_text TEXT, -- The text of the comment we replied to
  original_comment_author_name TEXT,
  original_comment_author_profile_id TEXT,
  reply_text TEXT NOT NULL, -- Our reply text
  replied_at TIMESTAMPTZ DEFAULT NOW(),
  replied_by UUID REFERENCES auth.users(id),
  unipile_response JSONB, -- Full response from Unipile API
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_linkedin_comment_replies_workspace_id ON linkedin_comment_replies(workspace_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_comment_replies_post_id ON linkedin_comment_replies(post_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_comment_replies_replied_at ON linkedin_comment_replies(replied_at DESC);

-- Enable RLS
ALTER TABLE linkedin_comment_replies ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view replies in their workspace" ON linkedin_comment_replies
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert replies in their workspace" ON linkedin_comment_replies
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update replies in their workspace" ON linkedin_comment_replies
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Service role bypass for admin operations
CREATE POLICY "Service role can manage all replies" ON linkedin_comment_replies
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Update trigger for updated_at
CREATE TRIGGER update_linkedin_comment_replies_updated_at
  BEFORE UPDATE ON linkedin_comment_replies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
