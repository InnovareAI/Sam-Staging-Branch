-- Migration: Create insight tracking tables and semantic search RPCs
-- This supports the automated conversation insight extraction and de-duplication systems.
-- 1. Conversation Insights (Main tracking table)
-- Referenced to sam_conversation_threads as sam_conversations is legacy/missing
CREATE TABLE IF NOT EXISTS public.conversation_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.sam_conversation_threads(id) ON DELETE CASCADE,
    user_id UUID,
    insights JSONB NOT NULL,
    trigger_type TEXT DEFAULT 'manual',
    status TEXT DEFAULT 'pending_review',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
-- 2. KB Notifications
CREATE TABLE IF NOT EXISTS public.kb_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    data JSONB,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);
-- 3. Competitive Intelligence
CREATE TABLE IF NOT EXISTS public.competitive_intelligence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competitor_name TEXT UNIQUE NOT NULL,
    first_mentioned TIMESTAMPTZ DEFAULT now(),
    last_mentioned TIMESTAMPTZ DEFAULT now(),
    mention_context TEXT,
    positioning_notes TEXT,
    source TEXT,
    status TEXT DEFAULT 'auto_detected',
    embedding VECTOR(768),
    created_at TIMESTAMPTZ DEFAULT now()
);
-- 4. Customer Insight Patterns (Clustering/Deduplication)
CREATE TABLE IF NOT EXISTS public.customer_insight_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    insight_type TEXT NOT NULL,
    description TEXT NOT NULL,
    frequency_score INTEGER DEFAULT 1,
    business_impact TEXT DEFAULT 'medium',
    last_seen TIMESTAMPTZ DEFAULT now(),
    source_conversations UUID [] DEFAULT '{}',
    embedding VECTOR(768),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(insight_type, description)
);
-- 5. Knowledge Gap Tracking
CREATE TABLE IF NOT EXISTS public.knowledge_gap_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    missing_info TEXT NOT NULL,
    impact_level TEXT DEFAULT 'medium',
    suggested_section TEXT,
    source_conversation UUID,
    insight_id UUID REFERENCES public.conversation_insights(id) ON DELETE
    SET NULL,
        status TEXT DEFAULT 'open',
        embedding VECTOR(768),
        created_at TIMESTAMPTZ DEFAULT now()
);
-- 6. RPC: Match Knowledge Gaps
CREATE OR REPLACE FUNCTION public.match_knowledge_gaps(
        p_query_embedding VECTOR(768),
        p_match_threshold FLOAT,
        p_match_count INTEGER
    ) RETURNS TABLE (
        id UUID,
        category TEXT,
        missing_info TEXT,
        impact_level TEXT,
        status TEXT,
        similarity DOUBLE PRECISION
    ) AS $$ BEGIN RETURN QUERY
SELECT g.id,
    g.category,
    g.missing_info,
    g.impact_level,
    g.status,
    1 - (g.embedding <=> p_query_embedding) AS similarity
FROM public.knowledge_gap_tracking g
WHERE 1 - (g.embedding <=> p_query_embedding) >= p_match_threshold
ORDER BY g.embedding <->p_query_embedding
LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql STABLE;
-- 7. RPC: Match Customer Insights
CREATE OR REPLACE FUNCTION public.match_customer_insights(
        p_query_embedding VECTOR(768),
        p_match_threshold FLOAT,
        p_match_count INTEGER
    ) RETURNS TABLE (
        id UUID,
        insight_type TEXT,
        description TEXT,
        frequency_score INTEGER,
        similarity DOUBLE PRECISION
    ) AS $$ BEGIN RETURN QUERY
SELECT i.id,
    i.insight_type,
    i.description,
    i.frequency_score,
    1 - (i.embedding <=> p_query_embedding) AS similarity
FROM public.customer_insight_patterns i
WHERE 1 - (i.embedding <=> p_query_embedding) >= p_match_threshold
ORDER BY i.embedding <->p_query_embedding
LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql STABLE;
-- 8. Add Indexes
CREATE INDEX IF NOT EXISTS idx_kg_embedding ON public.knowledge_gap_tracking USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
CREATE INDEX IF NOT EXISTS idx_cip_embedding ON public.customer_insight_patterns USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
CREATE INDEX IF NOT EXISTS idx_ci_embedding ON public.competitive_intelligence USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);