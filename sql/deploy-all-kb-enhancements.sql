-- Deploy all KB enhancements and website intelligence migrations
-- Run this in Supabase SQL Editor (Production)

-- Migration 1: SAM Attachments
-- Enables document uploads in SAM conversations
-- SAM Conversation Attachments System
-- Supports document uploads (PDFs, images, etc.) in SAM conversations

-- ================================================================
-- 1. SAM CONVERSATION ATTACHMENTS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS sam_conversation_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Thread and message association
    thread_id UUID NOT NULL REFERENCES sam_conversation_threads(id) ON DELETE CASCADE,
    message_id UUID REFERENCES sam_conversation_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,

    -- File metadata
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL, -- 'application/pdf', 'image/png', etc.
    file_size INTEGER NOT NULL, -- bytes
    mime_type TEXT NOT NULL,

    -- Storage location
    storage_path TEXT NOT NULL, -- Path in Supabase Storage
    storage_bucket TEXT NOT NULL DEFAULT 'sam-attachments',

    -- Processing status
    processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),

    -- Extracted content (for PDFs/documents)
    extracted_text TEXT, -- Full text extracted from PDF
    extracted_metadata JSONB DEFAULT '{}', -- PDF metadata, page count, etc.

    -- Purpose/context
    attachment_type TEXT CHECK (attachment_type IN ('linkedin_profile', 'icp_document', 'pitch_deck', 'case_study', 'other')),
    user_notes TEXT, -- User's description of the document

    -- Processing results
    analysis_results JSONB DEFAULT '{}', -- AI analysis of document
    error_message TEXT, -- If processing failed

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,

    -- Indexes for efficient queries
    CONSTRAINT fk_thread FOREIGN KEY (thread_id) REFERENCES sam_conversation_threads(id) ON DELETE CASCADE,
    CONSTRAINT fk_message FOREIGN KEY (message_id) REFERENCES sam_conversation_messages(id) ON DELETE CASCADE
);

-- ================================================================
-- 2. INDEXES
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_attachments_thread ON sam_conversation_attachments(thread_id);
CREATE INDEX IF NOT EXISTS idx_attachments_message ON sam_conversation_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_attachments_user ON sam_conversation_attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_attachments_workspace ON sam_conversation_attachments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_attachments_type ON sam_conversation_attachments(attachment_type);
CREATE INDEX IF NOT EXISTS idx_attachments_status ON sam_conversation_attachments(processing_status);

-- ================================================================
-- 3. ROW LEVEL SECURITY
-- ================================================================
ALTER TABLE sam_conversation_attachments ENABLE ROW LEVEL SECURITY;

-- Users can view attachments in their workspace threads
CREATE POLICY "Users can view their workspace attachments"
    ON sam_conversation_attachments FOR SELECT
    USING (
        user_id = auth.uid()
        OR workspace_id IN (
            SELECT workspace_id FROM workspace_members
            WHERE user_id = auth.uid()
        )
    );

-- Users can upload attachments to their threads
CREATE POLICY "Users can upload attachments to their threads"
    ON sam_conversation_attachments FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND thread_id IN (
            SELECT id FROM sam_conversation_threads
            WHERE user_id = auth.uid()
        )
    );

-- Users can update their own attachments (e.g., add notes)
CREATE POLICY "Users can update their attachments"
    ON sam_conversation_attachments FOR UPDATE
    USING (user_id = auth.uid());

-- Users can delete their own attachments
CREATE POLICY "Users can delete their attachments"
    ON sam_conversation_attachments FOR DELETE
    USING (user_id = auth.uid());

-- ================================================================
-- 4. STORAGE BUCKET SETUP (Run this in Supabase Dashboard SQL Editor)
-- ================================================================
-- Note: This needs to be run with superuser privileges
-- Go to Supabase Dashboard > Storage > Create new bucket: 'sam-attachments'
-- Or run this SQL if you have storage permissions:

-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('sam-attachments', 'sam-attachments', false)
-- ON CONFLICT (id) DO NOTHING;

-- Storage policies for the bucket
-- CREATE POLICY "Users can upload their own attachments"
-- ON storage.objects FOR INSERT
-- WITH CHECK (
--     bucket_id = 'sam-attachments'
--     AND auth.uid()::text = (storage.foldername(name))[1]
-- );

-- CREATE POLICY "Users can view their own attachments"
-- ON storage.objects FOR SELECT
-- USING (
--     bucket_id = 'sam-attachments'
--     AND auth.uid()::text = (storage.foldername(name))[1]
-- );

-- CREATE POLICY "Users can delete their own attachments"
-- ON storage.objects FOR DELETE
-- USING (
--     bucket_id = 'sam-attachments'
--     AND auth.uid()::text = (storage.foldername(name))[1]
-- );

