-- Create workspace_accounts table only
CREATE TABLE IF NOT EXISTS workspace_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Account identification
    account_type TEXT NOT NULL CHECK (account_type IN ('linkedin', 'email', 'whatsapp', 'instagram')),
    account_identifier TEXT NOT NULL, -- Email address, LinkedIn profile URL, etc.
    account_name TEXT, -- Display name for the account
    
    -- Account connection details
    unipile_account_id TEXT, -- Connection to Unipile
    connection_status TEXT DEFAULT 'disconnected' CHECK (connection_status IN ('connected', 'disconnected', 'error', 'suspended')),
    connection_details JSONB DEFAULT '{}', -- Platform-specific connection info
    metadata JSONB DEFAULT '{}', -- Additional metadata for compatibility
    
    -- Usage tracking
    daily_message_count INTEGER DEFAULT 0,
    daily_message_limit INTEGER DEFAULT 50, -- Per-account daily limit
    monthly_message_count INTEGER DEFAULT 0,
    last_message_sent_at TIMESTAMPTZ,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    
    -- Account status
    is_active BOOLEAN DEFAULT true,
    is_primary BOOLEAN DEFAULT false, -- One primary account per type per user
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(workspace_id, user_id, account_type, account_identifier)
);

-- Add unique constraint for primary accounts
CREATE UNIQUE INDEX IF NOT EXISTS unique_primary_account_per_user_type 
ON workspace_accounts(workspace_id, user_id, account_type) 
WHERE is_primary = true;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspace_accounts_workspace_user ON workspace_accounts(workspace_id, user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_accounts_type_active ON workspace_accounts(account_type, is_active);
CREATE INDEX IF NOT EXISTS idx_workspace_accounts_unipile ON workspace_accounts(unipile_account_id) WHERE unipile_account_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE workspace_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policy - Users can manage accounts in their workspaces
CREATE POLICY "Users can manage workspace accounts" ON workspace_accounts
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members WHERE user_id = 
            (SELECT id FROM users WHERE clerk_id = auth.uid()::text)
        )
    );