-- Multi-Provider Integration Database Schema
-- Supports Google, Microsoft, LinkedIn, and future providers

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS synchronized_messages CASCADE;
DROP TABLE IF EXISTS synchronized_calendar_events CASCADE;
DROP TABLE IF EXISTS synchronized_emails CASCADE;
DROP TABLE IF EXISTS synchronized_contacts CASCADE;
DROP TABLE IF EXISTS user_provider_accounts CASCADE;

-- Core multi-provider account management table
CREATE TABLE user_provider_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Provider identification
  provider TEXT NOT NULL CHECK (provider IN ('GOOGLE', 'MICROSOFT', 'LINKEDIN', 'WHATSAPP', 'INSTAGRAM', 'TELEGRAM', 'TWITTER', 'MESSENGER', 'YAHOO', 'APPLE', 'SMS')),
  provider_account_id TEXT NOT NULL,
  account_email TEXT,
  account_name TEXT,
  
  -- Connection status
  connection_status TEXT NOT NULL DEFAULT 'active' CHECK (connection_status IN ('active', 'inactive', 'error', 'expired')),
  
  -- OAuth tokens (encrypted)
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  
  -- Provider-specific data
  provider_metadata JSONB DEFAULT '{}',
  
  -- Permissions granted
  scopes_granted TEXT[],
  email_permission BOOLEAN DEFAULT false,
  calendar_permission BOOLEAN DEFAULT false,
  contacts_permission BOOLEAN DEFAULT false,
  messaging_permission BOOLEAN DEFAULT false,
  
  -- LinkedIn-specific fields (for backward compatibility)
  linkedin_public_identifier TEXT,
  linkedin_profile_url TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(provider, provider_account_id),
  UNIQUE(user_id, provider, account_email) -- Prevent duplicate provider accounts per user
);

-- Email synchronization table
CREATE TABLE synchronized_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_account_id UUID NOT NULL REFERENCES user_provider_accounts(id) ON DELETE CASCADE,
  
  -- Email identifiers
  provider_message_id TEXT NOT NULL,
  thread_id TEXT,
  
  -- Email metadata
  subject TEXT,
  sender_email TEXT,
  sender_name TEXT,
  recipient_emails TEXT[],
  cc_emails TEXT[],
  bcc_emails TEXT[],
  
  -- Content (encrypted for privacy)
  body_text_encrypted TEXT,
  body_html_encrypted TEXT,
  
  -- Email classification
  email_type TEXT DEFAULT 'unknown' CHECK (email_type IN ('sent', 'received', 'draft', 'unknown')),
  is_read BOOLEAN DEFAULT false,
  is_important BOOLEAN DEFAULT false,
  has_attachments BOOLEAN DEFAULT false,
  
  -- AI Analysis
  is_prospect_related BOOLEAN DEFAULT false,
  prospect_emails TEXT[], -- Extracted prospect emails from content
  sentiment_score FLOAT CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
  importance_score FLOAT CHECK (importance_score >= 0 AND importance_score <= 1),
  keywords TEXT[], -- Extracted keywords for search
  
  -- Timestamps
  email_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(provider_account_id, provider_message_id)
);

-- Messaging synchronization table (WhatsApp, Telegram, Instagram, etc.)
CREATE TABLE synchronized_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_account_id UUID NOT NULL REFERENCES user_provider_accounts(id) ON DELETE CASCADE,
  
  -- Message identifiers
  provider_message_id TEXT NOT NULL,
  conversation_id TEXT, -- Chat/conversation ID
  thread_id TEXT, -- For threaded conversations
  
  -- Message metadata
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'audio', 'document', 'location', 'contact', 'sticker', 'voice_note')),
  direction TEXT NOT NULL CHECK (direction IN ('sent', 'received')),
  
  -- Participants
  sender_id TEXT, -- Platform-specific sender ID
  sender_name TEXT,
  sender_phone TEXT, -- For WhatsApp
  recipient_id TEXT,
  recipient_name TEXT,
  recipient_phone TEXT,
  
  -- Message content (encrypted for privacy)
  text_content_encrypted TEXT,
  media_url TEXT, -- For images, videos, documents
  media_type TEXT, -- MIME type
  media_size INTEGER, -- File size in bytes
  
  -- WhatsApp/Telegram specific fields
  is_group_message BOOLEAN DEFAULT false,
  group_name TEXT,
  group_participants TEXT[], -- List of group members
  
  -- Message status
  message_status TEXT DEFAULT 'sent' CHECK (message_status IN ('sent', 'delivered', 'read', 'failed')),
  is_forwarded BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  reply_to_message_id TEXT, -- For message replies
  
  -- AI Analysis
  is_prospect_related BOOLEAN DEFAULT false,
  prospect_phone_numbers TEXT[], -- Extracted prospect phone numbers
  sentiment_score FLOAT CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
  intent_category TEXT, -- 'inquiry', 'complaint', 'sales', 'support', etc.
  urgency_level TEXT DEFAULT 'normal' CHECK (urgency_level IN ('low', 'normal', 'high', 'urgent')),
  contains_contact_info BOOLEAN DEFAULT false,
  
  -- Language and location
  language_code TEXT, -- ISO 639-1 language code
  location_data JSONB DEFAULT '{}', -- GPS coordinates if shared
  
  -- Timestamps
  message_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(provider_account_id, provider_message_id)
);

