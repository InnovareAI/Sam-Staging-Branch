-- ============================================================================
-- Knowledge Base Usage Analytics System
-- Purpose: Track document usage by SAM for analytics and insights
-- Created: 2025-10-15
-- ============================================================================

-- Add usage tracking columns to knowledge_base_documents
ALTER TABLE public.knowledge_base_documents
  ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_used_in_thread_id UUID,
  ADD COLUMN IF NOT EXISTS first_used_at TIMESTAMPTZ;

-- Create usage tracking table for detailed analytics
CREATE TABLE IF NOT EXISTS public.knowledge_base_document_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.knowledge_base_documents(id) ON DELETE CASCADE,

    -- Context about the usage
    thread_id UUID, -- SAM conversation thread
    message_id UUID, -- Specific message in thread
    user_id UUID REFERENCES auth.users(id),

    -- What was retrieved
    chunks_used INTEGER DEFAULT 0,
    relevance_score NUMERIC, -- How relevant was this document to the query
    query_context TEXT, -- The user's question/prompt

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    used_at TIMESTAMPTZ DEFAULT NOW(),

    -- Indexes for common queries
    CONSTRAINT fk_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE,
    CONSTRAINT fk_document FOREIGN KEY (document_id) REFERENCES public.knowledge_base_documents(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_kb_usage_workspace ON public.knowledge_base_document_usage(workspace_id);
CREATE INDEX IF NOT EXISTS idx_kb_usage_document ON public.knowledge_base_document_usage(document_id);
CREATE INDEX IF NOT EXISTS idx_kb_usage_thread ON public.knowledge_base_document_usage(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kb_usage_used_at ON public.knowledge_base_document_usage(used_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_usage_workspace_date ON public.knowledge_base_document_usage(workspace_id, used_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_docs_last_used ON public.knowledge_base_documents(workspace_id, last_used_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_kb_docs_usage_count ON public.knowledge_base_documents(workspace_id, usage_count DESC);

-- Enable RLS
ALTER TABLE public.knowledge_base_document_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_document_usage FORCE ROW LEVEL SECURITY;

-- RLS Policies for usage tracking
CREATE POLICY kb_usage_select_scoped ON public.knowledge_base_document_usage
FOR SELECT USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_usage_insert_scoped ON public.knowledge_base_document_usage
FOR INSERT WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

-- Function to record document usage (call from SAM)
CREATE OR REPLACE FUNCTION public.record_document_usage(
    p_workspace_id UUID,
    p_document_id UUID,
    p_thread_id UUID DEFAULT NULL,
    p_message_id UUID DEFAULT NULL,
    p_chunks_used INTEGER DEFAULT 1,
    p_relevance_score NUMERIC DEFAULT NULL,
    p_query_context TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    -- Insert usage record
    INSERT INTO public.knowledge_base_document_usage (
        workspace_id,
        document_id,
        thread_id,
        message_id,
        user_id,
        chunks_used,
        relevance_score,
        query_context
    ) VALUES (
        p_workspace_id,
        p_document_id,
        p_thread_id,
        p_message_id,
        auth.uid(),
        p_chunks_used,
        p_relevance_score,
        p_query_context
    );

    -- Update document usage stats
    UPDATE public.knowledge_base_documents
    SET
        usage_count = COALESCE(usage_count, 0) + 1,
        last_used_at = NOW(),
        last_used_in_thread_id = p_thread_id,
        first_used_at = COALESCE(first_used_at, NOW())
    WHERE id = p_document_id AND workspace_id = p_workspace_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get document usage analytics for a workspace
CREATE OR REPLACE FUNCTION public.get_document_usage_analytics(
    p_workspace_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    document_id UUID,
    document_title TEXT,
    section TEXT,
    total_uses INTEGER,
    unique_threads INTEGER,
    avg_relevance NUMERIC,
    last_used_at TIMESTAMPTZ,
    days_since_last_use INTEGER,
    usage_trend TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id AS document_id,
        d.filename AS document_title,
        d.section_id AS section,
        COUNT(u.id)::INTEGER AS total_uses,
        COUNT(DISTINCT u.thread_id)::INTEGER AS unique_threads,
        AVG(u.relevance_score) AS avg_relevance,
        MAX(u.used_at) AS last_used_at,
        EXTRACT(DAY FROM NOW() - MAX(u.used_at))::INTEGER AS days_since_last_use,
        CASE
            WHEN COUNT(u.id) FILTER (WHERE u.used_at >= NOW() - INTERVAL '7 days') >
                 COUNT(u.id) FILTER (WHERE u.used_at >= NOW() - INTERVAL '14 days' AND u.used_at < NOW() - INTERVAL '7 days')
            THEN 'increasing'
            WHEN COUNT(u.id) FILTER (WHERE u.used_at >= NOW() - INTERVAL '7 days') <
                 COUNT(u.id) FILTER (WHERE u.used_at >= NOW() - INTERVAL '14 days' AND u.used_at < NOW() - INTERVAL '7 days')
            THEN 'decreasing'
            ELSE 'stable'
        END AS usage_trend
    FROM public.knowledge_base_documents d
    LEFT JOIN public.knowledge_base_document_usage u
        ON d.id = u.document_id
        AND u.used_at >= NOW() - (p_days || ' days')::INTERVAL
    WHERE d.workspace_id = p_workspace_id
        AND d.is_active = true
    GROUP BY d.id, d.filename, d.section_id
    ORDER BY total_uses DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to get section usage summary
CREATE OR REPLACE FUNCTION public.get_section_usage_summary(
    p_workspace_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    section TEXT,
    total_documents INTEGER,
    documents_used INTEGER,
    total_uses INTEGER,
    avg_uses_per_doc NUMERIC,
    usage_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(d.section_id, 'unspecified') AS section,
        COUNT(DISTINCT d.id)::INTEGER AS total_documents,
        COUNT(DISTINCT CASE WHEN u.id IS NOT NULL THEN d.id END)::INTEGER AS documents_used,
        COUNT(u.id)::INTEGER AS total_uses,
        ROUND(COUNT(u.id)::NUMERIC / NULLIF(COUNT(DISTINCT d.id), 0), 2) AS avg_uses_per_doc,
        ROUND(
            COUNT(DISTINCT CASE WHEN u.id IS NOT NULL THEN d.id END)::NUMERIC * 100.0 /
            NULLIF(COUNT(DISTINCT d.id), 0),
            1
        ) AS usage_rate
    FROM public.knowledge_base_documents d
    LEFT JOIN public.knowledge_base_document_usage u
        ON d.id = u.document_id
        AND u.used_at >= NOW() - (p_days || ' days')::INTERVAL
    WHERE d.workspace_id = p_workspace_id
        AND d.is_active = true
    GROUP BY d.section_id
    ORDER BY total_uses DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Add comment for documentation
COMMENT ON TABLE public.knowledge_base_document_usage IS 'Tracks every time SAM uses a document in a conversation';
COMMENT ON FUNCTION public.record_document_usage IS 'Call this function whenever SAM retrieves and uses a document';
COMMENT ON FUNCTION public.get_document_usage_analytics IS 'Returns usage analytics for all documents in a workspace';
COMMENT ON FUNCTION public.get_section_usage_summary IS 'Returns aggregated usage stats by KB section';
