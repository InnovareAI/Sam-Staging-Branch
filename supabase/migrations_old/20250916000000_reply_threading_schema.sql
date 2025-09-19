-- SAM Reply Threading and Approval Workflow Schema
-- Supports: Inbox Message → SAM Draft → Email Approval → Unipile Send
-- Created: 2024-09-16

-- 1. Reply Threads Table
-- Links original messages to their reply chain
CREATE TABLE reply_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Original message information
  original_message_id TEXT NOT NULL, -- From inbox (LinkedIn/Email message ID)
  original_platform TEXT NOT NULL CHECK (original_platform IN ('linkedin', 'email', 'gmail', 'outlook')),
  original_sender_name TEXT,
  original_sender_email TEXT,
  original_sender_id TEXT, -- LinkedIn profile ID or email
  original_subject TEXT,
  original_content TEXT,
  original_timestamp TIMESTAMPTZ,
  
  -- Thread management
  thread_id TEXT UNIQUE NOT NULL, -- Generated SAM-{random} format for tracking
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'awaiting_approval', 'approved', 'changes_requested', 'stopped', 'sent', 'failed')),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes for performance
  CONSTRAINT unique_original_message UNIQUE (original_message_id, original_platform)
);

-- 2. Reply Drafts Table
-- Stores SAM's draft responses for approval
CREATE TABLE reply_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID NOT NULL REFERENCES reply_threads(id) ON DELETE CASCADE,
  
  -- Draft content
  draft_content TEXT NOT NULL,
  sam_reasoning TEXT, -- Why SAM chose this response
  draft_version INTEGER NOT NULL DEFAULT 1,
  
  -- Client guidance
  user_guidance TEXT, -- What user asked SAM to focus on
  tone_preference TEXT, -- professional, friendly, formal, etc.
  
  -- Status
  is_active BOOLEAN DEFAULT true, -- Latest draft version
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent_for_approval', 'approved', 'rejected', 'modified')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure only one active draft per thread
  CONSTRAINT unique_active_draft UNIQUE (thread_id, is_active) DEFERRABLE INITIALLY DEFERRED
);

-- 3. Approval Emails Table
-- Tracks emails sent to clients for approval
CREATE TABLE approval_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID NOT NULL REFERENCES reply_threads(id) ON DELETE CASCADE,
  draft_id UUID NOT NULL REFERENCES reply_drafts(id) ON DELETE CASCADE,
  
  -- Email details
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  email_subject TEXT NOT NULL,
  email_body TEXT NOT NULL,
  
  -- Tracking
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  message_id TEXT, -- Email message ID for threading
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'opened', 'replied', 'bounced', 'failed')),
  
  -- Response tracking
  client_responded BOOLEAN DEFAULT false,
  response_received_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Approval Responses Table
-- Stores client responses (APPROVED, CHANGES, STOP)
CREATE TABLE approval_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID NOT NULL REFERENCES reply_threads(id) ON DELETE CASCADE,
  approval_email_id UUID NOT NULL REFERENCES approval_emails(id) ON DELETE CASCADE,
  
  -- Response details
  response_action TEXT NOT NULL CHECK (response_action IN ('APPROVED', 'CHANGES', 'STOP', 'UNKNOWN')),
  updated_message TEXT, -- If CHANGES, the new message content
  client_email TEXT NOT NULL,
  response_confidence DECIMAL(3,2) CHECK (response_confidence >= 0 AND response_confidence <= 1),
  
  -- Original email parsing
  raw_email_subject TEXT,
  raw_email_body TEXT,
  parsed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Processing
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Sent Messages Table
-- Tracks messages actually sent via Unipile
CREATE TABLE sent_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID NOT NULL REFERENCES reply_threads(id) ON DELETE CASCADE,
  draft_id UUID REFERENCES reply_drafts(id),
  
  -- Message content (final version)
  final_message_content TEXT NOT NULL,
  recipient_info JSONB NOT NULL, -- {email, name, platform_id, etc}
  
  -- Unipile send details
  unipile_account_id TEXT NOT NULL,
  unipile_message_id TEXT, -- Returned by Unipile after send
  platform TEXT NOT NULL CHECK (platform IN ('linkedin', 'email', 'gmail', 'outlook')),
  
  -- Status tracking
  send_status TEXT NOT NULL DEFAULT 'pending' CHECK (send_status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')),
  send_attempted_at TIMESTAMPTZ DEFAULT NOW(),
  send_completed_at TIMESTAMPTZ,
  
  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Thread Activity Log
-- Audit trail for the entire workflow
CREATE TABLE thread_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID NOT NULL REFERENCES reply_threads(id) ON DELETE CASCADE,
  
  -- Activity details
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'thread_created', 'draft_generated', 'approval_sent', 'client_responded', 
    'message_sent', 'status_changed', 'error_occurred', 'manual_intervention'
  )),
  activity_description TEXT NOT NULL,
  activity_data JSONB, -- Additional structured data
  
  -- Context
  performed_by TEXT, -- 'sam', 'client', 'system', user_id
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Performance
CREATE INDEX idx_reply_threads_user_id ON reply_threads(user_id);
CREATE INDEX idx_reply_threads_status ON reply_threads(status);
CREATE INDEX idx_reply_threads_original_platform ON reply_threads(original_platform);
CREATE INDEX idx_reply_threads_thread_id ON reply_threads(thread_id);