-- Calendar synchronization table
CREATE TABLE synchronized_calendar_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_account_id UUID NOT NULL REFERENCES user_provider_accounts(id) ON DELETE CASCADE,
  
  -- Event identifiers
  provider_event_id TEXT NOT NULL,
  calendar_id TEXT,
  calendar_name TEXT,
  
  -- Event details
  title TEXT,
  description TEXT,
  location TEXT,
  meeting_url TEXT, -- For virtual meetings (Teams, Meet, etc.)
  
  -- Attendees
  organizer_email TEXT,
  organizer_name TEXT,
  attendee_emails TEXT[],
  attendee_names TEXT[],
  
  -- Timing
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  timezone TEXT DEFAULT 'UTC',
  is_all_day BOOLEAN DEFAULT false,
  
  -- Event properties
  event_type TEXT DEFAULT 'meeting' CHECK (event_type IN ('meeting', 'appointment', 'reminder', 'task', 'other')),
  event_status TEXT DEFAULT 'confirmed' CHECK (event_status IN ('confirmed', 'tentative', 'cancelled')),
  response_status TEXT DEFAULT 'needsAction' CHECK (response_status IN ('accepted', 'declined', 'tentative', 'needsAction')),
  
  -- Recurrence
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT, -- RRULE format
  
  -- AI Analysis
  is_prospect_meeting BOOLEAN DEFAULT false,
  prospect_emails TEXT[], -- Prospect attendees
  meeting_outcome TEXT CHECK (meeting_outcome IN ('scheduled', 'completed', 'no_show', 'rescheduled', 'cancelled')),
  follow_up_required BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(provider_account_id, provider_event_id)
);

-- Contact synchronization table
CREATE TABLE synchronized_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_account_id UUID NOT NULL REFERENCES user_provider_accounts(id) ON DELETE CASCADE,
  
  -- Contact identifiers
  provider_contact_id TEXT NOT NULL,
  
  -- Basic contact info
  email_addresses TEXT[],
  phone_numbers TEXT[],
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  display_name TEXT,
  
  -- Professional info
  company TEXT,
  job_title TEXT,
  department TEXT,
  
  -- Additional contact data
  address JSONB DEFAULT '{}', -- Structured address data
  social_profiles JSONB DEFAULT '{}', -- LinkedIn, Twitter, etc.
  notes TEXT,
  
  -- Provider-specific data
  provider_metadata JSONB DEFAULT '{}',
  
  -- Contact classification
  contact_type TEXT DEFAULT 'personal' CHECK (contact_type IN ('personal', 'business', 'prospect', 'client')),
  importance_level TEXT DEFAULT 'normal' CHECK (importance_level IN ('low', 'normal', 'high', 'vip')),
  
  -- Prospect matching
  is_prospect BOOLEAN DEFAULT false,
  linked_prospect_id UUID, -- Link to prospects table when created
  prospect_confidence_score FLOAT CHECK (prospect_confidence_score >= 0 AND prospect_confidence_score <= 1),
  
  -- Interaction tracking
  last_contact_date TIMESTAMPTZ,
  interaction_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(provider_account_id, provider_contact_id)
);

