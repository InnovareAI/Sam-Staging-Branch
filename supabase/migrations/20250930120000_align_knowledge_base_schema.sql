-- Align knowledge base schema with Stage 3 design (workspace scope + structured tables)

-- 1. Ensure workspace_id columns exist on core tables
ALTER TABLE public.knowledge_base
    ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.knowledge_base_sections
    ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.knowledge_base_content
    ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.icp_configurations
    ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- 2. Index workspace columns for query performance
CREATE INDEX IF NOT EXISTS idx_knowledge_base_workspace ON public.knowledge_base(workspace_id);
CREATE INDEX IF NOT EXISTS idx_kb_sections_workspace ON public.knowledge_base_sections(workspace_id);
CREATE INDEX IF NOT EXISTS idx_kb_content_workspace ON public.knowledge_base_content(workspace_id);
CREATE INDEX IF NOT EXISTS idx_icp_config_workspace ON public.icp_configurations(workspace_id);

-- 3. Refresh RLS policies to enforce workspace membership while allowing global records (NULL workspace)
DROP POLICY IF EXISTS "Knowledge base is readable by all" ON public.knowledge_base;
DROP POLICY IF EXISTS "Knowledge base is writable by authenticated users" ON public.knowledge_base;

CREATE POLICY "knowledge_base_select_scoped" ON public.knowledge_base
FOR SELECT USING (
    workspace_id IS NULL OR workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
);

CREATE POLICY "knowledge_base_mutate_scoped" ON public.knowledge_base
FOR ALL TO authenticated USING (
    workspace_id IS NULL OR workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "KB sections readable by all" ON public.knowledge_base_sections;
DROP POLICY IF EXISTS "KB sections writable by authenticated" ON public.knowledge_base_sections;

CREATE POLICY "kb_sections_select_scoped" ON public.knowledge_base_sections
FOR SELECT USING (
    workspace_id IS NULL OR workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
);

CREATE POLICY "kb_sections_mutate_scoped" ON public.knowledge_base_sections
FOR ALL TO authenticated USING (
    workspace_id IS NULL OR workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "KB content readable by all" ON public.knowledge_base_content;
DROP POLICY IF EXISTS "KB content writable by authenticated" ON public.knowledge_base_content;

CREATE POLICY "kb_content_select_scoped" ON public.knowledge_base_content
FOR SELECT USING (
    workspace_id IS NULL OR workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
);

CREATE POLICY "kb_content_mutate_scoped" ON public.knowledge_base_content
FOR ALL TO authenticated USING (
    workspace_id IS NULL OR workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "ICP configs readable by all" ON public.icp_configurations;
DROP POLICY IF EXISTS "ICP configs writable by authenticated" ON public.icp_configurations;

CREATE POLICY "icp_config_select_scoped" ON public.icp_configurations
FOR SELECT USING (
    workspace_id IS NULL OR workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
);

CREATE POLICY "icp_config_mutate_scoped" ON public.icp_configurations
FOR ALL TO authenticated USING (
    workspace_id IS NULL OR workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
);

-- 4. Structured tables for Stage 3 (create if missing)

CREATE TABLE IF NOT EXISTS public.knowledge_base_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    section_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    extracted_content TEXT,
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.knowledge_base_icps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    icp_name TEXT NOT NULL,
    industries TEXT[] DEFAULT '{}',
    titles TEXT[] DEFAULT '{}',
    company_size_min INTEGER,
    company_size_max INTEGER,
    geography TEXT[] DEFAULT '{}',
    technologies TEXT[] DEFAULT '{}',
    pain_points JSONB DEFAULT '[]'::JSONB,
    buying_triggers JSONB DEFAULT '[]'::JSONB,
    disqualifiers JSONB DEFAULT '[]'::JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, icp_name)
);

CREATE TABLE IF NOT EXISTS public.knowledge_base_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    description TEXT,
    features JSONB DEFAULT '[]'::JSONB,
    benefits JSONB DEFAULT '[]'::JSONB,
    positioning TEXT,
    pricing_notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, product_name)
);

CREATE TABLE IF NOT EXISTS public.knowledge_base_competitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    competitor_name TEXT NOT NULL,
    strengths JSONB DEFAULT '[]'::JSONB,
    weaknesses JSONB DEFAULT '[]'::JSONB,
    differentiation TEXT,
    pricing_notes TEXT,
    win_signals JSONB DEFAULT '[]'::JSONB,
    lose_signals JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, competitor_name)
);

CREATE TABLE IF NOT EXISTS public.knowledge_base_personas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    icp_id UUID REFERENCES public.knowledge_base_icps(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    department TEXT,
    seniority TEXT,
    pain_points JSONB DEFAULT '[]'::JSONB,
    priorities JSONB DEFAULT '[]'::JSONB,
    communication_preferences JSONB DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_kb_docs_workspace ON public.knowledge_base_documents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_kb_docs_section ON public.knowledge_base_documents(section_id);
CREATE INDEX IF NOT EXISTS idx_kb_docs_search ON public.knowledge_base_documents USING gin(to_tsvector('english', filename || ' ' || COALESCE(extracted_content, '')));

CREATE INDEX IF NOT EXISTS idx_kb_icps_workspace ON public.knowledge_base_icps(workspace_id);
CREATE INDEX IF NOT EXISTS idx_kb_products_workspace ON public.knowledge_base_products(workspace_id);
CREATE INDEX IF NOT EXISTS idx_kb_competitors_workspace ON public.knowledge_base_competitors(workspace_id);
CREATE INDEX IF NOT EXISTS idx_kb_personas_workspace ON public.knowledge_base_personas(workspace_id);

-- 6. RLS policies for new tables
ALTER TABLE public.knowledge_base_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_icps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "kb_docs_select_scoped" ON public.knowledge_base_documents
FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);

CREATE POLICY IF NOT EXISTS "kb_docs_mutate_scoped" ON public.knowledge_base_documents
FOR ALL TO authenticated USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);

CREATE POLICY IF NOT EXISTS "kb_icps_select_scoped" ON public.knowledge_base_icps
FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);

CREATE POLICY IF NOT EXISTS "kb_icps_mutate_scoped" ON public.knowledge_base_icps
FOR ALL TO authenticated USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);

CREATE POLICY IF NOT EXISTS "kb_products_select_scoped" ON public.knowledge_base_products
FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);

CREATE POLICY IF NOT EXISTS "kb_products_mutate_scoped" ON public.knowledge_base_products
FOR ALL TO authenticated USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);

CREATE POLICY IF NOT EXISTS "kb_competitors_select_scoped" ON public.knowledge_base_competitors
FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);

CREATE POLICY IF NOT EXISTS "kb_competitors_mutate_scoped" ON public.knowledge_base_competitors
FOR ALL TO authenticated USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);

CREATE POLICY IF NOT EXISTS "kb_personas_select_scoped" ON public.knowledge_base_personas
FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);

CREATE POLICY IF NOT EXISTS "kb_personas_mutate_scoped" ON public.knowledge_base_personas
FOR ALL TO authenticated USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);

-- 7. Trigger helpers for structured tables
CREATE TRIGGER IF NOT EXISTS update_kb_documents_updated_at
    BEFORE UPDATE ON public.knowledge_base_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_kb_icps_updated_at
    BEFORE UPDATE ON public.knowledge_base_icps
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_kb_products_updated_at
    BEFORE UPDATE ON public.knowledge_base_products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_kb_competitors_updated_at
    BEFORE UPDATE ON public.knowledge_base_competitors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_kb_personas_updated_at
    BEFORE UPDATE ON public.knowledge_base_personas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
