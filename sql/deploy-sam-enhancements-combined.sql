-- ================================================================
-- SAM SYSTEM ENHANCEMENTS - COMBINED DEPLOYMENT
-- ================================================================
-- This file combines two migrations for easy deployment:
-- 1. Document attachments system (PDF upload, text extraction)
-- 2. Enhanced ICP discovery with Q&A storage for RAG
--
-- Deploy this entire file in Supabase Dashboard > SQL Editor
-- ================================================================

-- ================================================================
-- PART 1: SAM CONVERSATION ATTACHMENTS SYSTEM
-- ================================================================

-- Create attachments table
CREATE TABLE IF NOT EXISTS sam_conversation_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Thread and message association
    thread_id UUID NOT NULL REFERENCES sam_conversation_threads(id) ON DELETE CASCADE,
    message_id UUID REFERENCES sam_conversation_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,

    -- File metadata
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,

    -- Storage location
    storage_path TEXT NOT NULL,
    storage_bucket TEXT NOT NULL DEFAULT 'sam-attachments',

    -- Processing status
    processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),

    -- Extracted content (for PDFs/documents)
    extracted_text TEXT,
    extracted_metadata JSONB DEFAULT '{}',

    -- Purpose/context
    attachment_type TEXT CHECK (attachment_type IN ('linkedin_profile', 'icp_document', 'pitch_deck', 'case_study', 'other')),
    user_notes TEXT,

    -- Processing results
    analysis_results JSONB DEFAULT '{}',
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT fk_thread FOREIGN KEY (thread_id) REFERENCES sam_conversation_threads(id) ON DELETE CASCADE,
    CONSTRAINT fk_message FOREIGN KEY (message_id) REFERENCES sam_conversation_messages(id) ON DELETE CASCADE
);

-- Indexes for attachments
CREATE INDEX IF NOT EXISTS idx_attachments_thread ON sam_conversation_attachments(thread_id);
CREATE INDEX IF NOT EXISTS idx_attachments_message ON sam_conversation_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_attachments_user ON sam_conversation_attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_attachments_workspace ON sam_conversation_attachments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_attachments_type ON sam_conversation_attachments(attachment_type);
CREATE INDEX IF NOT EXISTS idx_attachments_status ON sam_conversation_attachments(processing_status);

