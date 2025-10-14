-- Create password_reset_tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  email TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index on token for faster lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);

-- Add index on expires_at for cleanup
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- RLS policies (table is only accessed via service role)
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- No user-facing policies needed - only service role access