-- Provider sync status table
CREATE TABLE provider_sync_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_account_id UUID NOT NULL REFERENCES user_provider_accounts(id) ON DELETE CASCADE,
  
  -- Sync configuration
  sync_type TEXT NOT NULL CHECK (sync_type IN ('email', 'calendar', 'contacts')),
  
  -- Sync status
  last_sync_at TIMESTAMPTZ,
  next_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'running', 'completed', 'error', 'paused')),
  
  -- Sync progress
  items_synced INTEGER DEFAULT 0,
  total_items INTEGER DEFAULT 0,
  sync_cursor TEXT, -- For incremental sync
  
  -- Error handling
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  last_error_at TIMESTAMPTZ,
  
  -- Settings
  sync_enabled BOOLEAN DEFAULT true,
  sync_frequency_minutes INTEGER DEFAULT 5, -- How often to sync
  retention_days INTEGER DEFAULT 365, -- How long to keep synced data
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(provider_account_id, sync_type)
);

-- Indexes for performance
CREATE INDEX idx_user_provider_accounts_user_id ON user_provider_accounts(user_id);
CREATE INDEX idx_user_provider_accounts_provider ON user_provider_accounts(provider);
CREATE INDEX idx_user_provider_accounts_status ON user_provider_accounts(connection_status);
CREATE INDEX idx_user_provider_accounts_email ON user_provider_accounts(account_email);

CREATE INDEX idx_synchronized_emails_user_id ON synchronized_emails(user_id);
CREATE INDEX idx_synchronized_emails_provider_account ON synchronized_emails(provider_account_id);
CREATE INDEX idx_synchronized_emails_date ON synchronized_emails(email_date);
CREATE INDEX idx_synchronized_emails_prospect ON synchronized_emails(is_prospect_related);
CREATE INDEX idx_synchronized_emails_sender ON synchronized_emails(sender_email);
CREATE INDEX idx_synchronized_emails_thread ON synchronized_emails(thread_id);

CREATE INDEX idx_synchronized_messages_user_id ON synchronized_messages(user_id);
CREATE INDEX idx_synchronized_messages_provider_account ON synchronized_messages(provider_account_id);
CREATE INDEX idx_synchronized_messages_date ON synchronized_messages(message_date);
CREATE INDEX idx_synchronized_messages_conversation ON synchronized_messages(conversation_id);
CREATE INDEX idx_synchronized_messages_direction ON synchronized_messages(direction);
CREATE INDEX idx_synchronized_messages_prospect ON synchronized_messages(is_prospect_related);
CREATE INDEX idx_synchronized_messages_sender ON synchronized_messages(sender_phone);
CREATE INDEX idx_synchronized_messages_type ON synchronized_messages(message_type);
CREATE INDEX idx_synchronized_messages_status ON synchronized_messages(message_status);

CREATE INDEX idx_synchronized_calendar_user_id ON synchronized_calendar_events(user_id);
CREATE INDEX idx_synchronized_calendar_provider_account ON synchronized_calendar_events(provider_account_id);
CREATE INDEX idx_synchronized_calendar_start_time ON synchronized_calendar_events(start_time);
CREATE INDEX idx_synchronized_calendar_prospect ON synchronized_calendar_events(is_prospect_meeting);
CREATE INDEX idx_synchronized_calendar_status ON synchronized_calendar_events(event_status);

CREATE INDEX idx_synchronized_contacts_user_id ON synchronized_contacts(user_id);
CREATE INDEX idx_synchronized_contacts_provider_account ON synchronized_contacts(provider_account_id);
CREATE INDEX idx_synchronized_contacts_email ON synchronized_contacts USING GIN(email_addresses);
CREATE INDEX idx_synchronized_contacts_prospect ON synchronized_contacts(is_prospect);
CREATE INDEX idx_synchronized_contacts_company ON synchronized_contacts(company);

CREATE INDEX idx_provider_sync_status_account ON provider_sync_status(provider_account_id);
CREATE INDEX idx_provider_sync_status_type ON provider_sync_status(sync_type);
CREATE INDEX idx_provider_sync_status_next_sync ON provider_sync_status(next_sync_at);

