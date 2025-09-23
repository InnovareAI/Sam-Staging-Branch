-- Direct Knowledge Base Creation (bypassing workspace conflicts)
-- Creates only knowledge base tables without workspace dependencies

-- 1. Core knowledge base table (global, not workspace-specific)
CREATE TABLE IF NOT EXISTS public.knowledge_base (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category TEXT NOT NULL,
    subcategory TEXT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    version TEXT DEFAULT '4.4',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Knowledge base sections (simplified, no workspace dependency initially)
CREATE TABLE IF NOT EXISTS public.knowledge_base_sections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    section_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Knowledge base content (simplified structure)
CREATE TABLE IF NOT EXISTS public.knowledge_base_content (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    section_id TEXT NOT NULL,
    content_type TEXT NOT NULL,
    title TEXT,
    content JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. ICP configurations (global initially)
CREATE TABLE IF NOT EXISTS public.icp_configurations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    market_niche TEXT NOT NULL,
    industry_vertical TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'testing', 'archived', 'draft')),
    priority TEXT DEFAULT 'secondary' CHECK (priority IN ('primary', 'secondary', 'experimental')),
    target_profile JSONB NOT NULL DEFAULT '{}',
    decision_makers JSONB NOT NULL DEFAULT '{}',
    pain_points JSONB NOT NULL DEFAULT '{}',
    buying_process JSONB NOT NULL DEFAULT '{}',
    messaging_strategy JSONB NOT NULL DEFAULT '{}',
    success_metrics JSONB NOT NULL DEFAULT '{}',
    advanced_classification JSONB NOT NULL DEFAULT '{}',
    market_intelligence JSONB NOT NULL DEFAULT '{}',
    performance_metrics JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    complexity_level TEXT DEFAULT 'medium' CHECK (complexity_level IN ('simple', 'medium', 'complex')),
    is_active BOOLEAN DEFAULT TRUE,
    is_template BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    version TEXT DEFAULT '1.0'
);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON public.knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_active ON public.knowledge_base(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_knowledge_base_tags ON public.knowledge_base USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_content_search ON public.knowledge_base USING gin(to_tsvector('english', content));

CREATE INDEX IF NOT EXISTS idx_kb_sections_active ON public.knowledge_base_sections(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_kb_sections_sort ON public.knowledge_base_sections(sort_order);

CREATE INDEX IF NOT EXISTS idx_kb_content_section ON public.knowledge_base_content(section_id);
CREATE INDEX IF NOT EXISTS idx_kb_content_type ON public.knowledge_base_content(content_type);
CREATE INDEX IF NOT EXISTS idx_kb_content_active ON public.knowledge_base_content(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_kb_content_tags ON public.knowledge_base_content USING gin(tags);

CREATE INDEX IF NOT EXISTS idx_icp_configs_active ON public.icp_configurations(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_icp_configs_status ON public.icp_configurations(status);
CREATE INDEX IF NOT EXISTS idx_icp_configs_industry ON public.icp_configurations(industry_vertical);
CREATE INDEX IF NOT EXISTS idx_icp_configs_tags ON public.icp_configurations USING gin(tags);

-- 6. Enable Row Level Security
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.icp_configurations ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policies (permissive for now, can be tightened later)
CREATE POLICY "Knowledge base is readable by all" ON public.knowledge_base
FOR SELECT USING (is_active = true);

CREATE POLICY "Knowledge base is writable by authenticated users" ON public.knowledge_base
FOR ALL TO authenticated USING (true);

CREATE POLICY "KB sections readable by all" ON public.knowledge_base_sections
FOR SELECT USING (is_active = true);

CREATE POLICY "KB sections writable by authenticated" ON public.knowledge_base_sections
FOR ALL TO authenticated USING (true);

CREATE POLICY "KB content readable by all" ON public.knowledge_base_content
FOR SELECT USING (is_active = true);

CREATE POLICY "KB content writable by authenticated" ON public.knowledge_base_content
FOR ALL TO authenticated USING (true);

CREATE POLICY "ICP configs readable by all" ON public.icp_configurations
FOR SELECT USING (is_active = true);

CREATE POLICY "ICP configs writable by authenticated" ON public.icp_configurations
FOR ALL TO authenticated USING (true);

-- 8. Create update triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_knowledge_base_updated_at
    BEFORE UPDATE ON public.knowledge_base
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kb_sections_updated_at
    BEFORE UPDATE ON public.knowledge_base_sections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kb_content_updated_at
    BEFORE UPDATE ON public.knowledge_base_content
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_icp_configurations_updated_at
    BEFORE UPDATE ON public.icp_configurations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 9. Insert initial knowledge base sections
INSERT INTO public.knowledge_base_sections (section_id, title, description, icon, sort_order) VALUES
('core', 'Core Knowledge', 'SAM AI identity, capabilities, and core knowledge', 'Brain', 1),
('conversational-design', 'Conversational Design', 'Conversation modes, error handling, and design patterns', 'MessageSquare', 2),
('strategy', 'Strategy & Sales', 'Objection handling, case studies, and sales strategies', 'Target', 3),
('verticals', 'Industry Verticals', 'Industry-specific messaging and approaches', 'Building2', 4),
('icp-management', 'ICP Management', 'Ideal customer profile configurations and targeting', 'Users', 5),
('campaign-integration', 'Campaign Integration', 'N8N workflows, HITL approval, and campaign systems', 'Workflow', 6),
('market-intelligence', 'Market Intelligence', 'Competitive analysis and market monitoring', 'TrendingUp', 7),
('technical', 'Technical Implementation', 'API specifications, integrations, and technical docs', 'Code', 8)
ON CONFLICT (section_id) DO NOTHING;

-- 10. Insert sample knowledge base content
INSERT INTO public.knowledge_base (category, title, content, tags) VALUES 
(
    'core',
    'SAM AI Identity & Core Capabilities',
    'SAM is an AI-powered B2B sales assistant that specializes in automated outreach, lead scoring, and personalized messaging. SAM orchestrates 14 specialized agents across enrichment, personalization, outreach, replies, and analytics to deliver comprehensive sales automation.',
    ARRAY['identity', 'core', 'capabilities', 'automation']
),
(
    'core',
    'Knowledge Base Recovery Complete',
    'The SAM AI knowledge base has been successfully restored after database migration issues. All core tables recreated with improved schema design.',
    ARRAY['recovery', 'system', 'migration', 'restore']
)
ON CONFLICT DO NOTHING;

-- 11. Create search function
CREATE OR REPLACE FUNCTION search_knowledge_base(search_query TEXT, category_filter TEXT DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    category TEXT,
    title TEXT,
    content TEXT,
    tags TEXT[],
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        kb.id,
        kb.category,
        kb.title,
        kb.content,
        kb.tags,
        ts_rank(to_tsvector('english', kb.content || ' ' || kb.title), plainto_tsquery('english', search_query)) as rank
    FROM public.knowledge_base kb
    WHERE kb.is_active = true
        AND (category_filter IS NULL OR kb.category = category_filter)
        AND (
            to_tsvector('english', kb.content || ' ' || kb.title) @@ plainto_tsquery('english', search_query)
            OR kb.tags && string_to_array(lower(search_query), ' ')
        )
    ORDER BY rank DESC, kb.created_at DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE public.knowledge_base IS 'Core SAM AI knowledge base with search capabilities';
COMMENT ON TABLE public.knowledge_base_sections IS 'Knowledge base section organization';
COMMENT ON TABLE public.knowledge_base_content IS 'Flexible JSONB content storage for knowledge base';
COMMENT ON TABLE public.icp_configurations IS 'Comprehensive ICP targeting configurations';