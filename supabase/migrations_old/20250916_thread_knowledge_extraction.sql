-- Knowledge extraction system for threaded conversations
-- Extends the existing knowledge classification system to work with sam_conversation_threads

-- Add knowledge tracking to threads table
ALTER TABLE sam_conversation_threads 
ADD COLUMN IF NOT EXISTS knowledge_extracted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS extraction_confidence DECIMAL(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS knowledge_classification JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_knowledge_extraction_at TIMESTAMPTZ;

-- Create index for unprocessed threads
CREATE INDEX IF NOT EXISTS idx_threads_knowledge_extraction 
ON sam_conversation_threads(knowledge_extracted, last_active_at DESC) 
WHERE knowledge_extracted = FALSE;

-- Update sam_extracted_knowledge to reference threads instead of old conversations
ALTER TABLE sam_extracted_knowledge 
ADD COLUMN IF NOT EXISTS thread_id UUID REFERENCES sam_conversation_threads(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS workspace_id UUID; -- For workspace isolation

-- Create index for thread-based knowledge
CREATE INDEX IF NOT EXISTS idx_extracted_knowledge_thread 
ON sam_extracted_knowledge(thread_id, knowledge_type, is_active);

CREATE INDEX IF NOT EXISTS idx_extracted_knowledge_workspace 
ON sam_extracted_knowledge(workspace_id, user_id, knowledge_type);

-- Function to extract knowledge from threaded conversations
CREATE OR REPLACE FUNCTION extract_knowledge_from_thread(
  p_thread_id UUID,
  p_conversation_text TEXT,
  p_user_context JSONB DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
  thread_record RECORD;
  classification JSONB;
  extraction_result JSONB := '{}';
  knowledge_item JSONB;
  category_key TEXT;
  category_data JSONB;
  personal_count INTEGER := 0;
  team_count INTEGER := 0;
BEGIN
  -- Get thread details
  SELECT * INTO thread_record FROM sam_conversation_threads WHERE id = p_thread_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Thread not found');
  END IF;
  
  -- Classify the conversation content using enhanced context
  classification := classify_conversation_content(
    p_conversation_text,
    p_user_context || jsonb_build_object(
      'thread_type', thread_record.thread_type,
      'prospect_name', thread_record.prospect_name,
      'prospect_company', thread_record.prospect_company,
      'sales_methodology', thread_record.sales_methodology,
      'deal_stage', thread_record.deal_stage,
      'priority', thread_record.priority,
      'tags', thread_record.tags
    )
  );
  
  -- Extract personal knowledge
  IF classification->'personal_data' != '{}' THEN
    FOR category_key IN SELECT jsonb_object_keys(classification->'personal_data') LOOP
      category_data := classification->'personal_data'->category_key;
      
      -- Insert personal knowledge extraction
      INSERT INTO sam_extracted_knowledge (
        thread_id,
        conversation_id, -- Keep for backward compatibility
        user_id,
        organization_id,
        workspace_id,
        knowledge_type,
        category,
        subcategory,
        content,
        confidence_score,
        source_message_ids,
        sharing_scope,
        data_sensitivity
      ) VALUES (
        p_thread_id,
        p_thread_id, -- Use thread_id for conversation_id
        thread_record.user_id,
        thread_record.organization_id,
        NULL, -- Will be updated by application layer
        'personal',
        category_key,
        (category_data->>'subcategory'),
        category_data,
        (category_data->>'confidence')::DECIMAL,
        ARRAY[p_thread_id::TEXT],
        'user',
        'medium'
      );
      
      personal_count := personal_count + 1;
    END LOOP;
  END IF;
  
  -- Extract team shareable knowledge
  IF classification->'team_shareable' != '{}' THEN
    FOR category_key IN SELECT jsonb_object_keys(classification->'team_shareable') LOOP
      category_data := classification->'team_shareable'->category_key;
      
      -- Insert team knowledge extraction
      INSERT INTO sam_extracted_knowledge (
        thread_id,
        conversation_id,
        user_id,
        organization_id,
        workspace_id,
        knowledge_type,
        category,
        subcategory,
        content,
        confidence_score,
        source_message_ids,
        sharing_scope,
        data_sensitivity
      ) VALUES (
        p_thread_id,
        p_thread_id,
        thread_record.user_id,
        thread_record.organization_id,
        NULL, -- Will be updated by application layer
        'team_shareable',
        category_key,
        (category_data->>'subcategory'),
        category_data,
        (category_data->>'confidence')::DECIMAL,
        ARRAY[p_thread_id::TEXT],
        CASE 
          WHEN thread_record.thread_type IN ('prospect', 'campaign') THEN 'organization'
          ELSE 'team'
        END,
        'low'
      );
      
      team_count := team_count + 1;
    END LOOP;
  END IF;
  
  -- Update thread as processed
  UPDATE sam_conversation_threads 
  SET 
    knowledge_extracted = TRUE,
    extraction_confidence = (classification->>'classification_confidence')::DECIMAL,
    knowledge_classification = classification,
    last_knowledge_extraction_at = NOW(),
    updated_at = NOW()
  WHERE id = p_thread_id;
  
  extraction_result := jsonb_build_object(
    'thread_id', p_thread_id,
    'classification', classification,
    'personal_extractions', personal_count,
    'team_extractions', team_count,
    'confidence', classification->>'classification_confidence',
    'extracted_at', extract(epoch from now())
  );
  
  RETURN extraction_result;
END;
$$ LANGUAGE plpgsql;

-- Enhanced function to get user knowledge context (now includes thread-based knowledge)
CREATE OR REPLACE FUNCTION get_user_knowledge_context_enhanced(
  p_user_id TEXT,
  p_workspace_id UUID DEFAULT NULL,
  p_organization_id TEXT DEFAULT NULL,
  p_knowledge_types TEXT[] DEFAULT ARRAY['personal', 'team_shareable'],
  p_categories TEXT[] DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
) RETURNS JSONB AS $$
DECLARE
  personal_knowledge JSONB := '{}';
  team_knowledge JSONB := '{}';
  recent_threads JSONB := '{}';
  result JSONB;
  knowledge_query TEXT;
BEGIN
  -- Get personal knowledge for this user
  IF 'personal' = ANY(p_knowledge_types) THEN
    SELECT jsonb_object_agg(category, jsonb_agg(
      jsonb_build_object(
        'content', content,
        'confidence', confidence_score,
        'thread_id', thread_id,
        'updated_at', updated_at,
        'subcategory', subcategory
      ) ORDER BY updated_at DESC
    ))
    INTO personal_knowledge
    FROM sam_extracted_knowledge 
    WHERE user_id = p_user_id 
      AND knowledge_type = 'personal' 
      AND is_active = TRUE
      AND (p_workspace_id IS NULL OR workspace_id = p_workspace_id)
      AND (p_categories IS NULL OR category = ANY(p_categories))
    GROUP BY category;
  END IF;
  
  -- Get team knowledge for this workspace/organization
  IF 'team_shareable' = ANY(p_knowledge_types) THEN
    SELECT jsonb_object_agg(category, jsonb_agg(
      jsonb_build_object(
        'content', content,
        'confidence', confidence_score,
        'thread_id', thread_id,
        'updated_at', updated_at,
        'subcategory', subcategory,
        'user_id', user_id
      ) ORDER BY updated_at DESC
    ))
    INTO team_knowledge
    FROM sam_extracted_knowledge 
    WHERE knowledge_type = 'team_shareable' 
      AND is_active = TRUE
      AND sharing_scope IN ('team', 'organization')
      AND (
        (p_workspace_id IS NOT NULL AND workspace_id = p_workspace_id) OR
        (p_organization_id IS NOT NULL AND organization_id = p_organization_id)
      )
      AND (p_categories IS NULL OR category = ANY(p_categories))
    GROUP BY category
    LIMIT p_limit;
  END IF;
  
  -- Get recent thread context for better conversation continuity
  SELECT jsonb_object_agg(
    id::TEXT,
    jsonb_build_object(
      'title', title,
      'thread_type', thread_type,
      'prospect_name', prospect_name,
      'prospect_company', prospect_company,
      'current_discovery_stage', current_discovery_stage,
      'sales_methodology', sales_methodology,
      'deal_stage', deal_stage,
      'last_active_at', last_active_at,
      'tags', tags
    )
  )
  INTO recent_threads
  FROM sam_conversation_threads 
  WHERE user_id = p_user_id 
    AND status = 'active'
    AND knowledge_extracted = TRUE
  ORDER BY last_active_at DESC 
  LIMIT 10;
  
  result := jsonb_build_object(
    'personal_knowledge', COALESCE(personal_knowledge, '{}'),
    'team_knowledge', COALESCE(team_knowledge, '{}'),
    'recent_threads', COALESCE(recent_threads, '{}'),
    'generated_at', extract(epoch from now()),
    'user_id', p_user_id,
    'workspace_id', p_workspace_id,
    'organization_id', p_organization_id,
    'filters', jsonb_build_object(
      'knowledge_types', p_knowledge_types,
      'categories', p_categories,
      'limit', p_limit
    )
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically extract knowledge from new messages
CREATE OR REPLACE FUNCTION auto_extract_knowledge_from_message()
RETURNS TRIGGER AS $$
DECLARE
  thread_record RECORD;
  message_count INTEGER;
  should_extract BOOLEAN := FALSE;
BEGIN
  -- Get thread information
  SELECT * INTO thread_record FROM sam_conversation_threads WHERE id = NEW.thread_id;
  
  -- Count messages in thread
  SELECT COUNT(*) INTO message_count FROM sam_thread_messages WHERE thread_id = NEW.thread_id;
  
  -- Determine if we should extract knowledge
  -- Extract after every 10 messages, or if thread has prospect intelligence
  should_extract := (
    (message_count % 10 = 0) OR 
    (thread_record.prospect_name IS NOT NULL) OR
    (NEW.has_prospect_intelligence = TRUE) OR
    (thread_record.thread_type IN ('prospect', 'linkedin_research'))
  );
  
  -- If thread hasn't been processed yet and has enough content
  IF should_extract AND (thread_record.knowledge_extracted = FALSE OR thread_record.knowledge_extracted IS NULL) THEN
    -- Mark for async processing (will be handled by the API)
    UPDATE sam_conversation_threads 
    SET 
      last_sam_message = CASE WHEN NEW.role = 'assistant' THEN LEFT(NEW.content, 200) ELSE last_sam_message END,
      last_user_message = CASE WHEN NEW.role = 'user' THEN LEFT(NEW.content, 200) ELSE last_user_message END,
      message_count = message_count,
      last_active_at = NOW(),
      updated_at = NOW()
    WHERE id = NEW.thread_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic knowledge extraction
DROP TRIGGER IF EXISTS auto_extract_knowledge_trigger ON sam_thread_messages;
CREATE TRIGGER auto_extract_knowledge_trigger
  AFTER INSERT ON sam_thread_messages
  FOR EACH ROW
  EXECUTE FUNCTION auto_extract_knowledge_from_message();

-- Add enhanced knowledge patterns for better extraction
INSERT INTO sam_knowledge_patterns (pattern_name, knowledge_type, category, subcategory, keywords, phrases, confidence_threshold, context_indicators) VALUES

-- Personal communication patterns
('communication_preference_brevity', 'personal', 'communication_style', 'brevity', ARRAY['brief', 'short', 'concise', 'quick'], ARRAY['keep it brief', 'make it short', 'quick summary'], 0.8, ARRAY['user_preference', 'communication']),
('communication_preference_detail', 'personal', 'communication_style', 'detail', ARRAY['detail', 'thorough', 'comprehensive', 'complete'], ARRAY['more details', 'comprehensive overview', 'full picture'], 0.8, ARRAY['user_preference', 'communication']),
('decision_making_style', 'personal', 'professional_context', 'decision_style', ARRAY['decide', 'choose', 'evaluate', 'consider'], ARRAY['need to think', 'discuss with team', 'evaluate options'], 0.7, ARRAY['decision_process']),

-- Enhanced prospect intelligence patterns
('prospect_authority_level', 'team_shareable', 'prospect_intelligence', 'authority', ARRAY['decision maker', 'approve', 'budget', 'final say'], ARRAY['I can approve', 'I make the decisions', 'within my budget'], 0.8, ARRAY['authority', 'decision_power']),
('prospect_urgency_signals', 'team_shareable', 'prospect_intelligence', 'urgency', ARRAY['urgent', 'asap', 'quickly', 'deadline'], ARRAY['need it soon', 'time sensitive', 'by end of'], 0.7, ARRAY['timeline', 'urgency']),
('prospect_budget_signals', 'team_shareable', 'prospect_intelligence', 'budget', ARRAY['budget', 'cost', 'price', 'expensive'], ARRAY['within budget', 'too expensive', 'what does it cost'], 0.8, ARRAY['budget', 'pricing']),

-- Sales methodology specific patterns
('meddic_metrics', 'team_shareable', 'sales_methodology', 'meddic_metrics', ARRAY['metrics', 'measure', 'success', 'kpi'], ARRAY['how do you measure', 'success metrics', 'key indicators'], 0.7, ARRAY['meddic', 'metrics']),
('meddic_economic_buyer', 'team_shareable', 'sales_methodology', 'meddic_economic', ARRAY['economic buyer', 'budget holder', 'funds', 'approved'], ARRAY['who controls budget', 'spending authority', 'economic buyer'], 0.8, ARRAY['meddic', 'economic_buyer']),
('meddic_decision_criteria', 'team_shareable', 'sales_methodology', 'meddic_decision', ARRAY['criteria', 'requirements', 'must have', 'evaluate'], ARRAY['decision criteria', 'evaluation process', 'requirements'], 0.7, ARRAY['meddic', 'decision_criteria']),

-- Competitive intelligence patterns
('competitor_mentions_specific', 'team_shareable', 'competitive_intelligence', 'direct_mention', ARRAY['salesforce', 'hubspot', 'outreach', 'apollo'], ARRAY['using salesforce', 'tried hubspot', 'compared to outreach'], 0.9, ARRAY['competitor', 'direct_mention']),
('competitor_dissatisfaction', 'team_shareable', 'competitive_intelligence', 'pain_points', ARRAY['disappointed', 'frustrating', 'issues', 'problems'], ARRAY['disappointed with', 'having issues', 'not working well'], 0.7, ARRAY['competitor', 'dissatisfaction']),

-- Industry and vertical patterns
('industry_healthcare', 'team_shareable', 'industry_intelligence', 'healthcare', ARRAY['healthcare', 'medical', 'hipaa', 'patient'], ARRAY['healthcare industry', 'medical practice', 'patient data'], 0.8, ARRAY['industry', 'healthcare']),
('industry_finance', 'team_shareable', 'industry_intelligence', 'finance', ARRAY['finance', 'fintech', 'banking', 'financial'], ARRAY['financial services', 'banking industry', 'fintech company'], 0.8, ARRAY['industry', 'finance']),
('industry_saas', 'team_shareable', 'industry_intelligence', 'saas', ARRAY['saas', 'software', 'platform', 'subscription'], ARRAY['saas company', 'software platform', 'subscription model'], 0.7, ARRAY['industry', 'saas']);

-- Comments
COMMENT ON FUNCTION extract_knowledge_from_thread IS 'Extracts structured knowledge from threaded conversations with enhanced context';
COMMENT ON FUNCTION get_user_knowledge_context_enhanced IS 'Enhanced user knowledge retrieval with workspace isolation and thread context';
COMMENT ON FUNCTION auto_extract_knowledge_from_message IS 'Automatically triggers knowledge extraction based on conversation patterns';
COMMENT ON TRIGGER auto_extract_knowledge_trigger ON sam_thread_messages IS 'Triggers automatic knowledge extraction when messages are added to threads';