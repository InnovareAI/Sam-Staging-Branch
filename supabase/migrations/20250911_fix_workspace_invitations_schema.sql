-- Fix workspace_invitations table schema
-- Add missing company column that the API route expects

-- Add company column to workspace_invitations table
ALTER TABLE public.workspace_invitations 
ADD COLUMN IF NOT EXISTS company TEXT DEFAULT 'InnovareAI' 
CHECK (company IN ('InnovareAI', '3cubedai'));

-- Add missing invited_by column if it doesn't exist (should reference auth.users)
ALTER TABLE public.workspace_invitations 
ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add missing expires_at column if it doesn't exist
ALTER TABLE public.workspace_invitations 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days');

-- Update the constraint on role if needed
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'workspace_invitations_role_check'
    ) THEN
        ALTER TABLE public.workspace_invitations 
        ADD CONSTRAINT workspace_invitations_role_check 
        CHECK (role IN ('member', 'admin', 'owner'));
    END IF;
END $$;

-- Create missing indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_company ON public.workspace_invitations(company);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_invited_by ON public.workspace_invitations(invited_by);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_expires_at ON public.workspace_invitations(expires_at);

-- Ensure RLS is enabled and has proper policies for service role
DROP POLICY IF EXISTS "Service role can manage invitations" ON public.workspace_invitations;
CREATE POLICY "Service role can manage invitations" ON public.workspace_invitations
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON COLUMN public.workspace_invitations.company IS 'Company identifier for multi-tenant invitation management';
COMMENT ON COLUMN public.workspace_invitations.invited_by IS 'User who sent the invitation';
COMMENT ON COLUMN public.workspace_invitations.expires_at IS 'When the invitation expires';