-- RLS for attachments
ALTER TABLE sam_conversation_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their workspace attachments"
    ON sam_conversation_attachments FOR SELECT
    USING (
        user_id = auth.uid()
        OR workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can upload attachments to their threads"
    ON sam_conversation_attachments FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND thread_id IN (
            SELECT id FROM sam_conversation_threads
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their attachments"
    ON sam_conversation_attachments FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete their attachments"
    ON sam_conversation_attachments FOR DELETE
    USING (user_id = auth.uid());

-- Trigger for attachment processing status
CREATE OR REPLACE FUNCTION update_attachment_processing_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.processing_status = 'completed' AND OLD.processing_status != 'completed' THEN
        NEW.processed_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_attachment_processing
    BEFORE UPDATE ON sam_conversation_attachments
    FOR EACH ROW
    EXECUTE FUNCTION update_attachment_processing_status();

-- ================================================================
-- PART 2: ENHANCED ICP DISCOVERY WITH Q&A STORAGE
-- ================================================================

-- Add new fields to existing ICP discovery sessions table
ALTER TABLE public.sam_icp_discovery_sessions
  ADD COLUMN IF NOT EXISTS question_responses JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS industry_context JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS prospecting_criteria JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS linkedin_profile_data JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS content_strategy JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

-- Index for workspace queries
CREATE INDEX IF NOT EXISTS idx_sam_icp_discovery_sessions_workspace_id
    ON public.sam_icp_discovery_sessions(workspace_id);

-- Create Q&A knowledge table for RAG integration
CREATE TABLE IF NOT EXISTS public.sam_icp_knowledge_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    discovery_session_id UUID REFERENCES public.sam_icp_discovery_sessions(id) ON DELETE CASCADE,

    -- Question/Answer tracking
    question_id TEXT NOT NULL,
    question_text TEXT NOT NULL,
    answer_text TEXT NOT NULL,
    answer_structured JSONB DEFAULT '{}'::jsonb,

    -- Categorization
    stage TEXT NOT NULL,
    category TEXT NOT NULL,

    -- Context metadata
    confidence_score DECIMAL(3,2) DEFAULT 1.0,
    is_shallow BOOLEAN DEFAULT false,
    needs_clarification BOOLEAN DEFAULT false,
    clarification_notes TEXT,

    -- RAG integration
    embedding VECTOR(1536),
    indexed_for_rag BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(discovery_session_id, question_id)
);

-- Indexes for ICP knowledge
CREATE INDEX IF NOT EXISTS idx_sam_icp_knowledge_workspace
    ON public.sam_icp_knowledge_entries(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sam_icp_knowledge_user
    ON public.sam_icp_knowledge_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_sam_icp_knowledge_session
    ON public.sam_icp_knowledge_entries(discovery_session_id);
CREATE INDEX IF NOT EXISTS idx_sam_icp_knowledge_stage
    ON public.sam_icp_knowledge_entries(stage);
CREATE INDEX IF NOT EXISTS idx_sam_icp_knowledge_category
    ON public.sam_icp_knowledge_entries(category);
CREATE INDEX IF NOT EXISTS idx_sam_icp_knowledge_embedding
    ON public.sam_icp_knowledge_entries
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- RLS for ICP knowledge
ALTER TABLE public.sam_icp_knowledge_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ICP knowledge"
    ON public.sam_icp_knowledge_entries FOR SELECT
    USING (
        user_id = auth.uid()
        OR workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own ICP knowledge"
    ON public.sam_icp_knowledge_entries FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own ICP knowledge"
    ON public.sam_icp_knowledge_entries FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own ICP knowledge"
    ON public.sam_icp_knowledge_entries FOR DELETE
    USING (user_id = auth.uid());

-- ================================================================
-- HELPER FUNCTIONS FOR RAG QUERIES
-- ================================================================

-- Search ICP knowledge
CREATE OR REPLACE FUNCTION public.search_icp_knowledge(
    p_workspace_id UUID,
    p_query_embedding VECTOR(1536),
    p_stage TEXT DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    question_id TEXT,
    question_text TEXT,
    answer_text TEXT,
    answer_structured JSONB,
    stage TEXT,
    category TEXT,
    confidence_score DECIMAL,
    similarity DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.question_id,
        e.question_text,
        e.answer_text,
        e.answer_structured,
        e.stage,
        e.category,
        e.confidence_score,
        1 - (e.embedding <=> p_query_embedding) AS similarity
    FROM public.sam_icp_knowledge_entries e
    WHERE e.workspace_id = p_workspace_id
      AND (p_stage IS NULL OR e.stage = p_stage)
      AND (p_category IS NULL OR e.category = p_category)
      AND e.indexed_for_rag = true
    ORDER BY e.embedding <-> p_query_embedding
    LIMIT COALESCE(p_limit, 5);
END;
$$ LANGUAGE plpgsql STABLE;

-- Get Q&A history
CREATE OR REPLACE FUNCTION public.get_discovery_qa_history(
    p_discovery_session_id UUID
)
RETURNS TABLE (
    question_id TEXT,
    question_text TEXT,
    answer_text TEXT,
    stage TEXT,
    category TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.question_id,
        e.question_text,
        e.answer_text,
        e.stage,
        e.category,
        e.created_at
    FROM public.sam_icp_knowledge_entries e
    WHERE e.discovery_session_id = p_discovery_session_id
    ORDER BY e.created_at ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get prospecting criteria
CREATE OR REPLACE FUNCTION public.get_prospecting_criteria(
    p_workspace_id UUID,
    p_user_id UUID
)
RETURNS TABLE (
    question_id TEXT,
    answer_text TEXT,
    answer_structured JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.question_id,
        e.answer_text,
        e.answer_structured
    FROM public.sam_icp_knowledge_entries e
    WHERE e.workspace_id = p_workspace_id
      AND e.user_id = p_user_id
      AND e.category = 'prospecting_criteria'
    ORDER BY e.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_sam_icp_knowledge_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_sam_icp_knowledge_updated_at
    BEFORE UPDATE ON public.sam_icp_knowledge_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_sam_icp_knowledge_updated_at();

-- ================================================================
-- GRANTS
-- ================================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON sam_conversation_attachments TO authenticated;
GRANT ALL ON public.sam_icp_knowledge_entries TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_icp_knowledge TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_discovery_qa_history TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_prospecting_criteria TO authenticated;

-- ================================================================
-- DEPLOYMENT COMPLETE
-- ================================================================
-- Tables created:
--   ✅ sam_conversation_attachments
--   ✅ sam_icp_knowledge_entries (with RAG support)
--
-- Enhanced tables:
--   ✅ sam_icp_discovery_sessions (added Q&A fields)
--
-- Functions created:
--   ✅ search_icp_knowledge()
--   ✅ get_discovery_qa_history()
--   ✅ get_prospecting_criteria()
--
-- Next steps:
--   1. Update SAM message route to store Q&A
--   2. Generate embeddings for Q&A pairs
--   3. Add file upload UI to SAM chat
-- ================================================================
