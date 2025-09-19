-- Enhanced Knowledge Base schema for section-based organization
-- This extends the existing knowledge_base table with structured sections

-- Create knowledge_base_sections table for the UI sections
CREATE TABLE IF NOT EXISTS public.knowledge_base_sections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    section_id TEXT NOT NULL, -- 'icp', 'products', 'competition', etc.
    title TEXT NOT NULL,
    description TEXT,
    icon TEXT, -- Icon name for UI
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workspace_id, section_id)
);

-- Create knowledge_base_content table for section content
CREATE TABLE IF NOT EXISTS public.knowledge_base_content (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    section_id TEXT NOT NULL,
    content_type TEXT NOT NULL, -- 'text', 'document', 'structured_data', 'icp', 'product'
    title TEXT,
    content JSONB NOT NULL, -- Flexible content storage
    metadata JSONB DEFAULT '{}', -- Additional metadata
    tags TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (workspace_id, section_id) REFERENCES public.knowledge_base_sections(workspace_id, section_id) ON DELETE CASCADE
);

-- Create knowledge_base_documents table for file uploads
CREATE TABLE IF NOT EXISTS public.knowledge_base_documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    section_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    storage_path TEXT NOT NULL, -- Path in Supabase storage
    extracted_content TEXT, -- Extracted text content for search
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (workspace_id, section_id) REFERENCES public.knowledge_base_sections(workspace_id, section_id) ON DELETE CASCADE
);

-- Create ICPs table for structured ICP data
CREATE TABLE IF NOT EXISTS public.knowledge_base_icps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    company_size_min INTEGER,
    company_size_max INTEGER,
    industries TEXT[] DEFAULT '{}',
    job_titles TEXT[] DEFAULT '{}',
    locations TEXT[] DEFAULT '{}',
    technologies TEXT[] DEFAULT '{}',
    pain_points TEXT[] DEFAULT '{}',
    qualification_criteria JSONB DEFAULT '{}',
    messaging_framework JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create products table for structured product data
CREATE TABLE IF NOT EXISTS public.knowledge_base_products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    pricing JSONB DEFAULT '{}',
    features TEXT[] DEFAULT '{}',
    benefits TEXT[] DEFAULT '{}',
    use_cases TEXT[] DEFAULT '{}',
    competitive_advantages TEXT[] DEFAULT '{}',
    target_segments TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create competitors table
CREATE TABLE IF NOT EXISTS public.knowledge_base_competitors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    website TEXT,
    description TEXT,
    strengths TEXT[] DEFAULT '{}',
    weaknesses TEXT[] DEFAULT '{}',
    pricing_model TEXT,
    key_features TEXT[] DEFAULT '{}',
    target_market TEXT,
    competitive_positioning JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create personas table
CREATE TABLE IF NOT EXISTS public.knowledge_base_personas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    job_title TEXT,
    department TEXT,
    seniority_level TEXT,
    decision_making_role TEXT,
    pain_points TEXT[] DEFAULT '{}',
    goals TEXT[] DEFAULT '{}',
    communication_preferences JSONB DEFAULT '{}',
    objections TEXT[] DEFAULT '{}',
    messaging_approach JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_kb_sections_workspace ON public.knowledge_base_sections(workspace_id);
