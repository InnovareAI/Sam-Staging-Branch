-- LinkedIn Contact Discovery System
-- Maps LinkedIn profile URLs to internal LinkedIn IDs for existing connections

-- Table to store discovered LinkedIn contacts and their internal IDs
CREATE TABLE IF NOT EXISTS linkedin_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User/Workspace association
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- LinkedIn identifiers
    linkedin_profile_url TEXT NOT NULL,
    linkedin_public_identifier TEXT, -- Extract from URL (e.g., "john-smith-123")
    linkedin_internal_id TEXT, -- The ACoAAA... format needed for messaging
    
    -- Contact information (extracted from conversations/connections)
    full_name TEXT,
    first_name TEXT,
    last_name TEXT,
    headline TEXT, -- LinkedIn headline/job title
    company_name TEXT,
    location TEXT,
    profile_picture_url TEXT,
    
    -- Discovery tracking
    discovery_method TEXT CHECK (discovery_method IN (
        'message_history',  -- Found via recent message scanning
        'webhook_capture',  -- Captured from webhook events
        'unipile_api',     -- Retrieved from Unipile connections API
        'manual_import',   -- Manually imported
        'conversation'     -- Found in conversation data
    )),
    discovered_at TIMESTAMPTZ DEFAULT NOW(),
    last_verified_at TIMESTAMPTZ,
    
    -- Connection status
    connection_status TEXT DEFAULT 'connected' CHECK (connection_status IN (
        'connected',        -- Confirmed LinkedIn connection
        'pending',         -- Connection request sent
        'not_connected',   -- No connection
        'unknown'          -- Status unknown
    )),
    
    -- Messaging capability
    can_message BOOLEAN DEFAULT TRUE,
    last_message_at TIMESTAMPTZ,
    message_count INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraints
    UNIQUE(user_id, linkedin_profile_url),
    UNIQUE(user_id, linkedin_internal_id) -- Each internal ID is unique per user
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_linkedin_contacts_user ON linkedin_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_contacts_workspace ON linkedin_contacts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_contacts_profile_url ON linkedin_contacts(linkedin_profile_url);
CREATE INDEX IF NOT EXISTS idx_linkedin_contacts_internal_id ON linkedin_contacts(linkedin_internal_id) WHERE linkedin_internal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_linkedin_contacts_public_id ON linkedin_contacts(linkedin_public_identifier) WHERE linkedin_public_identifier IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_linkedin_contacts_messageable ON linkedin_contacts(user_id, can_message) WHERE can_message = TRUE;

-- Full-text search index for contact names
CREATE INDEX IF NOT EXISTS idx_linkedin_contacts_search ON linkedin_contacts USING gin(
    to_tsvector('english', COALESCE(full_name, '') || ' ' || COALESCE(company_name, '') || ' ' || COALESCE(headline, ''))
);

-- Enable Row Level Security
ALTER TABLE linkedin_contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own LinkedIn contacts
CREATE POLICY "Users can access own linkedin contacts" ON linkedin_contacts
    FOR ALL USING (user_id = (SELECT id FROM users WHERE clerk_id = auth.uid()::text));

-- Discovery tracking table for batch operations
CREATE TABLE IF NOT EXISTS linkedin_discovery_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Job details
    job_type TEXT NOT NULL CHECK (job_type IN (
        'message_history_scan',
        'connection_sync',
        'campaign_id_resolution',
        'manual_batch_import'
    )),
    
    -- Progress tracking
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending',
        'running', 
        'completed',
        'failed',
        'cancelled'
    )),
    
    -- Metrics
    total_profiles_to_process INTEGER DEFAULT 0,
    profiles_processed INTEGER DEFAULT 0,
    ids_discovered INTEGER DEFAULT 0,
    errors_encountered INTEGER DEFAULT 0,
    
    -- Job parameters
    parameters JSONB, -- Store job-specific parameters
    
    -- Results
    results JSONB, -- Store job results and statistics
    error_message TEXT,
    
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Associated campaign (if job is for campaign ID resolution)
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL
);

-- Enable RLS for discovery jobs
ALTER TABLE linkedin_discovery_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policy for discovery jobs
CREATE POLICY "Users can access own discovery jobs" ON linkedin_discovery_jobs
    FOR ALL USING (user_id = (SELECT id FROM users WHERE clerk_id = auth.uid()::text));

