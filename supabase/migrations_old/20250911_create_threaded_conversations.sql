-- Enhanced Threaded Conversation System for SAM AI
-- Supports organized conversations by prospect, campaign, topic, etc.

-- Create conversation threads table (enhanced from sam_conversations)
CREATE TABLE IF NOT EXISTS sam_conversation_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  organization_id TEXT,
  title TEXT NOT NULL,
  thread_type TEXT NOT NULL CHECK (thread_type IN ('prospect', 'campaign', 'general', 'linkedin_research', 'company_analysis')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
  
  -- Thread context metadata
  prospect_name TEXT,
  prospect_company TEXT,
  prospect_linkedin_url TEXT,
  campaign_name TEXT,
  tags TEXT[],
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  
  -- Discovery and sales context
  current_discovery_stage TEXT,
  discovery_progress INTEGER DEFAULT 0,
  sales_methodology TEXT DEFAULT 'meddic' CHECK (sales_methodology IN ('meddic', 'spin', 'challenger')),
  deal_stage TEXT,
  deal_value DECIMAL,
  
  -- Activity tracking
  last_sam_message TEXT,
  last_user_message TEXT,
  message_count INTEGER DEFAULT 0,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create messages table for threaded conversations
CREATE TABLE IF NOT EXISTS sam_thread_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES sam_conversation_threads(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  
  -- Message metadata
  model_used TEXT,
  token_count INTEGER,
  processing_time_ms INTEGER,
  confidence_score DECIMAL(3,2),
  relevance_score DECIMAL(3,2),
  message_order INTEGER NOT NULL,
  
  -- Prospect intelligence metadata
  has_prospect_intelligence BOOLEAN DEFAULT false,
  prospect_intelligence_data JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create conversation intelligence table (for MCP prospect research)
CREATE TABLE IF NOT EXISTS sam_conversation_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  conversation_id TEXT, -- Can be thread_id or legacy conversation reference
  thread_id UUID REFERENCES sam_conversation_threads(id) ON DELETE CASCADE,
  
  intelligence_type TEXT NOT NULL CHECK (intelligence_type IN ('linkedin_url_research', 'company_analysis', 'prospect_search', 'strategic_insights')),
  intelligence_data JSONB NOT NULL,
  methodology TEXT DEFAULT 'meddic',
  confidence DECIMAL(3,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_sam_threads_user_org ON sam_conversation_threads(user_id, organization_id);
CREATE INDEX idx_sam_threads_type_status ON sam_conversation_threads(thread_type, status);
CREATE INDEX idx_sam_threads_prospect ON sam_conversation_threads(prospect_name, prospect_company);
CREATE INDEX idx_sam_threads_active ON sam_conversation_threads(last_active_at DESC) WHERE status = 'active';
CREATE INDEX idx_sam_threads_tags ON sam_conversation_threads USING GIN(tags);

CREATE INDEX idx_sam_messages_thread ON sam_thread_messages(thread_id, message_order);
CREATE INDEX idx_sam_messages_created ON sam_thread_messages(created_at DESC);

CREATE INDEX idx_sam_intelligence_thread ON sam_conversation_intelligence(thread_id);
CREATE INDEX idx_sam_intelligence_type ON sam_conversation_intelligence(intelligence_type, created_at DESC);

-- Enable RLS
ALTER TABLE sam_conversation_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE sam_thread_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sam_conversation_intelligence ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sam_conversation_threads
CREATE POLICY "Users can view threads in their organization" ON sam_conversation_threads
  FOR SELECT USING (
    user_id = auth.uid()::text OR
    (organization_id IS NOT NULL AND organization_id IN (
      SELECT jsonb_array_elements_text(auth.jwt() -> 'organizations')
    ))
  );

CREATE POLICY "Users can create their own threads" ON sam_conversation_threads
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update their own threads" ON sam_conversation_threads
  FOR UPDATE USING (user_id = auth.uid()::text);

CREATE POLICY "Users can delete their own threads" ON sam_conversation_threads
  FOR DELETE USING (user_id = auth.uid()::text);

-- RLS Policies for sam_thread_messages  
CREATE POLICY "Users can view messages in their threads" ON sam_thread_messages
  FOR SELECT USING (
    thread_id IN (
      SELECT id FROM sam_conversation_threads 
      WHERE user_id = auth.uid()::text OR
      (organization_id IS NOT NULL AND organization_id IN (
        SELECT jsonb_array_elements_text(auth.jwt() -> 'organizations')
      ))
    )
  );

CREATE POLICY "Users can create messages in their threads" ON sam_thread_messages
  FOR INSERT WITH CHECK (
    user_id = auth.uid()::text AND
    thread_id IN (
      SELECT id FROM sam_conversation_threads WHERE user_id = auth.uid()::text
    )
  );

-- RLS Policies for sam_conversation_intelligence
CREATE POLICY "Users can view their intelligence data" ON sam_conversation_intelligence
  FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "Users can create their intelligence data" ON sam_conversation_intelligence
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

-- Service role policies for API operations
CREATE POLICY "Service role can manage all threads" ON sam_conversation_threads
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all messages" ON sam_thread_messages
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage all intelligence" ON sam_conversation_intelligence
  FOR ALL USING (auth.role() = 'service_role');

-- Functions to auto-update thread activity
CREATE OR REPLACE FUNCTION update_thread_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE sam_conversation_threads 
  SET 
    message_count = message_count + 1,
    last_active_at = NOW(),
    last_sam_message = CASE WHEN NEW.role = 'assistant' THEN LEFT(NEW.content, 200) ELSE last_sam_message END,
    last_user_message = CASE WHEN NEW.role = 'user' THEN LEFT(NEW.content, 200) ELSE last_user_message END,
    updated_at = NOW()
  WHERE id = NEW.thread_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update thread activity on new messages
CREATE TRIGGER update_thread_activity_trigger
  AFTER INSERT ON sam_thread_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_thread_activity();

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_thread_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_thread_updated_at_trigger
  BEFORE UPDATE ON sam_conversation_threads
  FOR EACH ROW
  EXECUTE FUNCTION update_thread_updated_at();

-- Function to auto-create thread from LinkedIn URL detection
CREATE OR REPLACE FUNCTION auto_create_linkedin_thread(
  p_user_id TEXT,
  p_organization_id TEXT,
  p_linkedin_url TEXT,
  p_prospect_name TEXT DEFAULT NULL,
  p_prospect_company TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  thread_id UUID;
  thread_title TEXT;
BEGIN
  -- Generate thread title
  IF p_prospect_name IS NOT NULL AND p_prospect_company IS NOT NULL THEN
    thread_title := p_prospect_name || ' - ' || p_prospect_company;
  ELSIF p_prospect_name IS NOT NULL THEN
    thread_title := 'LinkedIn Research: ' || p_prospect_name;
  ELSE
    thread_title := 'LinkedIn Research - ' || EXTRACT(DATE FROM NOW());
  END IF;
  
  -- Create thread
  INSERT INTO sam_conversation_threads (
    user_id,
    organization_id,
    title,
    thread_type,
    prospect_name,
    prospect_company,
    prospect_linkedin_url,
    tags
  ) VALUES (
    p_user_id,
    p_organization_id,
    thread_title,
    'linkedin_research',
    p_prospect_name,
    p_prospect_company,
    p_linkedin_url,
    ARRAY['linkedin', 'prospect-research']
  )
  RETURNING id INTO thread_id;
  
  RETURN thread_id;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE sam_conversation_threads IS 'Threaded conversations organized by prospect, campaign, or topic';
COMMENT ON TABLE sam_thread_messages IS 'Messages within conversation threads';
COMMENT ON TABLE sam_conversation_intelligence IS 'MCP prospect intelligence data linked to conversations';
COMMENT ON FUNCTION auto_create_linkedin_thread IS 'Auto-creates a LinkedIn research thread when URLs are detected';