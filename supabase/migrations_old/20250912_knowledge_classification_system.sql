-- SAM AI Knowledge Classification System
-- Separates personal vs team knowledge for better RAG and privacy compliance

-- Add classification columns to existing sam_conversations table
ALTER TABLE sam_conversations 
ADD COLUMN IF NOT EXISTS knowledge_classification JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS privacy_tags JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS knowledge_extracted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS extraction_confidence DECIMAL(3,2) DEFAULT 0.0;

-- Create extracted knowledge table for structured knowledge storage
CREATE TABLE IF NOT EXISTS sam_extracted_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES sam_conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  organization_id TEXT,
  
  -- Knowledge classification
  knowledge_type TEXT NOT NULL CHECK (knowledge_type IN ('personal', 'team_shareable')),
  category TEXT NOT NULL, -- 'communication_style', 'customer_intelligence', 'market_insights', etc.
  subcategory TEXT,
  
  -- Knowledge content and metadata
  content JSONB NOT NULL,
  confidence_score DECIMAL(3,2) DEFAULT 0.0,
  source_message_ids TEXT[], -- Array of message IDs this knowledge was extracted from
  
  -- Privacy and sharing controls
  sharing_scope TEXT NOT NULL CHECK (sharing_scope IN ('user', 'team', 'organization', 'cross_tenant')),
  data_sensitivity TEXT DEFAULT 'medium' CHECK (data_sensitivity IN ('low', 'medium', 'high', 'critical')),
  
  -- Lifecycle management
  is_active BOOLEAN DEFAULT TRUE,
  verified_by_user BOOLEAN DEFAULT FALSE,
  last_updated_from_conversation UUID REFERENCES sam_conversations(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ -- For compliance and data retention
);

-- Create knowledge patterns table for ML training and classification rules
CREATE TABLE IF NOT EXISTS sam_knowledge_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_name TEXT UNIQUE NOT NULL,
  knowledge_type TEXT NOT NULL CHECK (knowledge_type IN ('personal', 'team_shareable')),
  category TEXT NOT NULL,
  subcategory TEXT,
  
  -- Pattern matching rules
  keywords TEXT[],
  phrases TEXT[],
  regex_patterns TEXT[],
  context_indicators TEXT[],
  
  -- Classification metadata
  confidence_threshold DECIMAL(3,2) DEFAULT 0.7,
  auto_extract BOOLEAN DEFAULT TRUE,
  requires_user_confirmation BOOLEAN DEFAULT FALSE,
  
  -- Pattern performance
  true_positive_count INTEGER DEFAULT 0,
  false_positive_count INTEGER DEFAULT 0,
  accuracy_score DECIMAL(3,2) DEFAULT 0.0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user privacy preferences table
CREATE TABLE IF NOT EXISTS sam_user_privacy_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,
  organization_id TEXT,
  
  -- Privacy settings per knowledge category
  communication_style_sharing TEXT DEFAULT 'user' CHECK (communication_style_sharing IN ('user', 'team', 'organization')),
  professional_context_sharing TEXT DEFAULT 'team' CHECK (professional_context_sharing IN ('user', 'team', 'organization')),
  customer_intelligence_sharing TEXT DEFAULT 'organization' CHECK (customer_intelligence_sharing IN ('user', 'team', 'organization')),
  market_insights_sharing TEXT DEFAULT 'organization' CHECK (market_insights_sharing IN ('user', 'team', 'organization')),
  
  -- Global preferences
  auto_knowledge_extraction BOOLEAN DEFAULT TRUE,
  require_extraction_confirmation BOOLEAN DEFAULT FALSE,
  data_retention_days INTEGER DEFAULT 365,
  allow_cross_tenant_anonymized_learning BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient knowledge retrieval and classification
CREATE INDEX idx_extracted_knowledge_user_type ON sam_extracted_knowledge(user_id, knowledge_type, is_active);
CREATE INDEX idx_extracted_knowledge_org_category ON sam_extracted_knowledge(organization_id, category, subcategory) WHERE is_active = TRUE;
CREATE INDEX idx_extracted_knowledge_sharing ON sam_extracted_knowledge(sharing_scope, data_sensitivity) WHERE is_active = TRUE;
CREATE INDEX idx_extracted_knowledge_conversation ON sam_extracted_knowledge(conversation_id, knowledge_type);
CREATE INDEX idx_extracted_knowledge_updated ON sam_extracted_knowledge(updated_at DESC) WHERE is_active = TRUE;

