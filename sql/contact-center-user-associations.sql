-- Contact Center: User Account Associations Table
-- This table maps users to their Unipile accounts for privacy protection

-- Create user_unipile_accounts table
CREATE TABLE IF NOT EXISTS user_unipile_accounts (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    unipile_account_id TEXT NOT NULL,
    account_name TEXT,
    account_type TEXT DEFAULT 'LINKEDIN',
    connection_status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    -- Ensure unique mapping of user to Unipile account
    UNIQUE(user_id, unipile_account_id)
);

-- Enable RLS (Row Level Security) for privacy
ALTER TABLE user_unipile_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own account associations
CREATE POLICY "Users can view own account associations" 
ON user_unipile_accounts FOR SELECT 
USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own account associations
CREATE POLICY "Users can insert own account associations" 
ON user_unipile_accounts FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own account associations
CREATE POLICY "Users can update own account associations" 
ON user_unipile_accounts FOR UPDATE 
USING (auth.uid() = user_id);

-- RLS Policy: Users can delete their own account associations
CREATE POLICY "Users can delete own account associations" 
ON user_unipile_accounts FOR DELETE 
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_user_unipile_accounts_user_id ON user_unipile_accounts(user_id);
CREATE INDEX idx_user_unipile_accounts_unipile_id ON user_unipile_accounts(unipile_account_id);
CREATE INDEX idx_user_unipile_accounts_status ON user_unipile_accounts(connection_status);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_user_unipile_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language plpgsql;

CREATE TRIGGER update_user_unipile_accounts_updated_at
    BEFORE UPDATE ON user_unipile_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_user_unipile_accounts_updated_at();

-- Insert sample data for testing (optional - remove in production)
-- This should be replaced with actual account linking flow
/*
INSERT INTO user_unipile_accounts (user_id, unipile_account_id, account_name, account_type, connection_status) 
VALUES 
    (auth.uid(), 'sample-account-id', 'Sample LinkedIn Account', 'LINKEDIN', 'connected')
ON CONFLICT (user_id, unipile_account_id) DO NOTHING;
*/

-- Comments for documentation
COMMENT ON TABLE user_unipile_accounts IS 'Maps users to their Unipile accounts for Contact Center privacy protection';
COMMENT ON COLUMN user_unipile_accounts.user_id IS 'References auth.users - the SAM AI user who owns this account';
COMMENT ON COLUMN user_unipile_accounts.unipile_account_id IS 'The account ID from Unipile API';
COMMENT ON COLUMN user_unipile_accounts.account_name IS 'Human-readable name of the account (e.g., LinkedIn profile name)';
COMMENT ON COLUMN user_unipile_accounts.account_type IS 'Type of account (LINKEDIN, EMAIL, etc.)';
COMMENT ON COLUMN user_unipile_accounts.connection_status IS 'Status: pending, connected, disconnected, error';