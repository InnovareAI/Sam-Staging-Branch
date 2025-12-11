-- Migration: Create AI Search Agent tables
-- Date: December 11, 2025
-- Purpose: Store website SEO/GEO analysis configurations and results

-- ============================================
-- Table 1: AI Search Agent Configuration (per workspace)
-- ============================================
CREATE TABLE IF NOT EXISTS public.workspace_ai_search_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

  -- Agent settings
  enabled BOOLEAN DEFAULT true,
  auto_analyze_prospects BOOLEAN DEFAULT false, -- Auto-analyze prospect company websites
  analysis_depth VARCHAR(20) DEFAULT 'standard' CHECK (analysis_depth IN ('quick', 'standard', 'comprehensive')),

  -- SEO Analysis settings
  check_meta_tags BOOLEAN DEFAULT true,
  check_structured_data BOOLEAN DEFAULT true,
  check_robots_txt BOOLEAN DEFAULT true,
  check_sitemap BOOLEAN DEFAULT true,
  check_page_speed BOOLEAN DEFAULT false, -- Requires external API

  -- GEO (Generative Engine Optimization) settings
  check_llm_readability BOOLEAN DEFAULT true,
  check_entity_clarity BOOLEAN DEFAULT true,
  check_fact_density BOOLEAN DEFAULT true,
  check_citation_readiness BOOLEAN DEFAULT true,

  -- Notification settings
  send_analysis_reports BOOLEAN DEFAULT true,
  report_email VARCHAR(255),

  -- AI model configuration
  ai_model VARCHAR(100) DEFAULT 'claude-3-5-sonnet',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one config per workspace
  UNIQUE(workspace_id)
);

-- ============================================
-- Table 2: Website Analysis Results
-- ============================================
CREATE TABLE IF NOT EXISTS public.website_analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

  -- Website info
  website_url TEXT NOT NULL,
  domain VARCHAR(255) NOT NULL,
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Analysis status
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'completed', 'failed', 'expired')),
  error_message TEXT,

  -- Overall scores (0-100)
  seo_score INTEGER CHECK (seo_score >= 0 AND seo_score <= 100),
  geo_score INTEGER CHECK (geo_score >= 0 AND geo_score <= 100),
  overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),

  -- SEO Analysis Results (JSONB for flexibility)
  seo_results JSONB DEFAULT '{}'::jsonb,
  -- Expected structure:
  -- {
  --   "meta_tags": { "title": "...", "description": "...", "score": 80, "issues": [] },
  --   "structured_data": { "types_found": [], "score": 60, "issues": [] },
  --   "robots_txt": { "exists": true, "allows_crawling": true, "score": 100 },
  --   "sitemap": { "exists": true, "pages_count": 50, "score": 90 },
  --   "page_speed": { "lcp": 2.5, "fid": 100, "cls": 0.1, "score": 75 },
  --   "technical_issues": []
  -- }

  -- GEO Analysis Results (JSONB for flexibility)
  geo_results JSONB DEFAULT '{}'::jsonb,
  -- Expected structure:
  -- {
  --   "llm_readability": { "score": 70, "issues": [], "suggestions": [] },
  --   "entity_clarity": { "entities_found": [], "score": 65, "issues": [] },
  --   "fact_density": { "facts_per_page": 5, "score": 80, "suggestions": [] },
  --   "citation_readiness": { "citable_content": true, "score": 85, "issues": [] },
  --   "ai_summary": "Website is moderately optimized for AI engines..."
  -- }

  -- AI-generated recommendations
  recommendations JSONB DEFAULT '[]'::jsonb,
  -- Expected structure:
  -- [
  --   { "priority": "high", "category": "seo", "title": "...", "description": "...", "implementation_steps": [] },
  --   { "priority": "medium", "category": "geo", "title": "...", "description": "...", "implementation_steps": [] }
  -- ]

  -- Executive summary (AI-generated)
  executive_summary TEXT,

  -- Raw data for debugging
  raw_html_hash VARCHAR(64), -- SHA-256 of the fetched HTML (to detect changes)
  fetch_duration_ms INTEGER,
  analysis_duration_ms INTEGER,

  -- Optional: Link to prospect if analyzed for a specific prospect
  prospect_id UUID REFERENCES public.campaign_prospects(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days') -- Results expire after 30 days
);

-- ============================================
-- Table 3: Analysis Queue (for async processing)
-- ============================================
CREATE TABLE IF NOT EXISTS public.website_analysis_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

  -- Request info
  website_url TEXT NOT NULL,
  analysis_depth VARCHAR(20) DEFAULT 'standard',
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10), -- 1 = highest

  -- Status tracking
  status VARCHAR(30) DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,

  -- Processing info
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  result_id UUID REFERENCES public.website_analysis_results(id) ON DELETE SET NULL,

  -- Optional: Link to prospect
  prospect_id UUID REFERENCES public.campaign_prospects(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  scheduled_for TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_website_analysis_results_workspace
  ON public.website_analysis_results(workspace_id);

CREATE INDEX IF NOT EXISTS idx_website_analysis_results_domain
  ON public.website_analysis_results(domain);

CREATE INDEX IF NOT EXISTS idx_website_analysis_results_status
  ON public.website_analysis_results(status);

CREATE INDEX IF NOT EXISTS idx_website_analysis_results_prospect
  ON public.website_analysis_results(prospect_id)
  WHERE prospect_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_website_analysis_queue_status
  ON public.website_analysis_queue(status, scheduled_for);

CREATE INDEX IF NOT EXISTS idx_website_analysis_queue_workspace
  ON public.website_analysis_queue(workspace_id);

-- ============================================
-- RLS Policies (Row Level Security)
-- ============================================

-- Enable RLS
ALTER TABLE public.workspace_ai_search_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_analysis_queue ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their workspace's config
CREATE POLICY "Users can view own workspace AI search config"
  ON public.workspace_ai_search_config
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own workspace AI search config"
  ON public.workspace_ai_search_config
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own workspace AI search config"
  ON public.workspace_ai_search_config
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can only access their workspace's analysis results
CREATE POLICY "Users can view own workspace analysis results"
  ON public.website_analysis_results
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own workspace analysis results"
  ON public.website_analysis_results
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own workspace analysis results"
  ON public.website_analysis_results
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Users can only access their workspace's queue
CREATE POLICY "Users can view own workspace analysis queue"
  ON public.website_analysis_queue
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert into own workspace analysis queue"
  ON public.website_analysis_queue
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own workspace analysis queue"
  ON public.website_analysis_queue
  FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete from own workspace analysis queue"
  ON public.website_analysis_queue
  FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- Updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workspace_ai_search_config_updated_at
  BEFORE UPDATE ON public.workspace_ai_search_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_website_analysis_results_updated_at
  BEFORE UPDATE ON public.website_analysis_results
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Comments for documentation
-- ============================================
COMMENT ON TABLE public.workspace_ai_search_config IS 'Per-workspace configuration for the AI Search Agent (SEO/GEO analysis)';
COMMENT ON TABLE public.website_analysis_results IS 'Stores SEO and GEO analysis results for websites';
COMMENT ON TABLE public.website_analysis_queue IS 'Queue for async website analysis processing';

COMMENT ON COLUMN public.website_analysis_results.geo_score IS 'GEO = Generative Engine Optimization - how well the website is optimized for AI/LLM consumption';
COMMENT ON COLUMN public.website_analysis_results.geo_results IS 'Detailed GEO analysis including LLM readability, entity clarity, fact density, and citation readiness';
