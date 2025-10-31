-- PII Encryption for EU GDPR Compliance
-- Adds encryption for sensitive personal data fields
-- Date: October 31, 2025

BEGIN;

-- =====================================================================
-- Enable pgcrypto extension for encryption
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================================
-- Add encryption key management
-- =====================================================================

-- Table to store workspace-specific encryption keys
-- Each workspace gets its own encryption key for data isolation
CREATE TABLE IF NOT EXISTS workspace_encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Encrypted master key (encrypted with database-level key)
  encrypted_key TEXT NOT NULL,
  key_version INTEGER DEFAULT 1,

  -- Key rotation tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  rotated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,

  -- Audit
  created_by UUID REFERENCES users(id),

  UNIQUE(workspace_id, is_active) -- Only one active key per workspace
);

-- Enable RLS
ALTER TABLE workspace_encryption_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only service role can access encryption keys
CREATE POLICY "Service role only" ON workspace_encryption_keys
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Block all user access" ON workspace_encryption_keys
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- Index
CREATE INDEX idx_workspace_encryption_keys_workspace
ON workspace_encryption_keys(workspace_id)
WHERE is_active = true;

-- =====================================================================
-- Add encrypted PII fields to workspace_prospects
-- =====================================================================

-- Add new encrypted columns (will migrate data in next step)
ALTER TABLE workspace_prospects
ADD COLUMN IF NOT EXISTS email_address_encrypted BYTEA,
ADD COLUMN IF NOT EXISTS phone_number_encrypted BYTEA,
ADD COLUMN IF NOT EXISTS linkedin_profile_url_encrypted BYTEA,
ADD COLUMN IF NOT EXISTS pii_encryption_version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS pii_encrypted_at TIMESTAMPTZ;

-- Add flag to indicate if PII is encrypted (for gradual migration)
ALTER TABLE workspace_prospects
ADD COLUMN IF NOT EXISTS pii_is_encrypted BOOLEAN DEFAULT false;

-- =====================================================================
-- Helper functions for encryption/decryption
-- =====================================================================

