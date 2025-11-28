-- Add ICP scoping to knowledge base tables
-- Migration: 20251128_add_icp_scoping_to_kb.sql
--
-- This allows content to be:
-- - Global (icp_id = NULL) - applies to all ICPs
-- - ICP-specific (icp_id = UUID) - only shows for that ICP

-- 1. Add icp_id column to knowledge_base table
ALTER TABLE knowledge_base
ADD COLUMN IF NOT EXISTS icp_id UUID REFERENCES knowledge_base_icps(id) ON DELETE SET NULL;

-- 2. Add icp_id column to knowledge_base_documents table
ALTER TABLE knowledge_base_documents
ADD COLUMN IF NOT EXISTS icp_id UUID REFERENCES knowledge_base_icps(id) ON DELETE SET NULL;

-- 3. Add icp_id column to knowledge_base_vectors table (for RAG filtering)
ALTER TABLE knowledge_base_vectors
ADD COLUMN IF NOT EXISTS icp_id UUID REFERENCES knowledge_base_icps(id) ON DELETE SET NULL;

-- 4. Create indexes for ICP filtering
CREATE INDEX IF NOT EXISTS idx_kb_icp_id ON knowledge_base(icp_id);
CREATE INDEX IF NOT EXISTS idx_kb_docs_icp_id ON knowledge_base_documents(icp_id);
CREATE INDEX IF NOT EXISTS idx_kb_vectors_icp_id ON knowledge_base_vectors(icp_id);

-- 5. Create composite indexes for efficient workspace + ICP queries
CREATE INDEX IF NOT EXISTS idx_kb_workspace_icp ON knowledge_base(workspace_id, icp_id);
CREATE INDEX IF NOT EXISTS idx_kb_docs_workspace_icp ON knowledge_base_documents(workspace_id, icp_id);
CREATE INDEX IF NOT EXISTS idx_kb_vectors_workspace_icp ON knowledge_base_vectors(workspace_id, icp_id);

-- 6. Update match_workspace_knowledge function to support ICP filtering
CREATE OR REPLACE FUNCTION match_workspace_knowledge(
    p_workspace_id UUID,
    p_query_embedding VECTOR(1536),
    p_section TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 5,
    p_icp_id UUID DEFAULT NULL
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
    FROM knowledge_base_vectors kbv
    WHERE kbv.workspace_id = p_workspace_id
      AND (p_section IS NULL OR kbv.section_id = p_section)
      AND (p_icp_id IS NULL OR kbv.icp_id IS NULL OR kbv.icp_id = p_icp_id)
    ORDER BY kbv.embedding <-> p_query_embedding
    LIMIT COALESCE(p_limit, 5);
END;
$$ LANGUAGE plpgsql STABLE;

-- 7. Comments for documentation
COMMENT ON COLUMN knowledge_base.icp_id IS 'NULL = global content for all ICPs, UUID = content specific to that ICP';
COMMENT ON COLUMN knowledge_base_documents.icp_id IS 'NULL = global document for all ICPs, UUID = document specific to that ICP';
COMMENT ON COLUMN knowledge_base_vectors.icp_id IS 'NULL = global vector for all ICPs, UUID = vector specific to that ICP';
