-- 3cubed Billing System
-- Each 3cubed customer workspace gets a separate invoice (billed to 3cubed, not the customer)
-- All 3cubed customers get 14-day free trial

-- Create organizations table (3cubed is one organization)
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  billing_type TEXT NOT NULL CHECK (billing_type IN ('direct', 'master_account')),
  master_billing_email TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to existing organizations table
DO $$
BEGIN
  -- Remove NOT NULL constraint from clerk_org_id (legacy Clerk integration)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'clerk_org_id'
  ) THEN
    ALTER TABLE public.organizations ALTER COLUMN clerk_org_id DROP NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'billing_type'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN billing_type TEXT NOT NULL DEFAULT 'direct' CHECK (billing_type IN ('direct', 'master_account'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'master_billing_email'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN master_billing_email TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN stripe_customer_id TEXT;
  END IF;
END $$;

-- Add organization_id and trial tracking to workspaces
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workspaces' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.workspaces ADD COLUMN organization_id UUID REFERENCES public.organizations(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workspaces' AND column_name = 'trial_ends_at'
  ) THEN
    ALTER TABLE public.workspaces ADD COLUMN trial_ends_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workspaces' AND column_name = 'billing_starts_at'
  ) THEN
    ALTER TABLE public.workspaces ADD COLUMN billing_starts_at TIMESTAMPTZ;
  END IF;
END $$;

-- Create usage tracking table for billing
CREATE TABLE IF NOT EXISTS public.workspace_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  usage_type TEXT NOT NULL CHECK (usage_type IN ('message', 'campaign', 'prospect', 'ai_credits')),
  quantity INTEGER NOT NULL DEFAULT 1,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create monthly billing invoices (one invoice per 3cubed workspace)
CREATE TABLE IF NOT EXISTS public.workspace_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  billing_period_start TIMESTAMPTZ NOT NULL,
  billing_period_end TIMESTAMPTZ NOT NULL,
  total_messages INTEGER DEFAULT 0,
  total_campaigns INTEGER DEFAULT 0,
  total_prospects INTEGER DEFAULT 0,
  total_ai_credits INTEGER DEFAULT 0,
  total_amount_cents INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'sent', 'paid')),
  invoice_pdf_url TEXT,
  stripe_invoice_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, billing_period_start)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_workspace_usage_workspace_id ON public.workspace_usage(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_usage_organization_id ON public.workspace_usage(organization_id);
CREATE INDEX IF NOT EXISTS idx_workspace_usage_created_at ON public.workspace_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_workspace_invoices_workspace_id ON public.workspace_invoices(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invoices_organization_id ON public.workspace_invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invoices_period ON public.workspace_invoices(billing_period_start, billing_period_end);
CREATE INDEX IF NOT EXISTS idx_workspaces_trial_ends_at ON public.workspaces(trial_ends_at);

-- Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invoices ENABLE ROW LEVEL SECURITY;

-- RLS policies (drop and recreate to avoid conflicts)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Service role can manage organizations" ON public.organizations;
  CREATE POLICY "Service role can manage organizations" ON public.organizations
    FOR ALL USING (auth.role() = 'service_role');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Service role can manage usage" ON public.workspace_usage;
  CREATE POLICY "Service role can manage usage" ON public.workspace_usage
    FOR ALL USING (auth.role() = 'service_role');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Service role can manage workspace invoices" ON public.workspace_invoices;
  CREATE POLICY "Service role can manage workspace invoices" ON public.workspace_invoices
    FOR ALL USING (auth.role() = 'service_role');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Add triggers for updated_at (drop and recreate to avoid conflicts)
DO $$
BEGIN
  DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations;
  CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  DROP TRIGGER IF EXISTS update_workspace_invoices_updated_at ON public.workspace_invoices;
  CREATE TRIGGER update_workspace_invoices_updated_at
    BEFORE UPDATE ON public.workspace_invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Insert 3cubed organization
INSERT INTO public.organizations (name, slug, billing_type, master_billing_email)
VALUES (
  '3cubed',
  '3cubed',
  'master_account',
  'billing@3cubed.com'
) ON CONFLICT (slug) DO NOTHING;

-- Insert InnovareAI organization (for reference, but they use direct Stripe billing)
INSERT INTO public.organizations (name, slug, billing_type)
VALUES (
  'InnovareAI',
  'innovareai',
  'direct'
) ON CONFLICT (slug) DO NOTHING;

COMMENT ON TABLE public.organizations IS 'Organizations with different billing models (3cubed = master account with per-workspace invoicing, InnovareAI = direct Stripe)';
COMMENT ON TABLE public.workspace_usage IS 'Usage tracking for all workspaces, aggregated monthly for billing';
COMMENT ON TABLE public.workspace_invoices IS 'Monthly invoices per workspace (3cubed workspaces get separate invoices sent to 3cubed billing email)';
