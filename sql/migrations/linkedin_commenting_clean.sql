CREATE TABLE IF NOT EXISTS linkedin_post_monitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  hashtags TEXT[] NOT NULL,
  keywords TEXT[],
  n8n_workflow_id VARCHAR(255),
  n8n_webhook_url TEXT,
  status VARCHAR(50) DEFAULT 'active',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT workspace_hashtags_unique UNIQUE(workspace_id, hashtags)
);

CREATE INDEX idx_linkedin_monitors_workspace ON linkedin_post_monitors(workspace_id);
CREATE INDEX idx_linkedin_monitors_status ON linkedin_post_monitors(status);
CREATE INDEX idx_linkedin_monitors_created_by ON linkedin_post_monitors(created_by);

CREATE TABLE IF NOT EXISTS linkedin_posts_discovered (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  monitor_id UUID REFERENCES linkedin_post_monitors(id) ON DELETE SET NULL,
  social_id VARCHAR(255) UNIQUE NOT NULL,
  share_url TEXT NOT NULL,
  post_content TEXT,
  author_name VARCHAR(255),
  author_profile_id VARCHAR(255),
  author_headline TEXT,
  hashtags TEXT[],
  post_date TIMESTAMP,
  engagement_metrics JSONB,
  status VARCHAR(50) DEFAULT 'discovered',
  skip_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_status CHECK (status IN ('discovered', 'processing', 'commented', 'skipped'))
);

CREATE INDEX idx_posts_discovered_workspace ON linkedin_posts_discovered(workspace_id);
CREATE INDEX idx_posts_discovered_monitor ON linkedin_posts_discovered(monitor_id);
CREATE INDEX idx_posts_discovered_status ON linkedin_posts_discovered(status);
CREATE INDEX idx_posts_discovered_social_id ON linkedin_posts_discovered(social_id);
CREATE INDEX idx_posts_discovered_date ON linkedin_posts_discovered(post_date DESC);

CREATE TABLE IF NOT EXISTS linkedin_comment_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  post_id UUID REFERENCES linkedin_posts_discovered(id) ON DELETE SET NULL,
  post_social_id VARCHAR(255) NOT NULL,
  comment_text TEXT NOT NULL,
  comment_length INTEGER,
  requires_approval BOOLEAN DEFAULT TRUE,
  approval_status VARCHAR(50),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP,
  generated_by VARCHAR(50) DEFAULT 'claude',
  generation_model VARCHAR(100),
  confidence_score FLOAT,
  status VARCHAR(50) DEFAULT 'pending',
  posted_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected', 'posted', 'failed')),
  CONSTRAINT valid_approval CHECK (approval_status IS NULL OR approval_status IN ('approved', 'rejected'))
);

CREATE INDEX idx_comment_queue_workspace ON linkedin_comment_queue(workspace_id);
CREATE INDEX idx_comment_queue_post ON linkedin_comment_queue(post_id);
CREATE INDEX idx_comment_queue_status ON linkedin_comment_queue(status);
CREATE INDEX idx_comment_queue_approval ON linkedin_comment_queue(approval_status);
CREATE INDEX idx_comment_queue_created ON linkedin_comment_queue(created_at DESC);

CREATE TABLE IF NOT EXISTS linkedin_comments_posted (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  post_id UUID REFERENCES linkedin_posts_discovered(id) ON DELETE SET NULL,
  queue_id UUID REFERENCES linkedin_comment_queue(id) ON DELETE SET NULL,
  comment_id VARCHAR(255) UNIQUE NOT NULL,
  post_social_id VARCHAR(255) NOT NULL,
  comment_text TEXT NOT NULL,
  engagement_metrics JSONB,
  replies_count INTEGER DEFAULT 0,
  user_replied BOOLEAN DEFAULT FALSE,
  last_reply_at TIMESTAMP,
  posted_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_comments_posted_workspace ON linkedin_comments_posted(workspace_id);
CREATE INDEX idx_comments_posted_post ON linkedin_comments_posted(post_id);
CREATE INDEX idx_comments_posted_comment_id ON linkedin_comments_posted(comment_id);
CREATE INDEX idx_comments_posted_posted_at ON linkedin_comments_posted(posted_at DESC);
CREATE INDEX idx_comments_posted_user_replied ON linkedin_comments_posted(user_replied);

ALTER TABLE linkedin_post_monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_posts_discovered ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_comment_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_comments_posted ENABLE ROW LEVEL SECURITY;

CREATE POLICY "linkedin_monitors_select_workspace"
  ON linkedin_post_monitors
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = linkedin_post_monitors.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "linkedin_monitors_insert_workspace"
  ON linkedin_post_monitors
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = linkedin_post_monitors.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "linkedin_monitors_update_workspace"
  ON linkedin_post_monitors
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = linkedin_post_monitors.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = linkedin_post_monitors.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "linkedin_monitors_delete_workspace"
  ON linkedin_post_monitors
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = linkedin_post_monitors.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "linkedin_posts_select_workspace"
  ON linkedin_posts_discovered
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = linkedin_posts_discovered.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "linkedin_posts_insert_workspace"
  ON linkedin_posts_discovered
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = linkedin_posts_discovered.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "linkedin_posts_update_workspace"
  ON linkedin_posts_discovered
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = linkedin_posts_discovered.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = linkedin_posts_discovered.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "linkedin_queue_select_workspace"
  ON linkedin_comment_queue
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = linkedin_comment_queue.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "linkedin_queue_insert_workspace"
  ON linkedin_comment_queue
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = linkedin_comment_queue.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "linkedin_queue_update_workspace"
  ON linkedin_comment_queue
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = linkedin_comment_queue.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = linkedin_comment_queue.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "linkedin_posted_select_workspace"
  ON linkedin_comments_posted
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = linkedin_comments_posted.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "linkedin_posted_insert_workspace"
  ON linkedin_comments_posted
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = linkedin_comments_posted.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "linkedin_posted_update_workspace"
  ON linkedin_comments_posted
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = linkedin_comments_posted.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = linkedin_comments_posted.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE OR REPLACE VIEW linkedin_queue_summary AS
SELECT
  workspace_id,
  status,
  COUNT(*) as count,
  MIN(created_at) as earliest,
  MAX(created_at) as latest
FROM linkedin_comment_queue
GROUP BY workspace_id, status;

CREATE OR REPLACE VIEW linkedin_posted_with_engagement AS
SELECT
  id,
  workspace_id,
  post_social_id,
  comment_text,
  replies_count,
  engagement_metrics->'reactions' as reactions,
  engagement_metrics->'replies' as replies,
  posted_at,
  user_replied,
  last_reply_at
FROM linkedin_comments_posted
ORDER BY posted_at DESC;

CREATE OR REPLACE VIEW linkedin_active_monitors AS
SELECT
  id,
  workspace_id,
  hashtags,
  keywords,
  status,
  n8n_workflow_id,
  created_by,
  created_at
FROM linkedin_post_monitors
WHERE status = 'active'
ORDER BY created_at DESC;

GRANT SELECT, INSERT, UPDATE, DELETE ON linkedin_post_monitors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON linkedin_posts_discovered TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON linkedin_comment_queue TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON linkedin_comments_posted TO authenticated;

GRANT SELECT ON linkedin_queue_summary TO authenticated;
GRANT SELECT ON linkedin_posted_with_engagement TO authenticated;
GRANT SELECT ON linkedin_active_monitors TO authenticated;
