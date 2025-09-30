-- Create structured knowledge base tables for workspace-scoped data
-- These tables replace the generic knowledge_base JSONB approach with typed columns

-- ============================================================================
-- knowledge_base_icps: Ideal Customer Profile definitions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.knowledge_base_icps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    
    -- Core ICP attributes
    title TEXT NOT NULL,
    description TEXT,
    industry TEXT,
    company_size TEXT,
    revenue_range TEXT,
    geography TEXT[],
    
    -- Pain points and needs
    pain_points JSONB DEFAULT '[]'::jsonb,
    buying_process JSONB,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    tags TEXT[] DEFAULT '{}'::text[],
    is_active BOOLEAN DEFAULT true,
    
    -- Audit fields
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- knowledge_base_products: Product catalog with detailed specs
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.knowledge_base_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    
    -- Product identity
    name TEXT NOT NULL,
    description TEXT,
    sku TEXT,
    category TEXT,
    
    -- Pricing and availability
    price NUMERIC,
    currency TEXT DEFAULT 'USD',
    pricing_model TEXT, -- subscription, one-time, usage-based, etc.
    
    -- Features and benefits
    features JSONB DEFAULT '[]'::jsonb,
    benefits JSONB DEFAULT '[]'::jsonb,
    use_cases JSONB DEFAULT '[]'::jsonb,
    
    -- Technical specs
    specifications JSONB DEFAULT '{}'::jsonb,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    tags TEXT[] DEFAULT '{}'::text[],
    is_active BOOLEAN DEFAULT true,
    
    -- Audit fields
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- knowledge_base_competitors: Competitive intelligence
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.knowledge_base_competitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    
    -- Competitor identity
    name TEXT NOT NULL,
    description TEXT,
    website TEXT,
    
    -- Market position
    market_share TEXT,
    market_position TEXT,
    
    -- SWOT analysis
    strengths JSONB DEFAULT '[]'::jsonb,
    weaknesses JSONB DEFAULT '[]'::jsonb,
    opportunities JSONB DEFAULT '[]'::jsonb,
    threats JSONB DEFAULT '[]'::jsonb,
    
    -- Competitive data
    pricing_info JSONB,
    product_comparison JSONB,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    tags TEXT[] DEFAULT '{}'::text[],
    is_active BOOLEAN DEFAULT true,
    
    -- Audit fields
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- knowledge_base_personas: User/Buyer personas
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.knowledge_base_personas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    
    -- Persona identity
    name TEXT NOT NULL,
    description TEXT,
    avatar_url TEXT,
    
    -- Demographics
    job_title TEXT,
    seniority_level TEXT,
    department TEXT,
    age_range TEXT,
    location TEXT,
    
    -- Psychographics
    goals JSONB DEFAULT '[]'::jsonb,
    challenges JSONB DEFAULT '[]'::jsonb,
    motivations JSONB DEFAULT '[]'::jsonb,
    frustrations JSONB DEFAULT '[]'::jsonb,
    
    -- Behavior
    decision_criteria JSONB DEFAULT '[]'::jsonb,
    preferred_channels JSONB DEFAULT '[]'::jsonb,
    content_preferences JSONB,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    tags TEXT[] DEFAULT '{}'::text[],
    is_active BOOLEAN DEFAULT true,
    
    -- Audit fields
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Indexes for performance
-- ============================================================================

-- ICPs
CREATE INDEX IF NOT EXISTS idx_kb_icps_workspace ON knowledge_base_icps(workspace_id);
CREATE INDEX IF NOT EXISTS idx_kb_icps_active ON knowledge_base_icps(workspace_id, is_active);
CREATE INDEX IF NOT EXISTS idx_kb_icps_created ON knowledge_base_icps(created_at DESC);

-- Products
CREATE INDEX IF NOT EXISTS idx_kb_products_workspace ON knowledge_base_products(workspace_id);
CREATE INDEX IF NOT EXISTS idx_kb_products_active ON knowledge_base_products(workspace_id, is_active);
CREATE INDEX IF NOT EXISTS idx_kb_products_category ON knowledge_base_products(workspace_id, category);
CREATE INDEX IF NOT EXISTS idx_kb_products_sku ON knowledge_base_products(sku) WHERE sku IS NOT NULL;

-- Competitors
CREATE INDEX IF NOT EXISTS idx_kb_competitors_workspace ON knowledge_base_competitors(workspace_id);
CREATE INDEX IF NOT EXISTS idx_kb_competitors_active ON knowledge_base_competitors(workspace_id, is_active);
CREATE INDEX IF NOT EXISTS idx_kb_competitors_name ON knowledge_base_competitors(name);

-- Personas
CREATE INDEX IF NOT EXISTS idx_kb_personas_workspace ON knowledge_base_personas(workspace_id);
CREATE INDEX IF NOT EXISTS idx_kb_personas_active ON knowledge_base_personas(workspace_id, is_active);
CREATE INDEX IF NOT EXISTS idx_kb_personas_title ON knowledge_base_personas(job_title) WHERE job_title IS NOT NULL;

-- ============================================================================
-- Enable RLS on all tables
-- ============================================================================

ALTER TABLE public.knowledge_base_icps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_icps FORCE ROW LEVEL SECURITY;

ALTER TABLE public.knowledge_base_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_products FORCE ROW LEVEL SECURITY;

ALTER TABLE public.knowledge_base_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_competitors FORCE ROW LEVEL SECURITY;

ALTER TABLE public.knowledge_base_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_personas FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies (workspace-scoped)
-- ============================================================================

-- ICPs policies
CREATE POLICY kb_icps_select_scoped ON public.knowledge_base_icps
FOR SELECT USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_icps_insert_scoped ON public.knowledge_base_icps
FOR INSERT WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_icps_update_scoped ON public.knowledge_base_icps
FOR UPDATE USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
) WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_icps_delete_scoped ON public.knowledge_base_icps
FOR DELETE USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

-- Products policies (same pattern)
CREATE POLICY kb_products_select_scoped ON public.knowledge_base_products
FOR SELECT USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_products_insert_scoped ON public.knowledge_base_products
FOR INSERT WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_products_update_scoped ON public.knowledge_base_products
FOR UPDATE USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
) WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_products_delete_scoped ON public.knowledge_base_products
FOR DELETE USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

-- Competitors policies
CREATE POLICY kb_competitors_select_scoped ON public.knowledge_base_competitors
FOR SELECT USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_competitors_insert_scoped ON public.knowledge_base_competitors
FOR INSERT WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_competitors_update_scoped ON public.knowledge_base_competitors
FOR UPDATE USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
) WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_competitors_delete_scoped ON public.knowledge_base_competitors
FOR DELETE USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

-- Personas policies
CREATE POLICY kb_personas_select_scoped ON public.knowledge_base_personas
FOR SELECT USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_personas_insert_scoped ON public.knowledge_base_personas
FOR INSERT WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_personas_update_scoped ON public.knowledge_base_personas
FOR UPDATE USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
) WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY kb_personas_delete_scoped ON public.knowledge_base_personas
FOR DELETE USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

-- ============================================================================
-- Updated_at triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_kb_icps_updated_at
    BEFORE UPDATE ON knowledge_base_icps
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kb_products_updated_at
    BEFORE UPDATE ON knowledge_base_products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kb_competitors_updated_at
    BEFORE UPDATE ON knowledge_base_competitors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kb_personas_updated_at
    BEFORE UPDATE ON knowledge_base_personas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();