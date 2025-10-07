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
