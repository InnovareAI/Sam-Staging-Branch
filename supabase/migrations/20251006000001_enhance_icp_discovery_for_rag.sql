-- Enhance ICP Discovery System for Complete Q&A Storage and RAG Integration
-- This migration ensures all questions and answers are stored for SAM to reference
-- when asking clarifying questions or setting up campaigns

-- ================================================================
-- 1. ADD Q&A STORAGE FIELDS TO ICP DISCOVERY SESSIONS
-- ================================================================

-- Add raw question-answer pairs for complete conversation history
ALTER TABLE public.sam_icp_discovery_sessions
  ADD COLUMN IF NOT EXISTS question_responses JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS industry_context JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS prospecting_criteria JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS linkedin_profile_data JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS content_strategy JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

-- Add index for workspace queries
CREATE INDEX IF NOT EXISTS idx_sam_icp_discovery_sessions_workspace_id
    ON public.sam_icp_discovery_sessions(workspace_id);

-- ================================================================
-- 2. CREATE Q&A KNOWLEDGE BASE INTEGRATION TABLE
-- ================================================================

-- Link ICP discovery data to knowledge base for RAG retrieval
CREATE TABLE IF NOT EXISTS public.sam_icp_knowledge_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    discovery_session_id UUID REFERENCES public.sam_icp_discovery_sessions(id) ON DELETE CASCADE,

    -- Question/Answer tracking
    question_id TEXT NOT NULL, -- e.g., 'objectives', 'pain_points', 'prospecting_linkedin_activity'
    question_text TEXT NOT NULL,
    answer_text TEXT NOT NULL,
    answer_structured JSONB DEFAULT '{}'::jsonb,

    -- Categorization
    stage TEXT NOT NULL, -- e.g., 'stage_1_target_market', 'stage_2_icp', 'stage_3_prospecting'
    category TEXT NOT NULL, -- e.g., 'business_model', 'pain_points', 'prospecting_criteria'

    -- Context metadata
    confidence_score DECIMAL(3,2) DEFAULT 1.0,
    is_shallow BOOLEAN DEFAULT false,
    needs_clarification BOOLEAN DEFAULT false,
    clarification_notes TEXT,

    -- RAG integration
    embedding VECTOR(1536), -- OpenAI text-embedding-3-small
    indexed_for_rag BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure unique question per session
    UNIQUE(discovery_session_id, question_id)
);

-- Create indexes for efficient RAG queries
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

-- Vector similarity search index
CREATE INDEX IF NOT EXISTS idx_sam_icp_knowledge_embedding
    ON public.sam_icp_knowledge_entries
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- ================================================================
-- 3. ROW LEVEL SECURITY FOR Q&A KNOWLEDGE
-- ================================================================

ALTER TABLE public.sam_icp_knowledge_entries ENABLE ROW LEVEL SECURITY;

-- Users can view their own Q&A knowledge
CREATE POLICY "Users can view their own ICP knowledge"
    ON public.sam_icp_knowledge_entries FOR SELECT
    USING (
        user_id = auth.uid()
        OR workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- Users can insert their own Q&A knowledge
CREATE POLICY "Users can insert their own ICP knowledge"
    ON public.sam_icp_knowledge_entries FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Users can update their own Q&A knowledge
CREATE POLICY "Users can update their own ICP knowledge"
    ON public.sam_icp_knowledge_entries FOR UPDATE
    USING (user_id = auth.uid());

-- Users can delete their own Q&A knowledge
CREATE POLICY "Users can delete their own ICP knowledge"
    ON public.sam_icp_knowledge_entries FOR DELETE
    USING (user_id = auth.uid());

-- ================================================================
-- 4. HELPER FUNCTIONS FOR RAG QUERIES
-- ================================================================

-- Search ICP knowledge for clarifying questions or campaign setup
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

-- Get all Q&A for a specific discovery session
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

-- Get prospecting criteria from discovery session
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

-- ================================================================
-- 5. TRIGGERS FOR AUTO-UPDATING TIMESTAMPS
-- ================================================================

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
-- 6. GRANTS
-- ================================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.sam_icp_knowledge_entries TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_icp_knowledge TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_discovery_qa_history TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_prospecting_criteria TO authenticated;

-- ================================================================
-- 7. COMMENTS FOR DOCUMENTATION
-- ================================================================

COMMENT ON TABLE public.sam_icp_knowledge_entries IS
'Stores all ICP discovery Q&A pairs with vector embeddings for RAG retrieval.
SAM uses this to reference past answers when asking clarifying questions or setting up campaigns.';

COMMENT ON COLUMN public.sam_icp_knowledge_entries.question_id IS
'Unique identifier for question type (e.g., objectives, pain_points, prospecting_linkedin_activity)';

COMMENT ON COLUMN public.sam_icp_knowledge_entries.stage IS
'Workflow stage: stage_1_target_market, stage_1b_industry, stage_2_icp, stage_3_prospecting, stage_4_linkedin, stage_5_content';

COMMENT ON COLUMN public.sam_icp_knowledge_entries.category IS
'Category: business_model, icp_definition, pain_points, prospecting_criteria, linkedin_profile, content_strategy';

COMMENT ON COLUMN public.sam_icp_knowledge_entries.embedding IS
'Vector embedding for RAG similarity search using OpenAI text-embedding-3-small (1536 dimensions)';

COMMENT ON FUNCTION public.search_icp_knowledge IS
'Semantic search across ICP knowledge for SAM to find relevant context when asking clarifying questions';

COMMENT ON FUNCTION public.get_discovery_qa_history IS
'Get complete Q&A history for a discovery session in chronological order';

COMMENT ON FUNCTION public.get_prospecting_criteria IS
'Get all prospecting criteria Q&A for campaign setup';

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
-- Next steps:
-- 1. Deploy this migration via Supabase Dashboard SQL Editor
-- 2. Update SAM message route to store Q&A in this table
-- 3. Generate embeddings for each Q&A pair using OpenAI
-- 4. Query this table when SAM needs context for clarifying questions
-- 5. Use for campaign setup to reference stored prospecting criteria
