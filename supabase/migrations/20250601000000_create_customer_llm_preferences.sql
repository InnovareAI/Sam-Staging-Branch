-- Create customer_llm_preferences table for BYOK and model selection
-- Migration: 20250601000000_create_customer_llm_preferences.sql

-- Drop table if exists (for clean migration)
DROP TABLE IF EXISTS public.customer_llm_preferences CASCADE;

-- Create customer LLM preferences table
CREATE TABLE public.customer_llm_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Plan tier determines available features
  plan_tier VARCHAR(50) NOT NULL DEFAULT 'standard',
  -- Options: 'standard', 'premium', 'enterprise'
  
  -- Model Selection (null = use platform default)
  selected_model VARCHAR(150),
  -- Examples: 'anthropic/claude-sonnet-4.5', 'mistralai/mistral-large', 'custom/enterprise-llm'
  
  -- Model Configuration
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 1000,
  
  -- EU Compliance
  prefer_eu_models BOOLEAN DEFAULT false,
  -- When true, only show EU-hosted models in selection
  
  -- Enterprise BYOK (Bring Your Own OpenRouter Key)
  use_own_openrouter_key BOOLEAN DEFAULT false,
  openrouter_api_key_encrypted TEXT,
  -- Only populated for Enterprise tier with BYOK
  
  -- Enterprise Custom LLM Endpoint
  use_custom_endpoint BOOLEAN DEFAULT false,
  custom_endpoint_config JSONB,
  /* Example custom_endpoint_config:
  {
    "provider": "azure-openai",
    "endpoint": "https://customer-corp.openai.azure.com",
    "api_key_encrypted": "...",
    "deployment_name": "gpt-4o-deployment",
    "api_version": "2024-02-15",
    "model": "gpt-4o"
  }
  */
  
  -- Usage Tracking (for reporting)
  total_tokens_used BIGINT DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  
  -- Metadata
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_customer_llm_prefs_user_id ON public.customer_llm_preferences(user_id);
CREATE INDEX idx_customer_llm_prefs_plan_tier ON public.customer_llm_preferences(plan_tier);
CREATE INDEX idx_customer_llm_prefs_enabled ON public.customer_llm_preferences(enabled);

-- Create unique constraint (one preference per user)
CREATE UNIQUE INDEX idx_customer_llm_prefs_user_unique ON public.customer_llm_preferences(user_id);

-- Add Row Level Security (RLS)
ALTER TABLE public.customer_llm_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own preferences
CREATE POLICY "Users can read own LLM preferences"
  ON public.customer_llm_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own preferences
CREATE POLICY "Users can insert own LLM preferences"
  ON public.customer_llm_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own preferences
CREATE POLICY "Users can update own LLM preferences"
  ON public.customer_llm_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own preferences
CREATE POLICY "Users can delete own LLM preferences"
  ON public.customer_llm_preferences
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_customer_llm_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_customer_llm_preferences_updated_at
  BEFORE UPDATE ON public.customer_llm_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_customer_llm_preferences_updated_at();

-- Add helpful comments
COMMENT ON TABLE public.customer_llm_preferences IS 'Stores customer LLM model preferences and BYOK configurations';
COMMENT ON COLUMN public.customer_llm_preferences.selected_model IS 'OpenRouter model ID or custom/enterprise-llm for custom endpoint';
COMMENT ON COLUMN public.customer_llm_preferences.use_own_openrouter_key IS 'Enterprise tier: customer provides their own OpenRouter API key';
COMMENT ON COLUMN public.customer_llm_preferences.use_custom_endpoint IS 'Enterprise tier: customer provides custom LLM endpoint (Azure, AWS, self-hosted)';
COMMENT ON COLUMN public.customer_llm_preferences.prefer_eu_models IS 'Filter model list to show only EU-hosted options (Mistral, Cohere EU)';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_llm_preferences TO authenticated;
GRANT USAGE ON SEQUENCE customer_llm_preferences_id_seq TO authenticated;
