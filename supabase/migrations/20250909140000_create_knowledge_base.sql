-- Create knowledge_base table for persistent SAM AI knowledge storage
CREATE TABLE IF NOT EXISTS public.knowledge_base (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category TEXT NOT NULL, -- 'core', 'conversational-design', 'strategy', 'verticals'
    subcategory TEXT, -- Optional subcategory for organization
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}', -- Array of tags for better searchability
    version TEXT DEFAULT '4.4',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON public.knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_active ON public.knowledge_base(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_knowledge_base_tags ON public.knowledge_base USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_content ON public.knowledge_base USING gin(to_tsvector('english', content));

-- Enable Row Level Security
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- Create policies (for now, allow read access to all, write access to authenticated users)
CREATE POLICY "Knowledge base is readable by everyone"
ON public.knowledge_base FOR SELECT
TO public
USING (is_active = true);

CREATE POLICY "Knowledge base is writable by authenticated users"
ON public.knowledge_base FOR ALL
TO authenticated
USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_knowledge_base_updated_at
    BEFORE UPDATE ON public.knowledge_base
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert initial knowledge base data
INSERT INTO public.knowledge_base (category, title, content, tags) VALUES 
(
    'core',
    'SAM AI Identity & Core Capabilities',
    'SAM is an AI-powered B2B sales assistant that specializes in automated outreach, lead scoring, and personalized messaging. SAM orchestrates 14 specialized agents across enrichment, personalization, outreach, replies, and analytics to deliver comprehensive sales automation.',
    ARRAY['identity', 'core', 'capabilities', 'automation']
),
(
    'core',
    'User Personas Library',
    'Detailed personas for different user types including founders (Growth, fundraising, efficient GTM), sales teams (Pipeline generation, conversion rates), marketers (Brand consistency, multi-channel campaigns), consultants (High-value client acquisition), coaches (Personal connection, steady lead flow), agencies (Scalable results for clients), recruiting (Faster placements, higher-quality pipelines), financial services (Trust, compliance, credibility), legal (Client origination, credibility), pharma (HCP engagement, compliant communications), manufacturing (Supply chain efficiency, market expansion).',
    ARRAY['personas', 'users', 'targeting', 'segmentation']
),
(
    'conversational-design',
    'Conversation Modes',
    'Four main conversation modes: 1) Onboarding - Consultant-style discovery and setup, 2) Product QA - Feature explanations and technical questions, 3) Campaign Management - Active campaign optimization and performance, 4) Repair - Error recovery and troubleshooting conversations.',
    ARRAY['conversation', 'modes', 'onboarding', 'support']
),
(
    'conversational-design',
    'Error Handling Strategies',
    'Comprehensive error scenarios and repair strategies for common conversation breakdowns including misunderstood intents, technical failures, integration issues, and user confusion recovery patterns.',
    ARRAY['error', 'handling', 'recovery', 'troubleshooting']
),
(
    'strategy',
    'Objection Handling',
    'Proven responses to common objections: "We already use Apollo/Sales Nav" → "Great tools for data, but SAM orchestrates 14 agents across enrichment, personalization, outreach, replies, and analytics." "We can hire an SDR" → "SDRs take 3–6 months to ramp. SAM delivers ROI in weeks at 20% of the cost." "AI feels robotic" → "Every message is personalized with context from LinkedIn, websites, and case studies. Feels researched, not robotic." "Compliance concerns" → "SAM includes HITL approvals, pre-approved disclaimers, and vertical-specific compliance libraries."',
    ARRAY['objections', 'responses', 'sales', 'competitive']
),
(
    'verticals',
    'Industry-Specific Messaging',
    'Industry-specific conversation starters and pain points for healthcare (HCP engagement, compliance), finance (trust, credibility, regulations), manufacturing (supply chain, market expansion), legal (client origination, credibility), pharmaceutical (compliant communications, HCP targeting), recruiting (faster placements, quality pipelines), consulting (high-value acquisition), agencies (scalable client results).',
    ARRAY['industry', 'verticals', 'messaging', 'pain-points']
);

-- Create function to search knowledge base
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

COMMENT ON TABLE public.knowledge_base IS 'Stores persistent knowledge base content for SAM AI with search capabilities';