-- Enable Row Level Security
ALTER TABLE user_provider_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE synchronized_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE synchronized_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE synchronized_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE synchronized_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_sync_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user data isolation
CREATE POLICY "Users can manage their own provider accounts" ON user_provider_accounts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access their own synchronized emails" ON synchronized_emails FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access their own synchronized messages" ON synchronized_messages FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access their own synchronized calendar events" ON synchronized_calendar_events FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access their own synchronized contacts" ON synchronized_contacts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access their own sync status" ON provider_sync_status FOR ALL USING (
  auth.uid() = (SELECT user_id FROM user_provider_accounts WHERE id = provider_account_id)
);

-- Functions for encrypted data handling
CREATE OR REPLACE FUNCTION encrypt_sensitive_data(data TEXT, key_name TEXT DEFAULT 'default')
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- In production, implement proper encryption using pgcrypto or external service
  -- For now, return base64 encoded (NOT SECURE - implement proper encryption)
  RETURN encode(data::bytea, 'base64');
END;
$$;

CREATE OR REPLACE FUNCTION decrypt_sensitive_data(encrypted_data TEXT, key_name TEXT DEFAULT 'default')
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- In production, implement proper decryption using pgcrypto or external service
  -- For now, return base64 decoded (NOT SECURE - implement proper decryption)
  RETURN convert_from(decode(encrypted_data, 'base64'), 'UTF8');
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL; -- Return NULL if decryption fails
END;
$$;

-- Function to migrate existing LinkedIn data to new schema
CREATE OR REPLACE FUNCTION migrate_linkedin_data()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  migration_result JSON;
  migrated_count INTEGER := 0;
  error_count INTEGER := 0;
  linkedin_record RECORD;
BEGIN
  -- Migrate existing user_unipile_accounts to user_provider_accounts
  FOR linkedin_record IN 
    SELECT * FROM user_unipile_accounts WHERE platform = 'LINKEDIN'
  LOOP
    BEGIN
      INSERT INTO user_provider_accounts (
        user_id,
        provider,
        provider_account_id,
        account_email,
        account_name,
        connection_status,
        linkedin_public_identifier,
        linkedin_profile_url,
        email_permission,
        created_at,
        updated_at
      ) VALUES (
        linkedin_record.user_id,
        'LINKEDIN',
        linkedin_record.unipile_account_id,
        linkedin_record.account_email,
        linkedin_record.account_name,
        linkedin_record.connection_status,
        linkedin_record.linkedin_public_identifier,
        linkedin_record.linkedin_profile_url,
        true, -- LinkedIn has messaging permission
        linkedin_record.created_at,
        linkedin_record.updated_at
      ) ON CONFLICT (provider, provider_account_id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        account_email = EXCLUDED.account_email,
        account_name = EXCLUDED.account_name,
        connection_status = EXCLUDED.connection_status,
        linkedin_public_identifier = EXCLUDED.linkedin_public_identifier,
        linkedin_profile_url = EXCLUDED.linkedin_profile_url,
        updated_at = NOW();
      
      migrated_count := migrated_count + 1;
    EXCEPTION
      WHEN OTHERS THEN
        error_count := error_count + 1;
        RAISE NOTICE 'Error migrating LinkedIn record %: %', linkedin_record.id, SQLERRM;
    END;
  END LOOP;
  
  migration_result := json_build_object(
    'success', true,
    'migrated_count', migrated_count,
    'error_count', error_count,
    'message', format('Migrated %s LinkedIn accounts with %s errors', migrated_count, error_count)
  );
  
  RETURN migration_result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'migrated_count', migrated_count,
      'error_count', error_count
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION encrypt_sensitive_data TO authenticated;
GRANT EXECUTE ON FUNCTION decrypt_sensitive_data TO authenticated;
GRANT EXECUTE ON FUNCTION migrate_linkedin_data TO authenticated;

-- Create initial sync status for existing accounts
-- This will be populated when accounts are connected

COMMENT ON TABLE user_provider_accounts IS 'Multi-provider account management for Google, Microsoft, LinkedIn integrations';
COMMENT ON TABLE synchronized_emails IS 'Email data synchronized from provider accounts with AI analysis';
COMMENT ON TABLE synchronized_calendar_events IS 'Calendar events synchronized from provider accounts';
COMMENT ON TABLE synchronized_contacts IS 'Contacts synchronized from provider accounts with prospect matching';
COMMENT ON TABLE provider_sync_status IS 'Tracks synchronization status and configuration for each provider';

-- Test the migration function
SELECT migrate_linkedin_data();