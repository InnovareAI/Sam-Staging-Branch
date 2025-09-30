-- Enable required extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Bring knowledge_base_documents schema in sync with application code
ALTER TABLE public.knowledge_base_documents
  ALTER COLUMN storage_path DROP NOT NULL,
  ALTER COLUMN file_type DROP NOT NULL;

ALTER TABLE public.knowledge_base_documents
  ADD COLUMN IF NOT EXISTS section TEXT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS upload_mode TEXT,
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS content_type TEXT,
  ADD COLUMN IF NOT EXISTS key_insights JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS relevance_score NUMERIC,
  ADD COLUMN IF NOT EXISTS suggested_section TEXT,
  ADD COLUMN IF NOT EXISTS ai_metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'uploaded',
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vector_chunks INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vectorized_at TIMESTAMPTZ;

-- Primary vector store for RAG
CREATE TABLE IF NOT EXISTS public.knowledge_base_vectors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    document_id UUID REFERENCES public.knowledge_base_documents(id) ON DELETE CASCADE,
    section_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(1536) NOT NULL,
    metadata JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_vectors_workspace_section
    ON public.knowledge_base_vectors(workspace_id, section_id);

CREATE INDEX IF NOT EXISTS idx_kb_vectors_document_chunk
    ON public.knowledge_base_vectors(document_id, chunk_index);

CREATE INDEX IF NOT EXISTS idx_kb_vectors_tags
    ON public.knowledge_base_vectors USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_kb_vectors_embedding
    ON public.knowledge_base_vectors USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

ALTER TABLE public.knowledge_base_vectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can read KB vectors"
    ON public.knowledge_base_vectors
    FOR SELECT
    TO authenticated
    USING (
        workspace_id IN (
            SELECT workspace_id FROM public.user_workspaces
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Workspace members can insert KB vectors"
    ON public.knowledge_base_vectors
    FOR INSERT
    TO authenticated
    WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM public.user_workspaces
            WHERE user_id = auth.uid()
        )
    );

CREATE TRIGGER update_kb_vectors_updated_at
    BEFORE UPDATE ON public.knowledge_base_vectors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Lightweight summary table for fast access inside conversations
CREATE TABLE IF NOT EXISTS public.sam_knowledge_summaries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    document_id UUID REFERENCES public.knowledge_base_documents(id) ON DELETE CASCADE,
    section_id TEXT,
    total_chunks INTEGER,
    total_tokens INTEGER,
    tags TEXT[] DEFAULT '{}',
    quick_summary TEXT,
    metadata JSONB DEFAULT '{}',
    sam_ready BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sam_knowledge_summaries_workspace
    ON public.sam_knowledge_summaries(workspace_id, section_id);

CREATE INDEX IF NOT EXISTS idx_sam_knowledge_summaries_tags
    ON public.sam_knowledge_summaries USING GIN(tags);

ALTER TABLE public.sam_knowledge_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can access SAM knowledge summaries"
    ON public.sam_knowledge_summaries
    FOR ALL
    TO authenticated
    USING (
        workspace_id IN (
            SELECT workspace_id FROM public.user_workspaces
            WHERE user_id = auth.uid()
        )
    );

CREATE TRIGGER update_sam_knowledge_summaries_updated_at
    BEFORE UPDATE ON public.sam_knowledge_summaries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Track per-document AI analysis for auditing
CREATE TABLE IF NOT EXISTS public.document_ai_analysis (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    document_id UUID REFERENCES public.knowledge_base_documents(id) ON DELETE CASCADE,
    analysis_type TEXT NOT NULL,
    model_used TEXT,
    tags TEXT[] DEFAULT '{}',
    categories TEXT[] DEFAULT '{}',
    key_insights JSONB DEFAULT '[]'::jsonb,
    summary TEXT,
    relevance_score NUMERIC,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_ai_analysis_workspace
    ON public.document_ai_analysis(workspace_id, document_id);

ALTER TABLE public.document_ai_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can access document AI analysis"
    ON public.document_ai_analysis
    FOR ALL
    TO authenticated
    USING (
        workspace_id IN (
            SELECT workspace_id FROM public.user_workspaces
            WHERE user_id = auth.uid()
        )
    );

-- Similarity search helper for RAG queries
CREATE OR REPLACE FUNCTION public.match_workspace_knowledge(
    p_workspace_id UUID,
    p_query_embedding VECTOR(1536),
    p_section TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    document_id UUID,
    section_id TEXT,
    content TEXT,
    tags TEXT[],
    metadata JSONB,
    similarity DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        kbv.document_id,
        kbv.section_id,
        kbv.content,
        kbv.tags,
        kbv.metadata,
        1 - (kbv.embedding <=> p_query_embedding) AS similarity
    FROM public.knowledge_base_vectors kbv
    WHERE kbv.workspace_id = p_workspace_id
      AND (p_section IS NULL OR kbv.section_id = p_section)
    ORDER BY kbv.embedding <-> p_query_embedding
    LIMIT COALESCE(p_limit, 5);
END;
$$ LANGUAGE plpgsql STABLE;