-- ================================================================
-- 5. FUNCTIONS
-- ================================================================

-- Function to update attachment processing status
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
-- 6. GRANTS
-- ================================================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON sam_conversation_attachments TO authenticated;

-- ================================================================
-- MIGRATION COMPLETE
-- ================================================================
-- Next steps:
-- 1. Create 'sam-attachments' storage bucket in Supabase Dashboard
-- 2. Configure storage policies (see section 4 above)
-- 3. Deploy upload API endpoint
-- 4. Add PDF parsing with pdf-parse library

-- Migration 2: ICP Discovery Enhancements
-- Adds structured Q&A storage for SAM discovery sessions
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

-- Migration 3: Source Tracking
-- Tracks where KB entries come from (manual, document, website, SAM)
-- Add source document tracking to knowledge base tables
-- This allows KB entries to reference their source documents

-- 1. Create knowledge_base table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.knowledge_base (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    subcategory TEXT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    version TEXT DEFAULT '1.0',
    is_active BOOLEAN DEFAULT true,
    source_attachment_id UUID,
    source_type TEXT CHECK (source_type IN ('manual', 'document_upload', 'sam_discovery', 'api_import')),
    source_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create indexes for knowledge_base
CREATE INDEX IF NOT EXISTS idx_knowledge_base_workspace ON public.knowledge_base(workspace_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON public.knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_active ON public.knowledge_base(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_knowledge_base_source ON public.knowledge_base(source_attachment_id);

-- 3. Add foreign key constraint for source_attachment_id (if table existed before)
DO $$
BEGIN
    -- Check if foreign key constraint exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'knowledge_base_source_attachment_id_fkey'
        AND table_name = 'knowledge_base'
    ) THEN
        -- Add foreign key
        ALTER TABLE public.knowledge_base
        ADD CONSTRAINT knowledge_base_source_attachment_id_fkey
        FOREIGN KEY (source_attachment_id)
        REFERENCES public.sam_conversation_attachments(id)
        ON DELETE SET NULL;
    END IF;
END $$;

-- 4. Add source_attachment_id to sam_icp_knowledge_entries
ALTER TABLE public.sam_icp_knowledge_entries
ADD COLUMN IF NOT EXISTS source_attachment_id UUID REFERENCES public.sam_conversation_attachments(id) ON DELETE SET NULL;

-- 5. Add index for efficient lookups by source document
CREATE INDEX IF NOT EXISTS idx_sam_icp_knowledge_source
ON public.sam_icp_knowledge_entries(source_attachment_id);

-- 6. If knowledge_base already existed, add missing columns
DO $$
BEGIN
    -- Add workspace_id if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'knowledge_base'
        AND column_name = 'workspace_id'
    ) THEN
        ALTER TABLE public.knowledge_base
        ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

        CREATE INDEX IF NOT EXISTS idx_knowledge_base_workspace ON public.knowledge_base(workspace_id);
    END IF;

    -- Add source_attachment_id if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'knowledge_base'
        AND column_name = 'source_attachment_id'
    ) THEN
        ALTER TABLE public.knowledge_base
        ADD COLUMN source_attachment_id UUID;

        CREATE INDEX IF NOT EXISTS idx_knowledge_base_source ON public.knowledge_base(source_attachment_id);
    END IF;

    -- Add source_type if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'knowledge_base'
        AND column_name = 'source_type'
    ) THEN
        ALTER TABLE public.knowledge_base
        ADD COLUMN source_type TEXT CHECK (source_type IN ('manual', 'document_upload', 'sam_discovery', 'api_import'));

        -- Set default for existing rows
        UPDATE public.knowledge_base SET source_type = 'manual' WHERE source_type IS NULL;
    END IF;

    -- Add source_metadata if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'knowledge_base'
        AND column_name = 'source_metadata'
    ) THEN
        ALTER TABLE public.knowledge_base
        ADD COLUMN source_metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 7. Create helper function to get all KB entries from a document
