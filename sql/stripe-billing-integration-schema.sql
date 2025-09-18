-- =====================================================
-- SAM AI STRIPE BILLING INTEGRATION SCHEMA
-- Complete Stripe billing system for multi-tenant SaaS
-- =====================================================

-- Workspace Stripe customer mapping
CREATE TABLE workspace_stripe_customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    stripe_customer_id TEXT NOT NULL UNIQUE,
    
    -- Customer details
    customer_email TEXT,
    customer_name TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by uuid REFERENCES auth.users(id),
    
    UNIQUE(workspace_id)
);

-- Workspace subscription management
CREATE TABLE workspace_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Stripe subscription details
    stripe_subscription_id TEXT NOT NULL UNIQUE,
    stripe_customer_id TEXT NOT NULL,
    
    -- Service tier
    tier_type TEXT NOT NULL CHECK (tier_type IN ('startup', 'sme', 'enterprise')),
    
    -- Subscription status
    status TEXT NOT NULL CHECK (status IN (
        'incomplete', 'incomplete_expired', 'trialing', 'active', 
        'past_due', 'canceled', 'unpaid', 'paused'
    )),
    
    -- Billing periods
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Trial information
    trial_start TIMESTAMP WITH TIME ZONE,
    trial_end TIMESTAMP WITH TIME ZONE,
    
    -- Cancellation
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    cancellation_reason TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by uuid REFERENCES auth.users(id),
    
    -- Foreign key to Stripe customer
    FOREIGN KEY (stripe_customer_id) REFERENCES workspace_stripe_customers(stripe_customer_id)
);

