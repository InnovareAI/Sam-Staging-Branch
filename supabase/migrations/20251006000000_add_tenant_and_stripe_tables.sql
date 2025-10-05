-- Migration: Add tenant field and Stripe integration tables
-- Created: 2025-10-06
-- Purpose: Support InnovareAI vs 3cubed tenant separation + Stripe subscriptions

-- 1. Add tenant field to workspaces table
ALTER TABLE workspaces
ADD COLUMN IF NOT EXISTS tenant TEXT DEFAULT 'innovareai' CHECK (tenant IN ('innovareai', '3cubed'));

-- Add index for tenant queries
CREATE INDEX IF NOT EXISTS idx_workspaces_tenant ON workspaces(tenant);

-- 2. Create workspace_stripe_customers table
CREATE TABLE IF NOT EXISTS workspace_stripe_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id)
);

-- Index for fast workspace lookups
CREATE INDEX IF NOT EXISTS idx_workspace_stripe_customers_workspace ON workspace_stripe_customers(workspace_id);

-- RLS for workspace_stripe_customers
ALTER TABLE workspace_stripe_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their workspace Stripe customer"
  ON workspace_stripe_customers FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage Stripe customers"
  ON workspace_stripe_customers FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- 3. Create workspace_subscriptions table
CREATE TABLE IF NOT EXISTS workspace_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid')),
  plan TEXT NOT NULL CHECK (plan IN ('startup', 'sme', 'enterprise')),
  trial_end TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id)
);

-- Index for subscription queries
CREATE INDEX IF NOT EXISTS idx_workspace_subscriptions_workspace ON workspace_subscriptions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_subscriptions_status ON workspace_subscriptions(status);

-- RLS for workspace_subscriptions
ALTER TABLE workspace_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their workspace subscription"
  ON workspace_subscriptions FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage subscriptions"
  ON workspace_subscriptions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- 4. Create function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create triggers for updated_at
CREATE TRIGGER update_workspace_stripe_customers_updated_at
  BEFORE UPDATE ON workspace_stripe_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workspace_subscriptions_updated_at
  BEFORE UPDATE ON workspace_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Add comment documentation
COMMENT ON COLUMN workspaces.tenant IS 'Tenant identifier: innovareai (self-service/SME) or 3cubed (enterprise)';
COMMENT ON TABLE workspace_stripe_customers IS 'Maps workspaces to Stripe customer IDs';
COMMENT ON TABLE workspace_subscriptions IS 'Tracks Stripe subscription status and plan for workspaces';