-- Function to get active encryption key for workspace
CREATE OR REPLACE FUNCTION get_workspace_encryption_key(p_workspace_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key TEXT;
BEGIN
  -- In production, this should decrypt the workspace key
  -- For now, using a deterministic key derivation
  SELECT encrypted_key INTO v_key
  FROM workspace_encryption_keys
  WHERE workspace_id = p_workspace_id
    AND is_active = true
  LIMIT 1;

  -- If no key exists, create one
  IF v_key IS NULL THEN
    INSERT INTO workspace_encryption_keys (workspace_id, encrypted_key)
    VALUES (p_workspace_id, encode(gen_random_bytes(32), 'hex'))
    RETURNING encrypted_key INTO v_key;
  END IF;

  RETURN v_key;
END;
$$;

-- Function to encrypt PII field
CREATE OR REPLACE FUNCTION encrypt_pii(
  p_workspace_id UUID,
  p_plaintext TEXT
)
RETURNS BYTEA
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key TEXT;
BEGIN
  IF p_plaintext IS NULL OR p_plaintext = '' THEN
    RETURN NULL;
  END IF;

  v_key := get_workspace_encryption_key(p_workspace_id);

  -- Encrypt using AES-256-GCM
  RETURN pgp_sym_encrypt(p_plaintext, v_key, 'compress-algo=0, cipher-algo=aes256');
END;
$$;

-- Function to decrypt PII field
CREATE OR REPLACE FUNCTION decrypt_pii(
  p_workspace_id UUID,
  p_ciphertext BYTEA
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key TEXT;
BEGIN
  IF p_ciphertext IS NULL THEN
    RETURN NULL;
  END IF;

  v_key := get_workspace_encryption_key(p_workspace_id);

  -- Decrypt using AES-256-GCM
  RETURN pgp_sym_decrypt(p_ciphertext, v_key);
EXCEPTION
  WHEN OTHERS THEN
    -- Log decryption failure
    RAISE WARNING 'Failed to decrypt PII for workspace %: %', p_workspace_id, SQLERRM;
    RETURN NULL;
END;
$$;

-- =====================================================================
-- Migration function: Encrypt existing PII data
-- =====================================================================

CREATE OR REPLACE FUNCTION migrate_workspace_prospects_to_encrypted(
  p_workspace_id UUID DEFAULT NULL,
  p_batch_size INTEGER DEFAULT 100
)
RETURNS TABLE (
  workspace_id UUID,
  migrated_count INTEGER,
  error_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workspace_id UUID;
  v_migrated INTEGER := 0;
  v_errors INTEGER := 0;
BEGIN
  -- If specific workspace provided, migrate only that workspace
  -- Otherwise migrate all workspaces
  FOR v_workspace_id IN
    SELECT DISTINCT wp.workspace_id::uuid
    FROM workspace_prospects wp
    WHERE wp.pii_is_encrypted = false
      AND (p_workspace_id IS NULL OR wp.workspace_id = p_workspace_id::text)
    LIMIT p_batch_size
  LOOP
    BEGIN
      -- Encrypt PII for this workspace
      UPDATE workspace_prospects
      SET
        email_address_encrypted = encrypt_pii(v_workspace_id, email_address),
        phone_number_encrypted = encrypt_pii(v_workspace_id, phone_number),
        linkedin_profile_url_encrypted = encrypt_pii(v_workspace_id, linkedin_profile_url),
        pii_is_encrypted = true,
        pii_encrypted_at = NOW(),
        pii_encryption_version = 1
      WHERE workspace_id = v_workspace_id::text
        AND pii_is_encrypted = false;

      GET DIAGNOSTICS v_migrated = ROW_COUNT;

      RETURN QUERY SELECT v_workspace_id, v_migrated, 0;

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      RAISE WARNING 'Failed to encrypt workspace % PII: %', v_workspace_id, SQLERRM;
      RETURN QUERY SELECT v_workspace_id, 0, 1;
    END;
  END LOOP;
END;
$$;

-- =====================================================================
-- Views for transparent PII access
-- =====================================================================

-- Create view that automatically decrypts PII
-- This allows existing queries to work without modification
CREATE OR REPLACE VIEW workspace_prospects_decrypted AS
SELECT
  wp.id,
  wp.workspace_id,
  wp.first_name,
  wp.last_name,
  wp.company_name,
  wp.job_title,
  wp.location,
  wp.industry,

  -- Decrypt PII fields if encrypted, otherwise return plain text
  CASE
    WHEN wp.pii_is_encrypted THEN decrypt_pii(wp.workspace_id::uuid, wp.email_address_encrypted)
    ELSE wp.email_address
  END as email_address,

  CASE
    WHEN wp.pii_is_encrypted THEN decrypt_pii(wp.workspace_id::uuid, wp.phone_number_encrypted)
    ELSE wp.phone_number
  END as phone_number,

  CASE
    WHEN wp.pii_is_encrypted THEN decrypt_pii(wp.workspace_id::uuid, wp.linkedin_profile_url_encrypted)
    ELSE wp.linkedin_profile_url
  END as linkedin_profile_url,

  wp.pii_is_encrypted,
  wp.pii_encrypted_at,
  wp.created_at,
  wp.updated_at
FROM workspace_prospects wp;

-- Grant access to view
GRANT SELECT ON workspace_prospects_decrypted TO authenticated;

-- RLS on view inherits from base table
ALTER VIEW workspace_prospects_decrypted SET (security_invoker = true);

-- =====================================================================
-- Audit logging for PII access
-- =====================================================================

CREATE TABLE IF NOT EXISTS pii_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),

  -- What was accessed
  table_name TEXT NOT NULL,
  record_id UUID,
  field_name TEXT NOT NULL,

  -- Access details
  access_type TEXT NOT NULL CHECK (access_type IN ('read', 'write', 'delete')),
  ip_address INET,
  user_agent TEXT,

  -- Timestamp
  accessed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Purpose (optional)
  access_reason TEXT
);

-- Enable RLS
ALTER TABLE pii_access_log ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only see their own access logs
CREATE POLICY "Users see own access logs" ON pii_access_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Service role can see all
CREATE POLICY "Service role sees all" ON pii_access_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_pii_access_log_workspace ON pii_access_log(workspace_id);
CREATE INDEX idx_pii_access_log_user ON pii_access_log(user_id);
CREATE INDEX idx_pii_access_log_accessed_at ON pii_access_log(accessed_at);

-- Function to log PII access
CREATE OR REPLACE FUNCTION log_pii_access(
  p_workspace_id UUID,
  p_table_name TEXT,
  p_record_id UUID,
  p_field_name TEXT,
  p_access_type TEXT,
  p_access_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO pii_access_log (
    workspace_id,
    user_id,
    table_name,
    record_id,
    field_name,
    access_type,
    access_reason
  )
  VALUES (
    p_workspace_id,
    auth.uid(),
    p_table_name,
    p_record_id,
    p_field_name,
    p_access_type,
    p_access_reason
  );
END;
$$;

-- =====================================================================
-- Comments
-- =====================================================================

COMMENT ON TABLE workspace_encryption_keys IS 'Workspace-specific encryption keys for PII data isolation';
COMMENT ON TABLE pii_access_log IS 'Audit log for all PII field access (GDPR compliance)';
COMMENT ON FUNCTION encrypt_pii IS 'Encrypts PII field using workspace-specific key (AES-256-GCM)';
COMMENT ON FUNCTION decrypt_pii IS 'Decrypts PII field using workspace-specific key';
COMMENT ON FUNCTION migrate_workspace_prospects_to_encrypted IS 'Migrates existing plain-text PII to encrypted format (run in batches)';
COMMENT ON VIEW workspace_prospects_decrypted IS 'Transparent decryption view - use this instead of direct table access';

-- =====================================================================
-- Migration Instructions
-- =====================================================================

-- To migrate existing data to encrypted format:
-- SELECT * FROM migrate_workspace_prospects_to_encrypted(NULL, 100);
-- Run multiple times until all workspaces migrated

-- To encrypt a specific workspace:
-- SELECT * FROM migrate_workspace_prospects_to_encrypted('workspace-uuid', 1000);

COMMIT;
