-- Safe deployment script - skips already existing objects
-- Run this in Supabase SQL Editor (Production)

-- ================================================================
-- Migration 1: SAM Attachments (Safe)
-- ================================================================

CREATE TABLE IF NOT EXISTS sam_conversation_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES sam_conversation_threads(id) ON DELETE CASCADE,
    message_id UUID REFERENCES sam_conversation_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    storage_bucket TEXT NOT NULL DEFAULT 'sam-attachments',
    processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    extracted_text TEXT,
    extracted_metadata JSONB DEFAULT '{}',
    attachment_type TEXT CHECK (attachment_type IN ('linkedin_profile', 'icp_document', 'pitch_deck', 'case_study', 'other')),
    user_notes TEXT,
    analysis_results JSONB DEFAULT '{}',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_attachments_thread ON sam_conversation_attachments(thread_id);
CREATE INDEX IF NOT EXISTS idx_attachments_message ON sam_conversation_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_attachments_user ON sam_conversation_attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_attachments_workspace ON sam_conversation_attachments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_attachments_type ON sam_conversation_attachments(attachment_type);
CREATE INDEX IF NOT EXISTS idx_attachments_status ON sam_conversation_attachments(processing_status);

-- RLS
ALTER TABLE sam_conversation_attachments ENABLE ROW LEVEL SECURITY;

-- Policies (drop and recreate to avoid "already exists" errors)
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can view their workspace attachments" ON sam_conversation_attachments;
    CREATE POLICY "Users can view their workspace attachments"
        ON sam_conversation_attachments FOR SELECT
        USING (
            user_id = auth.uid()
            OR workspace_id IN (
                SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
            )
        );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can upload attachments to their threads" ON sam_conversation_attachments;
    CREATE POLICY "Users can upload attachments to their threads"
        ON sam_conversation_attachments FOR INSERT
        WITH CHECK (
            user_id = auth.uid()
            AND thread_id IN (SELECT id FROM sam_conversation_threads WHERE user_id = auth.uid())
        );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can update their attachments" ON sam_conversation_attachments;
    CREATE POLICY "Users can update their attachments"
        ON sam_conversation_attachments FOR UPDATE
        USING (user_id = auth.uid());
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can delete their attachments" ON sam_conversation_attachments;
    CREATE POLICY "Users can delete their attachments"
        ON sam_conversation_attachments FOR DELETE
        USING (user_id = auth.uid());
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Functions
CREATE OR REPLACE FUNCTION update_attachment_processing_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.processing_status = 'completed' AND OLD.processing_status != 'completed' THEN
        NEW.processed_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_attachment_processing ON sam_conversation_attachments;
CREATE TRIGGER trigger_update_attachment_processing
    BEFORE UPDATE ON sam_conversation_attachments
    FOR EACH ROW
    EXECUTE FUNCTION update_attachment_processing_status();

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON sam_conversation_attachments TO authenticated;

-- ================================================================
-- Migration 2: ICP Discovery Q&A (Safe)
-- ================================================================

ALTER TABLE public.sam_icp_discovery_sessions
  ADD COLUMN IF NOT EXISTS question_responses JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS industry_context JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS prospecting_criteria JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS linkedin_profile_data JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS content_strategy JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_sam_icp_discovery_sessions_workspace_id
    ON public.sam_icp_discovery_sessions(workspace_id);

CREATE TABLE IF NOT EXISTS public.sam_icp_knowledge_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    discovery_session_id UUID REFERENCES public.sam_icp_discovery_sessions(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL,
    question_text TEXT NOT NULL,
    answer_text TEXT NOT NULL,
    answer_structured JSONB DEFAULT '{}'::jsonb,
    stage TEXT NOT NULL,
    category TEXT NOT NULL,
    confidence_score DECIMAL(3,2) DEFAULT 1.0,
    is_shallow BOOLEAN DEFAULT false,
    needs_clarification BOOLEAN DEFAULT false,
    clarification_notes TEXT,
    embedding VECTOR(1536),
    indexed_for_rag BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(discovery_session_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_sam_icp_knowledge_workspace ON public.sam_icp_knowledge_entries(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sam_icp_knowledge_user ON public.sam_icp_knowledge_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_sam_icp_knowledge_session ON public.sam_icp_knowledge_entries(discovery_session_id);
CREATE INDEX IF NOT EXISTS idx_sam_icp_knowledge_stage ON public.sam_icp_knowledge_entries(stage);
CREATE INDEX IF NOT EXISTS idx_sam_icp_knowledge_category ON public.sam_icp_knowledge_entries(category);
CREATE INDEX IF NOT EXISTS idx_sam_icp_knowledge_embedding ON public.sam_icp_knowledge_entries USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE public.sam_icp_knowledge_entries ENABLE ROW LEVEL SECURITY;

-- Policies (safe recreate)
DO $$ BEGIN DROP POLICY IF EXISTS "Users can view their own ICP knowledge" ON public.sam_icp_knowledge_entries; EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "Users can view their own ICP knowledge" ON public.sam_icp_knowledge_entries FOR SELECT
USING (user_id = auth.uid() OR workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

DO $$ BEGIN DROP POLICY IF EXISTS "Users can insert their own ICP knowledge" ON public.sam_icp_knowledge_entries; EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "Users can insert their own ICP knowledge" ON public.sam_icp_knowledge_entries FOR INSERT WITH CHECK (user_id = auth.uid());

DO $$ BEGIN DROP POLICY IF EXISTS "Users can update their own ICP knowledge" ON public.sam_icp_knowledge_entries; EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "Users can update their own ICP knowledge" ON public.sam_icp_knowledge_entries FOR UPDATE USING (user_id = auth.uid());

DO $$ BEGIN DROP POLICY IF EXISTS "Users can delete their own ICP knowledge" ON public.sam_icp_knowledge_entries; EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE POLICY "Users can delete their own ICP knowledge" ON public.sam_icp_knowledge_entries FOR DELETE USING (user_id = auth.uid());

-- ================================================================
-- Migration 3: Source Tracking (Safe)
-- ================================================================

ALTER TABLE public.sam_icp_knowledge_entries
ADD COLUMN IF NOT EXISTS source_attachment_id UUID REFERENCES public.sam_conversation_attachments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sam_icp_knowledge_source ON public.sam_icp_knowledge_entries(source_attachment_id);

-- ================================================================
-- Migration 4: Website Intelligence (Safe)
-- ================================================================

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

CREATE INDEX IF NOT EXISTS idx_workspaces_company_url ON public.workspaces(company_url);
CREATE INDEX IF NOT EXISTS idx_workspaces_detected_industry ON public.workspaces(detected_industry);
CREATE INDEX IF NOT EXISTS idx_workspaces_analysis_status ON public.workspaces(website_analysis_status);

-- ================================================================
-- DEPLOYMENT COMPLETE
-- ================================================================
SELECT 'All migrations deployed successfully!' AS status;
