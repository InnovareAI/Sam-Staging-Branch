-- Bulk Prospect Upload with Automatic Deduplication
-- This migration adds functionality for bulk prospect uploads with automatic deduplication
-- Teams can upload CSV files without manual duplicate checking

-- Function to bulk upload prospects with automatic deduplication
CREATE OR REPLACE FUNCTION bulk_upload_prospects(
    p_workspace_id UUID,
    p_prospects JSONB,
    p_data_source TEXT DEFAULT 'bulk_upload'
)
RETURNS TABLE (
    prospect_id UUID,
    action_taken TEXT, -- 'created', 'updated', or 'skipped'
    prospect_hash TEXT,
    duplicate_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_prospect JSONB;
    v_prospect_id UUID;
    v_existing_prospect_id UUID;
    v_prospect_hash TEXT;
    v_action TEXT;
    v_duplicate_reason TEXT;
    v_contact_count INTEGER;
    v_last_contacted_at TIMESTAMPTZ;
BEGIN
    -- Loop through each prospect in the bulk upload
    FOR v_prospect IN SELECT * FROM jsonb_array_elements(p_prospects)
    LOOP
        -- Generate hash for deduplication
        v_prospect_hash := generate_prospect_hash(
            v_prospect->>'email_address',
            v_prospect->>'linkedin_profile_url',
            v_prospect->>'phone_number',
            v_prospect->>'company_domain'
        );
        
        -- Check if prospect already exists
        SELECT id, contact_count, last_contacted_at 
        INTO v_existing_prospect_id, v_contact_count, v_last_contacted_at
        FROM workspace_prospects 
        WHERE workspace_id = p_workspace_id 
          AND prospect_hash = v_prospect_hash;
        
        IF v_existing_prospect_id IS NOT NULL THEN
            -- Prospect exists - determine if we should update or skip
            IF v_contact_count > 0 THEN
                -- Already contacted - skip to prevent disrupting active campaigns
                v_prospect_id := v_existing_prospect_id;
                v_action := 'skipped';
                v_duplicate_reason := 'Already contacted (contact_count: ' || v_contact_count || ')';
            ELSE
                -- Exists but never contacted - update with any new information
                UPDATE workspace_prospects 
                SET 
                    full_name = COALESCE(v_prospect->>'full_name', full_name),
                    first_name = COALESCE(v_prospect->>'first_name', first_name),
                    last_name = COALESCE(v_prospect->>'last_name', last_name),
                    job_title = COALESCE(v_prospect->>'job_title', job_title),
                    company_name = COALESCE(v_prospect->>'company_name', company_name),
                    location = COALESCE(v_prospect->>'location', location),
                    data_sources = array_append(data_sources, p_data_source),
                    updated_at = NOW()
                WHERE id = v_existing_prospect_id;
                
                v_prospect_id := v_existing_prospect_id;
                v_action := 'updated';
                v_duplicate_reason := 'Prospect enriched with new data';
            END IF;
        ELSE
            -- New prospect - create it
            INSERT INTO workspace_prospects (
                workspace_id, 
                email_address, 
                linkedin_profile_url, 
                phone_number, 
                company_domain, 
                full_name, 
                first_name, 
                last_name, 
                job_title, 
                company_name, 
                location, 
                prospect_hash, 
                data_sources,
                prospect_status
            ) VALUES (
                p_workspace_id,
                v_prospect->>'email_address',
                v_prospect->>'linkedin_profile_url',
                v_prospect->>'phone_number',
                v_prospect->>'company_domain',
                v_prospect->>'full_name',
                v_prospect->>'first_name',
                v_prospect->>'last_name',
                v_prospect->>'job_title',
                v_prospect->>'company_name',
                v_prospect->>'location',
                v_prospect_hash,
                ARRAY[p_data_source],
                'new' -- Default status for new prospects
            ) RETURNING id INTO v_prospect_id;
            
            v_action := 'created';
            v_duplicate_reason := NULL;
        END IF;
        
        -- Return the result for this prospect
        RETURN QUERY SELECT 
            v_prospect_id, 
            v_action, 
            v_prospect_hash, 
            v_duplicate_reason;
    END LOOP;
    
    RETURN;
END;
$$;

-- Function to validate bulk prospect data before upload
CREATE OR REPLACE FUNCTION validate_bulk_prospects(
    p_prospects JSONB
)
RETURNS TABLE (
    row_number INTEGER,
    validation_status TEXT, -- 'valid', 'invalid', 'warning'
    validation_messages TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_prospect JSONB;
    v_row_number INTEGER := 0;
    v_status TEXT;
    v_messages TEXT[] := '{}';
    v_has_identifier BOOLEAN;
BEGIN
    -- Loop through each prospect to validate
    FOR v_prospect IN SELECT * FROM jsonb_array_elements(p_prospects)
    LOOP
        v_row_number := v_row_number + 1;
        v_messages := '{}';
        v_status := 'valid';
        
        -- Check if at least one identifier is provided
        v_has_identifier := (
            v_prospect->>'email_address' IS NOT NULL OR
            v_prospect->>'linkedin_profile_url' IS NOT NULL OR
            v_prospect->>'phone_number' IS NOT NULL
        );
        
        IF NOT v_has_identifier THEN
            v_status := 'invalid';
            v_messages := array_append(v_messages, 'At least one identifier (email, LinkedIn, or phone) is required');
        END IF;
        
        -- Validate email format if provided
        IF v_prospect->>'email_address' IS NOT NULL THEN
            IF NOT (v_prospect->>'email_address' ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') THEN
                v_status := 'invalid';
                v_messages := array_append(v_messages, 'Invalid email format');
            END IF;
        END IF;
        
        -- Validate LinkedIn URL format if provided
        IF v_prospect->>'linkedin_profile_url' IS NOT NULL THEN
            IF NOT (v_prospect->>'linkedin_profile_url' ~* '^https?://.*linkedin\.com/') THEN
                v_status := 'warning';
                v_messages := array_append(v_messages, 'LinkedIn URL should start with linkedin.com');
            END IF;
        END IF;
        
        -- Check for required fields
        IF v_prospect->>'full_name' IS NULL AND 
           v_prospect->>'first_name' IS NULL AND 
           v_prospect->>'last_name' IS NULL THEN
            v_status := 'warning';
            v_messages := array_append(v_messages, 'No name provided - consider adding full_name or first/last name');
        END IF;
        
        IF v_prospect->>'company_name' IS NULL THEN
            v_status := 'warning';
            v_messages := array_append(v_messages, 'Company name not provided');
        END IF;
        
        -- Return validation result for this row
        RETURN QUERY SELECT 
            v_row_number,
            v_status,
            v_messages;
    END LOOP;
    
    RETURN;
END;
$$;

-- Function to get bulk upload statistics
CREATE OR REPLACE FUNCTION get_bulk_upload_stats(
    p_workspace_id UUID,
    p_upload_session_id TEXT DEFAULT NULL
)
RETURNS TABLE (
    total_prospects BIGINT,
    new_prospects BIGINT,
    updated_prospects BIGINT,
    duplicate_prospects BIGINT,
    contacted_prospects BIGINT,
    never_contacted BIGINT,
    upload_session_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- If no session ID provided, return overall workspace stats
    IF p_upload_session_id IS NULL THEN
        RETURN QUERY
        SELECT 
            COUNT(*) as total_prospects,
            COUNT(*) FILTER (WHERE prospect_status = 'new') as new_prospects,
            COUNT(*) FILTER (WHERE prospect_status = 'enriched') as updated_prospects,
            COUNT(*) FILTER (WHERE contact_count > 0) as contacted_prospects,
            COUNT(*) FILTER (WHERE contact_count > 0) as duplicate_prospects, -- Contacted = effectively duplicate for new uploads
            COUNT(*) FILTER (WHERE contact_count = 0) as never_contacted,
            'overall'::TEXT as upload_session_id
        FROM workspace_prospects
        WHERE workspace_id = p_workspace_id;
    ELSE
        -- Return stats for specific upload session (would need session tracking table)
        RETURN QUERY
        SELECT 
            0::BIGINT, 0::BIGINT, 0::BIGINT, 0::BIGINT, 0::BIGINT, 0::BIGINT, p_upload_session_id;
    END IF;
END;
$$;

-- Create bulk upload session tracking table
CREATE TABLE IF NOT EXISTS bulk_upload_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    
    -- Upload details
    filename TEXT NOT NULL,
    total_rows INTEGER NOT NULL,
    processed_rows INTEGER DEFAULT 0,
    successful_rows INTEGER DEFAULT 0,
    failed_rows INTEGER DEFAULT 0,
    skipped_rows INTEGER DEFAULT 0,
    
    -- Upload status
    upload_status TEXT DEFAULT 'processing' CHECK (upload_status IN ('processing', 'completed', 'failed', 'cancelled')),
    
    -- Results summary
    new_prospects INTEGER DEFAULT 0,
    updated_prospects INTEGER DEFAULT 0,
    duplicate_prospects INTEGER DEFAULT 0,
    validation_errors JSONB DEFAULT '[]',
    
    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    processing_time_seconds INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for bulk upload sessions
CREATE INDEX IF NOT EXISTS idx_bulk_upload_sessions_workspace ON bulk_upload_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_bulk_upload_sessions_user ON bulk_upload_sessions(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_bulk_upload_sessions_status ON bulk_upload_sessions(upload_status);
CREATE INDEX IF NOT EXISTS idx_bulk_upload_sessions_started ON bulk_upload_sessions(started_at);

-- Enable RLS for bulk upload sessions
ALTER TABLE bulk_upload_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policy for bulk upload sessions
CREATE POLICY "Users can access workspace bulk upload sessions" ON bulk_upload_sessions
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = 
            (SELECT id FROM users WHERE clerk_id = auth.uid()::text)
        )
    );

-- Function to create bulk upload session
CREATE OR REPLACE FUNCTION create_bulk_upload_session(
    p_workspace_id UUID,
    p_filename TEXT,
    p_total_rows INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session_id UUID;
    v_user_id UUID;
BEGIN
    -- Get user ID from current auth
    SELECT id INTO v_user_id FROM users WHERE clerk_id = auth.uid()::text;
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;
    
    INSERT INTO bulk_upload_sessions (
        workspace_id,
        uploaded_by,
        filename,
        total_rows
    ) VALUES (
        p_workspace_id,
        v_user_id,
        p_filename,
        p_total_rows
    ) RETURNING id INTO v_session_id;
    
    RETURN v_session_id;
END;
$$;

-- Function to update bulk upload session progress
CREATE OR REPLACE FUNCTION update_bulk_upload_session(
    p_session_id UUID,
    p_processed_rows INTEGER DEFAULT NULL,
    p_successful_rows INTEGER DEFAULT NULL,
    p_failed_rows INTEGER DEFAULT NULL,
    p_skipped_rows INTEGER DEFAULT NULL,
    p_new_prospects INTEGER DEFAULT NULL,
    p_updated_prospects INTEGER DEFAULT NULL,
    p_duplicate_prospects INTEGER DEFAULT NULL,
    p_upload_status TEXT DEFAULT NULL,
    p_validation_errors JSONB DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE bulk_upload_sessions
    SET 
        processed_rows = COALESCE(p_processed_rows, processed_rows),
        successful_rows = COALESCE(p_successful_rows, successful_rows),
        failed_rows = COALESCE(p_failed_rows, failed_rows),
        skipped_rows = COALESCE(p_skipped_rows, skipped_rows),
        new_prospects = COALESCE(p_new_prospects, new_prospects),
        updated_prospects = COALESCE(p_updated_prospects, updated_prospects),
        duplicate_prospects = COALESCE(p_duplicate_prospects, duplicate_prospects),
        upload_status = COALESCE(p_upload_status, upload_status),
        validation_errors = COALESCE(p_validation_errors, validation_errors),
        updated_at = NOW(),
        completed_at = CASE 
            WHEN p_upload_status IN ('completed', 'failed', 'cancelled') 
            THEN NOW() 
            ELSE completed_at 
        END,
        processing_time_seconds = CASE 
            WHEN p_upload_status IN ('completed', 'failed', 'cancelled') 
            THEN EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
            ELSE processing_time_seconds 
        END
    WHERE id = p_session_id;
    
    RETURN FOUND;
END;
$$;

-- Comments
COMMENT ON FUNCTION bulk_upload_prospects IS 'Automatically processes bulk prospect uploads with deduplication - no manual checking required';
COMMENT ON FUNCTION validate_bulk_prospects IS 'Validates prospect data before bulk upload to catch errors early';
COMMENT ON FUNCTION get_bulk_upload_stats IS 'Returns statistics for bulk upload operations and workspace prospect counts';
COMMENT ON TABLE bulk_upload_sessions IS 'Tracks bulk upload sessions for monitoring and auditing';
COMMENT ON FUNCTION create_bulk_upload_session IS 'Creates a new bulk upload session for tracking progress';
COMMENT ON FUNCTION update_bulk_upload_session IS 'Updates bulk upload session with progress and results';