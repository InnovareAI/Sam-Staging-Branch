-- Voice Drop Foundation Schema
-- November 30, 2025
-- Minimal schema to support voice drops in campaigns
-- User records voice sample → Upload → 11Labs cloning → Generate personalized TTS

-- Add voice settings to linkedin_brand_guidelines (workspace-level defaults)
ALTER TABLE linkedin_brand_guidelines
ADD COLUMN IF NOT EXISTS voice_enabled BOOLEAN DEFAULT false;

ALTER TABLE linkedin_brand_guidelines
ADD COLUMN IF NOT EXISTS voice_gender VARCHAR(10) DEFAULT 'female';

ALTER TABLE linkedin_brand_guidelines
ADD COLUMN IF NOT EXISTS elevenlabs_voice_id TEXT;

-- Voice sample for user voice cloning
ALTER TABLE linkedin_brand_guidelines
ADD COLUMN IF NOT EXISTS voice_sample_url TEXT;

ALTER TABLE linkedin_brand_guidelines
ADD COLUMN IF NOT EXISTS voice_clone_status VARCHAR(20) DEFAULT 'none';

-- Add voice_message support to send_queue
ALTER TABLE send_queue
ADD COLUMN IF NOT EXISTS voice_message_url TEXT;

ALTER TABLE send_queue
ADD COLUMN IF NOT EXISTS message_type VARCHAR(50) DEFAULT 'text';

-- Add constraint for voice_gender
ALTER TABLE linkedin_brand_guidelines
DROP CONSTRAINT IF EXISTS check_voice_gender;

ALTER TABLE linkedin_brand_guidelines
ADD CONSTRAINT check_voice_gender
CHECK (voice_gender IN ('male', 'female'));

-- Add constraint for voice_clone_status
ALTER TABLE linkedin_brand_guidelines
DROP CONSTRAINT IF EXISTS check_voice_clone_status;

ALTER TABLE linkedin_brand_guidelines
ADD CONSTRAINT check_voice_clone_status
CHECK (voice_clone_status IN ('none', 'pending', 'processing', 'ready', 'failed'));

-- Add constraint for message_type (includes all valid types)
ALTER TABLE send_queue
DROP CONSTRAINT IF EXISTS check_message_type;

ALTER TABLE send_queue
ADD CONSTRAINT check_message_type
CHECK (message_type IN (
  'text', 'voice', 'attachment', 'voice_followup',
  'connection_request',
  'follow_up_1', 'follow_up_2', 'follow_up_3', 'follow_up_4', 'follow_up_5',
  'direct_message_1', 'direct_message_2', 'direct_message_3', 'direct_message_4', 'direct_message_5'
));

-- Comments
COMMENT ON COLUMN linkedin_brand_guidelines.voice_enabled IS 'Whether voice drops are enabled for this workspace';
COMMENT ON COLUMN linkedin_brand_guidelines.voice_gender IS 'Default voice gender for 11Labs TTS (male/female)';
COMMENT ON COLUMN linkedin_brand_guidelines.elevenlabs_voice_id IS '11Labs voice ID after cloning user voice sample';
COMMENT ON COLUMN linkedin_brand_guidelines.voice_sample_url IS 'URL to uploaded voice sample for 11Labs cloning';
COMMENT ON COLUMN linkedin_brand_guidelines.voice_clone_status IS 'Status of voice cloning: none, pending, processing, ready, failed';
COMMENT ON COLUMN send_queue.voice_message_url IS 'URL to .m4a voice file for LinkedIn voice drops';
COMMENT ON COLUMN send_queue.message_type IS 'Type of message: text, voice, attachment, connection_request, follow_up_N, direct_message_N';

-- Voice drop flow:
-- 1. User uploads voice sample (30+ seconds of their voice)
-- 2. voice_sample_url stored, voice_clone_status = 'pending'
-- 3. Backend calls 11Labs voice cloning API
-- 4. On success: elevenlabs_voice_id stored, voice_clone_status = 'ready'
-- 5. When sending voice drop: Generate .m4a via 11Labs TTS using cloned voice
-- 6. Upload .m4a, store URL in voice_message_url
-- 7. Send via Unipile /api/v1/chats with voice_message field