CREATE INDEX idx_reply_drafts_thread_id ON reply_drafts(thread_id);
CREATE INDEX idx_reply_drafts_active ON reply_drafts(is_active) WHERE is_active = true;

CREATE INDEX idx_approval_emails_thread_id ON approval_emails(thread_id);
CREATE INDEX idx_approval_emails_status ON approval_emails(status);
CREATE INDEX idx_approval_emails_recipient ON approval_emails(recipient_email);

CREATE INDEX idx_approval_responses_thread_id ON approval_responses(thread_id);
CREATE INDEX idx_approval_responses_action ON approval_responses(response_action);
CREATE INDEX idx_approval_responses_processed ON approval_responses(processed);

CREATE INDEX idx_sent_messages_thread_id ON sent_messages(thread_id);
CREATE INDEX idx_sent_messages_status ON sent_messages(send_status);
CREATE INDEX idx_sent_messages_platform ON sent_messages(platform);

CREATE INDEX idx_thread_activity_thread_id ON thread_activity_log(thread_id);
CREATE INDEX idx_thread_activity_type ON thread_activity_log(activity_type);
CREATE INDEX idx_thread_activity_created ON thread_activity_log(created_at);

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_reply_threads_updated_at 
  BEFORE UPDATE ON reply_threads 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE reply_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE reply_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE sent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE thread_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Users can only access their own threads
CREATE POLICY "Users can access their own reply threads" ON reply_threads
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can access drafts for their threads" ON reply_drafts
  FOR ALL USING (EXISTS (
    SELECT 1 FROM reply_threads rt 
    WHERE rt.id = reply_drafts.thread_id 
    AND rt.user_id = auth.uid()
  ));

CREATE POLICY "Users can access approval emails for their threads" ON approval_emails
  FOR ALL USING (EXISTS (
    SELECT 1 FROM reply_threads rt 
    WHERE rt.id = approval_emails.thread_id 
    AND rt.user_id = auth.uid()
  ));

CREATE POLICY "Users can access approval responses for their threads" ON approval_responses
  FOR ALL USING (EXISTS (
    SELECT 1 FROM reply_threads rt 
    WHERE rt.id = approval_responses.thread_id 
    AND rt.user_id = auth.uid()
  ));

CREATE POLICY "Users can access sent messages for their threads" ON sent_messages
  FOR ALL USING (EXISTS (
    SELECT 1 FROM reply_threads rt 
    WHERE rt.id = sent_messages.thread_id 
    AND rt.user_id = auth.uid()
  ));

CREATE POLICY "Users can access activity log for their threads" ON thread_activity_log
  FOR ALL USING (EXISTS (
    SELECT 1 FROM reply_threads rt 
    WHERE rt.id = thread_activity_log.thread_id 
    AND rt.user_id = auth.uid()
  ));

-- Helper Functions

-- Generate unique thread ID
CREATE OR REPLACE FUNCTION generate_thread_id()
RETURNS TEXT AS $$
BEGIN
  RETURN 'SAM-' || upper(substring(encode(gen_random_bytes(6), 'base64'), 1, 8));
END;
$$ LANGUAGE plpgsql;

-- Get thread status summary
CREATE OR REPLACE FUNCTION get_thread_status_summary(p_user_id UUID)
RETURNS TABLE (
  status TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT rt.status, COUNT(*)
  FROM reply_threads rt
  WHERE rt.user_id = p_user_id
  GROUP BY rt.status
  ORDER BY rt.status;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE reply_threads IS 'Main table tracking reply conversation threads from inbox to completion';
COMMENT ON TABLE reply_drafts IS 'SAM-generated draft responses awaiting approval';
COMMENT ON TABLE approval_emails IS 'Emails sent to clients for reply approval';
COMMENT ON TABLE approval_responses IS 'Client responses (APPROVED/CHANGES/STOP)';
COMMENT ON TABLE sent_messages IS 'Messages actually sent via Unipile';
COMMENT ON TABLE thread_activity_log IS 'Complete audit trail of workflow activities';

COMMENT ON COLUMN reply_threads.thread_id IS 'Unique SAM-generated ID for email threading (format: SAM-XXXXXXXX)';
COMMENT ON COLUMN reply_drafts.sam_reasoning IS 'AI explanation of why this response was generated';
COMMENT ON COLUMN approval_responses.response_confidence IS 'Parser confidence score (0.0-1.0) for email parsing accuracy';