-- Migration: Create Inbox Agent tables
-- Date: December 11, 2025
-- Purpose: Store inbox agent configuration and message categorization

-- ============================================
-- Table 1: Inbox Agent Configuration (per workspace)
-- ============================================
CREATE TABLE IF NOT EXISTS public.workspace_inbox_agent_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

  -- Agent settings
  enabled BOOLEAN DEFAULT false,

  -- Categorization settings
  categorization_enabled BOOLEAN DEFAULT true,
  auto_categorize_new_messages BOOLEAN DEFAULT true,

  -- Response suggestion settings
  response_suggestions_enabled BOOLEAN DEFAULT true,
  suggest_for_categories TEXT[] DEFAULT ARRAY['interested', 'question', 'objection'],

  -- Auto-tagging settings
  auto_tagging_enabled BOOLEAN DEFAULT false,

  -- AI model configuration
  ai_model VARCHAR(100) DEFAULT 'claude-3-5-sonnet',

  -- Custom instructions for categorization
  categorization_instructions TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one config per workspace
  UNIQUE(workspace_id)
);

-- ============================================
-- Table 2: Message Categories (predefined + custom)
-- ============================================
CREATE TABLE IF NOT EXISTS public.inbox_message_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,

  -- Category info
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#6b7280', -- Hex color for UI
  icon VARCHAR(50), -- Lucide icon name

  -- System vs custom
  is_system BOOLEAN DEFAULT false, -- true = built-in, can't delete
  is_active BOOLEAN DEFAULT true,

  -- Suggested action when message falls into this category
  suggested_action VARCHAR(50) CHECK (suggested_action IN ('reply', 'archive', 'escalate', 'ignore', 'follow_up')),

  -- Priority for display order
  display_order INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique category per workspace (or global for system categories)
  UNIQUE(workspace_id, slug)
);

-- ============================================
-- Table 3: Message Categorization History
-- ============================================
CREATE TABLE IF NOT EXISTS public.inbox_message_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

  -- Message reference (from Unipile or email provider)
  message_id TEXT NOT NULL,
  message_source VARCHAR(20) NOT NULL CHECK (message_source IN ('linkedin', 'email', 'gmail', 'outlook')),

  -- Categorization
  category_id UUID REFERENCES public.inbox_message_categories(id) ON DELETE SET NULL,
  detected_intent VARCHAR(50),

  -- AI analysis
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  ai_reasoning TEXT,
  ai_model VARCHAR(100),

  -- Manual override
  is_manual_override BOOLEAN DEFAULT false,
  overridden_by UUID REFERENCES auth.users(id),
  overridden_at TIMESTAMPTZ,

  -- Response suggestion (if enabled)
  suggested_response TEXT,
  response_used BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- One categorization per message
  UNIQUE(workspace_id, message_id, message_source)
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_inbox_message_tags_workspace
  ON public.inbox_message_tags(workspace_id);

CREATE INDEX IF NOT EXISTS idx_inbox_message_tags_category
  ON public.inbox_message_tags(category_id);

CREATE INDEX IF NOT EXISTS idx_inbox_message_tags_intent
  ON public.inbox_message_tags(detected_intent);

CREATE INDEX IF NOT EXISTS idx_inbox_message_tags_created
  ON public.inbox_message_tags(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inbox_message_categories_workspace
  ON public.inbox_message_categories(workspace_id);

-- ============================================
-- Enable RLS
-- ============================================
ALTER TABLE public.workspace_inbox_agent_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_message_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_message_tags ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies - Config
-- ============================================
CREATE POLICY "Users can view own workspace inbox agent config"
  ON public.workspace_inbox_agent_config FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own workspace inbox agent config"
  ON public.workspace_inbox_agent_config FOR UPDATE
  USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own workspace inbox agent config"
  ON public.workspace_inbox_agent_config FOR INSERT
  WITH CHECK (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

-- ============================================
-- RLS Policies - Categories
-- ============================================
CREATE POLICY "Users can view categories for their workspace or system categories"
  ON public.inbox_message_categories FOR SELECT
  USING (
    is_system = true
    OR workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage own workspace categories"
  ON public.inbox_message_categories FOR ALL
  USING (
    is_system = false
    AND workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
  );

-- ============================================
-- RLS Policies - Tags
-- ============================================
CREATE POLICY "Users can view own workspace message tags"
  ON public.inbox_message_tags FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage own workspace message tags"
  ON public.inbox_message_tags FOR ALL
  USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));

-- ============================================
-- Updated_at trigger
-- ============================================
CREATE TRIGGER update_workspace_inbox_agent_config_updated_at
  BEFORE UPDATE ON public.workspace_inbox_agent_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Insert System Categories (default categories for all workspaces)
-- ============================================
INSERT INTO public.inbox_message_categories (id, workspace_id, name, slug, description, color, icon, is_system, suggested_action, display_order)
VALUES
  (gen_random_uuid(), NULL, 'Interested', 'interested', 'Prospect shows interest in your product/service', '#22c55e', 'ThumbsUp', true, 'reply', 1),
  (gen_random_uuid(), NULL, 'Question', 'question', 'Prospect has a question that needs answering', '#3b82f6', 'HelpCircle', true, 'reply', 2),
  (gen_random_uuid(), NULL, 'Objection', 'objection', 'Prospect raises concerns or objections', '#f59e0b', 'AlertTriangle', true, 'reply', 3),
  (gen_random_uuid(), NULL, 'Meeting Request', 'meeting_request', 'Prospect wants to schedule a meeting', '#8b5cf6', 'Calendar', true, 'reply', 4),
  (gen_random_uuid(), NULL, 'Not Interested', 'not_interested', 'Prospect explicitly declines', '#ef4444', 'XCircle', true, 'archive', 5),
  (gen_random_uuid(), NULL, 'Out of Office', 'out_of_office', 'Auto-reply or vacation message', '#6b7280', 'Clock', true, 'follow_up', 6),
  (gen_random_uuid(), NULL, 'Referral', 'referral', 'Prospect refers you to someone else', '#06b6d4', 'Users', true, 'reply', 7),
  (gen_random_uuid(), NULL, 'Follow Up', 'follow_up', 'Generic follow-up needed', '#f97316', 'ArrowRight', true, 'follow_up', 8),
  (gen_random_uuid(), NULL, 'Spam/Irrelevant', 'spam', 'Spam or irrelevant message', '#9ca3af', 'Trash2', true, 'ignore', 9),
  (gen_random_uuid(), NULL, 'Uncategorized', 'uncategorized', 'Message needs manual review', '#d1d5db', 'Inbox', true, 'reply', 10)
ON CONFLICT DO NOTHING;

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE public.workspace_inbox_agent_config IS 'Per-workspace configuration for the Inbox Agent (message categorization)';
COMMENT ON TABLE public.inbox_message_categories IS 'Message categories - both system-defined and workspace-custom';
COMMENT ON TABLE public.inbox_message_tags IS 'Categorization history for messages with AI-detected intents';