CREATE INDEX idx_knowledge_patterns_type_category ON sam_knowledge_patterns(knowledge_type, category, auto_extract);
CREATE INDEX idx_knowledge_patterns_performance ON sam_knowledge_patterns(accuracy_score DESC, confidence_threshold);

CREATE INDEX idx_conversations_classification ON sam_conversations(knowledge_extracted, extraction_confidence) WHERE knowledge_extracted = FALSE;
CREATE INDEX idx_conversations_privacy ON sam_conversations USING GIN(privacy_tags) WHERE privacy_tags != '{}';

-- Enable RLS on new tables
ALTER TABLE sam_extracted_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE sam_knowledge_patterns ENABLE ROW LEVEL SECURITY;  
ALTER TABLE sam_user_privacy_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sam_extracted_knowledge
CREATE POLICY "Users can view their personal knowledge" ON sam_extracted_knowledge
  FOR SELECT USING (
    user_id = auth.uid()::text AND knowledge_type = 'personal'
  );

CREATE POLICY "Users can view team knowledge in their organization" ON sam_extracted_knowledge
  FOR SELECT USING (
    knowledge_type = 'team_shareable' AND
    (organization_id IS NOT NULL AND organization_id IN (
      SELECT jsonb_array_elements_text(auth.jwt() -> 'organizations')
    ))
  );

CREATE POLICY "Users can create their own knowledge extractions" ON sam_extracted_knowledge
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update their own knowledge extractions" ON sam_extracted_knowledge
  FOR UPDATE USING (user_id = auth.uid()::text);

-- RLS Policies for sam_user_privacy_preferences
CREATE POLICY "Users can manage their own privacy preferences" ON sam_user_privacy_preferences
  FOR ALL USING (user_id = auth.uid()::text);

-- RLS Policies for sam_knowledge_patterns (admin only for now)
CREATE POLICY "Service role can manage knowledge patterns" ON sam_knowledge_patterns
  FOR ALL USING (auth.role() = 'service_role');

-- Service role policies for API operations
CREATE POLICY "Service role can manage extracted knowledge" ON sam_extracted_knowledge
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage privacy preferences" ON sam_user_privacy_preferences
  FOR ALL USING (auth.role() = 'service_role');

-- Functions for knowledge classification and extraction