CREATE INDEX IF NOT EXISTS idx_kb_sections_active ON public.knowledge_base_sections(workspace_id, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_kb_content_workspace_section ON public.knowledge_base_content(workspace_id, section_id);
CREATE INDEX IF NOT EXISTS idx_kb_content_type ON public.knowledge_base_content(content_type);
CREATE INDEX IF NOT EXISTS idx_kb_content_active ON public.knowledge_base_content(workspace_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_kb_content_search ON public.knowledge_base_content USING gin(to_tsvector('english', title || ' ' || (content->>'text')));
CREATE INDEX IF NOT EXISTS idx_kb_content_tags ON public.knowledge_base_content USING gin(tags);

CREATE INDEX IF NOT EXISTS idx_kb_docs_workspace_section ON public.knowledge_base_documents(workspace_id, section_id);
CREATE INDEX IF NOT EXISTS idx_kb_docs_active ON public.knowledge_base_documents(workspace_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_kb_docs_search ON public.knowledge_base_documents USING gin(to_tsvector('english', filename || ' ' || COALESCE(extracted_content, '')));

CREATE INDEX IF NOT EXISTS idx_kb_icps_workspace ON public.knowledge_base_icps(workspace_id);
CREATE INDEX IF NOT EXISTS idx_kb_icps_active ON public.knowledge_base_icps(workspace_id, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_kb_products_workspace ON public.knowledge_base_products(workspace_id);
CREATE INDEX IF NOT EXISTS idx_kb_products_active ON public.knowledge_base_products(workspace_id, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_kb_competitors_workspace ON public.knowledge_base_competitors(workspace_id);
CREATE INDEX IF NOT EXISTS idx_kb_competitors_active ON public.knowledge_base_competitors(workspace_id, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_kb_personas_workspace ON public.knowledge_base_personas(workspace_id);
CREATE INDEX IF NOT EXISTS idx_kb_personas_active ON public.knowledge_base_personas(workspace_id, is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE public.knowledge_base_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_icps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_personas ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for knowledge_base_sections
CREATE POLICY "KB sections are accessible by workspace members"
ON public.knowledge_base_sections FOR ALL
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM public.user_workspaces 
        WHERE user_id = auth.uid()
    )
);

-- Create RLS policies for knowledge_base_content
CREATE POLICY "KB content is accessible by workspace members"
ON public.knowledge_base_content FOR ALL
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM public.user_workspaces 
        WHERE user_id = auth.uid()
    )
);

-- Create RLS policies for knowledge_base_documents
CREATE POLICY "KB documents are accessible by workspace members"
ON public.knowledge_base_documents FOR ALL
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM public.user_workspaces 
        WHERE user_id = auth.uid()
    )
);

-- Create RLS policies for knowledge_base_icps
CREATE POLICY "KB ICPs are accessible by workspace members"
ON public.knowledge_base_icps FOR ALL
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM public.user_workspaces 
        WHERE user_id = auth.uid()
    )
);

-- Create RLS policies for knowledge_base_products
CREATE POLICY "KB products are accessible by workspace members"
ON public.knowledge_base_products FOR ALL
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM public.user_workspaces 
        WHERE user_id = auth.uid()
    )
);

-- Create RLS policies for knowledge_base_competitors
CREATE POLICY "KB competitors are accessible by workspace members"
ON public.knowledge_base_competitors FOR ALL
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM public.user_workspaces 
        WHERE user_id = auth.uid()
    )
);

-- Create RLS policies for knowledge_base_personas
CREATE POLICY "KB personas are accessible by workspace members"
ON public.knowledge_base_personas FOR ALL
TO authenticated
USING (
    workspace_id IN (
        SELECT workspace_id FROM public.user_workspaces 
        WHERE user_id = auth.uid()
    )
);

-- Create updated_at triggers for all tables
CREATE TRIGGER update_kb_sections_updated_at
    BEFORE UPDATE ON public.knowledge_base_sections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kb_content_updated_at
    BEFORE UPDATE ON public.knowledge_base_content
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kb_documents_updated_at
    BEFORE UPDATE ON public.knowledge_base_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kb_icps_updated_at
    BEFORE UPDATE ON public.knowledge_base_icps
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kb_products_updated_at
    BEFORE UPDATE ON public.knowledge_base_products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kb_competitors_updated_at
    BEFORE UPDATE ON public.knowledge_base_competitors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kb_personas_updated_at
    BEFORE UPDATE ON public.knowledge_base_personas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to initialize default KB sections for a workspace