-- Function to extract LinkedIn public identifier from profile URL
CREATE OR REPLACE FUNCTION extract_linkedin_public_identifier(profile_url TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    -- Extract from various LinkedIn URL formats
    -- https://www.linkedin.com/in/john-smith-123/ -> john-smith-123
    -- https://linkedin.com/in/jane-doe -> jane-doe
    
    IF profile_url IS NULL OR profile_url = '' THEN
        RETURN NULL;
    END IF;
    
    -- Pattern: /in/identifier or /in/identifier/
    RETURN (regexp_match(profile_url, '/in/([^/?]+)'))[1];
END;
$$;

-- Function to upsert LinkedIn contact
CREATE OR REPLACE FUNCTION upsert_linkedin_contact(
    p_user_id UUID,
    p_workspace_id UUID,
    p_linkedin_profile_url TEXT,
    p_linkedin_internal_id TEXT DEFAULT NULL,
    p_full_name TEXT DEFAULT NULL,
    p_first_name TEXT DEFAULT NULL,
    p_last_name TEXT DEFAULT NULL,
    p_headline TEXT DEFAULT NULL,
    p_company_name TEXT DEFAULT NULL,
    p_location TEXT DEFAULT NULL,
    p_profile_picture_url TEXT DEFAULT NULL,
    p_discovery_method TEXT DEFAULT 'manual_import',
    p_connection_status TEXT DEFAULT 'connected',
    p_can_message BOOLEAN DEFAULT TRUE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_contact_id UUID;
    v_public_identifier TEXT;
BEGIN
    -- Extract public identifier from URL
    v_public_identifier := extract_linkedin_public_identifier(p_linkedin_profile_url);
    
    -- Upsert the contact
    INSERT INTO linkedin_contacts (
        user_id,
        workspace_id,
        linkedin_profile_url,
        linkedin_public_identifier,
        linkedin_internal_id,
        full_name,
        first_name,
        last_name,
        headline,
        company_name,
        location,
        profile_picture_url,
        discovery_method,
        connection_status,
        can_message,
        discovered_at,
        last_verified_at
    )
    VALUES (
        p_user_id,
        p_workspace_id,
        p_linkedin_profile_url,
        v_public_identifier,
        p_linkedin_internal_id,
        p_full_name,
        p_first_name,
        p_last_name,
        p_headline,
        p_company_name,
        p_location,
        p_profile_picture_url,
        p_discovery_method,
        p_connection_status,
        p_can_message,
        NOW(),
        CASE WHEN p_linkedin_internal_id IS NOT NULL THEN NOW() ELSE NULL END
    )
    ON CONFLICT (user_id, linkedin_profile_url)
    DO UPDATE SET
        linkedin_internal_id = COALESCE(EXCLUDED.linkedin_internal_id, linkedin_contacts.linkedin_internal_id),
        full_name = COALESCE(EXCLUDED.full_name, linkedin_contacts.full_name),
        first_name = COALESCE(EXCLUDED.first_name, linkedin_contacts.first_name),
        last_name = COALESCE(EXCLUDED.last_name, linkedin_contacts.last_name),
        headline = COALESCE(EXCLUDED.headline, linkedin_contacts.headline),
        company_name = COALESCE(EXCLUDED.company_name, linkedin_contacts.company_name),
        location = COALESCE(EXCLUDED.location, linkedin_contacts.location),
        profile_picture_url = COALESCE(EXCLUDED.profile_picture_url, linkedin_contacts.profile_picture_url),
        connection_status = EXCLUDED.connection_status,
        can_message = EXCLUDED.can_message,
        updated_at = NOW(),
        last_verified_at = CASE 
            WHEN EXCLUDED.linkedin_internal_id IS NOT NULL 
            THEN NOW() 
            ELSE linkedin_contacts.last_verified_at 
        END
    RETURNING id INTO v_contact_id;
    
    RETURN v_contact_id;
END;
$$;

-- Function to resolve LinkedIn profile URLs to internal IDs for a campaign
CREATE OR REPLACE FUNCTION resolve_campaign_linkedin_ids(
    p_campaign_id UUID,
    p_user_id UUID
)
RETURNS TABLE (
    prospect_id UUID,
    linkedin_profile_url TEXT,
    linkedin_internal_id TEXT,
    resolution_status TEXT -- 'found', 'not_found', 'error'
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cp.prospect_id,
        wp.linkedin_profile_url,
        lc.linkedin_internal_id,
        CASE 
            WHEN lc.linkedin_internal_id IS NOT NULL THEN 'found'
            WHEN lc.id IS NOT NULL THEN 'not_found'
            ELSE 'not_found'
        END as resolution_status
    FROM campaign_prospects cp
    JOIN workspace_prospects wp ON cp.prospect_id = wp.id
    LEFT JOIN linkedin_contacts lc ON (
        lc.user_id = p_user_id 
        AND lc.linkedin_profile_url = wp.linkedin_profile_url
        AND lc.linkedin_internal_id IS NOT NULL
    )
    WHERE cp.campaign_id = p_campaign_id;
END;
$$;

-- Function to get messageable contacts for a user
CREATE OR REPLACE FUNCTION get_messageable_linkedin_contacts(
    p_user_id UUID,
    p_search_term TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    id UUID,
    linkedin_profile_url TEXT,
    linkedin_internal_id TEXT,
    full_name TEXT,
    company_name TEXT,
    headline TEXT,
    last_verified_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        lc.id,
        lc.linkedin_profile_url,
        lc.linkedin_internal_id,
        lc.full_name,
        lc.company_name,
        lc.headline,
        lc.last_verified_at
    FROM linkedin_contacts lc
    WHERE lc.user_id = p_user_id
      AND lc.can_message = TRUE
      AND lc.linkedin_internal_id IS NOT NULL
      AND (
          p_search_term IS NULL 
          OR to_tsvector('english', COALESCE(lc.full_name, '') || ' ' || COALESCE(lc.company_name, '') || ' ' || COALESCE(lc.headline, '')) 
             @@ plainto_tsquery('english', p_search_term)
      )
    ORDER BY lc.last_verified_at DESC NULLS LAST
    LIMIT p_limit;
END;
$$;

-- Comments
COMMENT ON TABLE linkedin_contacts IS 'Stores discovered LinkedIn contacts with their internal IDs for messaging';
COMMENT ON TABLE linkedin_discovery_jobs IS 'Tracks background jobs for LinkedIn ID discovery and contact syncing';
COMMENT ON FUNCTION extract_linkedin_public_identifier IS 'Extracts public identifier from LinkedIn profile URL';
COMMENT ON FUNCTION upsert_linkedin_contact IS 'Creates or updates LinkedIn contact information';
COMMENT ON FUNCTION resolve_campaign_linkedin_ids IS 'Resolves LinkedIn profile URLs to internal IDs for campaign prospects';
COMMENT ON FUNCTION get_messageable_linkedin_contacts IS 'Returns contacts that can be messaged directly via LinkedIn';