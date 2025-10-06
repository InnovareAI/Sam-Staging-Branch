-- Add company-related fields to workspaces table for website intelligence
-- Allows workspaces to store company information extracted from website during signup

-- 1. Add columns to workspaces table
ALTER TABLE public.workspaces
ADD COLUMN IF NOT EXISTS company_url TEXT,
ADD COLUMN IF NOT EXISTS detected_industry TEXT,
ADD COLUMN IF NOT EXISTS company_description TEXT,
ADD COLUMN IF NOT EXISTS target_personas TEXT[],
ADD COLUMN IF NOT EXISTS pain_points TEXT[],
ADD COLUMN IF NOT EXISTS value_proposition TEXT,
ADD COLUMN IF NOT EXISTS key_competitors TEXT[],
ADD COLUMN IF NOT EXISTS pricing_model TEXT,
ADD COLUMN IF NOT EXISTS website_analysis_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS website_analyzed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS manual_overrides JSONB DEFAULT '{}'::jsonb;

-- 2. Add check constraint for website_analysis_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'workspaces_website_analysis_status_check'
    AND table_name = 'workspaces'
  ) THEN
    ALTER TABLE public.workspaces
    ADD CONSTRAINT workspaces_website_analysis_status_check
    CHECK (website_analysis_status IN ('pending', 'analyzing', 'completed', 'failed'));
  END IF;
END $$;

-- 3. Add index for efficient lookups by company_url and industry
CREATE INDEX IF NOT EXISTS idx_workspaces_company_url ON public.workspaces(company_url);
CREATE INDEX IF NOT EXISTS idx_workspaces_detected_industry ON public.workspaces(detected_industry);
CREATE INDEX IF NOT EXISTS idx_workspaces_analysis_status ON public.workspaces(website_analysis_status);

-- 4. Add comments for documentation
COMMENT ON COLUMN public.workspaces.company_url IS
'Website URL provided during signup, used for AI analysis of company information';

COMMENT ON COLUMN public.workspaces.detected_industry IS
'Industry detected from website analysis, maps to industry blueprints (cybersecurity, saas, fintech, etc.)';

COMMENT ON COLUMN public.workspaces.company_description IS
'AI-extracted description of what the company does (used in SAM context)';

COMMENT ON COLUMN public.workspaces.target_personas IS
'AI-detected target customer personas (e.g., ["CISO", "SOC Manager"])';

COMMENT ON COLUMN public.workspaces.pain_points IS
'Key pain points the company solves (extracted from website)';

COMMENT ON COLUMN public.workspaces.value_proposition IS
'Company value proposition (extracted from website hero/about sections)';

COMMENT ON COLUMN public.workspaces.key_competitors IS
'Competitors mentioned on website (from competitive analysis pages)';

COMMENT ON COLUMN public.workspaces.pricing_model IS
'Pricing model detected (per-seat, tiered, enterprise, freemium, etc.)';

COMMENT ON COLUMN public.workspaces.website_analysis_status IS
'Status of website analysis: pending (not started), analyzing (in progress), completed (success), failed (error)';

COMMENT ON COLUMN public.workspaces.website_analyzed_at IS
'Timestamp when website was last analyzed by AI';

COMMENT ON COLUMN public.workspaces.manual_overrides IS
'Tracks which fields were manually edited by user (JSON object with field names as keys)';
