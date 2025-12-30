-- Migration: Add VIP/Priority Profiles to Commenting Agent
-- Date: 2025-12-30
-- Purpose: Allow users to define priority profiles that get special treatment in comments
--
-- Use cases:
-- - Partners/associates: Warmer, more personal tone
-- - Clients: Professional but friendly
-- - Friends: Very casual and personal
-- - Important prospects: Extra thoughtful engagement
--
-- The AI will adjust its commenting style when the post author matches a priority profile.

-- Add priority_profiles column to linkedin_brand_guidelines
ALTER TABLE linkedin_brand_guidelines
ADD COLUMN IF NOT EXISTS priority_profiles JSONB DEFAULT '[]';

-- Add comment to document the expected structure
COMMENT ON COLUMN linkedin_brand_guidelines.priority_profiles IS
'Array of VIP profiles with custom comment styling. Structure:
[
  {
    "profile_id": "linkedin_profile_id",
    "profile_url": "https://linkedin.com/in/username",
    "name": "John Doe",
    "relationship": "partner" | "client" | "friend" | "prospect" | "thought_leader",
    "tone_override": "warm and personal, like talking to a close colleague",
    "never_miss": true/false (if true, always prioritize their posts),
    "notes": "Any additional context for the AI"
  }
]';

-- Create an index for faster lookups when checking if an author is a VIP
-- Uses GIN index for JSONB containment queries
CREATE INDEX IF NOT EXISTS idx_brand_guidelines_priority_profiles
ON linkedin_brand_guidelines USING GIN (priority_profiles);

-- Add opportunity_digest_enabled for Feature 3 (while we're here)
ALTER TABLE linkedin_brand_guidelines
ADD COLUMN IF NOT EXISTS opportunity_digest_enabled BOOLEAN DEFAULT false;

ALTER TABLE linkedin_brand_guidelines
ADD COLUMN IF NOT EXISTS opportunity_digest_time VARCHAR(10) DEFAULT '07:00';

COMMENT ON COLUMN linkedin_brand_guidelines.opportunity_digest_enabled IS
'Enable daily digest of trending/opportunity posts to engage with';

COMMENT ON COLUMN linkedin_brand_guidelines.opportunity_digest_time IS
'Time to send opportunity digest (HH:MM format, in workspace timezone)';
