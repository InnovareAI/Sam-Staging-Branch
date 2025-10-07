-- Drop existing table if needed (use this carefully!)
-- DROP TABLE IF EXISTS email_responses CASCADE;

-- Create email_responses table for storing inbound email replies
-- This table captures responses from prospects to campaigns

CREATE TABLE IF NOT EXISTS email_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  prospect_id UUID, -- Foreign key will be added later if workspace_prospects exists

  -- Email metadata
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT NOT NULL,
  subject TEXT,
  message_id TEXT UNIQUE, -- Postmark MessageID

  -- Content
  text_body TEXT,
  html_body TEXT,
  stripped_text TEXT, -- Text with signatures removed

  -- Attachments
  has_attachments BOOLEAN DEFAULT FALSE,
  attachments JSONB, -- Array of attachment metadata

  -- Processing
  received_at TIMESTAMPTZ NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  sentiment TEXT, -- 'positive', 'negative', 'neutral', 'interested'
  intent TEXT, -- 'meeting_request', 'question', 'objection', 'unsubscribe', etc.
  requires_response BOOLEAN DEFAULT TRUE,

  -- AI Analysis
  ai_summary TEXT,
  ai_suggested_response TEXT,

  -- Postmark raw data
  raw_email JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance (with IF NOT EXISTS checks)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_email_responses_workspace') THEN
    CREATE INDEX idx_email_responses_workspace ON email_responses(workspace_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_email_responses_campaign') THEN
    CREATE INDEX idx_email_responses_campaign ON email_responses(campaign_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_email_responses_prospect') THEN
    CREATE INDEX idx_email_responses_prospect ON email_responses(prospect_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_email_responses_from_email') THEN
    CREATE INDEX idx_email_responses_from_email ON email_responses(from_email);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_email_responses_received_at') THEN
    CREATE INDEX idx_email_responses_received_at ON email_responses(received_at DESC);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_email_responses_processed') THEN
    CREATE INDEX idx_email_responses_processed ON email_responses(processed) WHERE processed = FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_email_responses_message_id') THEN
    CREATE INDEX idx_email_responses_message_id ON email_responses(message_id);
  END IF;
END $$;

-- RLS Policies
ALTER TABLE email_responses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view email responses for their workspaces" ON email_responses;
DROP POLICY IF EXISTS "Service role can insert email responses" ON email_responses;
DROP POLICY IF EXISTS "Users can update email responses in their workspaces" ON email_responses;

-- Users can view email responses for their workspaces
CREATE POLICY "Users can view email responses for their workspaces"
  ON email_responses
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Users can insert email responses (for webhook)
CREATE POLICY "Service role can insert email responses"
  ON email_responses
  FOR INSERT
  WITH CHECK (true);

-- Users can update email responses in their workspaces
CREATE POLICY "Users can update email responses in their workspaces"
  ON email_responses
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Auto-update updated_at timestamp
DROP FUNCTION IF EXISTS update_email_responses_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION update_email_responses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS email_responses_updated_at ON email_responses;

CREATE TRIGGER email_responses_updated_at
  BEFORE UPDATE ON email_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_email_responses_updated_at();

-- Comments
COMMENT ON TABLE email_responses IS 'Stores inbound email replies from prospects to campaigns';
COMMENT ON COLUMN email_responses.message_id IS 'Postmark MessageID for deduplication';
COMMENT ON COLUMN email_responses.sentiment IS 'AI-detected sentiment: positive, negative, neutral, interested';
COMMENT ON COLUMN email_responses.intent IS 'AI-detected intent: meeting_request, question, objection, unsubscribe, etc.';
COMMENT ON COLUMN email_responses.stripped_text IS 'Email body with signatures and quoted text removed';

-- Add foreign key for prospect_id if workspace_prospects table exists
DO $$
BEGIN
  -- First check if constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_email_responses_prospect'
  ) THEN
    -- Only add if workspace_prospects table exists
    IF EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'workspace_prospects'
    ) THEN
      ALTER TABLE email_responses
        ADD CONSTRAINT fk_email_responses_prospect
        FOREIGN KEY (prospect_id)
        REFERENCES workspace_prospects(id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;
