-- Create email_providers table for storing email provider configurations
CREATE TABLE IF NOT EXISTS email_providers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    provider_type text NOT NULL CHECK (provider_type IN ('google', 'microsoft', 'smtp', 'calendly')),
    provider_name text NOT NULL,
    email_address text NOT NULL,
    status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error', 'syncing')),
    
    -- OAuth 2.0 fields for Google/Microsoft
    oauth_access_token text,
    oauth_refresh_token text,
    oauth_token_expires_at timestamp with time zone,
    oauth_scopes text[],
    
    -- SMTP fields for custom email providers
    smtp_host text,
    smtp_port integer,
    smtp_username text,
    smtp_password_encrypted text,
    smtp_use_tls boolean DEFAULT true,
    smtp_use_ssl boolean DEFAULT false,
    
    -- Provider-specific configuration
    config jsonb DEFAULT '{}',
    
    -- Connection metadata
    last_sync timestamp with time zone,
    last_error text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    UNIQUE(user_id, email_address, provider_type)
);

-- Create indexes for faster lookups
CREATE INDEX idx_email_providers_user_id ON email_providers(user_id);
CREATE INDEX idx_email_providers_status ON email_providers(status);
CREATE INDEX idx_email_providers_provider_type ON email_providers(provider_type);
CREATE INDEX idx_email_providers_last_sync ON email_providers(last_sync DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE email_providers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own email providers" ON email_providers
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own email providers" ON email_providers
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own email providers" ON email_providers
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own email providers" ON email_providers
    FOR DELETE USING (auth.uid() = user_id);

-- Create email_messages table for storing synced emails
CREATE TABLE IF NOT EXISTS email_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    provider_id uuid REFERENCES email_providers(id) ON DELETE CASCADE,
    
    -- Message identifiers
    external_message_id text NOT NULL,
    thread_id text,
    
    -- Message content
    subject text,
    from_address text NOT NULL,
    from_name text,
    to_addresses text[] NOT NULL,
    cc_addresses text[],
    bcc_addresses text[],
    reply_to text,
    
    -- Message body
    body_text text,
    body_html text,
    
    -- Message metadata
    message_date timestamp with time zone NOT NULL,
    is_read boolean DEFAULT false,
    is_draft boolean DEFAULT false,
    is_sent boolean DEFAULT false,
    has_attachments boolean DEFAULT false,
    importance text CHECK (importance IN ('low', 'normal', 'high')),
    
    -- Labels/folders
    labels text[],
    folder text,
    
    -- Timestamps
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    UNIQUE(provider_id, external_message_id)
);

-- Create indexes for email_messages
CREATE INDEX idx_email_messages_user_id ON email_messages(user_id);
CREATE INDEX idx_email_messages_provider_id ON email_messages(provider_id);
CREATE INDEX idx_email_messages_message_date ON email_messages(message_date DESC);
CREATE INDEX idx_email_messages_from_address ON email_messages(from_address);
CREATE INDEX idx_email_messages_subject ON email_messages USING gin(to_tsvector('english', subject));
CREATE INDEX idx_email_messages_is_read ON email_messages(is_read);

-- Enable RLS for email_messages
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for email_messages
CREATE POLICY "Users can view their own email messages" ON email_messages
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own email messages" ON email_messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own email messages" ON email_messages
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own email messages" ON email_messages
    FOR DELETE USING (auth.uid() = user_id);

-- Add helpful comments
COMMENT ON TABLE email_providers IS 'Stores email provider configurations for Google, Microsoft, SMTP, and Calendly integrations';
COMMENT ON COLUMN email_providers.oauth_access_token IS 'OAuth 2.0 access token (encrypted at application level)';
COMMENT ON COLUMN email_providers.smtp_password_encrypted IS 'SMTP password encrypted at application level';
COMMENT ON COLUMN email_providers.config IS 'Provider-specific configuration as JSON';

COMMENT ON TABLE email_messages IS 'Stores synced email messages from connected email providers';
COMMENT ON COLUMN email_messages.external_message_id IS 'Unique message ID from the email provider';
COMMENT ON COLUMN email_messages.labels IS 'Array of labels/tags associated with the message';