CREATE OR REPLACE FUNCTION initialize_knowledge_base_sections(p_workspace_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.knowledge_base_sections (workspace_id, section_id, title, description, icon, sort_order) VALUES
    (p_workspace_id, 'overview', 'Overview', 'Company overview, mission, and core value propositions', 'Building2', 1),
    (p_workspace_id, 'icp', 'ICP Config', 'Define your ideal customer profiles with detailed targeting criteria', 'Target', 2),
    (p_workspace_id, 'products', 'Products', 'Upload comprehensive product documentation and specifications', 'Package', 3),
    (p_workspace_id, 'competition', 'Competition', 'Track competitors and your competitive positioning', 'Zap', 4),
    (p_workspace_id, 'messaging', 'Messaging', 'Configure communication templates and messaging frameworks', 'MessageSquare', 5),
    (p_workspace_id, 'tone', 'Tone of Voice', 'Define your brand voice and communication style', 'Volume2', 6),
    (p_workspace_id, 'company', 'Company Info', 'Team information, company culture, and organizational details', 'Users', 7),
    (p_workspace_id, 'stories', 'Success Stories', 'Customer case studies and success metrics', 'Trophy', 8),
    (p_workspace_id, 'process', 'Buying Process', 'Sales process, stages, and qualification criteria', 'GitBranch', 9),
    (p_workspace_id, 'compliance', 'Compliance', 'Industry regulations and compliance requirements', 'Shield', 10),
    (p_workspace_id, 'personas', 'Personas & Roles', 'Buyer personas and decision-maker profiles', 'UserCheck', 11),
    (p_workspace_id, 'objections', 'Objections', 'Common objections and proven response strategies', 'HelpCircle', 12),
    (p_workspace_id, 'pricing', 'Pricing', 'Pricing models, packages, and value propositions', 'DollarSign', 13),
    (p_workspace_id, 'metrics', 'Success Metrics', 'KPIs, success metrics, and ROI calculations', 'TrendingUp', 14),
    (p_workspace_id, 'documents', 'Documents', 'Upload and organize supporting documents', 'FileText', 15)
    ON CONFLICT (workspace_id, section_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Function to search across all KB content
CREATE OR REPLACE FUNCTION search_knowledge_base_sections(
    p_workspace_id UUID,
    p_search_query TEXT,
    p_section_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
    section_id TEXT,
    content_type TEXT,
    title TEXT,
    content_snippet TEXT,
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    WITH search_results AS (
        -- Search in content
        SELECT 
            kbc.section_id,
            kbc.content_type,
            COALESCE(kbc.title, 'Content') as title,
            CASE 
                WHEN kbc.content_type = 'text' THEN LEFT(kbc.content->>'text', 200) || '...'
                WHEN kbc.content_type = 'structured_data' THEN LEFT(kbc.content->>'description', 200) || '...'
                ELSE 'Structured content'
            END as content_snippet,
            ts_rank(
                to_tsvector('english', COALESCE(kbc.title, '') || ' ' || COALESCE(kbc.content->>'text', '') || ' ' || COALESCE(kbc.content->>'description', '')),
                plainto_tsquery('english', p_search_query)
            ) as rank
        FROM public.knowledge_base_content kbc
        WHERE kbc.workspace_id = p_workspace_id
            AND kbc.is_active = true
            AND (p_section_filter IS NULL OR kbc.section_id = p_section_filter)
            AND (
                to_tsvector('english', COALESCE(kbc.title, '') || ' ' || COALESCE(kbc.content->>'text', '') || ' ' || COALESCE(kbc.content->>'description', '')) 
                @@ plainto_tsquery('english', p_search_query)
                OR kbc.tags && string_to_array(lower(p_search_query), ' ')
            )
        
        UNION ALL
        
        -- Search in documents
        SELECT 
            kbd.section_id,
            'document' as content_type,
            kbd.original_filename as title,
            LEFT(COALESCE(kbd.extracted_content, 'Document content'), 200) || '...' as content_snippet,
            ts_rank(
                to_tsvector('english', kbd.original_filename || ' ' || COALESCE(kbd.extracted_content, '')),
                plainto_tsquery('english', p_search_query)
            ) as rank
        FROM public.knowledge_base_documents kbd
        WHERE kbd.workspace_id = p_workspace_id
            AND kbd.is_active = true
            AND (p_section_filter IS NULL OR kbd.section_id = p_section_filter)
            AND to_tsvector('english', kbd.original_filename || ' ' || COALESCE(kbd.extracted_content, '')) 
                @@ plainto_tsquery('english', p_search_query)
    )
    SELECT sr.section_id, sr.content_type, sr.title, sr.content_snippet, sr.rank
    FROM search_results sr
    WHERE sr.rank > 0
    ORDER BY sr.rank DESC, sr.title;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE public.knowledge_base_sections IS 'Defines the structure and organization of knowledge base sections for each workspace';
COMMENT ON TABLE public.knowledge_base_content IS 'Stores flexible content for knowledge base sections using JSONB for structured data';
COMMENT ON TABLE public.knowledge_base_documents IS 'Stores uploaded documents and files for knowledge base sections';
COMMENT ON TABLE public.knowledge_base_icps IS 'Stores structured ideal customer profile data';
COMMENT ON TABLE public.knowledge_base_products IS 'Stores structured product information';
COMMENT ON TABLE public.knowledge_base_competitors IS 'Stores competitor analysis and positioning data';
COMMENT ON TABLE public.knowledge_base_personas IS 'Stores buyer persona and decision-maker profiles';