CREATE OR REPLACE FUNCTION get_kb_entries_by_source(attachment_id UUID)
RETURNS TABLE (
    entry_type TEXT,
    entry_id UUID,
    title TEXT,
    category TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    -- Get entries from sam_icp_knowledge_entries
    RETURN QUERY
    SELECT
        'icp_knowledge'::TEXT as entry_type,
        id as entry_id,
        question_text as title,
        category,
        created_at
    FROM public.sam_icp_knowledge_entries
    WHERE source_attachment_id = attachment_id;

    -- Get entries from knowledge_base
    RETURN QUERY
    SELECT
        'knowledge_base'::TEXT as entry_type,
        id as entry_id,
        title,
        category,
        created_at
    FROM public.knowledge_base
    WHERE source_attachment_id = attachment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create function to clean up KB entries when attachment is deleted
-- Note: ON DELETE SET NULL will keep entries but remove reference
-- This function allows manual cleanup if needed
CREATE OR REPLACE FUNCTION cleanup_orphaned_kb_entries()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Delete sam_icp_knowledge_entries with no source and no session
    DELETE FROM public.sam_icp_knowledge_entries
    WHERE source_attachment_id IS NULL
    AND discovery_session_id IS NULL
    AND created_at < NOW() - INTERVAL '30 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Add comment documentation
COMMENT ON COLUMN public.sam_icp_knowledge_entries.source_attachment_id IS
'Reference to the uploaded document that generated this knowledge entry. NULL for entries from SAM discovery conversations.';

COMMENT ON COLUMN public.knowledge_base.source_attachment_id IS
'Reference to the uploaded document that generated this knowledge entry. NULL for manually created entries.';

COMMENT ON COLUMN public.knowledge_base.source_type IS
'Origin of the knowledge entry: manual (user created), document_upload (extracted from uploaded document), sam_discovery (from SAM conversation), api_import (imported via API)';

COMMENT ON FUNCTION get_kb_entries_by_source(UUID) IS
'Returns all knowledge base entries (from both tables) that were extracted from a specific document attachment.';

-- Migration 4: Company Website Intelligence
-- Enables automatic website analysis during signup
-- Add company-related fields to workspaces table for website intelligence
-- Allows workspaces to store company information extracted from website during signup

-- 1. Add columns to workspaces table
ALTER TABLE public.workspaces
ADD COLUMN IF NOT EXISTS company_url TEXT,
ADD COLUMN IF NOT EXISTS detected_industry TEXT,
ADD COLUMN IF NOT EXISTS company_description TEXT,
ADD COLUMN IF NOT EXISTS target_personas TEXT[],
ADD COLUMN IF NOT EXISTS pain_points TEXT[],
ADD COLUMN IF NOT EXISTS value_proposition TEXT,
ADD COLUMN IF NOT EXISTS key_competitors TEXT[],
ADD COLUMN IF NOT EXISTS pricing_model TEXT,
ADD COLUMN IF NOT EXISTS website_analysis_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS website_analyzed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS manual_overrides JSONB DEFAULT '{}'::jsonb;

-- 2. Add check constraint for website_analysis_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'workspaces_website_analysis_status_check'
    AND table_name = 'workspaces'
  ) THEN
    ALTER TABLE public.workspaces
    ADD CONSTRAINT workspaces_website_analysis_status_check
    CHECK (website_analysis_status IN ('pending', 'analyzing', 'completed', 'failed'));
  END IF;
END $$;

-- 3. Add index for efficient lookups by company_url and industry
CREATE INDEX IF NOT EXISTS idx_workspaces_company_url ON public.workspaces(company_url);
CREATE INDEX IF NOT EXISTS idx_workspaces_detected_industry ON public.workspaces(detected_industry);
CREATE INDEX IF NOT EXISTS idx_workspaces_analysis_status ON public.workspaces(website_analysis_status);

-- 4. Add comments for documentation
COMMENT ON COLUMN public.workspaces.company_url IS
'Website URL provided during signup, used for AI analysis of company information';

COMMENT ON COLUMN public.workspaces.detected_industry IS
'Industry detected from website analysis, maps to industry blueprints (cybersecurity, saas, fintech, etc.)';

COMMENT ON COLUMN public.workspaces.company_description IS
'AI-extracted description of what the company does (used in SAM context)';

COMMENT ON COLUMN public.workspaces.target_personas IS
'AI-detected target customer personas (e.g., ["CISO", "SOC Manager"])';

COMMENT ON COLUMN public.workspaces.pain_points IS
'Key pain points the company solves (extracted from website)';

COMMENT ON COLUMN public.workspaces.value_proposition IS
'Company value proposition (extracted from website hero/about sections)';

COMMENT ON COLUMN public.workspaces.key_competitors IS
'Competitors mentioned on website (from competitive analysis pages)';

COMMENT ON COLUMN public.workspaces.pricing_model IS
'Pricing model detected (per-seat, tiered, enterprise, freemium, etc.)';

COMMENT ON COLUMN public.workspaces.website_analysis_status IS
'Status of website analysis: pending (not started), analyzing (in progress), completed (success), failed (error)';

COMMENT ON COLUMN public.workspaces.website_analyzed_at IS
'Timestamp when website was last analyzed by AI';

COMMENT ON COLUMN public.workspaces.manual_overrides IS
'Tracks which fields were manually edited by user (JSON object with field names as keys)';