-- Billing audit log for compliance and debugging
CREATE TABLE billing_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Action details
    action TEXT NOT NULL, -- 'checkout_session_created', 'subscription_created', 'payment_succeeded', etc.
    details JSONB NOT NULL, -- Full details of the action
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscription usage tracking for billing analytics
CREATE TABLE subscription_usage_tracking (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    subscription_id uuid NOT NULL REFERENCES workspace_subscriptions(id) ON DELETE CASCADE,
    
    -- Usage period
    usage_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    usage_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Tier limits (stored for historical reference)
    tier_type TEXT NOT NULL,
    linkedin_daily_limit INTEGER,
    email_daily_limit INTEGER,
    contacts_limit INTEGER,
    campaigns_limit INTEGER,
    
    -- Actual usage during period
    linkedin_messages_sent INTEGER DEFAULT 0,
    email_messages_sent INTEGER DEFAULT 0,
    contacts_stored INTEGER DEFAULT 0,
    campaigns_created INTEGER DEFAULT 0,
    
    -- Overage calculations
    linkedin_overage INTEGER DEFAULT 0,
    email_overage INTEGER DEFAULT 0,
    contacts_overage INTEGER DEFAULT 0,
    campaigns_overage INTEGER DEFAULT 0,
    
    -- Billing status
    billed BOOLEAN DEFAULT FALSE,
    billed_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment method information (for display purposes)
CREATE TABLE workspace_payment_methods (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    stripe_customer_id TEXT NOT NULL,
    
    -- Payment method details
    stripe_payment_method_id TEXT NOT NULL,
    payment_method_type TEXT NOT NULL, -- 'card', 'bank_account', etc.
    
    -- Card details (if applicable)
    card_brand TEXT, -- 'visa', 'mastercard', etc.
    card_last4 TEXT,
    card_exp_month INTEGER,
    card_exp_year INTEGER,
    
    -- Status
    is_default BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'active',
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key to Stripe customer
    FOREIGN KEY (stripe_customer_id) REFERENCES workspace_stripe_customers(stripe_customer_id)
);

-- Subscription plan definitions (for reference and historical data)
CREATE TABLE subscription_plan_definitions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Plan identification
    tier_type TEXT NOT NULL CHECK (tier_type IN ('startup', 'sme', 'enterprise')),
    plan_version TEXT NOT NULL DEFAULT '1.0',
    
    -- Stripe configuration
    stripe_price_id TEXT NOT NULL,
    stripe_product_id TEXT,
    
    -- Pricing
    price_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    billing_interval TEXT NOT NULL CHECK (billing_interval IN ('month', 'year')),
    
    -- Feature limits
    features JSONB NOT NULL, -- Complete feature definitions
    limits JSONB NOT NULL, -- Usage limits
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    deprecated_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoice tracking (for record keeping)
CREATE TABLE workspace_invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    subscription_id uuid REFERENCES workspace_subscriptions(id) ON DELETE SET NULL,
    
    -- Stripe invoice details
    stripe_invoice_id TEXT NOT NULL UNIQUE,
    stripe_customer_id TEXT NOT NULL,
    
    -- Invoice details
    invoice_number TEXT,
    amount_due INTEGER NOT NULL, -- In cents
    amount_paid INTEGER DEFAULT 0, -- In cents
    currency TEXT NOT NULL DEFAULT 'USD',
    
    -- Status
    status TEXT NOT NULL, -- 'draft', 'open', 'paid', 'void', 'uncollectible'
    
    -- Dates
    invoice_date TIMESTAMP WITH TIME ZONE NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    
    -- Hosted invoice URL
    hosted_invoice_url TEXT,
    invoice_pdf TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key to Stripe customer
    FOREIGN KEY (stripe_customer_id) REFERENCES workspace_stripe_customers(stripe_customer_id)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Stripe customer lookups
CREATE INDEX idx_stripe_customers_workspace_id ON workspace_stripe_customers(workspace_id);
CREATE INDEX idx_stripe_customers_stripe_id ON workspace_stripe_customers(stripe_customer_id);

-- Subscription lookups
CREATE INDEX idx_subscriptions_workspace_id ON workspace_subscriptions(workspace_id);
CREATE INDEX idx_subscriptions_stripe_id ON workspace_subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON workspace_subscriptions(status);
CREATE INDEX idx_subscriptions_tier_type ON workspace_subscriptions(tier_type);

-- Audit log queries
CREATE INDEX idx_billing_audit_workspace_id ON billing_audit_log(workspace_id);
CREATE INDEX idx_billing_audit_created_at ON billing_audit_log(created_at);
CREATE INDEX idx_billing_audit_action ON billing_audit_log(action);

-- Usage tracking
CREATE INDEX idx_usage_tracking_workspace_id ON subscription_usage_tracking(workspace_id);
CREATE INDEX idx_usage_tracking_period ON subscription_usage_tracking(usage_period_start, usage_period_end);

-- Payment methods
CREATE INDEX idx_payment_methods_workspace_id ON workspace_payment_methods(workspace_id);
CREATE INDEX idx_payment_methods_stripe_customer ON workspace_payment_methods(stripe_customer_id);

-- Plan definitions
CREATE INDEX idx_plan_definitions_tier_type ON subscription_plan_definitions(tier_type);
CREATE INDEX idx_plan_definitions_active ON subscription_plan_definitions(is_active);

-- Invoice tracking
CREATE INDEX idx_invoices_workspace_id ON workspace_invoices(workspace_id);
CREATE INDEX idx_invoices_stripe_id ON workspace_invoices(stripe_invoice_id);
CREATE INDEX idx_invoices_status ON workspace_invoices(status);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE workspace_stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plan_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_invoices ENABLE ROW LEVEL SECURITY;

-- RLS policies (users can only access their workspace data)
CREATE POLICY stripe_customers_policy ON workspace_stripe_customers
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY subscriptions_policy ON workspace_subscriptions
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY billing_audit_policy ON billing_audit_log
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY usage_tracking_policy ON subscription_usage_tracking
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY payment_methods_policy ON workspace_payment_methods
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

-- Plan definitions are read-only for all authenticated users
CREATE POLICY plan_definitions_policy ON subscription_plan_definitions
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY invoices_policy ON workspace_invoices
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

-- =====================================================
-- FUNCTIONS FOR BILLING AUTOMATION
-- =====================================================

-- Function to get current subscription for a workspace
CREATE OR REPLACE FUNCTION get_workspace_subscription(p_workspace_id uuid)
RETURNS TABLE (
    subscription_id uuid,
    tier_type text,
    status text,
    trial_end timestamp with time zone,
    current_period_end timestamp with time zone
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ws.id,
        ws.tier_type,
        ws.status,
        ws.trial_end,
        ws.current_period_end
    FROM workspace_subscriptions ws
    WHERE ws.workspace_id = p_workspace_id 
      AND ws.status IN ('trialing', 'active', 'past_due')
    ORDER BY ws.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if workspace has active subscription
CREATE OR REPLACE FUNCTION workspace_has_active_subscription(p_workspace_id uuid)
RETURNS boolean AS $$
DECLARE
    subscription_count integer;
BEGIN
    SELECT COUNT(*)
    INTO subscription_count
    FROM workspace_subscriptions
    WHERE workspace_id = p_workspace_id 
      AND status IN ('trialing', 'active');
    
    RETURN subscription_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get workspace tier with fallback
CREATE OR REPLACE FUNCTION get_workspace_tier(p_workspace_id uuid)
RETURNS text AS $$
DECLARE
    tier_type text;
    has_subscription boolean;
BEGIN
    -- Check if workspace has active subscription
    SELECT workspace_has_active_subscription(p_workspace_id) INTO has_subscription;
    
    IF has_subscription THEN
        -- Get tier from active subscription
        SELECT ws.tier_type
        INTO tier_type
        FROM workspace_subscriptions ws
        WHERE ws.workspace_id = p_workspace_id 
          AND ws.status IN ('trialing', 'active')
        ORDER BY ws.created_at DESC
        LIMIT 1;
    ELSE
        -- Fallback to workspace_tiers table or default
        SELECT wt.tier_type
        INTO tier_type
        FROM workspace_tiers wt
        WHERE wt.workspace_id = p_workspace_id;
        
        -- Default to startup if no tier found
        IF tier_type IS NULL THEN
            tier_type := 'startup';
        END IF;
    END IF;
    
    RETURN tier_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update workspace tier based on subscription
CREATE OR REPLACE FUNCTION sync_workspace_tier_from_subscription()
RETURNS TRIGGER AS $$
BEGIN
    -- Update workspace_tiers table when subscription changes
    INSERT INTO workspace_tiers (workspace_id, tier_type, effective_date, updated_by)
    VALUES (NEW.workspace_id, NEW.tier_type, NOW(), NEW.created_by)
    ON CONFLICT (workspace_id) 
    DO UPDATE SET 
        tier_type = NEW.tier_type,
        effective_date = NOW(),
        updated_at = NOW();
        
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS FOR AUTOMATION
-- =====================================================

-- Trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_billing_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to billing tables
CREATE TRIGGER update_stripe_customers_updated_at 
    BEFORE UPDATE ON workspace_stripe_customers 
    FOR EACH ROW EXECUTE FUNCTION update_billing_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at 
    BEFORE UPDATE ON workspace_subscriptions 
    FOR EACH ROW EXECUTE FUNCTION update_billing_updated_at_column();

CREATE TRIGGER update_usage_tracking_updated_at 
    BEFORE UPDATE ON subscription_usage_tracking 
    FOR EACH ROW EXECUTE FUNCTION update_billing_updated_at_column();

CREATE TRIGGER update_payment_methods_updated_at 
    BEFORE UPDATE ON workspace_payment_methods 
    FOR EACH ROW EXECUTE FUNCTION update_billing_updated_at_column();

CREATE TRIGGER update_plan_definitions_updated_at 
    BEFORE UPDATE ON subscription_plan_definitions 
    FOR EACH ROW EXECUTE FUNCTION update_billing_updated_at_column();

CREATE TRIGGER update_invoices_updated_at 
    BEFORE UPDATE ON workspace_invoices 
    FOR EACH ROW EXECUTE FUNCTION update_billing_updated_at_column();

-- Trigger to sync workspace tier when subscription changes
CREATE TRIGGER sync_workspace_tier_trigger
    AFTER INSERT OR UPDATE ON workspace_subscriptions
    FOR EACH ROW EXECUTE FUNCTION sync_workspace_tier_from_subscription();

-- =====================================================
-- INITIAL DATA SETUP
-- =====================================================

-- Insert current plan definitions
INSERT INTO subscription_plan_definitions (tier_type, stripe_price_id, price_cents, features, limits) VALUES
('startup', 'price_startup_monthly', 9900, 
 '["Unipile LinkedIn & Email Integration", "Basic SAM AI Personalization", "Email-based HITL Approval", "Standard Analytics", "Community Support"]'::jsonb,
 '{"linkedin_daily": 50, "email_daily": 200, "contacts": 2000, "campaigns": 5}'::jsonb),

('sme', 'price_sme_monthly', 39900,
 '["Multi-Channel Setup (ReachInbox + Unipile)", "Advanced SAM AI Personalization", "A/B Testing & Analytics", "Priority Support", "Custom Workflows", "Advanced HITL Workflows"]'::jsonb,
 '{"linkedin_daily": 200, "email_daily": 2000, "contacts": 10000, "campaigns": 20}'::jsonb),

('enterprise', 'price_enterprise_monthly', 89900,
 '["Premium Multi-Channel Setup", "Premium SAM AI with Custom Training", "Unlimited A/B Testing", "Dedicated Account Manager", "Custom MCP Integrations", "White-Glove Onboarding", "Advanced Analytics & Reporting"]'::jsonb,
 '{"linkedin_daily": 500, "email_daily": 5000, "contacts": 30000, "campaigns": 100}'::jsonb)

ON CONFLICT (tier_type, plan_version) DO NOTHING;