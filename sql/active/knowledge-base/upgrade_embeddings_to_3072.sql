-- Upgrade vector embeddings to use text-embedding-3-large for better RAG quality
-- NOTE: Dimensions limited to 1536 due to pgvector 2000-dimension hard limit
-- text-embedding-3-large @ 1536-dim still provides better quality than text-embedding-3-small

-- Update existing embedding column comment
COMMENT ON COLUMN public.knowledge_base_vectors.embedding IS 'Embeddings using text-embedding-3-large @ 1536 dimensions for quality-first RAG';

-- No schema changes needed - continuing to use existing embedding column with upgraded model
