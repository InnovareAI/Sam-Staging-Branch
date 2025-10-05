-- Upgrade vector embeddings from 1536 to 3072 dimensions for better RAG quality
-- Using OpenAI text-embedding-3-large for improved retrieval accuracy

-- Step 1: Add new column with 3072 dimensions
ALTER TABLE public.knowledge_base_vectors
ADD COLUMN IF NOT EXISTS embedding_3072 VECTOR(3072);

-- Step 2: Create index on new embedding column
CREATE INDEX IF NOT EXISTS idx_kb_vectors_embedding_3072
    ON public.knowledge_base_vectors USING ivfflat (embedding_3072 vector_cosine_ops)
    WITH (lists = 100);

-- Step 3: Update the similarity search function to use 3072 dimensions
CREATE OR REPLACE FUNCTION public.match_workspace_knowledge_3072(
    p_workspace_id UUID,
    p_query_embedding VECTOR(3072),
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
        1 - (kbv.embedding_3072 <=> p_query_embedding) AS similarity
    FROM public.knowledge_base_vectors kbv
    WHERE kbv.workspace_id = p_workspace_id
      AND kbv.embedding_3072 IS NOT NULL
      AND (p_section IS NULL OR kbv.section_id = p_section)
    ORDER BY kbv.embedding_3072 <-> p_query_embedding
    LIMIT COALESCE(p_limit, 5);
END;
$$ LANGUAGE plpgsql STABLE;

-- Note: The old embedding column (1536) is kept for backward compatibility
-- New embeddings will populate embedding_3072
-- Old embeddings can be migrated gradually or kept as fallback

COMMENT ON COLUMN public.knowledge_base_vectors.embedding IS 'Legacy 1536-dim embeddings (text-embedding-3-small)';
COMMENT ON COLUMN public.knowledge_base_vectors.embedding_3072 IS 'New 3072-dim embeddings (text-embedding-3-large) for better quality';
COMMENT ON FUNCTION public.match_workspace_knowledge_3072 IS 'RAG similarity search using 3072-dimension embeddings for improved accuracy';
