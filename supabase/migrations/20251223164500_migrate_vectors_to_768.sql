-- Migrate Knowledge Base Vectors from 1536 to 768 dimensions
-- This aligns with Gemini's native text-embedding-004 output and improves performance.
-- 1. Update knowledge_base_vectors table
-- We need to temporarily remove the index as its type depends on the dimension
DROP INDEX IF EXISTS idx_kb_vectors_embedding;
-- Alter the column type with explicit truncation
-- We cast to real[] (float4 array), slice the first 768 elements, and cast back to vector(768)
ALTER TABLE public.knowledge_base_vectors
ALTER COLUMN embedding TYPE VECTOR(768) USING (embedding::real []) [1:768]::vector(768);
-- Re-create the index for 768 dimensions
CREATE INDEX idx_kb_vectors_embedding ON public.knowledge_base_vectors USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
-- 2. Update sam_icp_knowledge_entries table
DROP INDEX IF EXISTS idx_sam_icp_knowledge_embedding;
ALTER TABLE public.sam_icp_knowledge_entries
ALTER COLUMN embedding TYPE VECTOR(768) USING (embedding::real []) [1:768]::vector(768);
CREATE INDEX idx_sam_icp_knowledge_embedding ON public.sam_icp_knowledge_entries USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
-- 3. Update match_workspace_knowledge function
-- Drop first to avoid signature mismatch (vector(1536) vs vector(768))
DROP FUNCTION IF EXISTS public.match_workspace_knowledge(UUID, VECTOR, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.match_workspace_knowledge(UUID, VECTOR(1536), TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.match_workspace_knowledge(UUID, VECTOR(768), TEXT, INTEGER);
CREATE OR REPLACE FUNCTION public.match_workspace_knowledge(
        p_workspace_id UUID,
        p_query_embedding VECTOR(768),
        p_section TEXT DEFAULT NULL,
        p_limit INTEGER DEFAULT 5
    ) RETURNS TABLE (
        document_id UUID,
        section_id TEXT,
        content TEXT,
        tags TEXT [],
        metadata JSONB,
        similarity DOUBLE PRECISION
    ) AS $$ BEGIN RETURN QUERY
SELECT kbv.document_id,
    kbv.section_id,
    kbv.content,
    kbv.tags,
    kbv.metadata,
    1 - (kbv.embedding <=> p_query_embedding) AS similarity
FROM public.knowledge_base_vectors kbv
WHERE kbv.workspace_id = p_workspace_id
    AND (
        p_section IS NULL
        OR kbv.section_id = p_section
    )
ORDER BY kbv.embedding <->p_query_embedding
LIMIT COALESCE(p_limit, 5);
END;
$$ LANGUAGE plpgsql STABLE;
-- 4. Update search_icp_knowledge function
DROP FUNCTION IF EXISTS public.search_icp_knowledge(UUID, VECTOR, TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.search_icp_knowledge(UUID, VECTOR(1536), TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.search_icp_knowledge(UUID, VECTOR(768), TEXT, TEXT, INTEGER);
CREATE OR REPLACE FUNCTION public.search_icp_knowledge(
        p_workspace_id UUID,
        p_query_embedding VECTOR(768),
        p_stage TEXT DEFAULT NULL,
        p_category TEXT DEFAULT NULL,
        p_limit INTEGER DEFAULT 5
    ) RETURNS TABLE (
        question_id TEXT,
        question_text TEXT,
        answer_text TEXT,
        answer_structured JSONB,
        stage TEXT,
        category TEXT,
        confidence_score DECIMAL,
        similarity DOUBLE PRECISION
    ) AS $$ BEGIN RETURN QUERY
SELECT e.question_id,
    e.question_text,
    e.answer_text,
    e.answer_structured,
    e.stage,
    e.category,
    e.confidence_score,
    1 - (e.embedding <=> p_query_embedding) AS similarity
FROM public.sam_icp_knowledge_entries e
WHERE e.workspace_id = p_workspace_id
    AND (
        p_stage IS NULL
        OR e.stage = p_stage
    )
    AND (
        p_category IS NULL
        OR e.category = p_category
    )
    AND e.indexed_for_rag = true
ORDER BY e.embedding <->p_query_embedding
LIMIT COALESCE(p_limit, 5);
END;
$$ LANGUAGE plpgsql STABLE;
-- 5. Create or Update match_reply_conversations function
DROP FUNCTION IF EXISTS public.match_reply_conversations(VECTOR, UUID, FLOAT, INTEGER, TEXT []);
DROP FUNCTION IF EXISTS public.match_reply_conversations(VECTOR(1536), UUID, FLOAT, INTEGER, TEXT []);
DROP FUNCTION IF EXISTS public.match_reply_conversations(VECTOR(768), UUID, FLOAT, INTEGER, TEXT []);
-- Also handle the variation with double precision if needed
DROP FUNCTION IF EXISTS public.match_reply_conversations(VECTOR, UUID, DOUBLE PRECISION, INTEGER, TEXT []);
CREATE OR REPLACE FUNCTION public.match_reply_conversations(
        query_embedding VECTOR(768),
        match_workspace_id UUID,
        match_threshold FLOAT,
        match_count INTEGER,
        filter_tags TEXT [] DEFAULT NULL
    ) RETURNS TABLE (
        id UUID,
        content TEXT,
        metadata JSONB,
        similarity DOUBLE PRECISION
    ) AS $$ BEGIN RETURN QUERY
SELECT kbv.document_id as id,
    kbv.content,
    kbv.metadata,
    1 - (kbv.embedding <=> query_embedding) AS similarity
FROM public.knowledge_base_vectors kbv
WHERE kbv.workspace_id = match_workspace_id
    AND (
        filter_tags IS NULL
        OR kbv.tags @> filter_tags
    )
    AND (1 - (kbv.embedding <=> query_embedding)) >= match_threshold
ORDER BY kbv.embedding <->query_embedding
LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;