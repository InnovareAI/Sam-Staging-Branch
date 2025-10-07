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
