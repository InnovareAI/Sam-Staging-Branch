-- Fix knowledge_base_vectors foreign key to point to knowledge_base instead of knowledge_base_documents
-- This allows vectors to be created for documents in the knowledge_base table

-- Drop the old foreign key constraint if it exists
ALTER TABLE public.knowledge_base_vectors
DROP CONSTRAINT IF EXISTS knowledge_base_vectors_document_id_fkey;

-- Make document_id nullable (since not all vectors need to reference a document)
ALTER TABLE public.knowledge_base_vectors
ALTER COLUMN document_id DROP NOT NULL;

-- Add new foreign key constraint pointing to knowledge_base table
-- Use ON DELETE CASCADE to clean up vectors when document is deleted
ALTER TABLE public.knowledge_base_vectors
ADD CONSTRAINT knowledge_base_vectors_document_id_fkey
FOREIGN KEY (document_id)
REFERENCES public.knowledge_base(id)
ON DELETE CASCADE;

-- Add comment explaining the relationship
COMMENT ON COLUMN public.knowledge_base_vectors.document_id IS 
'References knowledge_base.id - the source document for this vector chunk. Nullable to support vectors not tied to specific documents.';