-- Function to classify conversation content
CREATE OR REPLACE FUNCTION classify_conversation_content(
  conversation_text TEXT,
  user_context JSONB DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
  classification JSONB := '{}';
  personal_data JSONB := '{}';
  team_data JSONB := '{}';
  pattern RECORD;
  match_found BOOLEAN;
BEGIN
  -- Initialize classification structure
  classification := jsonb_build_object(
    'personal_data', '{}',
    'team_shareable', '{}',
    'classification_confidence', 0.0,
    'patterns_matched', '[]'
  );
  
  -- Loop through classification patterns
  FOR pattern IN 
    SELECT * FROM sam_knowledge_patterns 
    WHERE auto_extract = TRUE 
    ORDER BY accuracy_score DESC
  LOOP
    match_found := FALSE;
    
    -- Check keyword matches
    IF pattern.keywords IS NOT NULL THEN
      FOR i IN 1..array_length(pattern.keywords, 1) LOOP
        IF position(lower(pattern.keywords[i]) IN lower(conversation_text)) > 0 THEN
          match_found := TRUE;
          EXIT;
        END IF;
      END LOOP;
    END IF;
    
    -- Check phrase matches
    IF NOT match_found AND pattern.phrases IS NOT NULL THEN
      FOR i IN 1..array_length(pattern.phrases, 1) LOOP
        IF position(lower(pattern.phrases[i]) IN lower(conversation_text)) > 0 THEN
          match_found := TRUE;
          EXIT;
        END IF;
      END LOOP;
    END IF;
    
    -- If pattern matched, add to classification
    IF match_found THEN
      IF pattern.knowledge_type = 'personal' THEN
        personal_data := personal_data || jsonb_build_object(
          pattern.category, jsonb_build_object(
            'detected', TRUE,
            'confidence', pattern.confidence_threshold,
            'pattern_used', pattern.pattern_name
          )
        );
      ELSE
        team_data := team_data || jsonb_build_object(
          pattern.category, jsonb_build_object(
            'detected', TRUE,
            'confidence', pattern.confidence_threshold,
            'pattern_used', pattern.pattern_name
          )
        );
      END IF;
      
      classification := classification || jsonb_build_object(
        'patterns_matched', classification->'patterns_matched' || to_jsonb(pattern.pattern_name)
      );
    END IF;
  END LOOP;
  
  -- Build final classification
  classification := classification || jsonb_build_object(
    'personal_data', personal_data,
    'team_shareable', team_data,
    'classification_confidence', CASE 
      WHEN jsonb_array_length(classification->'patterns_matched') > 0 
      THEN 0.8 
      ELSE 0.3 
    END
  );
  
  RETURN classification;
END;
$$ LANGUAGE plpgsql;

-- Function to extract and store knowledge from conversation
CREATE OR REPLACE FUNCTION extract_knowledge_from_conversation(
  p_conversation_id UUID
) RETURNS JSONB AS $$
DECLARE
  conv RECORD;
  classification JSONB;
  extraction_result JSONB := '{}';
  knowledge_item JSONB;
  category_key TEXT;
  category_data JSONB;
BEGIN
  -- Get conversation details
  SELECT * INTO conv FROM sam_conversations WHERE id = p_conversation_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Conversation not found');
  END IF;
  
  -- Classify the conversation content
  classification := classify_conversation_content(
    conv.message || ' ' || conv.response,
    conv.metadata
  );
  
  -- Extract personal knowledge
  IF classification->'personal_data' != '{}' THEN
    FOR category_key IN SELECT jsonb_object_keys(classification->'personal_data') LOOP
      category_data := classification->'personal_data'->category_key;
      
      -- Insert personal knowledge extraction
      INSERT INTO sam_extracted_knowledge (
        conversation_id,
        user_id,
        organization_id,
        knowledge_type,
        category,
        content,
        confidence_score,
        source_message_ids,
        sharing_scope,
        data_sensitivity
      ) VALUES (
        p_conversation_id,
        conv.user_id,
        conv.organization_id,
        'personal',
        category_key,
        category_data,
        (category_data->>'confidence')::DECIMAL,
        ARRAY[p_conversation_id::TEXT],
        'user',
        'medium'
      );
    END LOOP;
  END IF;
  
  -- Extract team shareable knowledge
  IF classification->'team_shareable' != '{}' THEN
    FOR category_key IN SELECT jsonb_object_keys(classification->'team_shareable') LOOP
      category_data := classification->'team_shareable'->category_key;
      
      -- Insert team knowledge extraction
      INSERT INTO sam_extracted_knowledge (
        conversation_id,
        user_id,
        organization_id,
        knowledge_type,
        category,
        content,
        confidence_score,
        source_message_ids,
        sharing_scope,
        data_sensitivity
      ) VALUES (
        p_conversation_id,
        conv.user_id,
        conv.organization_id,
        'team_shareable',
        category_key,
        category_data,
        (category_data->>'confidence')::DECIMAL,
        ARRAY[p_conversation_id::TEXT],
        'organization',
        'low'
      );
    END LOOP;
  END IF;
  
  -- Update conversation as processed
  UPDATE sam_conversations 
  SET 
    knowledge_extracted = TRUE,
    extraction_confidence = (classification->>'classification_confidence')::DECIMAL,
    knowledge_classification = classification
  WHERE id = p_conversation_id;
  
  extraction_result := jsonb_build_object(
    'conversation_id', p_conversation_id,
    'classification', classification,
    'personal_extractions', jsonb_array_length(classification->'personal_data'),
    'team_extractions', jsonb_array_length(classification->'team_shareable'),
    'confidence', classification->>'classification_confidence'
  );
  
  RETURN extraction_result;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's knowledge for RAG context
CREATE OR REPLACE FUNCTION get_user_knowledge_context(
  p_user_id TEXT,
  p_organization_id TEXT DEFAULT NULL,
  p_knowledge_types TEXT[] DEFAULT ARRAY['personal', 'team_shareable'],
  p_limit INTEGER DEFAULT 50
) RETURNS JSONB AS $$
DECLARE
  personal_knowledge JSONB := '{}';
  team_knowledge JSONB := '{}';
  result JSONB;
BEGIN
  -- Get personal knowledge for this user
  IF 'personal' = ANY(p_knowledge_types) THEN
    SELECT jsonb_object_agg(category, jsonb_agg(content ORDER BY updated_at DESC))
    INTO personal_knowledge
    FROM sam_extracted_knowledge 
    WHERE user_id = p_user_id 
      AND knowledge_type = 'personal' 
      AND is_active = TRUE
    GROUP BY category;
  END IF;
  
  -- Get team knowledge for this organization
  IF 'team_shareable' = ANY(p_knowledge_types) AND p_organization_id IS NOT NULL THEN
    SELECT jsonb_object_agg(category, jsonb_agg(content ORDER BY updated_at DESC))
    INTO team_knowledge
    FROM sam_extracted_knowledge 
    WHERE organization_id = p_organization_id 
      AND knowledge_type = 'team_shareable' 
      AND is_active = TRUE
      AND sharing_scope IN ('team', 'organization')
    GROUP BY category
    LIMIT p_limit;
  END IF;
  
  result := jsonb_build_object(
    'personal_knowledge', COALESCE(personal_knowledge, '{}'),
    'team_knowledge', COALESCE(team_knowledge, '{}'),
    'generated_at', extract(epoch from now()),
    'user_id', p_user_id,
    'organization_id', p_organization_id
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Insert default classification patterns
INSERT INTO sam_knowledge_patterns (pattern_name, knowledge_type, category, subcategory, keywords, phrases, confidence_threshold) VALUES
-- Personal patterns
('communication_style_formal', 'personal', 'communication_style', 'tone', ARRAY['please', 'thank you', 'appreciate', 'kindly'], ARRAY['I would appreciate', 'Could you please', 'Thank you for'], 0.7),
('communication_style_casual', 'personal', 'communication_style', 'tone', ARRAY['hey', 'cool', 'awesome', 'sounds good'], ARRAY['sounds good', 'no worries', 'hey there'], 0.7),
('professional_background_sales', 'personal', 'professional_context', 'role', ARRAY['sales', 'quota', 'pipeline', 'deals'], ARRAY['VP Sales', 'Sales Director', 'Account Executive'], 0.8),
('professional_background_marketing', 'personal', 'professional_context', 'role', ARRAY['marketing', 'campaigns', 'leads', 'brand'], ARRAY['CMO', 'Marketing Director', 'Growth Marketing'], 0.8),

-- Team shareable patterns  
('customer_pain_points', 'team_shareable', 'customer_intelligence', 'pain_points', ARRAY['problem', 'challenge', 'struggle', 'difficult'], ARRAY['biggest challenge', 'main problem', 'pain point'], 0.6),
('market_insights_industry', 'team_shareable', 'market_insights', 'industry', ARRAY['industry', 'market', 'sector', 'vertical'], ARRAY['in our industry', 'market conditions', 'industry trends'], 0.6),
('competitive_intelligence', 'team_shareable', 'competitive_intelligence', 'mentions', ARRAY['competitor', 'alternative', 'vs ', 'compare'], ARRAY['compared to', 'instead of', 'better than'], 0.7),
('product_feedback', 'team_shareable', 'product_intelligence', 'feedback', ARRAY['feature', 'functionality', 'improvement', 'integration'], ARRAY['would be great if', 'missing feature', 'integration with'], 0.6);

-- Insert default user privacy preferences template
INSERT INTO sam_user_privacy_preferences (user_id, communication_style_sharing, professional_context_sharing, customer_intelligence_sharing, market_insights_sharing) 
VALUES ('_default_template', 'user', 'team', 'organization', 'organization');

-- Comments
COMMENT ON TABLE sam_extracted_knowledge IS 'Structured knowledge extracted from conversations with privacy classification';
COMMENT ON TABLE sam_knowledge_patterns IS 'ML patterns for automatically classifying and extracting knowledge from conversations';
COMMENT ON TABLE sam_user_privacy_preferences IS 'User-specific privacy preferences for knowledge sharing';
COMMENT ON FUNCTION classify_conversation_content IS 'Classifies conversation content into personal vs team knowledge categories';
COMMENT ON FUNCTION extract_knowledge_from_conversation IS 'Extracts and stores structured knowledge from a conversation';
COMMENT ON FUNCTION get_user_knowledge_context IS 'Retrieves user and team knowledge for RAG context generation';