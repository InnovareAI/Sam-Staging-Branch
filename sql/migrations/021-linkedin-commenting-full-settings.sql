-- Migration: Add comprehensive LinkedIn Commenting Agent settings
-- Date: 2025-11-27
-- Based on full spec for commenting agent settings

-- Add new columns to linkedin_brand_guidelines table
ALTER TABLE linkedin_brand_guidelines
  -- Section 1: Quick Settings (new fields)
  ADD COLUMN IF NOT EXISTS perspective_style VARCHAR(50) DEFAULT 'additive',
  ADD COLUMN IF NOT EXISTS confidence_level VARCHAR(50) DEFAULT 'balanced',
  ADD COLUMN IF NOT EXISTS tone VARCHAR(50) DEFAULT 'professional',
  ADD COLUMN IF NOT EXISTS formality VARCHAR(50) DEFAULT 'semi-formal',
  ADD COLUMN IF NOT EXISTS comment_length VARCHAR(50) DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS question_frequency VARCHAR(50) DEFAULT 'sometimes',
  ADD COLUMN IF NOT EXISTS use_workspace_knowledge BOOLEAN DEFAULT false,

  -- Section 2: Your Expertise
  ADD COLUMN IF NOT EXISTS what_you_do TEXT,
  ADD COLUMN IF NOT EXISTS what_youve_learned TEXT,
  ADD COLUMN IF NOT EXISTS pov_on_future TEXT,
  ADD COLUMN IF NOT EXISTS industry_talking_points TEXT,

  -- Section 3: Brand Voice (some exist, adding new)
  ADD COLUMN IF NOT EXISTS voice_reference TEXT,

  -- Section 4: Vibe Check
  ADD COLUMN IF NOT EXISTS okay_funny BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS okay_blunt BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS casual_openers BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS personal_experience BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS strictly_professional BOOLEAN DEFAULT false,

  -- Section 5: Comment Framework (max_characters exists)
  ADD COLUMN IF NOT EXISTS framework_preset VARCHAR(50) DEFAULT 'aca_i',
  ADD COLUMN IF NOT EXISTS custom_framework TEXT,

  -- Section 6: Example Comments
  ADD COLUMN IF NOT EXISTS example_comments TEXT[],
  ADD COLUMN IF NOT EXISTS admired_comments TEXT[],

  -- Section 7: Relationship & Context
  ADD COLUMN IF NOT EXISTS default_relationship_tag VARCHAR(50) DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS comment_scope VARCHAR(50) DEFAULT 'my_expertise',
  ADD COLUMN IF NOT EXISTS auto_skip_generic BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS post_age_awareness BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS recent_comment_memory BOOLEAN DEFAULT true,

  -- Section 8: Guardrails
  ADD COLUMN IF NOT EXISTS competitors_never_mention TEXT[],
  ADD COLUMN IF NOT EXISTS end_with_cta VARCHAR(50) DEFAULT 'never',
  ADD COLUMN IF NOT EXISTS cta_style VARCHAR(50) DEFAULT 'question_only';

-- Add check constraints for enum-like fields
ALTER TABLE linkedin_brand_guidelines
  DROP CONSTRAINT IF EXISTS valid_perspective_style,
  ADD CONSTRAINT valid_perspective_style
    CHECK (perspective_style IN ('supportive', 'additive', 'thought_provoking'));

ALTER TABLE linkedin_brand_guidelines
  DROP CONSTRAINT IF EXISTS valid_confidence_level,
  ADD CONSTRAINT valid_confidence_level
    CHECK (confidence_level IN ('assertive', 'balanced', 'humble'));

ALTER TABLE linkedin_brand_guidelines
  DROP CONSTRAINT IF EXISTS valid_tone,
  ADD CONSTRAINT valid_tone
    CHECK (tone IN ('professional', 'friendly', 'casual', 'passionate'));

ALTER TABLE linkedin_brand_guidelines
  DROP CONSTRAINT IF EXISTS valid_formality,
  ADD CONSTRAINT valid_formality
    CHECK (formality IN ('formal', 'semi_formal', 'informal'));

ALTER TABLE linkedin_brand_guidelines
  DROP CONSTRAINT IF EXISTS valid_comment_length,
  ADD CONSTRAINT valid_comment_length
    CHECK (comment_length IN ('short', 'medium', 'long'));

ALTER TABLE linkedin_brand_guidelines
  DROP CONSTRAINT IF EXISTS valid_question_frequency,
  ADD CONSTRAINT valid_question_frequency
    CHECK (question_frequency IN ('frequently', 'sometimes', 'rarely', 'never'));

ALTER TABLE linkedin_brand_guidelines
  DROP CONSTRAINT IF EXISTS valid_framework_preset,
  ADD CONSTRAINT valid_framework_preset
    CHECK (framework_preset IN ('aca_i', 'var', 'hook_value_bridge', 'custom'));

ALTER TABLE linkedin_brand_guidelines
  DROP CONSTRAINT IF EXISTS valid_relationship_tag,
  ADD CONSTRAINT valid_relationship_tag
    CHECK (default_relationship_tag IN ('prospect', 'client', 'peer', 'thought_leader', 'unknown'));

ALTER TABLE linkedin_brand_guidelines
  DROP CONSTRAINT IF EXISTS valid_comment_scope,
  ADD CONSTRAINT valid_comment_scope
    CHECK (comment_scope IN ('my_expertise', 'expertise_adjacent', 'anything_relevant'));

ALTER TABLE linkedin_brand_guidelines
  DROP CONSTRAINT IF EXISTS valid_cta_frequency,
  ADD CONSTRAINT valid_cta_frequency
    CHECK (end_with_cta IN ('never', 'occasionally', 'when_relevant'));

ALTER TABLE linkedin_brand_guidelines
  DROP CONSTRAINT IF EXISTS valid_cta_style,
  ADD CONSTRAINT valid_cta_style
    CHECK (cta_style IN ('question_only', 'soft_invitation', 'direct_ask'));

-- Comment on table for documentation
COMMENT ON TABLE linkedin_brand_guidelines IS 'Comprehensive LinkedIn commenting settings per workspace. Includes quick settings, expertise, brand voice, vibe check, frameworks, examples, context, and guardrails.';
